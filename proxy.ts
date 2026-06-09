import NextAuth from "next-auth";
import authConfig from "@/lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

function getRoleHome(role?: string): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "provider":
      return "/provider";
    default:
      return "/";
  }
}

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const role = req.auth?.user?.role;

  // Redirect logged-in users away from auth pages to their role portal
  if (pathname.startsWith("/login") || pathname.startsWith("/register")) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL(getRoleHome(role), req.url));
    }
    return NextResponse.next();
  }

  // /dashboard is the customer portal. Admins/providers have their own portals,
  // so bounce them to their role home (also catches OAuth callbacks landing here);
  // customers fall through and reach the dashboard.
  if (pathname.startsWith("/dashboard")) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    if (role === "admin" || role === "provider") {
      return NextResponse.redirect(new URL(getRoleHome(role), req.url));
    }
  }

  if (pathname.startsWith("/admin")) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    if (role !== "admin") {
      return NextResponse.redirect(new URL(getRoleHome(role), req.url));
    }
  }

  if (pathname.startsWith("/provider")) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    if (role !== "provider") {
      return NextResponse.redirect(new URL(getRoleHome(role), req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/provider/:path*", "/login", "/register"],
};
