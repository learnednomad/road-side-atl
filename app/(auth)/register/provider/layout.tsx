import type { Metadata } from "next";

// `absolute` bypasses the intermediate register/ layout title so the brand
// suffix is applied exactly once.
export const metadata: Metadata = { title: { absolute: "Become a Provider | RoadSide GA" } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
