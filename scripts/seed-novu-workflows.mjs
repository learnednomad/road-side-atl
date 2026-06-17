#!/usr/bin/env node
/**
 * Seed/sync all RoadSide GA Novu notification workflows into a Novu environment.
 *
 * Source of truth for the notification catalog. Idempotent: creates missing
 * workflows and updates existing ones (matched by name == trigger identifier).
 *
 * Usage:
 *   NOVU_API_URL=https://novu-api.roadsidega.com \
 *   NOVU_ENV_API_KEY=<environment api key> \
 *   node scripts/seed-novu-workflows.mjs
 *
 * Get the environment API key from the Novu dashboard (Settings -> API Keys),
 * one per environment (Development / Production).
 *
 * Templates use Handlebars. The app passes pre-formatted, display-ready values
 * in the trigger payload (e.g. priceFormatted "$120.00", etaMinutes) so the
 * templates never do math. Recipient targeting (subscriber vs topic) is decided
 * by the caller in lib/novu.ts, not here.
 */

const API_URL = (process.env.NOVU_API_URL || "https://novu-api.roadsidega.com").replace(/\/$/, "");
const API_KEY = process.env.NOVU_ENV_API_KEY;
if (!API_KEY) {
  console.error("Missing NOVU_ENV_API_KEY (the per-environment API key).");
  process.exit(1);
}

const H = (p) => `{{${p}}}`; // tiny helper to keep templates readable

// ---- step builders -------------------------------------------------------
// PHASE 1: only the in-app (Inbox) channel is active. Email/SMS/push templates
// are defined and version-controlled here but staged inactive, because the app
// already delivers those via lib/notifications (Resend/Twilio/web-push) — so
// Novu adds the net-new Inbox with ZERO double-send. PHASE 2 = configure Novu's
// Resend/Twilio integrations, set CHANNELS_ACTIVE=true, and retire the legacy
// senders. Toggle with: CHANNELS_ACTIVE=true node scripts/seed-novu-workflows.mjs
const CHANNELS_ACTIVE = process.env.CHANNELS_ACTIVE === "true";
const inApp = (content) => ({ template: { type: "in_app", content }, active: true });
const email = (subject, content) => ({ template: { type: "email", subject, content, contentType: "customHtml" }, active: CHANNELS_ACTIVE });
const sms = (content) => ({ template: { type: "sms", content }, active: CHANNELS_ACTIVE });
const push = (title, content) => ({ template: { type: "push", title, content }, active: CHANNELS_ACTIVE });

