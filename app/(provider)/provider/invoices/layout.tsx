import type { Metadata } from "next";

// Plain-string title — the (provider) group layout template appends "| Provider | RoadSide GA".
export const metadata: Metadata = { title: "Invoices" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
