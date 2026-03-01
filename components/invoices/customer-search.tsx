"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Customer {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
}

interface CustomerSearchProps {
  onSelect: (customer: Customer) => void;
  placeholder?: string;
}

export function CustomerSearch({
  onSelect,
  placeholder = "Search customers by name, email, or phone...",
}: CustomerSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length < 2) {
      // Use functional updates in the cleanup/guard path
      const clear = () => {
        setResults([]);
        setOpen(false);
      };
      clear();
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/users/search?q=${encodeURIComponent(query)}`
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data.data || []);
          setOpen(true);
        }
      } catch {
        // ignore
      }
      setLoading(false);
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        onFocus={() => results.length > 0 && setOpen(true)}
      />
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          Searching...
        </div>
      )}
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 shadow-md">
          {results.map((customer) => (
            <button
              key={customer.id}
              type="button"
              className={cn(
                "flex w-full flex-col items-start rounded-sm px-3 py-2 text-left text-sm",
                "hover:bg-accent hover:text-accent-foreground"
              )}
              onClick={() => {
                onSelect(customer);
                setQuery(customer.name || "");
                setOpen(false);
              }}
            >
              <span className="font-medium">{customer.name}</span>
              <span className="text-xs text-muted-foreground">
                {[customer.email, customer.phone].filter(Boolean).join(" • ")}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
