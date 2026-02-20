"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { formatPrice } from "@/lib/utils";

interface Customer {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  bookingCount: number;
  totalSpent: number;
}

interface CustomersTableProps {
  customers: Customer[];
  total: number;
  page: number;
  totalPages: number;
}

export function CustomersTable({
  customers: initialCustomers,
  total: initialTotal,
  page: initialPage,
  totalPages: initialTotalPages,
}: CustomersTableProps) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchCustomers = useCallback(async () => {
    const params = new URLSearchParams();
    params.set("page", page.toString());
    params.set("limit", "20");
    if (searchDebounced) params.set("search", searchDebounced);

    const res = await fetch(`/api/admin/customers?${params}`);
    if (res.ok) {
      const data = await res.json();
      setCustomers(data.data);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    }
  }, [page, searchDebounced]);

  const [hasInteracted, setHasInteracted] = useState(false);
  useEffect(() => {
    if (hasInteracted) {
      fetchCustomers();
    }
  }, [fetchCustomers, hasInteracted]);

  function handleSearchChange(value: string) {
    setHasInteracted(true);
    setSearch(value);
    setPage(1);
  }

  function handlePageChange(newPage: number) {
    setHasInteracted(true);
    setPage(newPage);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            {total} Customer{total !== 1 ? "s" : ""}
          </CardTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name or email..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-64 pl-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {customers.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No customers found.
          </p>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="md:hidden space-y-3">
              {customers.map(({ user, bookingCount, totalSpent }) => (
                <Card key={user.id} className="py-4">
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.image || ""} />
                        <AvatarFallback>
                          {(user.name || user.email || "?")
                            .charAt(0)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/admin/bookings?search=${encodeURIComponent(user.name || user.email || "")}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {user.name || "\u2014"}
                        </Link>
                        <p className="truncate text-sm text-muted-foreground">
                          {user.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {bookingCount} booking{bookingCount !== 1 ? "s" : ""}
                      </span>
                      <span className="font-medium">
                        {formatPrice(Number(totalSpent))}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Desktop table view */}
            <div className="hidden md:block rounded-md border">
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
                          <Link
                            href={`/admin/bookings?search=${encodeURIComponent(user.name || user.email || "")}`}
                            className="text-sm font-medium hover:underline"
                          >
                            {user.name || "\u2014"}
                          </Link>
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

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
