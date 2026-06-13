import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RoadSide GA - 24/7 Roadside Assistance Atlanta",
    short_name: "RoadSide GA",
    description:
      "24/7 emergency roadside assistance in Atlanta GA. Towing, jump starts, lockout service, tire changes, fuel delivery & car diagnostics.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf9f6",
    theme_color: "#dc2626",
    categories: ["auto", "utilities", "transportation"],
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
      {
        src: "/images/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/images/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
