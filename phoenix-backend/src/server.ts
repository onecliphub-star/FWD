import { createApp } from "./app";
import { getSettings } from "./config";
import { connectDb, disconnectDb } from "./db";

async function main() {
  const settings = getSettings(); // fail fast on bad configuration
  await connectDb(settings.MONGODB_URI);
  // B-23 fix: removed "127.0.0.1" hostname — server was only reachable on loopback.
  // Omitting hostname defaults to 0.0.0.0 (all interfaces), required for CI/containers.
  const server = createApp().listen(settings.PORT, () => {
    console.log(`phoenix-api ${settings.APP_VERSION} listening on :${settings.PORT}`);
  });

  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down`);
    server.close(() => void disconnectDb().then(() => process.exit(0)));
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
