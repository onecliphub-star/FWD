import type { Request, Response } from "express";
import { createApp } from "../src/app";
import { getSettings } from "../src/config";
import { connectDb } from "../src/db";

// B-21 fix: Serverless functions handle ONE request and return — they must NOT call app.listen().
// Previously called app.listen() inside the handler causing errors in Vercel's runtime.
let appInstance: ReturnType<typeof createApp> | null = null;

export default async function handler(req: Request, res: Response) {
  if (!appInstance) {
    await connectDb(getSettings().MONGODB_URI);
    appInstance = createApp();
  }
  return appInstance(req, res);
}
