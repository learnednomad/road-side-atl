# RoadSide ATL - SEO Strategy & Implementation Guide

## Table of Contents

1. [What Was Implemented](#1-what-was-implemented)
2. [File-by-File Changes](#2-file-by-file-changes)
3. [Keyword Strategy](#3-keyword-strategy)
4. [Structured Data (JSON-LD)](#4-structured-data-json-ld)
5. [Immediate Action Items](#5-immediate-action-items)
6. [Google Business Profile Setup](#6-google-business-profile-setup)
7. [Directory Citations](#7-directory-citations)
8. [Content Strategy & Blog Plan](#8-content-strategy--blog-plan)
9. [Location Pages Expansion](#9-location-pages-expansion)
10. [Review Generation Strategy](#10-review-generation-strategy)
11. [Technical SEO Checklist](#11-technical-seo-checklist)
12. [Performance Targets](#12-performance-targets)
13. [Monthly SEO Maintenance](#13-monthly-seo-maintenance)
14. [Tracking & Measurement](#14-tracking--measurement)

---

## 1. What Was Implemented

### Before (Zero SEO)
- Basic title and description on root layout only
- No Open Graph or Twitter Cards
- No structured data (JSON-LD)
- No sitemap.xml
- No robots.txt
- No web manifest
- No keywords meta tags
- No canonical URLs
- No geo-meta tags
- No FAQ content or schema
- No semantic HTML attributes
- Generic headings (e.g., "Our Services")
- Footer with minimal links
- No internal linking strategy

### After (Comprehensive On-Page SEO)
- Full metadata system with `buildMetadata()` helper and title template
- Open Graph + Twitter Cards on every public page
- 4 JSON-LD schemas on homepage (LocalBusiness, WebSite, FAQPage, BreadcrumbList)
- Dynamic XML sitemap (`/sitemap.xml`)
- Robots.txt blocking 8 private routes
- PWA web manifest
- 60+ targeted keywords across primary, service, local, and long-tail categories
- Canonical URLs on every page
- Geo-meta tags (geo.region, geo.placename, geo.position, ICBM)
- 6-question FAQ section with FAQPage schema (eligible for Google rich results)
- Semantic HTML (`aria-labelledby`, `role="contentinfo"`, `<address>`, `sr-only` text)
- Keyword-rich headings targeting "roadside assistance Atlanta"
- 4-column footer with individual service deep links
- Internal linking from footer to service sections via anchor IDs

---

## 2. File-by-File Changes

### New Files Created

| File | Purpose |
|------|---------|
| `lib/seo.ts` | SEO constants, 60+ keywords organized by category, `buildMetadata()` helper function, site URL config, geo-coordinates |
| `components/seo/json-ld.tsx` | 5 reusable JSON-LD schema components: `LocalBusinessJsonLd`, `ServiceJsonLd`, `FAQJsonLd`, `BreadcrumbJsonLd`, `WebSiteJsonLd` |
| `app/sitemap.ts` | Dynamic XML sitemap with all public pages and service anchor links |
| `app/robots.ts` | Robots.txt disallowing `/api/`, `/admin/`, `/provider/`, `/my-bookings/`, `/track/`, `/login`, `/register`, `/book/confirmation` |
| `app/manifest.ts` | PWA web manifest with app name, theme color, categories |

### Updated Files

| File | What Changed |
|------|-------------|
| `app/layout.tsx` | Added: `metadataBase`, title template system (`%s | RoadSide ATL`), Open Graph, Twitter Cards, 30 keywords, GoogleBot directives (`max-image-preview: large`, `max-snippet: -1`), geo-meta tags, `formatDetection`, viewport `themeColor`, `category` |
| `app/(marketing)/page.tsx` | Added: `buildMetadata()` with 10 primary keywords, `LocalBusinessJsonLd`, `WebSiteJsonLd`, `FAQJsonLd` (6 Q&As), `BreadcrumbJsonLd`, FAQ accordion section, keyword-rich headings, expanded service area text mentioning 10 neighborhoods + 4 interstates, `aria-labelledby` on all sections |
| `app/(marketing)/services/page.tsx` | Added: `buildMetadata()` with 12 service keywords, `BreadcrumbJsonLd`, keyword-rich H1 ("Roadside Assistance & Vehicle Diagnostic Services in Atlanta"), anchor IDs on section headings |
| `app/(marketing)/about/page.tsx` | Added: `buildMetadata()` with 6 brand keywords, `LocalBusinessJsonLd`, `BreadcrumbJsonLd`, keyword-enriched H1 and content, location mentions (I-285, Buckhead, Midtown) |
| `app/(marketing)/book/page.tsx` | Added: `buildMetadata()` with 6 booking-intent keywords, SEO heading ("Book Roadside Assistance in Atlanta") |
| `components/marketing/hero.tsx` | Changed H1 from "{BUSINESS.tagline}" to "24/7 Roadside Assistance in Atlanta, GA", expanded subtitle with service list, added `aria-label` on call button |
| `components/marketing/footer.tsx` | Expanded from 3 columns to 4: added "Our Services" column with 6 deep links to service sections, wrapped contact in `<address>` tag, added keyword-rich tagline footer line listing 8 Atlanta neighborhoods, `aria-hidden` on icons, email link |
| `components/marketing/service-card.tsx` | Added `id={slug}` for deep linking from footer/sitemap, `sr-only` "in Atlanta" text, `aria-label` on Book Now links, `aria-hidden` on icons |

---

## 3. Keyword Strategy

### Primary Keywords (Target in titles, H1s, meta descriptions)
```
roadside assistance Atlanta
roadside assistance Atlanta GA
24/7 roadside assistance Atlanta
emergency roadside assistance Atlanta
roadside assistance near me
Atlanta roadside help
```

### Service Keywords (Target on service page and homepage)
```
jump start Atlanta               towing Atlanta
battery jump start Atlanta GA    tow truck Atlanta GA
car battery jump start near me   local towing Atlanta
lockout service Atlanta          emergency towing near me
car lockout Atlanta GA           flat tire change Atlanta
locked out of car Atlanta        fuel delivery Atlanta
car diagnostics Atlanta          pre-purchase car inspection Atlanta
OBD2 scan Atlanta GA             used car inspection near me
```

### Local Keywords (Target across all pages, footer, service area section)
```
roadside assistance Buckhead          roadside assistance Midtown Atlanta
roadside assistance Downtown Atlanta  roadside assistance Decatur GA
roadside assistance Marietta GA       roadside assistance Sandy Springs GA
roadside assistance Roswell GA        roadside assistance Alpharetta GA
roadside assistance Dunwoody GA       roadside assistance Brookhaven GA
towing I-285 Atlanta                  towing I-85 Atlanta
towing I-75 Atlanta                   towing I-20 Atlanta
```

### Long-Tail Keywords (Target in FAQ, blog content)
```
affordable roadside assistance Atlanta
cheap towing service Atlanta
fast roadside help Atlanta metro
car won't start Atlanta help
stranded on highway Atlanta
emergency car help Atlanta GA
roadside assistance ITP OTP Atlanta
how much does roadside assistance cost in Atlanta
```

---

## 4. Structured Data (JSON-LD)

### What's Live on the Homepage

**LocalBusiness (AutoRepair type)**
- Business name, phone, email
- 10 cities in `areaServed` (Atlanta, Buckhead, Midtown, Decatur, Marietta, Sandy Springs, Roswell, Alpharetta, Dunwoody, Brookhaven)
- 24/7 opening hours
- 6 service offerings with prices in `hasOfferCatalog`
- Payment methods accepted
- Geo-coordinates (33.749, -84.388)

**FAQPage**
- 6 questions targeting high-intent searches:
  1. "How fast can you get to me in Atlanta?"
  2. "What areas do you serve in Atlanta?"
  3. "What payment methods do you accept?"
  4. "How much does roadside assistance cost in Atlanta?"
  5. "Do you offer 24/7 emergency roadside assistance?"
  6. "What roadside services do you offer in Atlanta?"

**WebSite**
- Site name, URL, description, publisher

**BreadcrumbList**
- Navigation path for each page

### How to Validate
1. Go to [Google Rich Results Test](https://search.google.com/test/rich-results)
2. Enter your URL
3. Verify FAQPage, LocalBusiness, BreadcrumbList are detected
4. Fix any warnings

---

## 5. Immediate Action Items

### Must Do Before Launch (Priority Order)

- [ ] **Set `NEXT_PUBLIC_SITE_URL` environment variable** to your actual domain (e.g., `https://roadsideatl.com`). Currently defaults to `https://roadsideatl.com` in `lib/seo.ts`.

- [ ] **Set up Google Search Console**
  1. Go to https://search.google.com/search-console
  2. Add your domain
  3. Verify ownership (DNS TXT record or HTML file)
  4. Submit sitemap: `https://yourdomain.com/sitemap.xml`
  5. Add your verification code to `app/layout.tsx`:
     ```typescript
     verification: {
       google: "your-verification-code-here",
     },
     ```

- [ ] **Set up Google Analytics / GA4**
  1. Create GA4 property at https://analytics.google.com
  2. Add tracking script using `next/script`:
     ```tsx
     // app/layout.tsx - add inside <body> before closing tag
     import Script from "next/script";

     <Script
       src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXX"
       strategy="afterInteractive"
     />
     <Script id="gtag-init" strategy="afterInteractive">
       {`
         window.dataLayer = window.dataLayer || [];
         function gtag(){dataLayer.push(arguments);}
         gtag('js', new Date());
         gtag('config', 'G-XXXXXXX');
       `}
     </Script>
     ```

- [ ] **Create OG images** (social sharing previews)
  - Create a 1200x630px image for homepage with your logo, tagline, and phone number
  - Save to `public/images/og-homepage.jpg`
  - Add to metadata in `app/layout.tsx`:
    ```typescript
    openGraph: {
      // ... existing fields
      images: [{
        url: "/images/og-homepage.jpg",
        width: 1200,
        height: 630,
        alt: "RoadSide ATL - 24/7 Roadside Assistance Atlanta",
      }],
    },
    ```

- [ ] **Update phone number** in `lib/constants.ts` — currently `(404) 555-0199` (placeholder)

- [ ] **Add social media URLs** to `components/seo/json-ld.tsx` in the `sameAs` array:
  ```typescript
  sameAs: [
    "https://www.facebook.com/YourPage",
    "https://www.instagram.com/yourhandle",
    "https://twitter.com/yourhandle",
  ],
  ```

---

## 6. Google Business Profile Setup

### Step-by-Step Setup

1. Go to https://business.google.com
2. Click "Manage now" and sign in with Google account
3. Search for "RoadSide ATL" or click "Add your business"

### Profile Configuration

| Field | Value |
|-------|-------|
| **Business Name** | RoadSide ATL |
| **Primary Category** | Towing Service |
| **Secondary Categories** | Roadside Assistance, Auto Wrecker Service, Vehicle Lockout Service |
| **Business Type** | Service Area Business (hide address) |
| **Phone** | Your actual business phone |
| **Website** | https://roadsideatl.com |
| **Hours** | Open 24 hours, 7 days a week |

### Service Areas to Add
Atlanta, Buckhead, Midtown, Downtown Atlanta, Decatur, Marietta, Sandy Springs, Roswell, Alpharetta, Dunwoody, Brookhaven, Smyrna, Johns Creek, Vinings, Stone Mountain, College Park, East Point

### GBP Description (750 characters max)
```
RoadSide ATL provides fast 24/7 emergency roadside assistance and towing across the
Atlanta metro area. Services include jump starts, local towing, car lockout help,
flat tire changes, fuel delivery, and comprehensive pre-purchase vehicle diagnostics
with OBD2 scanning. We serve both Inside the Perimeter (ITP) and Outside the Perimeter
(OTP) — Buckhead, Midtown, Decatur, Marietta, Sandy Springs, and all surrounding
communities. No membership required. Pay with Cash, CashApp, Zelle, or card. Book
online or call for immediate help!
```

### Services to List in GBP
| Service | Price |
|---------|-------|
| Jump Start / Battery Service | $75 |
| Towing (Local) | Starting at $125 |
| Car Lockout Service | $75 |
| Flat Tire Change | $100 |
| Fuel Delivery | $75 |
| Pre-Purchase Car Diagnostics | $250 |

### Photos to Upload (20+ recommended)
- Branded tow truck(s) — multiple angles
- Team members in uniform/action
- Jump start in progress
- Lockout service in progress
- Tire change in progress
- Before/after job photos
- Branded vehicle wraps
- Night service photos (shows 24/7 capability)
- Photos at recognizable Atlanta locations (Buckhead, Midtown)

### Weekly Posting Schedule
| Week | Post Type | Example |
|------|-----------|---------|
| Week 1 | Promotion | "$10 off all Atlanta towing this week! Call now." |
| Week 2 | Service Highlight | "Did you know we offer pre-purchase car diagnostics? Get an OBD2 scan before you buy." |
| Week 3 | Local Alert | "Heavy traffic on I-285 today. Stranded? Call RoadSide ATL for fast help!" |
| Week 4 | Tips/Education | "5 signs your car battery is dying — don't get stranded!" |

---

## 7. Directory Citations

### Priority 1 — Set Up Immediately (Top 15)
These have the strongest impact on local rankings. Use **exactly the same** business name, phone, and address format on every listing.

| # | Directory | URL | Notes |
|---|-----------|-----|-------|
| 1 | Google Business Profile | business.google.com | Most important |
| 2 | Apple Maps | mapsconnect.apple.com | For iPhone users |
| 3 | Bing Places | bingplaces.com | Microsoft/Bing search |
| 4 | Facebook Business | facebook.com/business | Social + local |
| 5 | Yelp | biz.yelp.com | High authority |
| 6 | Yellow Pages | yellowpages.com | Legacy authority |
| 7 | BBB | bbb.org | Trust signal |
| 8 | Angi (Angie's List) | angi.com | Home services |
| 9 | Thumbtack | thumbtack.com | Service marketplace |
| 10 | Nextdoor | business.nextdoor.com | Hyper-local |
| 11 | Foursquare | foursquare.com | Data feeds many apps |
| 12 | Towing.com | towing.com | Industry specific |
| 13 | Manta | manta.com | Business directory |
| 14 | CitySearch | citysearch.com | Local search |
| 15 | MapQuest | mapquest.com | Navigation app |

### Priority 2 — Set Up Within 30 Days
| # | Directory | URL |
|---|-----------|-----|
| 16 | Superpages | superpages.com |
| 17 | Merchant Circle | merchantcircle.com |
| 18 | Hotfrog | hotfrog.com |
| 19 | Chamberofcommerce.com | chamberofcommerce.com |
| 20 | Local.com | local.com |
| 21 | EZLocal | ezlocal.com |
| 22 | ShowMeLocal | showmelocal.com |
| 23 | Brownbook | brownbook.net |
| 24 | Cylex | cylex.us |
| 25 | Hub.biz | hub.biz |

### NAP Consistency Rules
- **Name**: Always use "RoadSide ATL" (exact capitalization)
- **Phone**: Always use same format, e.g., "(404) 555-0199"
- **Address**: If SAB (no physical location), consistently use "Atlanta, GA" as service city
- **Website**: Always use `https://roadsideatl.com` (with https, no trailing slash)
- Audit all listings quarterly — use BrightLocal or Whitespark to detect inconsistencies

---

## 8. Content Strategy & Blog Plan

### Setting Up a Blog

Create a blog section in the app. Suggested file structure:
```
app/(marketing)/blog/page.tsx              -- Blog listing page
app/(marketing)/blog/[slug]/page.tsx       -- Individual blog post
```

Each blog post should have:
- `generateMetadata()` for dynamic SEO metadata
- `BreadcrumbJsonLd` schema
- Author, date, reading time
- Internal links to service and booking pages
- CTA at the bottom (Book Now / Call Us)

### Content Pillars

| Pillar | Hub Page | Cluster Topics |
|--------|----------|---------------|
| Emergency Services | "Atlanta 24/7 Roadside Guide" | Jump starts, lockouts, fuel delivery, stranded help |
| Towing & Recovery | "Complete Atlanta Towing Services" | Light duty, flatbed, winch-outs, motorcycle |
| Safety & Prevention | "Stay Safe on Atlanta Roads" | Traffic tips, weather prep, maintenance, emergency kits |
| Local Atlanta Insights | "Atlanta Breakdown Map" | Highway guides, seasonal events, neighborhood guides |

### 25 Blog Article Ideas (With Target Keywords)

| # | Title | Target Keyword |
|---|-------|---------------|
| 1 | Top 10 Reasons Your Car Breaks Down on I-285 | Atlanta I-285 roadside assistance |
| 2 | Flat Tire Fix: DIY Steps Before Calling Help | flat tire repair Atlanta |
| 3 | Dead Battery Jump Start Guide for Atlanta Winters | jump start battery Atlanta |
| 4 | Locked Out? Atlanta Lockout Services Explained | car lockout service Atlanta |
| 5 | Out of Gas on I-75? Fuel Delivery in Atlanta | fuel delivery Atlanta I-75 |
| 6 | Best Towing Companies in Atlanta: How to Choose | best towing Atlanta |
| 7 | What to Do After a Minor Accident in Atlanta | accident roadside Atlanta |
| 8 | Heavy Duty Towing for Trucks on Atlanta Highways | heavy duty towing Atlanta |
| 9 | Why Response Time Matters for Roadside Assistance | 24/7 roadside assistance Atlanta |
| 10 | How to Avoid Breakdowns During Atlanta Rush Hour | Atlanta rush hour roadside |
| 11 | EV Roadside Assistance for Tesla Owners in Atlanta | EV roadside assistance Atlanta |
| 12 | Motorcycle Towing in East Atlanta Village | motorcycle towing Atlanta |
| 13 | Roadside Safety Tips for Solo Drivers | safe roadside Atlanta |
| 14 | AAA vs. Local Roadside Services: Which Is Better? | AAA vs local roadside Atlanta |
| 15 | How to Spot a Reliable Tow Truck in Decatur | reliable towing Decatur |
| 16 | Fuel Delivery vs. Towing: Which Is Faster? | fuel delivery vs towing Atlanta |
| 17 | Atlanta Construction Zones: Roadside Risks on I-20 | construction zone roadside Atlanta |
| 18 | On-Site Battery Replacement in Sandy Springs | battery replacement Atlanta |
| 19 | Holiday Travel Breakdowns: Prep for Atlanta Highways | holiday roadside Atlanta |
| 20 | Winch Out Services for Stuck Vehicles | winch out service Atlanta |
| 21 | How Much Does Roadside Assistance Cost in Atlanta? | roadside assistance cost Atlanta |
| 22 | Nighttime Breakdowns: Safe Waiting Tips | nighttime roadside help Atlanta |
| 23 | Fleet Roadside Services for Atlanta Businesses | fleet roadside Atlanta |
| 24 | Preparing for Atlanta Storms: Flood Towing Guide | storm towing Atlanta |
| 25 | What to Keep in Your Car for a Roadside Emergency | roadside emergency kit Atlanta |

### Seasonal Content Calendar

| Month | Theme | Content Focus |
|-------|-------|--------------|
| Jan-Feb | Winter Prep | Battery checks, ice driving tips, holiday return traffic |
| Mar-Apr | Spring Storms | Flood towing, pollen car care, spring break travel |
| May-Jun | Summer Travel | AC breakdowns, vacation prep, I-75 traffic |
| Jul-Aug | Hurricane Season | Flood recovery, evacuation towing, generator fuel |
| Sep-Oct | Fall Traffic | Back-to-school, UGA/GT game day surge, leaf debris |
| Nov-Dec | Holidays | Holiday lights events, family trip safety, peak travel dates |

### Publishing Frequency
- **Blog posts**: 2-3 per week (minimum 1/week to start)
- **GBP posts**: Weekly
- **Social media**: 3-5 times per week
- **Goal**: 52+ blog posts in first year (70% evergreen, 30% timely/seasonal)

---

## 9. Location Pages Expansion

### Why Location Pages Matter
Each location page targets "[service] + [neighborhood]" keywords. Top-ranking roadside companies have individual pages for every area they serve, with unique content per page.

### Priority Location Pages to Create

Create these as `app/(marketing)/service-areas/[area]/page.tsx` with `generateStaticParams()`:

**Tier 1 (Create First — Highest Search Volume)**
| Area | Target URL | Primary Keyword |
|------|-----------|----------------|
| Midtown Atlanta | `/service-areas/midtown-atlanta` | roadside assistance Midtown Atlanta |
| Buckhead | `/service-areas/buckhead` | towing Buckhead Atlanta |
| Downtown Atlanta | `/service-areas/downtown-atlanta` | emergency towing Downtown Atlanta |
| Decatur | `/service-areas/decatur` | roadside assistance Decatur GA |
| Marietta | `/service-areas/marietta` | towing Marietta GA |
| Sandy Springs | `/service-areas/sandy-springs` | roadside assistance Sandy Springs |

**Tier 2 (Create Next)**
| Area | Target URL |
|------|-----------|
| Dunwoody | `/service-areas/dunwoody` |
| Brookhaven | `/service-areas/brookhaven` |
| Alpharetta | `/service-areas/alpharetta` |
| Roswell | `/service-areas/roswell` |
| Smyrna | `/service-areas/smyrna` |
| Johns Creek | `/service-areas/johns-creek` |

### What Each Location Page Should Include
- Unique H1: "24/7 Roadside Assistance in [Area Name], GA"
- 300+ words of unique content about that area (landmarks, highways, common breakdown spots)
- List of all services available in that area
- Mention of nearby areas ("Also serving [neighboring areas]")
- Embedded Google Map of the area
- Click-to-call CTA
- Book Now CTA
- LocalBusiness JSON-LD with area-specific `areaServed`
- BreadcrumbList JSON-LD
- Customer testimonials from that area (when available)

---

## 10. Review Generation Strategy

### Why Reviews Are Critical
- Reviews are a top 3 local ranking factor
- 93% of consumers read reviews before choosing a local service
- Review content with keywords ("great towing service in Atlanta") directly impacts rankings
- Star ratings appear in search results, improving click-through rates

### Automated Review Collection Flow
1. After each completed service, send an automated SMS within 30 minutes:
   ```
   Hi [Name], thanks for choosing RoadSide ATL! We'd love your feedback.
   Leave a quick review: [direct GBP review link]
   ```
2. Follow up with an email 24 hours later if no review was left
3. Use a tool like Birdeye, Podium, or Google's direct review link generator

### Google Review Link Format
```
https://search.google.com/local/writereview?placeid=YOUR_PLACE_ID
```
Find your Place ID at: https://developers.google.com/maps/documentation/places/web-service/place-id

### Review Response Templates

**Positive Review Response:**
```
Thank you so much, [Name]! We're glad we could help you with your [service type]
in [area]. Our team works hard to provide fast, reliable roadside assistance
across Atlanta. We appreciate you trusting RoadSide ATL!
```

**Negative Review Response:**
```
[Name], we're sorry to hear about your experience. This isn't the level of service
we strive for. Please contact us directly at [phone] so we can make this right.
Your feedback helps us improve our roadside assistance across Atlanta.
```

### Review Goals
| Timeline | Target |
|----------|--------|
| Month 1-3 | 5-10 reviews/month |
| Month 4-6 | 10-15 reviews/month |
| Month 7-12 | 15-20 reviews/month |
| Year 1 total | 100+ reviews |

### Displaying Reviews on Website
When you have reviews, add `AggregateRating` to the LocalBusiness schema in `components/seo/json-ld.tsx`:
```typescript
aggregateRating: {
  "@type": "AggregateRating",
  ratingValue: "4.9",
  reviewCount: "127",
  bestRating: "5",
  worstRating: "1",
},
```

---

## 11. Technical SEO Checklist

### Already Done
- [x] XML Sitemap (`/sitemap.xml`)
- [x] Robots.txt with proper disallow rules
- [x] Canonical URLs on all pages
- [x] Open Graph tags on all pages
- [x] Twitter Card tags on all pages
- [x] JSON-LD structured data (LocalBusiness, FAQ, WebSite, Breadcrumb)
- [x] Semantic HTML (aria attributes, address tag, sr-only text)
- [x] Keyword-optimized title tags with template
- [x] Meta descriptions on all pages
- [x] Internal linking strategy (footer service links, breadcrumbs)
- [x] PWA web manifest
- [x] Geo-meta tags for local search
- [x] GoogleBot directives (max-image-preview, max-snippet)
- [x] Proper heading hierarchy (H1 > H2 > H3)
- [x] FAQ section with schema markup
- [x] Mobile viewport configuration
- [x] Self-hosted fonts via next/font (Geist — already had this)

### Still To Do
- [ ] Create OG images (1200x630px) for each page
- [ ] Add Google Search Console verification code
- [ ] Add Google Analytics tracking
- [ ] Create location-specific pages
- [ ] Add blog section
- [ ] Set up 301 redirects for any old URLs (if migrating)
- [ ] Add `alt` text to any future images using keyword-relevant descriptions
- [ ] Set up HTTPS redirect (hosting/DNS level)
- [ ] Configure Cache-Control headers for static assets
- [ ] Test all pages with Google Rich Results Test
- [ ] Test all pages with Google PageSpeed Insights
- [ ] Submit sitemap to Bing Webmaster Tools

---

## 12. Performance Targets

### Core Web Vitals (Google Ranking Factor)

| Metric | Target | What It Measures |
|--------|--------|-----------------|
| LCP (Largest Contentful Paint) | < 2.5 seconds | How fast the main content loads |
| INP (Interaction to Next Paint) | < 200ms | How responsive the page is to clicks |
| CLS (Cumulative Layout Shift) | < 0.1 | How much the layout shifts during loading |

### Next.js Performance Tips
- Use `next/image` with `priority` prop for above-fold images
- Use `next/script` with `strategy="afterInteractive"` for analytics/maps
- Use `dynamic()` imports for heavy components (maps, charts)
- Use SSG (Static Generation) for service and location pages
- Target < 170KB gzipped initial JS bundle
- Compress all images to < 100KB (< 50KB for mobile)
- Use WebP/AVIF image formats

### How to Test
1. **Google PageSpeed Insights**: https://pagespeed.web.dev
2. **Google Search Console > Core Web Vitals**: Shows real-user data
3. **Lighthouse** (Chrome DevTools > Lighthouse tab): Run on mobile preset

---

## 13. Monthly SEO Maintenance

### Weekly Tasks
- [ ] Publish 1-3 blog posts
- [ ] Post 1 update on Google Business Profile
- [ ] Respond to all new reviews within 24 hours
- [ ] Share content on social media (3-5 posts/week)

### Monthly Tasks
- [ ] Check Google Search Console for crawl errors
- [ ] Review keyword rankings (use Google Search Console > Performance)
- [ ] Check for broken links
- [ ] Update FAQ section if new common questions emerge
- [ ] Audit NAP consistency across top 15 directories
- [ ] Review competitor rankings and new content
- [ ] Add 2-3 new directory citations

### Quarterly Tasks
- [ ] Refresh meta descriptions on underperforming pages
- [ ] Update seasonal content
- [ ] Audit and improve pages with high impressions but low clicks (title/description optimization)
- [ ] Review and update JSON-LD structured data
- [ ] Run Core Web Vitals audit
- [ ] A/B test page titles for click-through rate improvement

### Annual Tasks
- [ ] Full SEO audit (content, technical, backlinks)
- [ ] Competitor analysis refresh
- [ ] Keyword research refresh
- [ ] Content pruning (update or remove low-performing posts)
- [ ] Review and update all location pages

---

## 14. Tracking & Measurement

### Key Metrics to Track

| Metric | Tool | Goal |
|--------|------|------|
| Organic traffic | Google Analytics | +20% month-over-month |
| Keyword rankings | Search Console | Top 3 for "roadside assistance Atlanta" |
| Local Pack appearances | Search Console | Appear in top 3 map results |
| Click-through rate (CTR) | Search Console | > 5% average |
| Phone calls from search | Google Business Profile | Track call volume |
| Direction requests | Google Business Profile | Track engagement |
| Review count & rating | Google Business Profile | 100+ reviews, 4.5+ stars |
| Core Web Vitals | Search Console / PageSpeed | All "Good" |
| Indexed pages | Search Console | All important pages indexed |
| Backlinks | Ahrefs / Search Console | 10+ quality links/month |

### Google Search Console Setup
1. Verify domain ownership
2. Submit sitemap (`/sitemap.xml`)
3. Check "Performance" report weekly for:
   - Top queries driving traffic
   - Pages with high impressions but low CTR (optimize titles)
   - Pages with declining rankings (refresh content)
4. Check "Indexing" report for:
   - Pages not indexed
   - Crawl errors
   - Mobile usability issues

### Ranking Milestones

| Timeline | Expected Position for "roadside assistance Atlanta" |
|----------|---------------------------------------------------|
| Month 1 | Not ranked → Indexed and appearing in results |
| Month 3 | Page 3-5 (positions 20-50) |
| Month 6 | Page 1-2 (positions 5-20) |
| Month 9 | Top 10 (positions 1-10) |
| Month 12 | Top 5 with Local Pack appearance |

*Note: Rankings depend heavily on competition, review volume, backlink quality, and content consistency. These are estimates based on typical local SEO timelines for service-area businesses.*

---

## Quick Reference: Environment Variables

Add these to your `.env` or hosting platform:

```bash
# Required
NEXT_PUBLIC_SITE_URL=https://roadsideatl.com

# Update when you have them
NEXT_PUBLIC_BUSINESS_PHONE=(404) YOUR-REAL-PHONE
NEXT_PUBLIC_BUSINESS_NAME=RoadSide ATL
```

---

## Quick Reference: File Locations

```
SEO Infrastructure:
  lib/seo.ts                           -- Keywords, metadata helper, site config
  components/seo/json-ld.tsx           -- All JSON-LD schema components

Crawlability:
  app/sitemap.ts                       -- XML sitemap
  app/robots.ts                        -- Robots.txt
  app/manifest.ts                      -- PWA manifest

Page Metadata:
  app/layout.tsx                       -- Root metadata (inherited by all pages)
  app/(marketing)/page.tsx             -- Homepage metadata + schemas
  app/(marketing)/services/page.tsx    -- Services page metadata
  app/(marketing)/about/page.tsx       -- About page metadata
  app/(marketing)/book/page.tsx        -- Booking page metadata

SEO-Enhanced Components:
  components/marketing/hero.tsx        -- H1 with primary keyword
  components/marketing/footer.tsx      -- Internal links + local keywords
  components/marketing/service-card.tsx -- Deep link anchors + aria labels
```
