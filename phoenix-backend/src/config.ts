import "dotenv/config";
import { z } from "zod";

// "Three people, three names for the same database."
// Harmonize MONGODB_URI, MONGO_URL, and MONGO_URI so any caller or environment variable works.
const resolvedMongoUri =
  process.env.MONGODB_URI || process.env.MONGO_URL || process.env.MONGO_URI || "";
if (!process.env.MONGODB_URI && resolvedMongoUri) {
  process.env.MONGODB_URI = resolvedMongoUri;
}

const EnvSchema = z.object({
  MONGODB_URI: z.string().regex(/^mongodb(\+srv)?:\/\//, "must start with mongodb:// or mongodb+srv://"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_ALGORITHM: z.enum(["HS256", "HS384", "HS512"]).default("HS256"),
  JWT_EXPIRE_MINUTES: z.coerce.number().int().positive().default(120),
  // B-03: CORS_ORIGINS is a comma-separated list, NOT JSON — JSON.parse of a plain URL crashes
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  TASK_CREDIT_COST: z.coerce.number().int().positive().default(1),
  WELCOME_CREDITS: z.coerce.number().int().nonnegative().default(3),
  APP_VERSION: z.string().default("dev"),
  PORT: z.coerce.number().int().default(8000),
});

export type Settings = z.infer<typeof EnvSchema> & {
  corsOriginList: string[];
  MONGO_URL: string;
};

let cached: Settings | null = null;

export function getSettings(): Settings {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${problems.join("\n")}`);
  }
  cached = {
    ...parsed.data,
    // B-03: Split comma-separated origins instead of JSON.parse
    corsOriginList: parsed.data.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean),
    MONGO_URL: parsed.data.MONGODB_URI,
  };
  return cached;
}