// ---- workflow catalog ----------------------------------------------------
// name === trigger identifier (Novu slugifies, but ours are already slugs).
const WORKFLOWS = [
  // ===== Customer: booking lifecycle =====
  { name: "booking-created", tags: ["customer", "booking"], steps: [
    inApp(`We received your request for {{serviceName}}. Estimated {{priceFormatted}}. We'll confirm shortly.`),
    email("We got your RoadSide request", `<p>Hi {{subscriber.firstName}},</p><p>We received your booking for <b>{{serviceName}}</b> at {{address}}.</p><p>Estimated total: <b>{{priceFormatted}}</b>. We'll confirm a provider shortly.</p><p>Booking ref: {{bookingId}}</p>`),
  ]},
  { name: "booking-confirmed", tags: ["customer", "booking"], steps: [
    sms(`RoadSide GA: your {{serviceName}} is confirmed. We're assigning a provider now. Ref {{bookingId}}.`),
    email("Your booking is confirmed", `<p>Hi {{subscriber.firstName}},</p><p>Your <b>{{serviceName}}</b> is confirmed. We're assigning the nearest available provider.</p><p>Estimated total: {{priceFormatted}}.</p>`),
    inApp(`Your {{serviceName}} is confirmed — assigning a provider now.`),
  ]},
  { name: "booking-dispatched", critical: true, tags: ["customer", "booking"], steps: [
    sms(`{{providerName}} is assigned to your {{serviceName}} and is on the way (~{{etaMinutes}} min). Track: {{trackUrl}}`),
    push("Provider on the way", `{{providerName}} is heading to you — about {{etaMinutes}} min out.`),
    inApp(`{{providerName}} ({{providerRating}}★) is assigned and on the way — ~{{etaMinutes}} min.`),
  ]},
  { name: "eta-update", tags: ["customer", "booking"], steps: [
    push("ETA update", `{{providerName}} is now about {{etaMinutes}} min away.`),
    sms(`Update: {{providerName}} is ~{{etaMinutes}} min from you.`),
  ]},
  { name: "booking-in-progress", tags: ["customer", "booking"], steps: [
    push("Service started", `{{providerName}} has started your {{serviceName}}.`),
    inApp(`Your {{serviceName}} is now in progress.`),
  ]},
  { name: "booking-completed", tags: ["customer", "booking"], steps: [
    email("Service complete — your receipt", `<p>Hi {{subscriber.firstName}},</p><p>Your <b>{{serviceName}}</b> is complete.</p><p>Total charged: <b>{{finalPriceFormatted}}</b>.</p><p>Thanks for using RoadSide GA!</p>`),
    sms(`Your {{serviceName}} is complete. Total: {{finalPriceFormatted}}. Thanks for choosing RoadSide GA!`),
    inApp(`Service complete — {{finalPriceFormatted}}. Tap to leave a review.`),
  ]},
  { name: "booking-cancelled", tags: ["customer", "booking"], steps: [
    sms(`Your {{serviceName}} (ref {{bookingId}}) was cancelled. {{cancellationNote}}`),
    email("Your booking was cancelled", `<p>Hi {{subscriber.firstName}},</p><p>Your booking for <b>{{serviceName}}</b> has been cancelled.</p><p>{{cancellationNote}}</p>`),
    inApp(`Your {{serviceName}} booking was cancelled.`),
  ]},
  { name: "booking-reminder", tags: ["customer", "booking"], steps: [
    inApp(`Reminder: your {{serviceName}} is scheduled for {{scheduledAtFormatted}}.`),
    sms(`Reminder: your {{serviceName}} is scheduled for {{scheduledAtFormatted}}.`),
    push("Upcoming service", `Your {{serviceName}} is scheduled for {{scheduledAtFormatted}}.`),
  ]},

  // ===== Customer: payments =====
  { name: "payment-link", tags: ["customer", "payment"], steps: [
    inApp(`Complete your {{amountFormatted}} payment for {{serviceName}}.`),
    email("Complete your payment", `<p>Hi {{subscriber.firstName}},</p><p>Please complete payment of <b>{{amountFormatted}}</b> for your {{serviceName}}.</p><p><a href="{{payUrl}}">Pay now</a></p>`),
    sms(`RoadSide GA: complete your {{amountFormatted}} payment for {{serviceName}}: {{payUrl}}`),
  ]},
  { name: "payment-confirmed", tags: ["customer", "payment"], steps: [
    email("Payment received", `<p>Hi {{subscriber.firstName}},</p><p>We received your payment of <b>{{amountFormatted}}</b>. Thank you!</p>`),
    inApp(`Payment of {{amountFormatted}} received. Thank you!`),
  ]},
  { name: "payment-failed", critical: true, tags: ["customer", "payment"], steps: [
    inApp(`Your {{amountFormatted}} payment didn't go through — tap to retry.`),
    sms(`Your {{amountFormatted}} payment didn't go through. Please retry: {{payUrl}}`),
    email("Payment failed", `<p>Hi {{subscriber.firstName}},</p><p>Your payment of {{amountFormatted}} could not be processed.</p><p><a href="{{payUrl}}">Try again</a></p>`),
  ]},
  { name: "payment-refunded", tags: ["customer", "payment"], steps: [
    email("Your refund is on the way", `<p>Hi {{subscriber.firstName}},</p><p>We've issued a refund of <b>{{refundFormatted}}</b> for {{serviceName}}.</p><p>{{refundReason}}</p>`),
    inApp(`Refund of {{refundFormatted}} issued for {{serviceName}}.`),
  ]},

  // ===== Customer: engagement =====
  { name: "review-request", tags: ["customer", "engagement"], steps: [
    { template: { type: "delay" }, metadata: { type: "regular", amount: 2, unit: "hours" }, active: true },
    push("How did we do?", `Rate your {{serviceName}} with {{providerName}}.`),
    email("How was your service?", `<p>Hi {{subscriber.firstName}},</p><p>How was your <b>{{serviceName}}</b> with {{providerName}}?</p><p><a href="{{reviewUrl}}">Leave a review</a></p>`),
    inApp(`How was your {{serviceName}}? Tap to rate {{providerName}}.`),
  ]},
  { name: "referral-credited", tags: ["customer", "engagement"], steps: [
    email("You earned a referral credit!", `<p>Hi {{subscriber.firstName}},</p><p>Your referral came through — <b>{{creditFormatted}}</b> has been added to your account.</p>`),
    push("Referral credit earned", `You earned {{creditFormatted}} in referral credit!`),
    inApp(`You earned {{creditFormatted}} in referral credit!`),
  ]},
  { name: "loyalty-earned", tags: ["customer", "engagement"], steps: [
    { template: { type: "digest" }, metadata: { type: "regular", amount: 12, unit: "hours", digestKey: "subscriberId" }, active: true },
    inApp(`You earned {{points}} loyalty points. Balance: {{balance}} points.`),
  ]},

  // ===== Customer: memberships =====
  { name: "membership-activated", tags: ["customer", "membership"], steps: [
    email("Welcome to {{planName}}", `<p>Hi {{subscriber.firstName}},</p><p>Your <b>{{planName}}</b> membership is active. Enjoy your member benefits and priority dispatch.</p>`),
    inApp(`Your {{planName}} membership is active.`),
  ]},
  { name: "membership-past-due", critical: true, tags: ["customer", "membership"], steps: [
    inApp(`Your {{planName}} membership payment failed — update your card to keep benefits.`),
    sms(`Your {{planName}} membership payment failed. Update your card to keep benefits: {{billingUrl}}`),
    email("Action needed: membership payment failed", `<p>Hi {{subscriber.firstName}},</p><p>We couldn't process your {{planName}} membership renewal.</p><p><a href="{{billingUrl}}">Update payment method</a></p>`),
  ]},
  { name: "membership-canceled", tags: ["customer", "membership"], steps: [
    inApp(`Your {{planName}} membership has been canceled.`),
    email("Your membership was canceled", `<p>Hi {{subscriber.firstName}},</p><p>Your {{planName}} membership has been canceled. You're welcome back anytime.</p>`),
  ]},

  // ===== Provider =====
  { name: "dispatch-offer", critical: true, tags: ["provider", "dispatch"], steps: [
    push("New job offer", `{{serviceName}} near {{address}} — {{payoutFormatted}}. Accept within {{offerWindowMinutes}} min.`),
    sms(`RoadSide job: {{serviceName}} @ {{address}}, earn {{payoutFormatted}}. Accept in {{offerWindowMinutes}} min: {{acceptUrl}}`),
    inApp(`New job: {{serviceName}} near {{address}} — {{payoutFormatted}}. Expires in {{offerWindowMinutes}} min.`),
  ]},
  { name: "provider-job-assigned", critical: true, tags: ["provider", "dispatch"], steps: [
    push("Job assigned", `You're assigned: {{serviceName}} for {{customerName}} at {{address}}.`),
    sms(`Job assigned: {{serviceName}} for {{customerName}} @ {{address}}. Contact: {{customerPhone}}. Details: {{jobUrl}}`),
    inApp(`Assigned: {{serviceName}} for {{customerName}} at {{address}}.`),
  ]},
  { name: "provider-application-received", tags: ["provider", "onboarding"], steps: [
    email("We received your application", `<p>Hi {{subscriber.firstName}},</p><p>Thanks for applying to RoadSide GA. We're reviewing your application and documents and will be in touch.</p>`),
    inApp(`Your provider application was received and is under review.`),
  ]},
  { name: "provider-resubmission-requested", tags: ["provider", "onboarding"], steps: [
    inApp(`We need more info on your application: {{resubmissionReason}}`),
    sms(`RoadSide GA: we need more info on your application. Details: {{resubmissionUrl}}`),
    email("Action needed on your application", `<p>Hi {{subscriber.firstName}},</p><p>We need a few more details before we can approve you:</p><p>{{resubmissionReason}}</p><p><a href="{{resubmissionUrl}}">Update application</a></p>`),
  ]},
  { name: "provider-approved", tags: ["provider", "onboarding"], steps: [
    email("You're approved — welcome to RoadSide GA!", `<p>Hi {{subscriber.firstName}},</p><p>You're approved and live. You'll start receiving job offers in your service area.</p><p><a href="{{dashboardUrl}}">Open your dashboard</a></p>`),
    sms(`You're approved on RoadSide GA! Job offers will start coming in. Dashboard: {{dashboardUrl}}`),
    inApp(`You're approved — you'll start receiving job offers.`),
  ]},
  { name: "provider-rejected", tags: ["provider", "onboarding"], steps: [
    inApp(`Update on your application: {{rejectionReason}}`),
    email("Update on your application", `<p>Hi {{subscriber.firstName}},</p><p>After review, we're unable to approve your application at this time.</p><p>{{rejectionReason}}</p>`),
  ]},
  { name: "provider-suspended", critical: true, tags: ["provider", "account"], steps: [
    inApp(`Your provider account has been suspended. Reason: {{suspendedReason}}`),
    sms(`Your RoadSide GA provider account has been suspended. Reason: {{suspendedReason}}. Contact support.`),
    email("Your account has been suspended", `<p>Hi {{subscriber.firstName}},</p><p>Your provider account has been suspended.</p><p>Reason: {{suspendedReason}}</p><p>Please contact support.</p>`),
  ]},
  { name: "payout-paid", tags: ["provider", "payout"], steps: [
    email("You've been paid", `<p>Hi {{subscriber.firstName}},</p><p><b>{{amountFormatted}}</b> has been paid out for booking {{bookingId}}.</p>`),
    inApp(`{{amountFormatted}} paid out for booking {{bookingId}}.`),
  ]},
  { name: "payout-held", tags: ["provider", "payout"], steps: [
    email("A payout is on hold", `<p>Hi {{subscriber.firstName}},</p><p>Your payout of {{amountFormatted}} for booking {{bookingId}} is on hold.</p><p>Reason: {{holdReason}}</p>`),
    inApp(`Payout of {{amountFormatted}} (booking {{bookingId}}) is on hold: {{holdReason}}.`),
  ]},
  { name: "payout-clawback", tags: ["provider", "payout"], steps: [
    email("Payout adjustment", `<p>Hi {{subscriber.firstName}},</p><p>A payout of {{amountFormatted}} for booking {{bookingId}} has been reversed due to a refund/dispute.</p><p>{{clawbackReason}}</p>`),
    inApp(`Payout reversed: {{amountFormatted}} for booking {{bookingId}}.`),
  ]},
  { name: "review-received", tags: ["provider", "engagement"], steps: [
    inApp(`New {{rating}}★ review from a customer{{#if comment}}: "{{comment}}"{{/if}}`),
  ]},

  // ===== Ops / admin (triggered to the admins topic) =====
  { name: "ops-new-booking", tags: ["ops"], steps: [
    inApp(`New booking: {{serviceName}} at {{address}} — {{priceFormatted}} (ref {{bookingId}}).`),
  ]},
  { name: "ops-payment-disputed", critical: true, tags: ["ops"], steps: [
    email("⚠️ Payment disputed", `<p>A payment of {{amountFormatted}} for booking {{bookingId}} has been disputed.</p><p>Provider payout has been held automatically.</p>`),
    inApp(`⚠️ Dispute: {{amountFormatted}} on booking {{bookingId}}. Payout held.`),
  ]},
  { name: "ops-dispatch-no-provider", critical: true, tags: ["ops"], steps: [
    sms(`RoadSide: no provider accepted booking {{bookingId}} ({{serviceName}} @ {{address}}). Manual dispatch needed.`),
    inApp(`⚠️ No provider for booking {{bookingId}} after {{attempts}} attempts — manual dispatch needed.`),
  ]},
  { name: "ops-sla-breach", critical: true, tags: ["ops"], steps: [
    sms(`RoadSide SLA breach: booking {{bookingId}} pending {{minutesPending}} min without dispatch.`),
    inApp(`⚠️ SLA breach: booking {{bookingId}} pending {{minutesPending}} min.`),
  ]},
  { name: "ops-low-rating", tags: ["ops"], steps: [
    email("Low rating alert", `<p>A {{rating}}★ review was left for provider {{providerName}} on booking {{bookingId}}.</p><p>Comment: {{comment}}</p>`),
    inApp(`Low rating ({{rating}}★) for {{providerName}} on booking {{bookingId}}.`),
  ]},
  { name: "ops-recurring-materialized", tags: ["ops"], steps: [
    inApp(`Recurring schedule created booking {{bookingId}} ({{serviceName}}) for account {{accountName}}.`),
  ]},
];

