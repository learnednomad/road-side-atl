# Data Models - RoadSide ATL

> Generated: 2026-02-11 | Scan Level: Exhaustive | ORM: Drizzle ORM | Database: PostgreSQL 16

## Overview

The database manages a roadside assistance service platform with 14 tables covering users, providers, bookings, payments, dispatching, reviews, and authentication. All tables use text-based UUIDs as primary keys (generated via `crypto.randomUUID()`).

---

## Enums

| Enum | Values |
|---|---|
| `user_role` | `customer` (default), `admin`, `provider` |
| `service_category` | `roadside`, `diagnostics` |
| `commission_type` | `percentage` (default), `flat_per_job` |
| `provider_status` | `active`, `inactive`, `pending` (default) |
| `booking_status` | `pending` (default), `confirmed`, `dispatched`, `in_progress`, `completed`, `cancelled` |
| `payment_method` | `cash`, `cashapp`, `zelle`, `stripe` |
| `payment_status` | `pending` (default), `confirmed`, `failed`, `refunded` |
| `payout_status` | `pending` (default), `paid` |
| `dispatch_algorithm` | `auto`, `manual` |
| `provider_invite_status` | `pending` (default), `accepted`, `expired` |

---

## Core Business Tables

### users

Core user accounts supporting multiple roles (customer, admin, provider).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | text | PK | UUID |
| `name` | text | nullable | Display name |
| `email` | text | unique, nullable | Login email |
| `emailVerified` | timestamp | nullable | When email was verified |
| `image` | text | nullable | Profile image URL |
| `phone` | text | nullable | Phone number |
| `password` | text | nullable | bcrypt hashed password |
| `role` | user_role | NOT NULL, default: 'customer' | User role |
| `tenantId` | text | nullable | Multi-tenancy support |
| `createdAt` | timestamp | NOT NULL, default: now() | |
| `updatedAt` | timestamp | NOT NULL, default: now() | |

**Schema file:** `db/schema/users.ts`

---

### services

Service catalog defining available roadside assistance services.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | text | PK | UUID |
| `name` | text | NOT NULL | Service display name |
| `slug` | text | NOT NULL, unique | URL-safe identifier |
| `description` | text | NOT NULL | Service description |
| `basePrice` | integer | NOT NULL | Price in cents |
| `pricePerMile` | integer | nullable | Additional cost per mile (cents) |
| `category` | service_category | NOT NULL | roadside or diagnostics |
| `active` | boolean | NOT NULL, default: true | Whether visible to customers |
| `tenantId` | text | nullable | Multi-tenancy |
| `createdAt` | timestamp | NOT NULL, default: now() | |
| `updatedAt` | timestamp | NOT NULL, default: now() | |

**Schema file:** `db/schema/services.ts`

---

### providers

Provider profiles for service technicians/drivers.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | text | PK | UUID |
| `userId` | text | FK → users.id, nullable | Linked user account |
| `name` | text | NOT NULL | Provider name |
| `email` | text | NOT NULL | Contact email |
| `phone` | text | NOT NULL | Contact phone |
| `commissionRate` | integer | NOT NULL, default: 7000 | Basis points (7000 = 70%) |
| `commissionType` | commission_type | NOT NULL, default: 'percentage' | Commission model |
| `flatFeeAmount` | integer | nullable | Cents, for flat_per_job type |
| `status` | provider_status | NOT NULL, default: 'pending' | Account status |
| `latitude` | real | nullable | Home/office latitude |
| `longitude` | real | nullable | Home/office longitude |
| `address` | text | nullable | Address string |
| `isAvailable` | boolean | NOT NULL, default: true | Online/offline toggle |
| `currentLocation` | jsonb | nullable | `{ lat, lng, updatedAt }` |
| `lastLocationUpdate` | timestamp | nullable | GPS timestamp |
| `specialties` | jsonb | NOT NULL, default: [] | `string[]` of service types |
| `averageRating` | real | nullable | Calculated from reviews |
| `reviewCount` | integer | NOT NULL, default: 0 | Total reviews received |
| `tenantId` | text | nullable | Multi-tenancy |
| `createdAt` | timestamp | NOT NULL, default: now() | |
| `updatedAt` | timestamp | NOT NULL, default: now() | |

**Schema file:** `db/schema/providers.ts`

---

### bookings

