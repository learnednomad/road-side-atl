/**
 * Independent Contractor Agreement content.
 *
 * ⚠️ NOT LEGAL ADVICE — PLACEHOLDER TEXT.
 * This language is derived from the Roadside ATL onboarding checklist and
 * must be reviewed and replaced by a licensed attorney before production
 * use. Bump IC_AGREEMENT_VERSION in lib/constants.ts when the lawyer
 * returns final copy so existing acceptances are not silently rolled into
 * the new version.
 */

import { IC_AGREEMENT_VERSION } from "./constants";

export interface IcAgreementSection {
  id: string;
  heading: string;
  body: string;
}

export const IC_AGREEMENT_SECTIONS: IcAgreementSection[] = [
  {
    id: "independent-contractor-status",
    heading: "1. Independent Contractor Status",
    body:
      "You are engaged as an independent contractor (1099), not as an employee, partner, or agent of Roadside ATL. You retain sole control over the means, manner, and methods of performing roadside services, including your schedule, route selection, and choice of tools. Nothing in this agreement creates an employer–employee relationship.",
  },
  {
    id: "dispatch-only",
    heading: "2. Roadside ATL Is a Dispatch Platform",
    body:
      "Roadside ATL operates a technology platform that connects vehicle owners with independent roadside service providers. Roadside ATL does not perform repairs, does not directly supervise work performed, and is not a party to the service relationship between you and the customer. All repairs and services rendered are solely your responsibility.",
  },
  {
    id: "responsibility-for-services",
    heading: "3. Responsibility for Services Provided",
    body:
      "You are solely responsible for the quality, safety, and outcome of every service you accept and perform through the platform, including but not limited to tire changes, jump starts, lockouts, fuel delivery, towing, and diagnostics. You agree to perform services in a workmanlike manner and in compliance with all applicable federal, state, and local laws.",
  },
  {
    id: "insurance-requirements",
    heading: "4. Insurance Requirements",
    body:
      "You must maintain, at your own expense, general liability insurance covering your roadside service activities. You acknowledge that Roadside ATL's insurance policies do not extend coverage to you or to losses arising from your services. Upon request, you will provide a current certificate of insurance naming the coverage amounts and policy period.",
  },
  {
    id: "hold-harmless",
    heading: "5. Indemnification & Hold Harmless",
    body:
      "You agree to defend, indemnify, and hold harmless Roadside ATL, its officers, employees, and affiliates from and against any and all claims, damages, losses, liabilities, costs, and expenses (including reasonable attorneys' fees) arising out of or related to: (a) services you performed or failed to perform; (b) your negligence, willful misconduct, or violation of law; (c) your breach of this agreement; or (d) any third-party claim brought against Roadside ATL as a result of your acts or omissions.",
  },
  {
    id: "tax-classification",
    heading: "6. Tax & Withholding",
    body:
      "As an independent contractor, you are solely responsible for the payment of all federal, state, and local taxes on income earned through the platform, including self-employment tax. Roadside ATL will not withhold income tax, Social Security, or Medicare contributions from your earnings and will issue an IRS Form 1099 for amounts paid that meet reporting thresholds.",
  },
  {
    id: "platform-standards",
    heading: "7. Platform Standards",
    body:
      "You agree to maintain a customer rating above the platform minimum, complete required background checks, keep your insurance and certifications current, and follow the safety and conduct standards in the training module. Failure to maintain these standards may result in suspension or removal from the platform.",
  },
  {
    id: "termination",
    heading: "8. Termination",
    body:
      "Either party may terminate this agreement at any time, with or without cause, by written notice. Sections concerning Indemnification, Tax classification, and any obligations that by their nature should survive termination will remain in effect after this agreement ends.",
  },
];

export const IC_AGREEMENT_DISCLAIMER =
  "By typing your full legal name and clicking Accept, you acknowledge that you have read, understood, and agree to be bound by all sections of this Independent Contractor Agreement.";

export function getIcAgreement() {
  return {
    version: IC_AGREEMENT_VERSION,
    title: "Independent Contractor Agreement",
    sections: IC_AGREEMENT_SECTIONS,
    disclaimer: IC_AGREEMENT_DISCLAIMER,
  };
}

export type IcAgreementPayload = ReturnType<typeof getIcAgreement>;
