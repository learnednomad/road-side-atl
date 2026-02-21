import type { WebSocket } from "ws";
import type { WSEvent } from "./types";

interface ConnectionInfo {
  ws: WebSocket;
  role: string;
  userId: string;
}

const connections = new Map<string, Set<ConnectionInfo>>();

export function addConnection(userId: string, role: string, ws: WebSocket) {
  if (!connections.has(userId)) {
    connections.set(userId, new Set());
  }
  connections.get(userId)!.add({ ws, role, userId });
}

export function removeConnection(userId: string, ws: WebSocket) {
  const userConns = connections.get(userId);
  if (!userConns) return;
  for (const conn of userConns) {
    if (conn.ws === ws) {
      userConns.delete(conn);
      break;
    }
  }
  if (userConns.size === 0) {
    connections.delete(userId);
  }
}

function sendToConnection(conn: ConnectionInfo, event: WSEvent) {
  if (conn.ws.readyState === 1) {
    conn.ws.send(JSON.stringify(event));
  }
}

export function getAdminConnections(): ConnectionInfo[] {
  const admins: ConnectionInfo[] = [];
  for (const conns of connections.values()) {
    for (const conn of conns) {
      if (conn.role === "admin") admins.push(conn);
    }
  }
  return admins;
}

export function broadcastToAdmins(event: WSEvent) {
  getAdminConnections().forEach((conn) => sendToConnection(conn, event));
}

export function broadcastToProvider(providerId: string, event: WSEvent) {
  const conns = connections.get(providerId);
  if (conns) {
    conns.forEach((conn) => sendToConnection(conn, event));
  }
}

export function getConnectionCount(): number {
  let total = 0;
  for (const conns of connections.values()) {
    total += conns.size;
  }
  return total;
}

export function broadcastToUser(userId: string, event: WSEvent) {
  const conns = connections.get(userId);
  if (conns) {
    conns.forEach((conn) => sendToConnection(conn, event));
  }
}
