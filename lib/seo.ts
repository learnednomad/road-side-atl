import { Metadata } from "next";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://roadsideatl.com";

export const SEO = {
  siteName: "RoadSide ATL",
  locale: "en_US",
  type: "website",
  twitterHandle: "@RoadSideATL",
  geoRegion: "US-GA",
  geoPlacename: "Atlanta, Georgia",
  geoPosition: "33.749;-84.388",
} as const;

export const KEYWORDS = {
  primary: [
    "roadside assistance Atlanta",
    "roadside assistance Atlanta GA",
    "24/7 roadside assistance Atlanta",
    "emergency roadside assistance Atlanta",
    "roadside assistance near me",
    "Atlanta roadside help",
  ],
  services: [
    "jump start Atlanta",
    "battery jump start Atlanta GA",
    "car battery jump start near me",
    "towing Atlanta",
    "tow truck Atlanta GA",
    "local towing Atlanta",
    "emergency towing near me",
    "lockout service Atlanta",
    "car lockout Atlanta GA",
    "locked out of car Atlanta",
    "flat tire change Atlanta",
    "flat tire help Atlanta GA",
    "tire change service near me",
    "fuel delivery Atlanta",
    "gas delivery Atlanta GA",
    "out of gas help near me",
    "car diagnostics Atlanta",
    "pre-purchase car inspection Atlanta",
    "OBD2 scan Atlanta GA",
    "used car inspection near me",
  ],
  local: [
    "roadside assistance Buckhead",
    "roadside assistance Midtown Atlanta",
    "roadside assistance Downtown Atlanta",
    "roadside assistance Decatur GA",
    "roadside assistance Marietta GA",
    "roadside assistance Sandy Springs GA",
    "roadside assistance Roswell GA",
    "roadside assistance Alpharetta GA",
    "roadside assistance Dunwoody GA",
    "roadside assistance Brookhaven GA",
    "towing I-285 Atlanta",
    "towing I-85 Atlanta",
    "towing I-75 Atlanta",
    "towing I-20 Atlanta",
  ],
  longTail: [
    "affordable roadside assistance Atlanta",
    "cheap towing service Atlanta",
    "fast roadside help Atlanta metro",
    "mobile mechanic Atlanta",
    "car won't start Atlanta help",
    "stranded on highway Atlanta",
    "emergency car help Atlanta GA",
    "roadside assistance ITP OTP Atlanta",
  ],
} as const;

export const ALL_KEYWORDS = [
  ...KEYWORDS.primary,
  ...KEYWORDS.services,
  ...KEYWORDS.local,
  ...KEYWORDS.longTail,
];

/** Build page-specific metadata with sensible SEO defaults */
export function buildMetadata(page: {
  title: string;
  description: string;
  path?: string;
  keywords?: string[];
  noindex?: boolean;
}): Metadata {
  const url = `${SITE_URL}${page.path || ""}`;
  return {
    title: page.title,
    description: page.description,
    keywords: page.keywords || ALL_KEYWORDS.slice(0, 20),
    alternates: { canonical: url },
    openGraph: {
      title: page.title,
      description: page.description,
      url,
      siteName: SEO.siteName,
      locale: SEO.locale,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.description,
      site: SEO.twitterHandle,
    },
    robots: page.noindex
      ? { index: false, follow: false }
      : { index: true, follow: true },
    other: {
      "geo.region": SEO.geoRegion,
      "geo.placename": SEO.geoPlacename,
      "geo.position": SEO.geoPosition,
      "ICBM": SEO.geoPosition,
    },
  };
}
