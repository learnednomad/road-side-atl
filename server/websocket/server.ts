import { WebSocketServer, type WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Socket } from "net";
import { addConnection, removeConnection } from "./connections";

let wss: WebSocketServer | null = null;

export function createWebSocketServer() {
  wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws: WebSocket) => {
    let userId: string | null = null;
    let role: string | null = null;

    // Wait for auth message
    const authTimeout = setTimeout(() => {
      if (!userId) ws.close(4001, "Auth timeout");
    }, 10_000);

    ws.on("message", (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === "auth" && msg.userId && msg.role) {
          userId = msg.userId;
          role = msg.role;
          clearTimeout(authTimeout);
          addConnection(userId!, role!, ws);
          ws.send(JSON.stringify({ type: "auth:success" }));
        }
      } catch {
        // ignore malformed messages
      }
    });

    ws.on("close", () => {
      clearTimeout(authTimeout);
      if (userId) {
        removeConnection(userId, ws);
      }
    });

    // Heartbeat
    const pingInterval = setInterval(() => {
      if (ws.readyState === 1) {
        ws.ping();
      } else {
        clearInterval(pingInterval);
      }
    }, 30_000);

    ws.on("close", () => clearInterval(pingInterval));
  });

  return wss;
}

export function handleUpgrade(req: IncomingMessage, socket: Socket, head: Buffer) {
  if (!wss) return;
  if (req.url !== "/ws") {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss!.emit("connection", ws, req);
  });
}

export function getWSS() {
  return wss;
}
