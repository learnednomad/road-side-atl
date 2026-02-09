import { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/provider/",
          "/my-bookings/",
          "/track/",
          "/login",
          "/register",
          "/book/confirmation",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
