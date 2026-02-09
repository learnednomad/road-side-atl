import { SITE_URL } from "@/lib/seo";
import { BUSINESS } from "@/lib/constants";

type JsonLdProps = { data: Record<string, unknown> };

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/** LocalBusiness schema - use on homepage and about page */
export function LocalBusinessJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "AutoRepair",
    "@id": `${SITE_URL}/#business`,
    name: BUSINESS.name,
    alternateName: "RoadSide ATL",
    description:
      "24/7 emergency roadside assistance in Atlanta GA. Towing, jump starts, lockout service, flat tire changes, fuel delivery, and pre-purchase car diagnostics.",
    url: SITE_URL,
    telephone: BUSINESS.phone,
    email: BUSINESS.email,
    areaServed: [
      {
        "@type": "City",
        name: "Atlanta",
        "@id": "https://www.wikidata.org/wiki/Q23556",
      },
      { "@type": "City", name: "Buckhead" },
      { "@type": "City", name: "Midtown Atlanta" },
      { "@type": "City", name: "Decatur" },
      { "@type": "City", name: "Marietta" },
      { "@type": "City", name: "Sandy Springs" },
      { "@type": "City", name: "Roswell" },
      { "@type": "City", name: "Alpharetta" },
      { "@type": "City", name: "Dunwoody" },
      { "@type": "City", name: "Brookhaven" },
      {
        "@type": "State",
        name: "Georgia",
        "@id": "https://www.wikidata.org/wiki/Q1428",
      },
    ],
    geo: {
      "@type": "GeoCoordinates",
      latitude: 33.749,
      longitude: -84.388,
    },
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      opens: "00:00",
      closes: "23:59",
    },
    priceRange: "$$",
    paymentAccepted: ["Cash", "CashApp", "Zelle", "Credit Card"],
    currenciesAccepted: "USD",
    serviceType: [
      "Roadside Assistance",
      "Towing Service",
      "Jump Start Service",
      "Lockout Service",
      "Flat Tire Change",
      "Fuel Delivery",
      "Vehicle Diagnostics",
      "Pre-Purchase Car Inspection",
    ],
    knowsAbout: [
      "Roadside Assistance",
      "Emergency Towing",
      "Vehicle Diagnostics",
      "OBD2 Scanning",
    ],
    slogan: BUSINESS.tagline,
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Roadside Assistance Services",
      itemListElement: [
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Jump Start",
            description:
              "Dead battery? We'll get you running again with a professional jump start service in Atlanta.",
          },
          price: "75.00",
          priceCurrency: "USD",
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Towing (Local)",
            description:
              "Local towing within the Atlanta metro area. Base rate includes first 10 miles.",
          },
          price: "125.00",
          priceCurrency: "USD",
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Lockout Service",
            description:
              "Locked out of your car in Atlanta? Our technicians will safely get you back in.",
          },
          price: "75.00",
          priceCurrency: "USD",
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Flat Tire Change",
            description:
              "We'll swap your flat for your spare tire and get you back on the road in Atlanta.",
          },
          price: "100.00",
          priceCurrency: "USD",
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Fuel Delivery",
            description:
              "Ran out of gas in Atlanta? We'll bring enough fuel to get you to the nearest station.",
          },
          price: "75.00",
          priceCurrency: "USD",
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Car Purchase Diagnostics",
            description:
              "Comprehensive pre-purchase vehicle inspection with OBD2 scan and mechanical grade assessment in Atlanta.",
          },
          price: "250.00",
          priceCurrency: "USD",
        },
      ],
    },
    sameAs: [
      // Add your social media URLs here:
      // "https://www.facebook.com/RoadSideATL",
      // "https://www.instagram.com/roadsideatl",
      // "https://twitter.com/RoadSideATL",
    ],
  };
  return <JsonLd data={data} />;
}

/** Service schema for individual service offerings */
export function ServiceJsonLd({
  name,
  description,
  price,
}: {
  name: string;
  description: string;
  price: string;
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Service",
    name,
    description,
    provider: {
      "@type": "AutoRepair",
      name: BUSINESS.name,
      url: SITE_URL,
      telephone: BUSINESS.phone,
    },
    areaServed: {
      "@type": "City",
      name: "Atlanta",
    },
    offers: {
      "@type": "Offer",
      price,
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
  };
  return <JsonLd data={data} />;
}

/** FAQ schema for FAQ sections - directly boosts SERP visibility */
export function FAQJsonLd({
  faqs,
}: {
  faqs: { question: string; answer: string }[];
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
  return <JsonLd data={data} />;
}

/** BreadcrumbList schema for navigation */
export function BreadcrumbJsonLd({
  items,
}: {
  items: { name: string; url: string }[];
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
  return <JsonLd data={data} />;
}

/** WebSite schema with search action - enables site search in SERPs */
export function WebSiteJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: BUSINESS.name,
    url: SITE_URL,
    description:
      "24/7 emergency roadside assistance in Atlanta GA. Towing, jump starts, lockout service, tire changes, fuel delivery & car diagnostics.",
    publisher: {
      "@type": "Organization",
      name: BUSINESS.name,
      url: SITE_URL,
    },
  };
  return <JsonLd data={data} />;
}
