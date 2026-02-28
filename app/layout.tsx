import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { WebSocketWrapper } from "@/components/providers/websocket-wrapper";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { SITE_URL, SEO, ALL_KEYWORDS } from "@/lib/seo";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#DC2626",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default:
      "RoadSide ATL | 24/7 Roadside Assistance Atlanta GA - Towing, Jump Start, Lockout",
    template: "%s | RoadSide ATL - Atlanta Roadside Assistance",
  },
  description:
    "24/7 emergency roadside assistance in Atlanta GA. Fast towing, jump starts, lockout service, flat tire changes, fuel delivery & car diagnostics. Serving Buckhead, Midtown, Decatur, Marietta & all metro Atlanta. Call now!",
  keywords: ALL_KEYWORDS.slice(0, 30),
  authors: [{ name: "RoadSide ATL" }],
  creator: "RoadSide ATL",
  publisher: "RoadSide ATL",
  formatDetection: { telephone: true, email: true, address: true },
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: "website",
    locale: SEO.locale,
    url: SITE_URL,
    siteName: SEO.siteName,
    title: "RoadSide ATL | 24/7 Roadside Assistance Atlanta GA",
    description:
      "24/7 emergency roadside assistance in Atlanta. Fast towing, jump starts, lockout service, tire changes, fuel delivery & diagnostics. Serving all metro Atlanta.",
  },
  twitter: {
    card: "summary_large_image",
    site: SEO.twitterHandle,
    title: "RoadSide ATL | 24/7 Roadside Assistance Atlanta GA",
    description:
      "24/7 emergency roadside assistance in Atlanta. Fast towing, jump starts, lockout service, tire changes, fuel delivery & diagnostics.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  category: "Roadside Assistance",
  other: {
    "geo.region": SEO.geoRegion,
    "geo.placename": SEO.geoPlacename,
    "geo.position": SEO.geoPosition,
    ICBM: SEO.geoPosition,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none"
        >
          Skip to main content
        </a>
        <AuthSessionProvider>
          <WebSocketWrapper>{children}</WebSocketWrapper>
        </AuthSessionProvider>
        <Toaster />
      </body>
    </html>
  );
}
