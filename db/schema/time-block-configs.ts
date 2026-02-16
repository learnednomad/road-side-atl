import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createId } from "./utils";

export const timeBlockConfigs = pgTable("time_block_configs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  startHour: integer("startHour").notNull(), // 0-23
  endHour: integer("endHour").notNull(), // 0-23
  multiplier: integer("multiplier").notNull(), // basis points: 10000 = 1.0x
  isActive: boolean("isActive").default(true).notNull(),
  priority: integer("priority").default(1).notNull(), // higher = wins in overlap
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});
