import { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { db } from "@/db";
import { users, bookings, payments } from "@/db/schema";
import { eq, desc, count, sql, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Customers | Admin | RoadSide ATL",
};

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function AdminCustomersPage() {
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
    .orderBy(desc(sql`count(${bookings.id})`));

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Customers</h1>

      <Card>
        <CardHeader>
          <CardTitle>
            {customers.length} Customer{customers.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No customers yet.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-center">Bookings</TableHead>
                    <TableHead className="text-right">Total Spent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map(({ user, bookingCount, totalSpent }) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.image || ""} />
                            <AvatarFallback>
                              {(user.name || user.email || "?")
                                .charAt(0)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">
                            {user.name || "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.email}
                      </TableCell>
                      <TableCell className="text-center">
                        {bookingCount}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatPrice(Number(totalSpent))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
