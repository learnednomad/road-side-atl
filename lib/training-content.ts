/**
 * Training module content — policy acknowledgment cards.
 * Each card requires the provider to confirm they've read and understood the content.
 * Progress is stored in the onboarding step's draftData JSONB field.
 */

export interface TrainingCard {
  id: string;
  title: string;
  category: "safety" | "service" | "policy" | "payment";
  content: string;
  keyPoints: string[];
}

export const TRAINING_CARDS: TrainingCard[] = [
  // ── Safety ────────────────────────────────────────────────────────
  {
    id: "safety-scene",
    title: "Scene Safety & Personal Protection",
    category: "safety",
    content:
      "Your safety is the #1 priority on every call. Before exiting your vehicle, assess the scene for hazards: oncoming traffic, road conditions, and weather. Always wear your high-visibility safety vest. Position your vehicle to create a buffer zone between you and traffic. Use hazard lights, cones, or flares when working roadside, especially at night or in low-visibility conditions. If a scene feels unsafe, contact dispatch immediately — no job is worth risking your life.",
    keyPoints: [
      "Wear high-visibility vest on every call",
      "Position vehicle as a traffic buffer",
      "Use hazard lights, cones, or flares at night",
      "Leave immediately if a scene feels unsafe",
    ],
  },
  {
    id: "safety-vehicle",
    title: "Vehicle Safety & Equipment Checks",
    category: "safety",
    content:
      "Before starting each shift, inspect your equipment: portable jump starter (charged above 50%), lockout tools (complete set), fuel can (empty and clean), tire plug kit, and air compressor. Keep your vehicle clean and organized — a cluttered vehicle slows your response time and looks unprofessional. Secure all equipment during transit. Report any damaged or missing equipment to support before accepting calls.",
    keyPoints: [
      "Check jump starter charge before each shift",
      "Verify all lockout tools are present",
      "Secure equipment during transit",
      "Report damaged/missing equipment before accepting calls",
    ],
  },
  {
    id: "safety-emergency",
    title: "Emergency Procedures",
    category: "safety",
    content:
      "If you witness or are involved in an accident while on a call, stop your vehicle safely and call 911 immediately. Do not move injured persons unless there is immediate danger (fire, oncoming traffic). Provide first aid only if trained. Document the scene with photos and notify dispatch. If a customer becomes aggressive or threatening, disengage immediately, return to your vehicle, lock doors, and contact dispatch. We will handle the situation from there.",
    keyPoints: [
      "Call 911 for any accident or medical emergency",
      "Do not move injured persons unless immediate danger",
      "Disengage from aggressive customers immediately",
      "Document all incidents with photos",
    ],
  },

  // ── Service Standards ─────────────────────────────────────────────
  {
    id: "service-greeting",
    title: "Customer Interaction & Professionalism",
    category: "service",
    content:
      "First impressions matter. When you arrive, greet the customer by name (visible in the app), introduce yourself, and confirm the service requested. Wear your branded vest and maintain a clean, professional appearance. Explain what you're going to do before you start. Keep the customer informed throughout the service. When finished, confirm the vehicle is working properly before leaving. Thank the customer and let them know they'll receive a receipt via email.",
    keyPoints: [
      "Greet customer by name and confirm the service",
      "Explain each step before performing it",
      "Verify the fix works before leaving",
      "Thank customer and mention the email receipt",
    ],
  },
  {
    id: "service-timing",
    title: "Response Times & Availability",
    category: "service",
    content:
      "Our brand promise is fast, reliable roadside assistance. When you accept a job, you commit to the estimated arrival time shown in the app. If you encounter a delay (traffic, prior job running long), update the ETA in the app immediately. Customers see your live location — radio silence creates anxiety. If you cannot make the ETA, contact dispatch so we can reassign. Repeated ETA violations will affect your provider rating and may result in fewer dispatches.",
    keyPoints: [
      "Update ETA immediately if delayed",
      "Customers see your live location — stay responsive",
      "Contact dispatch if you can't make ETA",
      "Repeated ETA violations reduce your dispatch priority",
    ],
  },
  {
    id: "service-quality",
    title: "Service Quality & Completeness",
    category: "service",
    content:
      "Every service must be performed completely and correctly. For jump starts, verify the vehicle starts and the battery holds charge for at least 2 minutes. For lockouts, confirm all doors lock and unlock properly after entry. For tire changes, torque lug nuts to spec and verify tire pressure. For fuel delivery, add the purchased amount and verify the vehicle starts. If you cannot resolve the issue, explain the situation to the customer, document it in the app, and recommend next steps (tow to mechanic, etc.).",
    keyPoints: [
      "Verify every fix works before leaving",
      "If unresolvable, document and recommend next steps",
      "Check tire pressure after changes",
      "Confirm battery holds charge after jump start",
    ],
  },

  // ── Policies ──────────────────────────────────────────────────────
  {
    id: "policy-conduct",
    title: "Code of Conduct",
    category: "policy",
    content:
      "As a RoadSide ATL provider, you represent our brand. Zero tolerance applies to: working under the influence of drugs or alcohol, discriminatory behavior based on race, gender, religion, orientation, or any protected class, theft or damage to customer property, sharing customer personal information, and performing services outside your scope (mechanical repairs, towing without proper equipment/licensing). Violations result in immediate deactivation and may be reported to law enforcement.",
    keyPoints: [
      "Zero tolerance for impairment on the job",
      "Zero tolerance for discrimination",
      "Never share customer personal information",
      "Only perform services within your certified scope",
    ],
  },
  {
    id: "policy-insurance",
    title: "Insurance & Liability",
    category: "policy",
    content:
      "You must maintain valid personal auto insurance at minimum throughout your time as a provider. Commercial auto insurance is recommended but not required for non-towing services. You are responsible for any damage to customer vehicles caused by your negligence. Report all incidents immediately through the app — late reporting may void coverage. RoadSide ATL carries general liability insurance, but this does not cover provider negligence or intentional damage.",
    keyPoints: [
      "Maintain valid auto insurance at all times",
      "Report all incidents immediately through the app",
      "You are liable for damage caused by your negligence",
      "Late incident reporting may void coverage",
    ],
  },
  {
    id: "policy-cancellation",
    title: "Cancellation & No-Show Policy",
    category: "policy",
    content:
      "If a customer cancels after you've been dispatched, you will receive a cancellation fee. If you need to cancel an accepted job, do so through the app as early as possible — the system will auto-reassign. Cancelling after arrival incurs a strike on your record. Three strikes in a 30-day period triggers a review. No-shows (accepting a job and never arriving) result in immediate suspension pending investigation. If you have an emergency, contact dispatch — we'll handle the reassignment.",
    keyPoints: [
      "Cancel through the app as early as possible",
      "Cancellation after arrival counts as a strike",
      "No-shows trigger immediate suspension",
      "Contact dispatch for emergencies — don't just disappear",
    ],
  },

  // ── Payment ───────────────────────────────────────────────────────
  {
    id: "payment-earnings",
    title: "How You Get Paid",
    category: "payment",
    content:
      "Earnings are calculated per job based on the service type, distance, and any surge pricing in effect. Our commission rate is clearly shown on every job offer before you accept. Payments are processed through Stripe Connect and deposited to your linked bank account. Standard payouts arrive within 2-3 business days. You can view your earnings, pending payouts, and transaction history in the provider dashboard. Tips from customers go 100% to you with no commission.",
    keyPoints: [
      "Commission rate shown on every job before you accept",
      "Payouts via Stripe to your bank in 2-3 business days",
      "Tips go 100% to you — no commission on tips",
      "Track earnings in your provider dashboard",
    ],
  },
  {
    id: "payment-disputes",
    title: "Payment Disputes & Refunds",
    category: "payment",
    content:
      "If a customer disputes a charge, you may be asked to provide documentation (photos, timestamps, notes). Respond to dispute requests within 48 hours — failure to respond may result in the dispute being resolved in the customer's favor with the amount deducted from your earnings. Fraudulent dispute claims by providers (e.g., claiming a service was completed when it wasn't) result in immediate deactivation. If you believe a payout is incorrect, contact support with the job ID and details.",
    keyPoints: [
      "Respond to dispute requests within 48 hours",
      "Always take photos during service for documentation",
      "Fraudulent claims result in deactivation",
      "Contact support with job ID for payout issues",
    ],
  },
];

export const TRAINING_CATEGORIES = [
  { id: "safety", label: "Safety & Emergency", color: "text-red-600 bg-red-100" },
  { id: "service", label: "Service Standards", color: "text-blue-600 bg-blue-100" },
  { id: "policy", label: "Policies", color: "text-purple-600 bg-purple-100" },
  { id: "payment", label: "Payment & Earnings", color: "text-green-600 bg-green-100" },
] as const;

export const TOTAL_TRAINING_CARDS = TRAINING_CARDS.length;
