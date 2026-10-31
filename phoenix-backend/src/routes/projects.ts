import { Router } from "express";
import { currentUser, getProjectForUser, requireMember, requireUser } from "../lib/auth";
import { cacheDelete, cacheGet, cacheSet, projectListKey } from "../lib/cache";
import { asyncHandler, parseBody, parseId } from "../lib/http";
import { ProjectIn } from "../lib/schemas";
import { projectOut } from "../lib/serialize";
import { Project } from "../models";

export const projectsRouter = Router();

projectsRouter.get(
  "/api/workspaces/:workspaceId/projects",
  requireUser,
  asyncHandler(async (req, res) => {
    const user = currentUser(res.locals);
    const id = parseId(req.params.workspaceId, "Workspace");
    // Authorization BEFORE cache — a cache that answers before asking whose
    // data it may serve is a leak.
    await requireMember(id, user);
    const key = projectListKey(String(id));
    const cached = cacheGet(key);
    if (cached !== undefined) {
      res.json(cached);
      return;
    }
    const projects = await Project.find({ workspace: id }).sort({ _id: 1 }).lean();
    const result = projects.map(projectOut);
    cacheSet(key, result);
    res.json(result);
  })
);

projectsRouter.post(
  "/api/workspaces/:workspaceId/projects",
  requireUser,
  asyncHandler(async (req, res) => {
    const user = currentUser(res.locals);
    const id = parseId(req.params.workspaceId, "Workspace");
    await requireMember(id, user);
    const body = parseBody(ProjectIn, req.body);
    const key = projectListKey(req.params.workspaceId);
    const project = await Project.create({ workspace: id, name: body.name, description: body.description });
    // Invalidate with the same key shape the reader used — the old literal
    // `projects:<id>:list` never matched, so cached lists went stale for 30s.
    cacheDelete(key);
    res.status(201).json(projectOut(project));
  })
);

projectsRouter.get("/api/projects/:projectId", requireUser, asyncHandler(async (req, res) => {
  const user = currentUser(res.locals);
  // Parse the id properly — the old `as never` cast skipped validation and
  // was exactly the kind of compiler-silencing the rules forbid.
  const projectId = parseId(req.params.projectId, "Project");
  const project = await getProjectForUser(projectId, user);
  res.json(projectOut(project));
}));