Service booking requests and orders.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | text | PK | UUID |
| `userId` | text | FK → users.id, nullable | Customer (nullable for walk-ins) |
| `serviceId` | text | FK → services.id, NOT NULL | Requested service |
| `status` | booking_status | NOT NULL, default: 'pending' | Workflow status |
| `vehicleInfo` | jsonb | NOT NULL | `{ year, make, model, color }` |
| `location` | jsonb | NOT NULL | `{ address, latitude?, longitude?, placeId?, notes?, destination?, destinationLatitude?, destinationLongitude?, estimatedMiles? }` |
| `contactName` | text | NOT NULL | Customer name |
| `contactPhone` | text | NOT NULL | Customer phone |
| `contactEmail` | text | NOT NULL | Customer email |
| `scheduledAt` | timestamp | nullable | Scheduled time (null = ASAP) |
| `estimatedPrice` | integer | NOT NULL | Quoted price in cents |
| `finalPrice` | integer | nullable | Actual price after completion |
| `towingMiles` | integer | nullable | Distance for towing jobs |
| `notes` | text | nullable | Customer notes |
| `providerId` | text | nullable | Assigned provider (app-level) |
| `tenantId` | text | nullable | Multi-tenancy |
| `createdAt` | timestamp | NOT NULL, default: now() | |
| `updatedAt` | timestamp | NOT NULL, default: now() | |

**Schema file:** `db/schema/bookings.ts`

---

### payments

Payment records for bookings.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | text | PK | UUID |
| `bookingId` | text | FK → bookings.id, NOT NULL, CASCADE | Associated booking |
| `amount` | integer | NOT NULL | Amount in cents |
| `method` | payment_method | NOT NULL | cash, cashapp, zelle, stripe |
| `status` | payment_status | NOT NULL, default: 'pending' | Payment status |
| `stripeSessionId` | text | nullable | Stripe checkout session ID |
| `confirmedAt` | timestamp | nullable | When payment was confirmed |
| `confirmedBy` | text | FK → users.id, nullable | Admin who confirmed |
| `tenantId` | text | nullable | Multi-tenancy |
| `createdAt` | timestamp | NOT NULL, default: now() | |

**Schema file:** `db/schema/payments.ts`

---

### provider_payouts

Provider earnings/commission records.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | text | PK | UUID |
| `providerId` | text | FK → providers.id, NOT NULL | Earning provider |
| `bookingId` | text | FK → bookings.id, NOT NULL | Associated booking |
| `amount` | integer | NOT NULL | Provider's earned share (cents) |
| `status` | payout_status | NOT NULL, default: 'pending' | Payment status |
| `paidAt` | timestamp | nullable | When payout was disbursed |
| `createdAt` | timestamp | NOT NULL, default: now() | |

**Schema file:** `db/schema/provider-payouts.ts`

---

### dispatch_logs

Dispatch algorithm audit trail.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | text | PK | UUID |
| `bookingId` | text | FK → bookings.id, NOT NULL, CASCADE | Dispatched booking |
| `assignedProviderId` | text | FK → providers.id, nullable, SET NULL | Assigned provider |
| `algorithm` | dispatch_algorithm | NOT NULL | auto or manual |
| `distanceMeters` | integer | nullable | Distance to provider |
| `candidateProviders` | jsonb | nullable | `Array<{ providerId, name, distanceMiles, specialtyMatch }>` |
| `reason` | text | nullable | Dispatch decision reason |
| `createdAt` | timestamp | NOT NULL, default: now() | |

**Schema file:** `db/schema/dispatch-logs.ts`

---

### reviews

Customer reviews and ratings for providers.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | text | PK | UUID |
| `bookingId` | text | FK → bookings.id, NOT NULL, CASCADE | Reviewed booking |
| `providerId` | text | FK → providers.id, NOT NULL, CASCADE | Reviewed provider |
| `customerId` | text | FK → users.id, NOT NULL, CASCADE | Reviewing customer |
| `rating` | integer | NOT NULL | 1-5 stars |
| `comment` | text | nullable | Review text |
| `createdAt` | timestamp | NOT NULL, default: now() | |
| `updatedAt` | timestamp | NOT NULL, default: now() | |

**Schema file:** `db/schema/reviews.ts`

---

### push_subscriptions

