# RoadSide GA - Testing Kit

Welcome to beta testing! This guide gives you everything you need to explore the app and report issues.

**Live URL:** https://roadsidega.learnednomad.com

---

## Test Accounts

All accounts below are pre-seeded with demo data. Pick the role you want to test.

### Admin Accounts

| Email | Password | Notes |
|---|---|---|
| `admin@roadsidega.com` | `admin123` | Primary admin (Sani Nabil) |
| `ops@roadsidega.com` | `admin123` | Operations manager |

### Provider (Technician) Accounts

| Email | Password | Status | Notes |
|---|---|---|---|
| `marcus@roadsidega.com` | `provider123` | Active | Has completed jobs, active dispatch |
| `terrence@roadsidega.com` | `provider123` | Active | Has completed jobs, dispatched lockout |
| `deandre@roadsidega.com` | `provider123` | Active | Offline (unavailable) |
| `carlos@roadsidega.com` | `provider123` | Active | Flat-fee commission model |
| `jamal@roadsidega.com` | `provider123` | Pending | Not yet approved - onboarding flow |

### Customer Accounts

| Email | Password | Has Bookings? |
|---|---|---|
| `jasmine.carter@gmail.com` | `customer123` | Yes - completed + in-progress tow |
| `david.okonkwo@gmail.com` | `customer123` | Yes - completed + dispatched lockout |
| `maria.santos@yahoo.com` | `customer123` | Yes - completed + confirmed inspection |
| `tyler.rich@outlook.com` | `customer123` | Yes - completed + pending jump start |
| `aisha.w@gmail.com` | `customer123` | Yes - completed tire change |
| `kevin.tran@gmail.com` | `customer123` | Yes - completed + pending tire change |
| `brittany.coleman@gmail.com` | `customer123` | Yes - completed jump start |
| `james.mitchell@outlook.com` | `customer123` | Yes - completed + pending fuel delivery |
| `steph.park@gmail.com` | `customer123` | Yes - completed lockout |
| `andre.w@yahoo.com` | `customer123` | Yes - completed tire change |
| `nicole.foster@gmail.com` | `customer123` | Yes - completed jump start |
| `marcus.green@gmail.com` | `customer123` | Yes - cancelled tow |

---

## What to Test (by Role)

### As a Customer

1. **Browse the site** (no login needed)
   - Visit the homepage, services page, and about page
   - Check responsiveness on mobile vs desktop

2. **Book a service** (login or guest)
   - Go to `/book` and select a service (Jump Start, Towing, Lockout, Tire Change, Fuel Delivery, or Inspections)
   - Fill in vehicle info, location, and contact details
   - Complete the booking flow
   - Check the confirmation page

3. **View your bookings**
   - Go to `/my-bookings` to see booking history
   - Try logging in as `jasmine.carter@gmail.com` to see a mix of completed/active bookings

4. **Track a booking**
   - From My Bookings, click on an active booking to see real-time tracking

5. **Customer dashboard**
   - Go to `/dashboard` after logging in
   - Check booking history and referral program

6. **Register a new account**
   - Go to `/register` and create a fresh customer account
   - Try the full booking flow as a new user

### As a Provider (Technician)

1. **Provider dashboard** - Log in as `marcus@roadsidega.com`
   - View the main dashboard at `/provider`
   - Check active jobs, earnings summary, and quick stats

2. **Jobs** - `/provider/jobs`
   - View dispatched and active jobs
   - Click into a job to see details

3. **Earnings** - `/provider/earnings`
   - View payout history and pending amounts

4. **Invoices** - `/provider/invoices`
   - View and create invoices

5. **Onboarding flow** - Log in as `jamal@roadsidega.com` (pending provider)
   - See the onboarding dashboard at `/provider/onboarding`
   - Note: dispatch-gated pages (jobs, earnings, invoices) should be locked

6. **Provider application** - `/become-provider`
   - Try applying as a new provider (use a unique email)
   - Check the multi-step application form

### As an Admin

1. **Admin dashboard** - Log in as `admin@roadsidega.com`
   - View the main dashboard at `/admin`
   - Check overview stats, recent bookings, revenue

2. **Bookings management** - `/admin/bookings`
   - View all bookings across all statuses
   - Click into a booking to manage it (dispatch, update status, confirm payment)

3. **Provider management** - `/admin/providers`
   - View all providers and their statuses
   - Click a provider to see details, edit commission rates
   - Approve/reject pending providers

4. **Financial pages**
   - `/admin/revenue` - Revenue overview
   - `/admin/finances` - Financial summary
   - `/admin/payouts` - Provider payout management
   - `/admin/invoices` - Invoice management
   - `/admin/commission` - Commission settings
   - `/admin/financial-reports` - Detailed reports

5. **Pricing** - `/admin/pricing`
   - View/edit service prices
   - Time-block pricing (surge pricing configs)

6. **Other admin pages**
   - `/admin/customers` - Customer list
   - `/admin/calendar` - Booking calendar view
   - `/admin/audit-logs` - System audit trail
   - `/admin/trust-tier` - Trust tier management
   - `/admin/b2b-accounts` - Business accounts
   - `/admin/settings` - App settings

---

## Services Available

| Service | Base Price | Category |
|---|---|---|
| Jump Start | $100.00 | Roadside |
| Towing (Local) | $125.00 + $3/mile | Roadside |
| Lockout Service | $135.00 | Roadside |
| Flat Tire Change | $100.00 | Roadside |
| Fuel Delivery | $75.00 | Roadside |
| Basic Inspection | $150.00 | Diagnostics |
| Standard Inspection | $250.00 | Diagnostics |
| Premium Inspection | $399.00 | Diagnostics |

---

## What to Look For (Bug Hunting Guide)

### Functionality
- [ ] Can you complete the full booking flow without errors?
- [ ] Do pages load correctly? Any blank screens or spinners that never resolve?
- [ ] Do buttons and links go where expected?
- [ ] Does login/logout work cleanly?
- [ ] Do role-specific pages block unauthorized access? (e.g., can a customer access `/admin`?)

### UI/UX
- [ ] Does the layout look good on your phone? Tablet? Desktop?
- [ ] Are there any text overlaps, cut-off content, or misaligned elements?
- [ ] Is the navigation intuitive? Can you find what you need?
- [ ] Do forms show helpful validation errors?
- [ ] Are loading states shown when data is being fetched?

### Edge Cases
- [ ] What happens if you submit a form with empty fields?
- [ ] What happens if you go directly to a URL you shouldn't have access to?
- [ ] Try using the back button mid-flow - does it break anything?
- [ ] Try booking with very long text in the notes field
- [ ] Try refreshing the page at various points

---

## How to Report Issues

When you find a bug, please include:

1. **What you did** (step by step)
2. **What you expected** to happen
3. **What actually happened**
4. **Which account** you were using
5. **Device/browser** (e.g., iPhone 15 Safari, Chrome on Windows)
6. **Screenshot** if possible

Send reports to: **Sani** (however you normally reach me)

Or create an issue at: https://github.com/learnednomad/road-side-ga/issues

---

## Quick Start (TL;DR)

1. Go to **https://roadsidega.learnednomad.com**
2. Click **Login** (top right)
3. Use any account from the tables above
4. Explore the pages listed for that role
5. Try breaking things and tell me what you find

Thanks for testing!
