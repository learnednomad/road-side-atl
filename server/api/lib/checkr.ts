/**
 * Checkr API typed wrapper — direct REST via fetch (Architecture Decision 3.1)
 * No npm dependency. API surface: 4 endpoints.
 */

const CHECKR_BASE_URL = "https://api.checkr.com/v1";

// ── Types ────────────────────────────────────────────────────────

export interface CheckrCandidate {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  dob: string;
  created_at: string;
}

export interface CheckrInvitation {
  id: string;
  candidate_id: string;
  package: string;
  status: string;
  uri: string;
  created_at: string;
}

export interface CheckrReport {
  id: string;
  status: "pending" | "clear" | "consider" | "suspended" | "dispute";
  adjudication: "engaged" | "pre_adverse_action" | "post_adverse_action" | null;
  package: string;
  candidate_id: string;
  completed_at: string | null;
  created_at: string;
}

export interface CheckrAdverseAction {
  id: string;
  report_id: string;
  status: string;
}

export class CheckrApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly responseBody: string,
    public readonly endpoint: string,
    public readonly attempts: number,
  ) {
    super(`Checkr API error: ${statusCode} on ${endpoint} after ${attempts} attempt(s)`);
    this.name = "CheckrApiError";
  }
}

// ── Internal Helpers ─────────────────────────────────────────────

function getApiKey(): string {
  if (process.env.NODE_ENV === "production") {
    return process.env.CHECKR_API_KEY!;
  }
  return process.env.CHECKR_API_KEY_SANDBOX || process.env.CHECKR_API_KEY!;
}

async function checkrFetch<T>(
  endpoint: string,
  options: RequestInit,
  maxRetries = 3,
): Promise<T> {
  const apiKey = getApiKey();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let response: Response;
    try {
      response = await fetch(`${CHECKR_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });
    } catch (err) {
      // Network error — retry if attempts remain
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
        continue;
      }
      throw new CheckrApiError(
        0,
        err instanceof Error ? err.message : "Network error",
        endpoint,
        attempt + 1,
      );
    }

    if (response.ok) {
      return response.json() as Promise<T>;
    }

    // Only retry on server errors (5xx)
    if (attempt < maxRetries && response.status >= 500) {
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
      continue;
    }

    // Non-retryable or retries exhausted
    const errorBody = await response.text().catch(() => "Unknown error");
    throw new CheckrApiError(response.status, errorBody, endpoint, attempt + 1);
  }

  // Should never reach here, but TypeScript needs it
  throw new CheckrApiError(0, "Max retries exceeded", endpoint, maxRetries + 1);
}

// ── Exported API Functions ───────────────────────────────────────

export async function createCandidate(data: {
  firstName: string;
  lastName: string;
  email: string;
  dob: string;
}): Promise<CheckrCandidate> {
  return checkrFetch<CheckrCandidate>("/candidates", {
    method: "POST",
    body: JSON.stringify({
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
      dob: data.dob,
    }),
  });
}

export async function createInvitation(
  candidateId: string,
  packageName = "tasker_standard",
): Promise<CheckrInvitation> {
  return checkrFetch<CheckrInvitation>("/invitations", {
    method: "POST",
    body: JSON.stringify({
      candidate_id: candidateId,
      package: packageName,
    }),
  });
}

export async function getReport(reportId: string): Promise<CheckrReport> {
  return checkrFetch<CheckrReport>(`/reports/${reportId}`, {
    method: "GET",
  });
}

export async function createAdverseAction(reportId: string): Promise<CheckrAdverseAction> {
  return checkrFetch<CheckrAdverseAction>(`/reports/${reportId}/adverse_actions`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}
