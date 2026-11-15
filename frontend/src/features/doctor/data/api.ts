import { StaffError } from "@shared/api/staff-session";
import { asRows } from "@shared/utils";
import { staff } from "../session";
import { doctorPreviewEnabled, previewProfile } from "./preview";
import {
  messagingSample,
  previewReviewQueue,
  samplePlanRequest,
  type PlanRequest,
  type QueueRow,
} from "./samples";

// ── Re-exports (keep backward compat) ───────────────────────────────────────
export type { PlanRequest, QueueRow };

// ── Error helper ─────────────────────────────────────────────────────────────
export function apiError(error: unknown): string {
  return error instanceof StaffError
    ? error.message
    : "دریافت اطلاعات انجام نشد.";
}

// ── Queue ────────────────────────────────────────────────────────────────────
export async function loadQueue(path: string): Promise<QueueRow[]> {
  if (doctorPreviewEnabled()) {
    if (path.includes("revisions")) {
      return (await messagingSample().changes()).map((row) => ({
        id: row.id,
        displayName: row.displayName,
        status: row.status,
        kind: "revision" as const,
        createdAt: row.createdAt,
      }));
    }
    if (path.includes("awaiting_review")) return previewReviewQueue;
    return [
      ...previewReviewQueue,
      ...(await loadQueue("specialist/queue?bucket=revisions")),
    ];
  }
  return asRows(await staff.api(path)) as QueueRow[];
}

// ── Plan ─────────────────────────────────────────────────────────────────────
export async function loadPlan(id: string): Promise<PlanRequest> {
  if (doctorPreviewEnabled()) return samplePlanRequest(id);
  return staff.api<PlanRequest>("specialist/requests/" + encodeURIComponent(id));
}

export async function publishPlan(id: string): Promise<void> {
  await staff.api("specialist/requests/" + encodeURIComponent(id) + "/publish", {
    method: "POST",
  });
}

export async function regeneratePlan(id: string): Promise<void> {
  await staff.api(
    "specialist/requests/" + encodeURIComponent(id) + "/regenerate",
    { method: "POST" }
  );
}

export async function savePlanDraft(
  id: string,
  draft: object,
  etag: string
): Promise<void> {
  await staff.api("specialist/requests/" + encodeURIComponent(id) + "/draft", {
    method: "PUT",
    headers: { "If-Match": etag },
    body: JSON.stringify(draft),
  });
}

export async function addCorrection(
  id: string,
  note: string
): Promise<void> {
  await staff.api(
    "specialist/requests/" + encodeURIComponent(id) + "/corrections",
    {
      method: "POST",
      body: JSON.stringify({ note }),
    }
  );
}

// ── Patient profile ───────────────────────────────────────────────────────────
export interface PatientProfile {
  userId: string;
  name: string;
  goal: string;
  age: number | null;
  sex: "male" | "female" | null;
  currentWeightKg: number | null;
  targetWeightKg: number | null;
  heightCm: number | null;
  bmi: number | null;
  targetKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  allergens: string[];
  dietStyle: string;
  safetyTier: "ai_ok" | "doctor_only";
  specVersion: number;
  answers: Record<string, unknown>;
  weightHistory: Array<{ date: string; kg: number }>;
  activeRequestId: string | null;
  activeRequestStatus: string | null;
}

export async function loadPatientProfile(userId: string): Promise<PatientProfile> {
  const [onboarding, weights] = await Promise.all([
    staff.api<Record<string, unknown>>(
      "admin/onboarding/profiles/" + encodeURIComponent(userId)
    ),
    staff.api<Array<{ entry_date: string; weight_kg: number }>>(
      "specialist/patients/" + encodeURIComponent(userId) + "/weights"
    ).catch(() => [] as Array<{ entry_date: string; weight_kg: number }>),
  ]);

  return {
    userId,
    name: String(onboarding.name ?? ""),
    goal: String(onboarding.goal ?? ""),
    age: (onboarding.age as number) ?? null,
    sex: (onboarding.sex as "male" | "female") ?? null,
    currentWeightKg: (onboarding.currentWeightKg as number) ?? null,
    targetWeightKg: (onboarding.targetWeightKg as number) ?? null,
    heightCm: (onboarding.heightCm as number) ?? null,
    bmi: (onboarding.bmi as number) ?? null,
    targetKcal: (onboarding.targetKcal as number) ?? 0,
    proteinG: (onboarding.proteinG as number) ?? 0,
    carbsG: (onboarding.carbsG as number) ?? 0,
    fatG: (onboarding.fatG as number) ?? 0,
    allergens: (onboarding.allergens as string[]) ?? [],
    dietStyle: String(onboarding.dietStyle ?? "regular"),
    safetyTier: (onboarding.safetyTier as "ai_ok" | "doctor_only") ?? "ai_ok",
    specVersion: (onboarding.specVersion as number) ?? 1,
    answers: (onboarding.answers as Record<string, unknown>) ?? {},
    weightHistory: weights.map((w) => ({
      date: w.entry_date,
      kg: w.weight_kg,
    })),
    activeRequestId: (onboarding.activeRequestId as string) ?? null,
    activeRequestStatus: (onboarding.activeRequestStatus as string) ?? null,
  };
}

// ── Info questions ────────────────────────────────────────────────────────────
export interface InfoQuestion {
  id: string;
  text: string;
  status: string;
  createdAt: string;
  answer?: string;
}

export async function loadInfoQuestions(
  requestId: string
): Promise<InfoQuestion[]> {
  const rows = await staff.api<InfoQuestion[]>(
    "specialist/info-questions?requestId=" + encodeURIComponent(requestId)
  ).catch(() => [] as InfoQuestion[]);
  return rows;
}

export async function askInfoQuestion(
  requestId: string,
  text: string
): Promise<void> {
  await staff.api(
    "specialist/requests/" + encodeURIComponent(requestId) + "/questions",
    { method: "POST", body: JSON.stringify({ text }) }
  );
}

export async function acknowledgeInfoQuestion(id: string): Promise<void> {
  await staff.api(
    "specialist/info-questions/" + encodeURIComponent(id) + "/acknowledge",
    { method: "POST" }
  );
}

// ── Patient reports ───────────────────────────────────────────────────────────
export async function loadPatientReports(userId: string): Promise<unknown[]> {
  return staff
    .api<unknown[]>(
      "specialist/patients/" + encodeURIComponent(userId) + "/patient-reports"
    )
    .catch(() => []);
}

// ── Specialist profile ────────────────────────────────────────────────────────
export async function loadProfile() {
  if (doctorPreviewEnabled()) return previewProfile;
  return staff.api<typeof previewProfile>("specialist/profile");
}

export async function saveProfile(data: Partial<typeof previewProfile>): Promise<void> {
  await staff.api("specialist/profile", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// ── SLA helpers ───────────────────────────────────────────────────────────────
/** Returns remaining hours until 24h SLA deadline from createdAt. */
export function slaHoursRemaining(createdAt: string): number {
  const deadline = new Date(createdAt).getTime() + 24 * 60 * 60 * 1000;
  const remaining = (deadline - Date.now()) / (60 * 60 * 1000);
  return Math.max(0, remaining);
}

export function slaUrgency(hours: number): "ok" | "warning" | "critical" {
  if (hours <= 0) return "critical";
  if (hours <= 6) return "critical";
  if (hours <= 12) return "warning";
  return "ok";
}
