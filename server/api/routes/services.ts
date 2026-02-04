import { Hono } from "hono";
import { db } from "@/db";
import { services } from "@/db/schema";
import { eq } from "drizzle-orm";

const app = new Hono();

app.get("/", async (c) => {
  const allServices = await db
    .select()
    .from(services)
    .where(eq(services.active, true))
    .orderBy(services.name);

  return c.json(allServices);
});

export default app;
