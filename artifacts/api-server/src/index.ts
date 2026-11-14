import app from "./app";
import { logger } from "./lib/logger";
import { createServer } from "node:http";
import { startRealtime } from "./game/realtime";
import { seedGameContent } from "./game/content";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

await seedGameContent();
const server = createServer(app);
const io = startRealtime(server);
server.listen(port, "0.0.0.0", () => logger.info({ port }, "Mission control listening"));
function shutdown() {
  io.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
