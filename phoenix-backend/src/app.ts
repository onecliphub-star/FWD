import cors from "cors";
import express from "express";
import { getSettings } from "./config";
import { errorHandler, notFound } from "./lib/http";
import { authRouter } from "./routes/auth";
import { healthRouter } from "./routes/health";
import { projectsRouter } from "./routes/projects";
import { tasksRouter } from "./routes/tasks";
import { workspacesRouter } from "./routes/workspaces";

export function createApp() {
  const settings = getSettings();
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(cors({ origin: settings.corsOriginList, credentials: true }));

  // Body parsing must happen BEFORE the routers — "order matters in a
  // pipeline". Routers reading req.body with the parser mounted after them
  // always received undefined.
  app.use(express.json({ limit: "100kb" }));

  app.use(healthRouter);
  app.use(authRouter);
  app.use(workspacesRouter);
  app.use(projectsRouter);
  app.use(tasksRouter);

  app.all("*", notFound);
  app.use(errorHandler);
  return app;
}
