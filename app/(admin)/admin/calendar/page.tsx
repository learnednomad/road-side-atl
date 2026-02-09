import { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db";
import { bookings, services } from "@/db/schema";
import { eq, gte, lte, desc, and, ne } from "drizzle-orm";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from "date-fns";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Calendar | Admin | RoadSide ATL",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  dispatched: "bg-purple-100 text-purple-800",
  in_progress: "bg-orange-100 text-orange-800",
  completed: "bg-green-100 text-green-800",
};

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const viewDate = params.month ? new Date(params.month + "-01") : now;
  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const prevMonth = format(subMonths(viewDate, 1), "yyyy-MM");
  const nextMonth = format(addMonths(viewDate, 1), "yyyy-MM");

  const monthBookings = await db
    .select({ booking: bookings, service: services })
    .from(bookings)
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .where(
      and(
        ne(bookings.status, "cancelled"),
        gte(bookings.createdAt, monthStart),
        lte(bookings.createdAt, monthEnd)
      )
    )
    .orderBy(desc(bookings.createdAt));

  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Calendar — {format(viewDate, "MMMM yyyy")}</h1>
        <div className="flex gap-2">
          <Link
            href={`/admin/calendar?month=${prevMonth}`}
            className="inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
          >
            &larr; Prev
          </Link>
          <Link
            href="/admin/calendar"
            className="inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
          >
            Today
          </Link>
          <Link
            href={`/admin/calendar?month=${nextMonth}`}
            className="inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
          >
            Next &rarr;
          </Link>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-7">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div
            key={d}
            className="hidden p-2 text-center text-sm font-medium text-muted-foreground sm:block"
          >
            {d}
          </div>
        ))}

        {/* Offset for first day of month */}
        {Array.from({ length: monthStart.getDay() }).map((_, i) => (
          <div key={`empty-${i}`} className="hidden sm:block" />
        ))}

        {days.map((day) => {
          const dayBookings = monthBookings.filter(({ booking }) => {
            const date = booking.scheduledAt || booking.createdAt;
            return isSameDay(date, day);
          });

          return (
            <Card
              key={day.toISOString()}
              className={`min-h-[80px] ${
                isSameDay(day, now) ? "border-primary" : ""
              }`}
            >
              <CardContent className="p-2">
                <p
                  className={`text-sm font-medium ${
                    isSameDay(day, now)
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  {format(day, "d")}
                </p>
                {dayBookings.map(({ booking, service }) => (
                  <Link
                    key={booking.id}
                    href={`/admin/bookings/${booking.id}`}
                    className={`mt-1 block truncate rounded px-1 py-0.5 text-xs hover:opacity-80 ${
                      statusColors[booking.status] || ""
                    }`}
                    title={`${service.name} — ${booking.contactName}`}
                  >
                    {service.name}
                  </Link>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* List view for mobile */}
      <Card className="sm:hidden">
        <CardHeader>
          <CardTitle>This Month&apos;s Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          {monthBookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No bookings this month.
            </p>
          ) : (
            <div className="space-y-2">
              {monthBookings.map(({ booking, service }) => (
                <Link
                  key={booking.id}
                  href={`/admin/bookings/${booking.id}`}
                  className="flex items-center justify-between rounded-lg border p-2 transition-colors hover:bg-muted/50"
                >
                  <div>
                    <p className="text-sm font-medium">{service.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {booking.contactName} &middot;{" "}
                      {format(
                        booking.scheduledAt || booking.createdAt,
                        "MMM d, h:mm a"
                      )}
                    </p>
                  </div>
                  <Badge
                    className={statusColors[booking.status] || ""}
                    variant="outline"
                  >
                    {booking.status}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
