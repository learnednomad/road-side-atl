import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { invoices, bookings } from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Printer } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import Link from "next/link";

export default async function MyInvoicesPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/my-invoices");
  }

  // Get customer's booking IDs
  const customerBookings = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(eq(bookings.userId, session.user.id));

  const bookingIds = customerBookings.map((b) => b.id);

  const customerInvoices =
    bookingIds.length > 0
      ? await db
          .select()
          .from(invoices)
          .where(inArray(invoices.bookingId, bookingIds))
          .orderBy(desc(invoices.createdAt))
      : [];

  const statusBadgeVariant = (status: string) => {
    switch (status) {
      case "paid": return "default" as const;
      case "issued": return "secondary" as const;
      case "void": return "destructive" as const;
      default: return "outline" as const;
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 py-12">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">My Invoices</h1>
          <p className="text-muted-foreground mt-2">
            View and download invoices for your completed services
          </p>
        </div>

        {customerInvoices.length === 0 ? (
          <div className="rounded-lg border bg-card p-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">No invoices yet</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Invoices are generated after your service is completed and payment is confirmed.
            </p>
            <Link href="/book">
              <Button>Book a Service</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {customerInvoices.map((inv) => (
              <div
                key={inv.id}
                className="rounded-lg border bg-card p-6 flex flex-col sm:flex-row sm:items-center gap-4"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium">{inv.invoiceNumber}</span>
                    <Badge variant={statusBadgeVariant(inv.status)}>
                      {inv.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {inv.lineItems.map((item) => item.description).join(", ")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {inv.issuedAt
                      ? `Issued ${new Date(inv.issuedAt).toLocaleDateString()}`
                      : `Created ${new Date(inv.createdAt).toLocaleDateString()}`}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-lg font-semibold">{formatPrice(inv.total)}</span>
                  <a
                    href={`/api/customer/invoices/${inv.id}/html`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" size="sm">
                      <Printer className="h-4 w-4 mr-2" />
                      View
                    </Button>
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
