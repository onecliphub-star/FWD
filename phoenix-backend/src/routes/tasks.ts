import { Router } from "express";
import type { FilterQuery } from "mongoose";
import { getSettings } from "../config";
import { currentUser, getProjectForUser, requireUser } from "../lib/auth";
import { asyncHandler, escapeRegex, HttpError, isDuplicateKey, parseBody, parseId } from "../lib/http";
import { TaskIn, TaskQuery } from "../lib/schemas";
import { taskOut } from "../lib/serialize";
import { CreditLedger, Project, Task, Workspace, WorkspaceMember } from "../models";

export const tasksRouter = Router();

tasksRouter.get(
  "/api/projects/:projectId/tasks",
  requireUser,
  asyncHandler(async (req, res) => {
    const user = currentUser(res.locals);
    const projectId = parseId(req.params.projectId, "Project");
    // Membership gate for GETs too — a locked door in the UI must also be a
    // locked door in the API (outsiders must not read workspace tasks).
    await getProjectForUser(projectId, user);
    const query = parseBody(TaskQuery, req.query);

    const filter: FilterQuery<unknown> = { project: projectId };
    if (query.q) {
      // User input is text, not a spell — escape it before treating as regex.
      filter.title = new RegExp(escapeRegex(query.q), "i");
    }
    if (query.status) filter.status = query.status;

    const total = await Task.countDocuments(filter);
    const items = await Task.find(filter)
      // Secondary _id sort makes pagination deterministic when many tasks
      // tie on createdAt (the seed creates 25 identical timestamps).
      .sort({ createdAt: -1, _id: -1 })
      .skip((query.page - 1) * query.page_size)
      .limit(query.page_size)
      .lean();
    res.json({ items: items.map(taskOut), total, page: query.page, page_size: query.page_size });
  })
);

/** Creating a task costs credits. */
tasksRouter.post(
  "/api/projects/:projectId/tasks",
  requireUser,
  asyncHandler(async (req, res) => {
    const user = currentUser(res.locals);
    const projectId = parseId(req.params.projectId, "Project");
    const project = await getProjectForUser(projectId, user);
    const body = parseBody(TaskIn, req.body);

    // Node lowercases header names: "Idempotency-Key" → "idempotency-key".
    const raw = req.headers["idempotency-key"];
    const key = (Array.isArray(raw) ? raw[0] : raw) ?? null;
    const cost = getSettings().TASK_CREDIT_COST;

    // Repeated asks should cost once.
    if (key) {
      const previous = await CreditLedger.findOne({ workspace: project.workspace, idempotencyKey: key }).lean();
      if (previous?.task) {
        const task = await Task.findById(previous.task).lean();
        if (task) {
          res.status(200).json(taskOut(task));
          return;
        }
      }
    }

    // Validation BEFORE any credit is spent.
    if (body.assignee_id) {
      const isMember = await WorkspaceMember.exists({ workspace: project.workspace, user: body.assignee_id });
      if (!isMember) throw new HttpError(422, "Assignee is not a workspace member");
    }

    // Atomic guarded decrement — two people cannot spend the last coin at the
    // same time: one request wins, the other gets 402. Also fixes the old
    // pay-after-create flow that allowed credits to go below zero.
    const ws = await Workspace.findOneAndUpdate(
      { _id: project.workspace, credits: { $gte: cost } },
      { $inc: { credits: -cost } }
    ).lean();
    if (!ws) {
      throw new HttpError(402, "Not enough credits");
    }

    let task;
    try {
      task = await Task.create({
        project: projectId,
        title: body.title,
        status: body.status,
        createdBy: user._id,
        assignee: body.assignee_id,
      });
    } catch (err) {
      // Never charge for a task that failed to persist.
      await Workspace.updateOne({ _id: project.workspace }, { $inc: { credits: cost } });
      throw err;
    }

    try {
      await CreditLedger.create({
        workspace: project.workspace,
        delta: -cost,
        reason: `task ${String(task._id)}`,
        task: task._id,
        idempotencyKey: key ?? undefined,
      });
    } catch (err) {
      if (isDuplicateKey(err) && key) {
        // A concurrent request with the same key won this race — undo ours and
        // return its task instead.
        await Task.deleteOne({ _id: task._id });
        await Workspace.updateOne({ _id: project.workspace }, { $inc: { credits: cost } });
        const ledger = await CreditLedger.findOne({ workspace: project.workspace, idempotencyKey: key }).lean();
        if (ledger?.task) {
          const winningTask = await Task.findById(ledger.task).lean();
          if (winningTask) {
            res.status(200).json(taskOut(winningTask));
            return;
          }
        }
      }
      throw err;
    }

    res.status(201).json(taskOut(task));
  })
);
