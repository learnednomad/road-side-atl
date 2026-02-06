import { createServer, type IncomingMessage } from "http";
import type { Socket } from "net";
import { parse } from "url";
import next from "next";
import { createWebSocketServer, handleUpgrade } from "./server/websocket/server";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createWebSocketServer();

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  server.on("upgrade", (req: IncomingMessage, socket: Socket, head: Buffer) => {
    handleUpgrade(req, socket, head);
  });

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
