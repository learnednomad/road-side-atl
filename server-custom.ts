import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { startCronJobs, stopCronJobs } from "./server/cron";
import { logger } from "./lib/logger";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  startCronJobs();

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  // Graceful shutdown
  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`[Shutdown] ${signal} received, starting graceful shutdown...`);

    // 1. Stop accepting new connections
    server.close(() => {
      logger.info("[Shutdown] HTTP server closed");
    });

    // 2. Stop cron jobs
    stopCronJobs();

    // 3. Force exit after 30s if graceful shutdown stalls
    setTimeout(() => {
      logger.warn("[Shutdown] Forcing exit after timeout");
      process.exit(1);
    }, 30_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