// ---- sync ----------------------------------------------------------------
async function api(method, path, body) {
  const res = await fetch(`${API_URL}/v1${path}`, {
    method,
    headers: { Authorization: `ApiKey ${API_KEY}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 300)}`);
  return json;
}

async function getGroupId() {
  const g = await api("GET", "/notification-groups");
  const id = g.data?.[0]?._id;
  if (!id) throw new Error("no notification group found");
  return id;
}

async function existingByName() {
  const map = new Map();
  let page = 0;
  for (;;) {
    const r = await api("GET", `/workflows?page=${page}&limit=100`);
    for (const w of r.data || []) map.set(w.name, w);
    if (!r.data || r.data.length < 100) break;
    page++;
  }
  return map;
}

async function main() {
  const groupId = await getGroupId();
  const existing = await existingByName();
  let created = 0, updated = 0;
  for (const wf of WORKFLOWS) {
    const payload = {
      name: wf.name,
      active: true, // publish the workflow (otherwise triggers return "trigger_not_active")
      notificationGroupId: groupId,
      critical: !!wf.critical,
      tags: wf.tags || [],
      steps: wf.steps,
    };
    const found = existing.get(wf.name);
    let id;
    if (found) {
      const r = await api("PUT", `/workflows/${found._id}`, payload);
      id = r.data?._id || found._id;
      updated++;
      console.log(`  ~ updated ${wf.name}`);
    } else {
      const r = await api("POST", `/workflows`, payload);
      id = r.data?._id;
      created++;
      console.log(`  + created ${wf.name}`);
    }
    // workflow-level `active` in the create/update body is ignored — publish via the status endpoint.
    // Idempotent: the endpoint 400s if already active, which is fine on re-runs.
    if (id && found?.active !== true) {
      try { await api("PUT", `/workflows/${id}/status`, { active: true }); }
      catch (e) { if (!/different status/.test(e.message)) throw e; }
    }
  }
  console.log(`\nDone. ${created} created, ${updated} updated, ${WORKFLOWS.length} total.`);

  // Novu only allows authoring in Development; changes are then promoted to
  // Production. Run against the DEV key with PROMOTE_TO_PROD=true to publish.
  if (process.env.PROMOTE_TO_PROD === "true") {
    const ids = [];
    let page = 0;
    for (;;) {
      const r = await api("GET", `/changes?page=${page}&limit=100&promoted=false`);
      for (const ch of r.data || []) ids.push(ch._id);
      if (!r.data || r.data.length < 100) break;
      page++;
    }
    if (ids.length) {
      await api("POST", `/changes/bulk/apply`, { changeIds: ids });
      console.log(`Promoted ${ids.length} changes to Production.`);
    } else {
      console.log("No pending changes to promote.");
    }
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