Web push notification subscriptions.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | text | PK | UUID |
| `userId` | text | FK → users.id, NOT NULL, CASCADE | Subscribed user |
| `endpoint` | text | NOT NULL, unique | Push endpoint URL |
| `keys` | jsonb | NOT NULL | `{ p256dh, auth }` |
| `userAgent` | text | nullable | Browser user agent |
| `createdAt` | timestamp | NOT NULL, default: now() | |
| `updatedAt` | timestamp | NOT NULL, default: now() | |

**Schema file:** `db/schema/push-subscriptions.ts`

---

## Authentication Tables

### accounts

NextAuth.js OAuth provider accounts.

| Column | Type | Constraints |
|---|---|---|
| `userId` | text | FK → users.id, CASCADE |
| `type` | text | NOT NULL |
| `provider` | text | PK (composite) |
| `providerAccountId` | text | PK (composite) |
| `refresh_token` | text | nullable |
| `access_token` | text | nullable |
| `expires_at` | integer | nullable |
| `token_type` | text | nullable |
| `scope` | text | nullable |
| `id_token` | text | nullable |
| `session_state` | text | nullable |

### sessions

| Column | Type | Constraints |
|---|---|---|
| `sessionToken` | text | PK |
| `userId` | text | FK → users.id, CASCADE |
| `expires` | timestamp | NOT NULL |

### verification_tokens

| Column | Type | Constraints |
|---|---|---|
| `identifier` | text | PK (composite) |
| `token` | text | PK (composite) |
| `expires` | timestamp | NOT NULL |

### password_reset_tokens

| Column | Type | Constraints |
|---|---|---|
| `identifier` | text | PK (composite) |
| `token` | text | PK (composite) |
| `expires` | timestamp | NOT NULL |

### provider_invite_tokens

| Column | Type | Constraints | Description |
|---|---|---|---|
| `identifier` | text | PK (composite) | Email address |
| `token` | text | PK (composite) | Invite token |
| `providerId` | text | FK → providers.id, CASCADE | Target provider |
| `invitedBy` | text | FK → users.id, SET NULL | Admin who invited |
| `status` | provider_invite_status | NOT NULL, default: 'pending' | |
| `expires` | timestamp | NOT NULL | 72h from creation |
| `acceptedAt` | timestamp | nullable | |
| `createdAt` | timestamp | NOT NULL, default: now() | |

**Schema file:** `db/schema/auth.ts`

---

## Entity Relationships

```
users ──1:N──▶ providers (userId)
users ──1:N──▶ bookings (userId)
users ──1:N──▶ accounts (userId)
users ──1:N──▶ sessions (userId)
users ──1:N──▶ reviews (customerId)
users ──1:N──▶ push_subscriptions (userId)
users ──1:N──▶ payments (confirmedBy)
users ──1:N──▶ provider_invite_tokens (invitedBy)

services ──1:N──▶ bookings (serviceId)

providers ──1:N──▶ bookings (providerId)
providers ──1:N──▶ provider_payouts (providerId)
providers ──1:N──▶ dispatch_logs (assignedProviderId)
providers ──1:N──▶ reviews (providerId)
providers ──1:N──▶ provider_invite_tokens (providerId)

bookings ──1:N──▶ payments (bookingId)
bookings ──1:N──▶ provider_payouts (bookingId)
bookings ──1:N──▶ dispatch_logs (bookingId)
bookings ──1:N──▶ reviews (bookingId)
```

---

## Migration History

| # | Name | Description |
|---|---|---|
| 0000 | brainy_mysterio | Initial schema: users, services, providers, bookings, payments, provider_payouts, NextAuth tables |
| 0001 | pretty_ogun | Added password column to users |
| 0002 | numerous_peter_parker | Added dispatch_logs, reviews, push_subscriptions; provider location/rating fields; 'provider' user role |
| 0003 | condemned_james_howlett | Added provider_invite_tokens for onboarding |

---

## Seed Data

The seed script (`db/seed.ts`) creates demo data:

- **2 admins** (admin@roadsideatl.com, ops@roadsideatl.com)
- **5 providers** (various commission structures, 1 pending approval)
- **12 customers** with Atlanta-area profiles
- **6 services** (Jump Start $100, Towing $125+$3/mi, Lockout $135, Flat Tire $100, Fuel Delivery $75, Diagnostics $250)
- **18 bookings** (11 completed, 1 cancelled, 6 in various active states)
- **13 payments** (11 confirmed, 2 pending)
- **11 provider payouts** (7 paid, 4 pending)
- **13 dispatch logs** (mix of auto/manual)

All seed bookings use realistic Atlanta metro area locations with GPS coordinates.
