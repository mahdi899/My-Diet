import type { StoredAnswers } from '../../questionnaire/domain/answers.js';
import type { QueueBucket } from '../domain/queue.js';
import type { MealInput } from '../domain/draft.js';
import type { ModelProfile } from '../../nutrition/model-profile.js';
import type { PlanDraftProvider } from './draft-provider.js';

export interface PlanRecords<T> { items: T[]; count: number }
export interface PlanDay { id: string; dayIndex: number; meals: MealInput[] }

/** Operations are bound to one transaction when supplied by transaction(). */
export interface PlanSession {
  claimableRequest(values: readonly [string]): Promise<PlanRecords<{
        status: string;
        flags: string[];
        answers: StoredAnswers;
        specialist_id: string | null;
        schema_version: number;
        user_id: string;
        phone_e164: string;
      }>>;
  existingVersion(values: readonly [string]): Promise<PlanRecords<{ id: string }>>;
  recoverExistingDraft(values: readonly [string]): Promise<PlanRecords<never>>;
  claimGeneration(values: readonly [string]): Promise<PlanRecords<{ request_id: string }>>;
  finishRecoveredRequest(values: readonly [string]): Promise<PlanRecords<never>>;
  failUncertainClaim(values: readonly [string]): Promise<PlanRecords<never>>;
  recordUncertainGeneration(values: readonly [string, string]): Promise<PlanRecords<never>>;
  startGeneration(values: readonly [string]): Promise<PlanRecords<never>>;
  mealHistory(values: readonly [string, string]): Promise<PlanRecords<{ recorded: number; eaten: number; days: number }>>;
  lockGenerationStatus(values: readonly [string]): Promise<PlanRecords<{ status: string }>>;
  failCancelledClaim(values: readonly [string]): Promise<PlanRecords<never>>;
  recordCancelledGeneration(values: readonly [string, string, string, number, number, string]): Promise<PlanRecords<never>>;
  generationTarget(values: readonly [string, boolean]): Promise<PlanRecords<{ id: string }>>;
  advanceDraftLock(values: readonly [string]): Promise<PlanRecords<never>>;
  finishGenerationClaim(values: readonly [string, string, string | null]): Promise<PlanRecords<never>>;
  finishGenerationRequest(values: readonly [string]): Promise<PlanRecords<never>>;
  nextAttempt(values: readonly [string]): Promise<PlanRecords<{ n: number }>>;
  recordGeneration(values: readonly [string, string, string, string, string | null, string | null, number, string, string, number, number, number, number, string, string | null, string | null, string | null]): Promise<PlanRecords<{id:string}>>;
  attachGeneration(values: readonly [string, string]): Promise<PlanRecords<never>>;
  costCapWarning(values: readonly [Date]): Promise<PlanRecords<{ id: string }>>;
  recordGenerationEvent(values: readonly [string, string, string, string]): Promise<PlanRecords<never>>;
  publishedVersion(values: readonly [string]): Promise<PlanRecords<{ id: string }>>;
  specialistQueue(values: readonly [string, QueueBucket | null]): Promise<PlanRecords<{
      id: string;
      status: string;
      kind: string;
      created_at: Date;
      display_name: string | null;
    }>>;
  latestUserRequest(values: readonly [string]): Promise<PlanRecords<{ id: string }>>;
  requestAssignment(values: readonly [string]): Promise<PlanRecords<{ assigned_specialist_id: string | null }>>;
  recordHealthAccess(values: readonly [string, string, string, string | null]): Promise<PlanRecords<never>>;
  editableVersions(values: readonly [string]): Promise<PlanRecords<{ id: string; status: string; lock_version: number; version_number: number }>>;
  advanceExpectedDraftLock(values: readonly [string, number]): Promise<PlanRecords<never>>;
  reopenPublishedRequest(values: readonly [string]): Promise<PlanRecords<never>>;
  recordDraftEdit(values: readonly [string, string, string]): Promise<PlanRecords<never>>;
  versionLock(values: readonly [string | undefined]): Promise<PlanRecords<{ lock_version: number }>>;
  redraftVersions(values: readonly [string]): Promise<PlanRecords<{ id: string; status: string; lock_version: number }>>;
  redraftRiskFlags(values: readonly [string]): Promise<PlanRecords<{ flags: string[] }>>;
  clearGenerationClaim(values: readonly [string]): Promise<PlanRecords<never>>;
  startRedraft(values: readonly [string]): Promise<PlanRecords<never>>;
  recordRedraftRequest(values: readonly [string, string, string]): Promise<PlanRecords<never>>;
  recoverFailedRedraft(values: readonly [string]): Promise<PlanRecords<never>>;
  specialistVerification(values: readonly [string]): Promise<PlanRecords<{ active: boolean; verification_status: string }>>;
  lockOwner(values: readonly [string]): Promise<PlanRecords<never>>;
  blockingQuestions(values: readonly [string]): Promise<PlanRecords<{ id: string }>>;
  latestDraftVersion(values: readonly [string]): Promise<PlanRecords<{ id: string; lock_version: number }>>;
  unchangedActiveBase(values: readonly [string, string]): Promise<PlanRecords<{ present: number }>>;
  recordReviewCompletion(values: readonly [string, string]): Promise<PlanRecords<never>>;
  datePlanDay(values: readonly [string, string]): Promise<PlanRecords<never>>;
  supersedePublishedVersion(values: readonly [string]): Promise<PlanRecords<never>>;
  publishVersion(values: readonly [string, Date]): Promise<PlanRecords<never>>;
  publishRequest(values: readonly [string, string, string]): Promise<PlanRecords<never>>;
  recordPublication(values: readonly [string, string, string]): Promise<PlanRecords<never>>;
  activateVersion(values: readonly [string, string]): Promise<PlanRecords<never>>;
  createQuestion(values: readonly [string, string, string, string, boolean]): Promise<PlanRecords<never>>;
  awaitUser(values: readonly [string]): Promise<PlanRecords<never>>;
  recordQuestionEvent(values: readonly [string, string, string]): Promise<PlanRecords<never>>;
  lockAnswerQuestion(values: readonly [string]): Promise<PlanRecords<{
        id: string;
        request_id: string;
        status: string;
        required: boolean;
        user_id: string;
        specialist_id: string | null;
      }>>;
  createAnswer(values: readonly [string, string, string, string]): Promise<PlanRecords<never>>;
  markAnswered(values: readonly [string]): Promise<PlanRecords<never>>;
  openRequiredQuestions(values: readonly [string]): Promise<PlanRecords<{ id: string }>>;
  markResponseReceived(values: readonly [string]): Promise<PlanRecords<never>>;
  lockAcknowledgementQuestion(values: readonly [string]): Promise<PlanRecords<{
        request_id: string;
        status: string;
        assigned_specialist_id: string | null;
      }>>;
  acknowledgeQuestion(values: readonly [string]): Promise<PlanRecords<never>>;
  remainingRequiredQuestions(values: readonly [string]): Promise<PlanRecords<{ id: string }>>;
  finishQuestionReview(values: readonly [string]): Promise<PlanRecords<never>>;
  userQuestions(values: readonly [string, string]): Promise<PlanRecords<{
      id: string;
      request_id: string;
      prompt: string;
      required: boolean;
      status: string;
      created_at: Date;
    }>>;
  lockWithdrawalQuestion(values: readonly [string]): Promise<PlanRecords<{
        request_id: string;
        status: string;
        assigned_specialist_id: string | null;
      }>>;
  withdrawQuestion(values: readonly [string]): Promise<PlanRecords<never>>;
  remainingWithdrawalQuestions(values: readonly [string]): Promise<PlanRecords<{ id: string }>>;
  finishWithdrawalReview(values: readonly [string]): Promise<PlanRecords<never>>;
  recordWithdrawal(values: readonly [string, string, string, string]): Promise<PlanRecords<never>>;
  activePublishedPlan(values: readonly [string]): Promise<PlanRecords<{
      id: string;
      version_id: string;
      week_start: string;
      effective_from: string;
    }>>;
  userRequests(values: readonly [string]): Promise<PlanRecords<{
      id: string;
      status: string;
      kind: string;
      price_toman: string;
      created_at: Date;
    }>>;
  ownedTimelineRequest(values: readonly [string, string]): Promise<PlanRecords<{
      id: string;
      status: string;
      kind: string;
      price_toman: string;
      created_at: Date;
    }>>;
  requestEvents(values: readonly [string]): Promise<PlanRecords<{ kind: string; created_at: Date }>>;
  timelineQuestions(values: readonly [string]): Promise<PlanRecords<{
      id: string;
      prompt: string;
      required: boolean;
      status: string;
    }>>;
  correctionDraft(values: readonly [string]): Promise<PlanRecords<never>>;
  correctionBase(values: readonly [string]): Promise<PlanRecords<{ id: string; version_number: number }>>;
  startCorrection(values: readonly [string]): Promise<PlanRecords<never>>;
  recordCorrection(values: readonly [string, string, string]): Promise<PlanRecords<never>>;
  patientAssignment(values: readonly [string, string]): Promise<PlanRecords<never>>;
  patientVersions(values: readonly [string]): Promise<PlanRecords<{
      id: string;
      request_id: string;
      status: string;
      version_number: number;
      published_at: Date | null;
      week_start: string | null;
    }>>;
  adminVersion(values: readonly [string]): Promise<PlanRecords<{ id: string; request_id: string; status: string }>>;
  recordVersionAccess(values: readonly [string, string, string, string]): Promise<PlanRecords<never>>;
  datedVersions(values: readonly [string, string, string]): Promise<PlanRecords<{
      version_id: string;
      request_id: string;
      status: 'published' | 'superseded';
      published_at: Date;
      civil_date: string;
      day_index: number;
    }>>;
  dayMealLogs(values: readonly [string, string, string]): Promise<PlanRecords<{ meal_uid: string; eaten: boolean;plan_version_id:string|null;option_uid:string|null;details:Record<string,unknown>;revision:number }>>;
  dayMealSelections(values: readonly [string, string]): Promise<PlanRecords<{meal_uid:string;option_uid:string;revision:number;version_id:string}>>;
  lockRequest(values: readonly [string]): Promise<PlanRecords<{
      user_id: string;
      status: string;
      assigned_specialist_id: string | null;
      week_start: string | null;
      effective_from: string | null;
    }>>;
  requestDetails(values: readonly [string]): Promise<PlanRecords<{
      id: string;
      user_id: string;
      status: string;
      kind: string;
      price_toman: string;
      week_start: string | null;
      effective_from: string | null;
      display_name: string | null;
    }>>;
  requestQuestions(values: readonly [string]): Promise<PlanRecords<{
      id: string;
      prompt: string;
      required: boolean;
      status: string;
    }>>;
  requestAnswers(values: readonly [string]): Promise<PlanRecords<{ question_id: string; body: string; created_at: Date }>>;
  careConversation(values: readonly [string]): Promise<PlanRecords<{ id: string }>>;
  reviewVersion(values: readonly [string]): Promise<PlanRecords<{ id: string; version_number:number; status: string; lock_version: number }>>;
  generationWarnings(values: readonly [string]): Promise<PlanRecords<{ warnings: unknown }>>;
  requestRiskFlags(values: readonly [string]): Promise<PlanRecords<{ flags: string[] | null }>>;
  latestGenerationReview(values: readonly [string]): Promise<PlanRecords<{
      id: string; status: string; provider: string; model: string; pool_code: string | null; prompt_version: string;
      cost_micros: string; tokens: number; skipped_reason: string | null; ai_notes: Record<string, unknown> | null;
      attempt_chain: unknown; warnings: unknown; created_at: Date; attempt_no: number;
    }>>;
  insertDays(requestId: string, version: number, createdBy: string | null, days: MealInput[][]): Promise<string>;
  insertDayContents(versionId: string, days: MealInput[][], approver?: string | null): Promise<void>;
  deleteDays(versionId: string): Promise<void>;
  readDays(versionId: string): Promise<PlanDay[]>;
  audit(actorId: string | null, action: string, targetType: string, targetId: string | null, detail?: object): Promise<void>;
  notify(userId: string, kind: string, payload: object): Promise<void>;
  insertOutbox(topic: string, aggregateId: string, payload: object): Promise<void>;
}

export interface PlanRepository extends PlanSession {
  transaction<T>(run: (session: PlanSession) => Promise<T>): Promise<T>;
  withGenerationLock<T>(run: () => Promise<T>): Promise<T>;
}

export interface PlanServices {
  provider: PlanDraftProvider;
  budget: { preflight(userId: string): Promise<{ reason: string; spentMicros: number; capMicros: number | null } | null> };
  profiles: { ensureProfile(userId: string): Promise<unknown>; loadModelProfile(userId: string): Promise<ModelProfile | null> };
  cipher: { encrypt(text: string): string; decrypt(text: string): string; openAnswers(answers: StoredAnswers): StoredAnswers };
  telemetry: { costCapHit(): void; attempt(status: string): void };
}
