import { z } from "zod";
import { ROLES, TASK_STATUSES } from "../models";

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "must be an id");

export const RegisterIn = z.object({
  email: text(3, 255).regex(/^[^@\s]+@[^@\s]+$/, "invalid email"),
  full_name: text(1, 120),
  password: z.string().min(8).max(128),
});

export const LoginIn = z.object({ email: text(1, 255), password: z.string().min(1) });

export const WorkspaceIn = z.object({ name: text(1, 120) });

export const MemberIn = z.object({
  email: text(3, 255),
  role: z.enum(ROLES).default("member"),
});

export const TopUpIn = z.object({ amount: z.coerce.number().int().positive().max(1000) });

export const ProjectIn = z.object({
  name: text(1, 120),
  description: z.string().trim().max(2000).default(""),
});

export const TaskIn = z.object({
  title: z.string().trim().min(1).max(200),
  status: z.enum(TASK_STATUSES).default("todo"),
  assignee_id: z.union([objectId, z.literal(""), z.null()]).optional().transform((v) => (v ? v : null)),
});

export const TaskQuery = z.object({
  q: z.string().max(100).optional().transform((v) => v?.trim() || undefined),
  status: z.union([z.enum(TASK_STATUSES), z.literal("")]).optional().transform((v) => v || undefined),
  page: z.coerce.number().int().min(0).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(10),
});
