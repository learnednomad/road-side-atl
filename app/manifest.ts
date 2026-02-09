import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RoadSide ATL - 24/7 Roadside Assistance Atlanta",
    short_name: "RoadSide ATL",
    description:
      "24/7 emergency roadside assistance in Atlanta GA. Towing, jump starts, lockout service, tire changes, fuel delivery & car diagnostics.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1a1a2e",
    categories: ["auto", "utilities", "transportation"],
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
