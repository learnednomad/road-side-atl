# Component Inventory - RoadSide ATL

> Generated: 2026-02-11 | Scan Level: Exhaustive | Total: 59 components

## Summary by Category

| Category | Count | Directory |
|---|---|---|
| Admin Panel | 12 | `components/admin/` |
| Booking Flow | 2 | `components/booking/` |
| Customer Dashboard | 2 | `components/dashboard/` |
| Maps | 3 | `components/maps/` |
| Marketing | 4 | `components/marketing/` |
| Notifications | 1 | `components/notifications/` |
| Provider Portal | 5 | `components/provider/` |
| Context Providers | 3 | `components/providers/` |
| Reviews | 3 | `components/reviews/` |
| SEO | 1 | `components/seo/` |
| UI Primitives (shadcn) | 22 | `components/ui/` |

---

## Admin Panel Components

| Component | File | Purpose | Key Dependencies |
|---|---|---|---|
| `AdminSidebar` | `sidebar.tsx` | Desktop nav sidebar | next/navigation, next-auth |
| `AdminMobileNav` | `admin-mobile-nav.tsx` | Mobile drawer nav | Sheet |
| `BookingsTable` | `bookings-table.tsx` | Bookings management with real-time WS updates | useWS, Table, Dialog, StatusBadge |
| `CustomersTable` | `customers-table.tsx` | Customer list with search + spend tracking | Table, Avatar, Input |
| `DateRangePicker` | `date-range-picker.tsx` | Date range with presets (7d/30d/90d) | Popover, Calendar, date-fns |
| `ExportButton` | `export-button.tsx` | CSV export trigger | Button, sonner |
| `PayoutsTable` | `payouts-table.tsx` | Payout management with batch ops | Table, Checkbox, Badge |
| `ProviderForm` | `provider-form.tsx` | Provider create/edit with address autocomplete | react-hook-form, zod, AddressAutocomplete |
| `ProvidersTable` | `providers-table.tsx` | Provider CRUD + invite | Table, Dialog, AlertDialog, ProviderForm |
| `RevenueAnalytics` | `revenue-analytics.tsx` | Full revenue dashboard (self-fetching) | Charts, DateRangePicker, ExportButton |
| `RevenueCharts` | `revenue-charts.tsx` | Line/Bar/Pie chart components | recharts |
| `StatsCards` | `stats-cards.tsx` | Dashboard metric cards with sparklines | Card, recharts AreaChart |

## Booking Flow Components

| Component | File | Purpose | Key Dependencies |
|---|---|---|---|
| `BookingForm` | `booking-form.tsx` | 4-step wizard (service → location → contact → review) | AddressAutocomplete, constants |
| `PaymentInstructions` | `payment-instructions.tsx` | Payment method display + Stripe checkout | Card, Badge, BUSINESS constants |

## Customer Dashboard Components

| Component | File | Purpose |
|---|---|---|
| `BookingList` | `booking-list.tsx` | Booking cards with status + CTA |
| `StatusBadge` | `status-badge.tsx` | Color-coded booking status badge |

## Map Components

| Component | File | Purpose | Key Dependencies |
|---|---|---|---|
| `AddressAutocomplete` | `address-autocomplete.tsx` | Google Places autocomplete (Atlanta-biased) | useGoogleMaps, Input |
| `BookingsMap` | `bookings-map.tsx` | Admin map with booking/provider markers | useGoogleMaps, Card |
| `LiveTrackingMap` | `live-tracking-map.tsx` | Real-time provider tracking | useGoogleMaps, AdvancedMarkerElement |

## Marketing Components

| Component | File | Purpose |
|---|---|---|
| `Hero` | `hero.tsx` | Homepage hero with CTA buttons |
| `Navbar` | `navbar.tsx` | Responsive nav with session-aware links |
| `ServiceCard` | `service-card.tsx` | Service offering card with pricing |
| `Footer` | `footer.tsx` | Site footer with links + contact info |

## Notification Components

| Component | File | Purpose |
|---|---|---|
| `PushNotificationToggle` | `push-notification-toggle.tsx` | Subscribe/unsubscribe toggle (card + button variants) |

## Provider Portal Components

| Component | File | Purpose | Key Dependencies |
|---|---|---|---|
| `JobCard` | `job-card.tsx` | Job display with accept/reject actions | Card, Badge, AlertDialog |
| `LocationTracker` | `location-tracker.tsx` | GPS tracking toggle (30s interval) | Geolocation API |
| `ProviderMobileNav` | `provider-mobile-nav.tsx` | Mobile drawer nav | Sheet |
| `ProviderSidebar` | `provider-sidebar.tsx` | Desktop sidebar nav | next/navigation |
| `StatusUpdater` | `status-updater.tsx` | Job status transition buttons | AlertDialog |

## Context Providers

| Component | File | Purpose |
|---|---|---|
| `AuthSessionProvider` | `session-provider.tsx` | NextAuth SessionProvider wrapper |
| `WebSocketProvider` | `websocket-provider.tsx` | WS context + `useWS` hook |
| `WebSocketWrapper` | `websocket-wrapper.tsx` | Session-aware WS provider wrapper |

## Review Components

| Component | File | Purpose |
|---|---|---|
| `StarRating` | `star-rating.tsx` | Star display (half-star support, 3 sizes) |
| `ReviewForm` | `review-form.tsx` | Interactive rating form (1-5 stars + comment) |
| `ReviewsList` | `reviews-list.tsx` | Paginated review list with load more |

## SEO Components

| Component | File | Exports |
|---|---|---|
| `json-ld.tsx` | `json-ld.tsx` | `JsonLd`, `LocalBusinessJsonLd`, `ServiceJsonLd`, `FAQJsonLd`, `BreadcrumbJsonLd`, `WebSiteJsonLd` |

## UI Primitives (shadcn/ui)

22 base components from shadcn/ui (New York style): alert-dialog, avatar, badge, button, calendar, card, checkbox, dialog, dropdown-menu, form, input, label, popover, select, separator, sheet, skeleton, sonner, switch, table, tabs, textarea.

---

## Design System

- **Style:** shadcn/ui New York variant
- **Icons:** lucide-react
- **Colors:** oklch color space with CSS variables
- **Dark Mode:** Theme variables defined (via next-themes integration available)
- **Responsive:** Mobile-first with Sheet drawers for mobile navigation
