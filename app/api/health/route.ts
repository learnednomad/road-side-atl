import { db } from "@/db";
import { sql } from "drizzle-orm";

export async function GET() {
  const checks: Record<string, string> = {};

  try {
    await db.execute(sql`SELECT 1`);
    checks.database = "connected";
  } catch {
    checks.database = "disconnected";
    return Response.json(
      { status: "unhealthy", timestamp: new Date().toISOString(), checks },
      { status: 503 },
    );
  }

  return Response.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    checks,
  });
}
