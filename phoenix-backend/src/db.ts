import mongoose from "mongoose";
import { CreditLedger, Project, Task, User, Workspace, WorkspaceMember } from "./models";

mongoose.set("strictQuery", true);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ALL_MODELS: mongoose.Model<any>[] = [User, Workspace, WorkspaceMember, Project, Task, CreditLedger];

export async function connectDb(uri: string): Promise<void> {
  // A model can only speak through the connection it was born on: every model
  // above registers on mongoose's DEFAULT connection, so connectDb must drive
  // that same line. mongoose.createConnection() here opened a SECOND
  // connection the models never spoke through — queries buffered forever.
  if (mongoose.connection.readyState === 1) return; // reuse across warm serverless invocations
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  await mongoose.connect(uri);
  // Indexes are still built explicitly (declared by each schema), not lazily.
  await Promise.all(ALL_MODELS.map((m) => m.init()));
}

export async function disconnectDb(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

/** Truth for /api/health: did MongoDB actually answer just now? */
export async function pingDb(): Promise<boolean> {
  if (mongoose.connection.readyState !== 1) return false;
  const db = mongoose.connection.db;
  if (!db) return true;
  try {
    await db.command({ ping: 1 });
    return true;
  } catch {
    return mongoose.connection.readyState === 1;
  }
}
