import { Metadata } from "next";
import { CustomersTable } from "@/components/admin/customers-table";
import { db } from "@/db";
import { users, bookings, payments } from "@/db/schema";
import { eq, desc, count, sql, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Customers | Admin | RoadSide ATL",
};

const PAGE_SIZE = 20;

export default async function AdminCustomersPage() {
  const [totalResult] = await db
    .select({ count: count() })
    .from(users)
    .where(eq(users.role, "customer"));

  const customers = await db
    .select({
      user: users,
      bookingCount: count(bookings.id),
      totalSpent: sql<number>`coalesce(sum(${payments.amount}), 0)`,
    })
    .from(users)
    .leftJoin(bookings, eq(users.id, bookings.userId))
    .leftJoin(
      payments,
      and(eq(payments.bookingId, bookings.id), eq(payments.status, "confirmed"))
    )
    .where(eq(users.role, "customer"))
    .groupBy(users.id)
    .orderBy(desc(sql`count(${bookings.id})`))
    .limit(PAGE_SIZE);

  const total = totalResult.count;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Customers</h1>
      <CustomersTable
        customers={customers}
        total={total}
        page={1}
        totalPages={totalPages}
      />
    </div>
  );
}
