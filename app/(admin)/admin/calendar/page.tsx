import { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db";
import { bookings, services } from "@/db/schema";
import { eq, gte, desc, and, ne } from "drizzle-orm";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";

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

export default async function AdminCalendarPage() {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const monthBookings = await db
    .select({ booking: bookings, service: services })
    .from(bookings)
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .where(
      and(
        ne(bookings.status, "cancelled"),
        gte(bookings.createdAt, monthStart)
      )
    )
    .orderBy(desc(bookings.createdAt));

  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Calendar — {format(now, "MMMM yyyy")}</h1>

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
                  <div
                    key={booking.id}
                    className={`mt-1 rounded px-1 py-0.5 text-xs ${
                      statusColors[booking.status] || ""
                    }`}
                  >
                    {service.name.slice(0, 12)}
                  </div>
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
                <div
                  key={booking.id}
                  className="flex items-center justify-between rounded-lg border p-2"
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
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
