import type { Role } from '../../common/roles.js';
import { ApplicationError as ApiError } from '../../common/application-error.js';
import { uuidv7 } from '../../common/id.js';
import { addCivilDays, civilNow, fridayOfWeek, tehranDayStartUtc, tehranToday, weekStartSaturday } from '../../common/time.js';
import { PROMPT_VERSION, usageCount } from '../../ai/cost.js';
import { AI_SKIP_FLAGS } from '../../questionnaire/domain/answers.js';
import { minimizeForModel } from '../../ai/minimize.js';
import { draftWarnings } from '../../ai/warnings.js';
import { acceptsAnotherAnswer, canWithdrawQuestion, type InfoQuestionStatus } from '../questions.js';
import type { QueueBucket } from '../domain/queue.js';
import { parseCivilDate, versionForDate, type DatedVersion } from '../views.js';
import { requireApprovedOptions } from '../options.js';
import { GenerationError, type DraftNotes } from './draft-provider.js';
import type { ModelProfile } from '../../nutrition/model-profile.js';
import { emptyDraft, isUsable, producedToInput, assertPublishable, parseDays, type DayInput } from '../domain/draft.js';
import type { PlanRepository, PlanSession, PlanServices, PlanDay } from './ports.js';

export class PlanUseCases {
  constructor(
    private readonly repository: PlanRepository,
    private readonly services: PlanServices,
  ) {}

  async generate(requestId: string, options: { regenerate?: boolean } = {}): Promise<void> {
    await this.repository.withGenerationLock(() => this.generateClaimed(requestId, options.regenerate === true));
  }

  private async generateClaimed(requestId: string, regenerate = false): Promise<void> {
    const claimed = await this.repository.transaction( async (client) => {
      const row = await client.claimableRequest([requestId]);
      const request = row.items[0];
      if (!request || (request.status !== 'queued' && request.status !== 'generating')) return null;
      const existing = await client.existingVersion([requestId]);
      if (!regenerate && (existing.count ?? 0) > 0) {
        await client.recoverExistingDraft([requestId]);
        return null;
      }
      const claim=await client.claimGeneration([requestId]);
      if (!claim.count) {
        // Maintenance may requeue an interrupted job. Never repeat an uncertain
        // paid call; recover an editable blank week for specialist completion.
        if(request.status==='queued') {
          await client.insertDays(requestId,1,null,emptyDraft());
          await client.finishRecoveredRequest([requestId]);
          await client.failUncertainClaim([requestId]);
          await client.recordUncertainGeneration([uuidv7(),requestId]);
        }
        return null;
      }
      await client.startGeneration([requestId]);
      return request;
    });
    if (!claimed) return;

    const highRisk = claimed.flags.some((flag) => (AI_SKIP_FLAGS as readonly string[]).includes(flag));
    const blocked = highRisk ? null : await this.services.budget.preflight(claimed.user_id);
    const skipReason = highRisk ? 'high_risk' : blocked?.reason ?? null;
    let draft = emptyDraft();
    let aiStatus: 'drafted' | 'skipped' | 'failed' = skipReason ? 'skipped' : 'drafted';
    let reason: string | null = skipReason;
    let providerName = skipReason ? 'none' : this.services.provider.name;
    let rawOutput: string | null = null;
    let model = '';
    let promptVersion = PROMPT_VERSION;
    let tokens = 0;
    let costMicros = 0;
    let latencyMs = 0;
    let poolCode: string | null = null;
    const opened = this.services.cipher.openAnswers(claimed.answers);
    const minimized = minimizeForModel(opened, requestId, {
      userId: claimed.user_id,
      phone: claimed.phone_e164,
      name: opened.name,
    });
    const history=(await this.repository.mealHistory([claimed.user_id,tehranToday()])).items[0];
    minimized.history={recordedMeals:history.recorded,eatenMeals:history.eaten,daysWithRecords:history.days,cutoff:civilNow().toISOString()};
    let notes: DraftNotes | null = null;
    if (!skipReason) {
      const started = Date.now();
      try {
        await this.services.profiles.ensureProfile(claimed.user_id).catch(() => null);
        const profile = await this.services.profiles.loadModelProfile(claimed.user_id);
        if (profile) minimized.profile = profile;
        const produced = await this.services.provider.draft({ ...minimized, requestId });
        notes = produced.notes ?? null;
        poolCode = produced.notes?.poolCode ?? null;
        latencyMs = Date.now() - started;
        rawOutput = this.services.cipher.encrypt(JSON.stringify(produced));
        providerName = produced.provider ?? providerName;
        model = produced.usage?.model ?? '';
        promptVersion = produced.usage?.promptVersion || PROMPT_VERSION;
        tokens = usageCount(produced.usage?.tokens);
        costMicros = usageCount(produced.usage?.costMicros);
        if (isUsable(produced)) draft = producedToInput(produced);
        else {
          aiStatus = 'failed';
          reason = 'invalid_draft';
        }
      } catch (error) {
        latencyMs = Math.max(0, Date.now() - started);
        aiStatus = 'failed';
        reason = error instanceof GenerationError ? error.code : 'provider_error';
        if (error instanceof GenerationError && error.usage) {
          // Calls that were made are paid for even when no plan came out of them.
          tokens = usageCount(error.usage.tokens);
          costMicros = usageCount(error.usage.costMicros);
          model = error.usage.model || model;
          providerName = error.usage.provider || providerName;
        }
      }
    }
    const warnings = aiStatus === 'drafted' ? draftWarnings(draft, opened.allergies ?? '', opened.dislikes ?? '') : [];

    await this.repository.transaction( async (client) => {
      const current = await client.lockGenerationStatus([requestId]);
      if (current.items[0]?.status !== 'generating') {
        await client.failCancelledClaim([requestId]);
        await client.recordCancelledGeneration([uuidv7(),requestId,providerName,costMicros,tokens,model]);
        return;
      }
      const existing = await client.generationTarget([requestId, regenerate]);
      if (regenerate) {
        // A doctor asked for a fresh draft: swap the week in place, and keep the old one when this run produced nothing.
        const target = existing.items[0];
        if (target && aiStatus === 'drafted') {
          await client.deleteDays(target.id);
          await client.insertDayContents(target.id, draft, null);
          await client.advanceDraftLock([target.id]);
        }
      } else {
        if ((existing.count ?? 0) > 0) return;
        await client.insertDays(requestId, 1, null, draft);
      }
      await client.finishGenerationClaim([requestId,aiStatus==='failed'?'failed':'completed',reason]);
      await client.finishGenerationRequest([requestId]);
      const attempt = await client.nextAttempt([requestId]);
      const generation = await client.recordGeneration([
          uuidv7(),
          requestId,
          providerName,
          aiStatus,
          reason,
          rawOutput,
          attempt.items[0]?.n ?? 1,
          model,
          promptVersion,
          claimed.schema_version,
          tokens,
          latencyMs,
          costMicros,
          JSON.stringify(warnings),
          poolCode,
          notes ? JSON.stringify(notes.attemptChain) : null,
          notes ? JSON.stringify({ ...notes, attemptChain: undefined }) : null,
        ]);
      await client.attachGeneration([requestId,generation.items[0]!.id]);
      if (reason === 'cost_cap' && blocked) {
        const dayStart = tehranDayStartUtc();
        const prior = await client.costCapWarning([dayStart]);
        if ((prior.count ?? 0) === 0) {
          await client.audit( null, 'ai_cost_cap', 'ai_controls', null, {
            spentMicros: blocked.spentMicros,
            capMicros: blocked.capMicros,
          });
        }
        this.services.telemetry.costCapHit();
      }
      this.services.telemetry.attempt(aiStatus);
      await client.recordGenerationEvent([uuidv7(), requestId, aiStatus === 'drafted' ? 'ai_drafted' : 'ai_skipped', JSON.stringify({ status: aiStatus })]);
      if (claimed.specialist_id) {
        await client.notify( claimed.specialist_id, 'draft_ready', { requestId });
      }
    });
  }

  async copyPublishedDraft(client: PlanSession, parentRequestId: string, requestId: string): Promise<void> {
    const version = await client.publishedVersion([parentRequestId]);
    if (!version.items[0]) throw new ApiError(409, 'no_published_plan', 'برنامهٔ تأییدشده‌ای برای اصلاح نیست');
    const days = await client.readDays(version.items[0].id);
    await client.insertDays(requestId,
      1,
      null,
      days.map((day) => day.meals.map((meal) => ({ ...meal, options:meal.options?.map(o=>({...o,approved:false})) }))),
    );
  }

  async queue(specialistId: string, bucket: QueueBucket | null = null) {
    const rows = await this.repository.specialistQueue([specialistId, bucket]);
    return rows.items.map((row) => ({
      id: row.id,
      status: row.status,
      kind: row.kind,
      createdAt: row.created_at.toISOString(),
      displayName: row.display_name,
    }));
  }

  async userRequest(userId: string) {
    const row = await this.repository.latestUserRequest([userId]);
    if (!row.items[0]) return null;
    return this.presentRequest(row.items[0].id, false);
  }

  async staffRequest(actorId: string, role: Role, requestId: string, reason: string | null) {
    if (role === 'admin' && (!reason || reason.trim().length < 3)) {
      throw new ApiError(400, 'reason_required', 'دلیل مشاهده را بنویسید');
    }
    const access = await this.repository.requestAssignment([requestId]);
    const request = access.items[0];
    if (!request) throw new ApiError(404, 'not_found', 'درخواست پیدا نشد');
    if (role === 'specialist' && request.assigned_specialist_id !== actorId) {
      throw new ApiError(404, 'not_found', 'درخواست پیدا نشد');
    }
    await this.repository.recordHealthAccess([uuidv7(), actorId, requestId, reason]);
    return this.presentRequest(requestId, true);
  }

  async replaceDraft(actorId: string, role: Role, requestId: string, lock: number, body: unknown) {
    const days = parseDays(body);
    if (role !== 'specialist' && days.flat().some(m => m.options?.some(o => o.approved))) {
      throw new ApiError(403, 'forbidden', 'تأیید گزینه فقط با متخصص است');
    }
    return this.repository.transaction( async (client) => {
      const request = await this.lockRequest(client, actorId, role, requestId);
      if (request.status === 'cancelled' || request.status === 'queued' || request.status === 'generating') {
        throw new ApiError(409, 'not_ready', 'پیش‌نویس هنوز آمادهٔ ویرایش نیست');
      }
      const versions = await client.editableVersions([requestId]);
      const draft = versions.items.find((version) => version.status === 'draft');
      const published = versions.items.find((version) => version.status === 'published');
      let versionId = draft?.id;
      if (draft) {
        if (draft.lock_version !== lock) throw new ApiError(409, 'lock_conflict', 'نسخهٔ برنامه تغییر کرده است');
        await client.deleteDays(draft.id);
        await client.advanceExpectedDraftLock([draft.id, lock]);
      } else if (published) {
        if (published.lock_version !== lock) throw new ApiError(409, 'lock_conflict', 'نسخهٔ برنامه تغییر کرده است');
        versionId = await client.insertDays(requestId, published.version_number + 1, actorId, days);
        await client.reopenPublishedRequest([requestId]);
      } else {
        throw new ApiError(409, 'not_ready', 'پیش‌نویس هنوز آمادهٔ ویرایش نیست');
      }
      if (draft) await client.insertDayContents(draft.id, days, role === 'specialist' ? actorId : null);
      await client.recordDraftEdit([uuidv7(), requestId, actorId]);
      const current = await client.versionLock([versionId]);
      return { lockVersion: current.items[0]?.lock_version ?? lock + 1 };
    });
  }

  /**
   * Doctor-initiated redraft. Validates synchronously, flips the request to `generating`, then runs the
   * pipeline in the background; the editor polls the request until it is back in review.
   */
  async regenerate(actorId: string, requestId: string, lock: number): Promise<{ status: 'generating' }> {
    await this.repository.transaction( async (client) => {
      const request = await this.lockRequest(client, actorId, 'specialist', requestId);
      if (request.status !== 'in_review') throw new ApiError(409, 'not_ready', 'فقط پیش‌نویس در حال بررسی را می‌توان دوباره ساخت');
      const versions = await client.redraftVersions([requestId]);
      const draft = versions.items.find((v) => v.status === 'draft');
      if (!draft) throw new ApiError(409, 'not_ready', 'پیش‌نویسی برای ساخت دوباره نیست');
      if (draft.lock_version !== lock) throw new ApiError(409, 'lock_conflict', 'نسخهٔ برنامه تغییر کرده است');
      const flags = await client.redraftRiskFlags([requestId]);
      if ((flags.items[0]?.flags ?? []).some((f) => (AI_SKIP_FLAGS as readonly string[]).includes(f))) {
        throw new ApiError(409, 'high_risk', 'این پرونده پرخطر است و باید کامل توسط متخصص نوشته شود');
      }
      const blocked = await this.services.budget.preflight(request.user_id);
      if (blocked) throw new ApiError(409, 'ai_budget_blocked', 'سقف هزینهٔ هوش مصنوعی اجازهٔ ساخت دوباره نمی‌دهد');
      await client.clearGenerationClaim([requestId]);
      await client.startRedraft([requestId]);
      await client.recordRedraftRequest([uuidv7(), requestId, actorId]);
    });
    void this.generate(requestId, { regenerate: true }).catch(async () => {
      await this.repository.recoverFailedRedraft([requestId]).catch(() => undefined);
    });
    return { status: 'generating' };
  }

  async publish(actorId: string, role: Role, requestId: string, lock: number, existing?: PlanSession) {
    if (role !== 'specialist') {
      throw new ApiError(403, 'forbidden', 'انتشار برنامه فقط با متخصص است');
    }
    const run = async (client: PlanSession) => {
      const profile = await client.specialistVerification([actorId]);
      const specialist = profile.items[0];
      if (!specialist || !specialist.active || specialist.verification_status !== 'verified') {
        throw new ApiError(403, 'not_verified', 'فقط متخصص تأییدشده و فعال می‌تواند برنامه را منتشر کند');
      }
      const request = await this.lockRequest(client, actorId, role, requestId);
      // Serializes active-pointer replacement across different requests of one owner.
      await client.lockOwner([request.user_id]);
      if (request.status !== 'in_review') {
        throw new ApiError(409, 'info_required', 'تا بسته شدن سؤال‌ها نمی‌توان برنامه را تأیید کرد');
      }
      const blocking = await client.blockingQuestions([requestId]);
      if ((blocking.count ?? 0) > 0) {
        throw new ApiError(409, 'info_required', 'تا بسته شدن سؤال‌ها نمی‌توان برنامه را تأیید کرد');
      }
      const draft = await client.latestDraftVersion([requestId]);
      const version = draft.items[0];
      if (!version) throw new ApiError(409, 'plan_incomplete', 'پیش‌نویسی برای تأیید نیست');
      if (version.lock_version !== lock) throw new ApiError(409, 'lock_conflict', 'نسخهٔ برنامه تغییر کرده است');
      const base = await client.unchangedActiveBase([version.id,requestId]);
      if (!base.count) throw new ApiError(409,'lock_conflict','برنامه فعال تغییر کرده است؛ پیش‌نویس باید بازبینی شود');
      const days = await client.readDays(version.id);
      assertPublishable(days);
      for (const day of days) for (const meal of day.meals) requireApprovedOptions(meal.options);
      await client.recordReviewCompletion([version.id,actorId]);
      const today = tehranToday();
      const weekStart = request.week_start ?? weekStartSaturday(today);
      const effectiveFrom = request.effective_from ?? today;
      if (today > fridayOfWeek(weekStart)) throw new ApiError(409,'week_closed','هفته این برنامه پایان یافته است');
      for (const day of days) {
        await client.datePlanDay([
          day.id,
          addCivilDays(weekStart, day.dayIndex),
        ]);
      }
      await client.supersedePublishedVersion([requestId]);
      await client.publishVersion([version.id,civilNow()]);
      await client.publishRequest([requestId, weekStart, effectiveFrom]);
      await client.recordPublication([uuidv7(), requestId, actorId]);
      await client.notify( request.user_id, 'plan_published', { requestId });
      await client.insertOutbox('shopping.invalidate',request.user_id,{requestId,versionId:version.id});
      await client.activateVersion([request.user_id,version.id]);
      return { status: 'published' as const, versionId: version.id };
    };
    return existing ? run(existing) : this.repository.transaction( run);
  }

  async ask(actorId: string, role: Role, requestId: string, prompt: string, required: boolean) {
    return this.repository.transaction( async (client) => {
      const request = await this.lockRequest(client, actorId, role, requestId);
      if (request.status === 'cancelled' || request.status === 'queued' || request.status === 'generating') {
        throw new ApiError(409, 'not_ready', 'هنوز نمی‌توان سؤال پرسید');
      }
      const id = uuidv7();
      await client.createQuestion([id, requestId, actorId, this.services.cipher.encrypt(prompt), required]);
      if (required) {
        await client.awaitUser([requestId]);
      }
      await client.recordQuestionEvent([uuidv7(), requestId, actorId]);
      await client.notify( request.user_id, 'info_requested', { requestId, questionId: id });
      return { id, status: required ? 'awaiting_user' : request.status };
    });
  }

  async answer(userId: string, questionId: string, body: string) {
    return this.repository.transaction( async (client) => {
      const question = await client.lockAnswerQuestion([questionId]);
      const row = question.items[0];
      if (!row || row.user_id !== userId) throw new ApiError(404, 'not_found', 'سؤال پیدا نشد');
      if (!acceptsAnotherAnswer(row.status)) {
        throw new ApiError(409, 'already_answered', 'به این سؤال قبلاً پاسخ داده شده است');
      }
      await client.createAnswer([uuidv7(), questionId, userId, this.services.cipher.encrypt(body)]);
      if (row.status === 'open') {
        await client.markAnswered([questionId]);
        const open = await client.openRequiredQuestions([row.request_id]);
        if ((open.count ?? 0) === 0) {
          await client.markResponseReceived([row.request_id]);
        }
      }
      if (row.specialist_id) await client.notify( row.specialist_id, 'info_answered', { requestId: row.request_id, questionId });
      return { status: 'answered' as const };
    });
  }

  async acknowledge(actorId: string, role: Role, questionId: string) {
    return this.repository.transaction( async (client) => {
      const question = await client.lockAcknowledgementQuestion([questionId]);
      const row = question.items[0];
      if (!row) throw new ApiError(404, 'not_found', 'سؤال پیدا نشد');
      if (role === 'specialist' && row.assigned_specialist_id !== actorId) {
        throw new ApiError(404, 'not_found', 'سؤال پیدا نشد');
      }
      if (row.status !== 'answered') {
        throw new ApiError(409, 'not_answered', 'هنوز پاسخی برای تأیید نیست');
      }
      await client.acknowledgeQuestion([questionId]);
      const blocking = await client.remainingRequiredQuestions([row.request_id]);
      if ((blocking.count ?? 0) === 0) {
        await client.finishQuestionReview([row.request_id]);
      }
      return { status: 'acknowledged' as const };
    });
  }

  async questionsForUser(userId: string, status: InfoQuestionStatus) {
    const rows = await this.repository.userQuestions([userId, status]);
    return rows.items.map((row) => ({
      id: row.id,
      requestId: row.request_id,
      prompt: this.services.cipher.decrypt(row.prompt),
      required: row.required,
      status: row.status,
      createdAt: row.created_at.toISOString(),
    }));
  }

  async withdraw(actorId: string, role: Role, questionId: string, reason: string) {
    return this.repository.transaction( async (client) => {
      const question = await client.lockWithdrawalQuestion([questionId]);
      const row = question.items[0];
      if (!row) throw new ApiError(404, 'not_found', 'سؤال پیدا نشد');
      if (role === 'specialist' && row.assigned_specialist_id !== actorId) {
        throw new ApiError(404, 'not_found', 'سؤال پیدا نشد');
      }
      if (!canWithdrawQuestion(row.status)) {
        throw new ApiError(409, 'not_open', 'این سؤال دیگر قابل پس‌گرفتن نیست');
      }
      await client.withdrawQuestion([questionId]);
      const blocking = await client.remainingWithdrawalQuestions([row.request_id]);
      if ((blocking.count ?? 0) === 0) {
        await client.finishWithdrawalReview([row.request_id]);
      }
      await client.recordWithdrawal([uuidv7(), row.request_id, actorId, JSON.stringify({ reason })]);
      return { status: 'withdrawn' as const };
    });
  }

  async publishedPlan(userId: string) {
    const found = await this.repository.activePublishedPlan([userId]);
    const request = found.items[0];
    if (!request) return null;
    const today = tehranToday();
    const friday = addCivilDays(request.week_start, 6);
    const week = await this.planWeek(userId,request.week_start);
    return {
      requestId: request.id,
      versionId: request.version_id,
      weekStart: request.week_start,
      effectiveFrom: request.effective_from,
      expired: today > friday,
      days: week.days.map((day,dayIndex)=>({...day,dayIndex,meals:day.meals.map(meal=>({...meal,
        loggable:day.date===today && day.date>=request.effective_from && today<=friday,
      }))})),
    };
  }

  async planWeek(userId: string, weekStart: string) {
    const date = parseCivilDate(weekStart);
    if (!date || weekStartSaturday(date) !== date) {
      throw new ApiError(400, 'validation', 'هفته باید از شنبه شروع شود');
    }
    const friday = fridayOfWeek(date);
    const rows = await this.datedVersions(userId, date, friday);
    const days = [];
    const loaded = new Map<string, PlanDay[]>();
    for (let index = 0; index < 7; index += 1) {
      days.push(await this.presentCivilDay(userId, addCivilDays(date, index), rows, loaded));
    }
    return { weekStart: date, days };
  }

  async planDay(userId: string, rawDate: string) {
    const date = parseCivilDate(rawDate);
    if (!date) throw new ApiError(400, 'validation', 'تاریخ درست نیست');
    const rows = await this.datedVersions(userId, date, date);
    return this.presentCivilDay(userId, date, rows, new Map());
  }

  async listRequests(userId: string) {
    const rows = await this.repository.userRequests([userId]);
    return rows.items.map((row) => ({
      id: row.id,
      status: row.status,
      kind: row.kind,
      priceToman: Number(row.price_toman),
      createdAt: row.created_at.toISOString(),
    }));
  }

  async requestTimeline(userId: string, requestId: string) {
    const found = await this.repository.ownedTimelineRequest([requestId, userId]);
    const request = found.items[0];
    if (!request) throw new ApiError(404, 'not_found', 'درخواست پیدا نشد');
    const events = await this.repository.requestEvents([requestId]);
    const questions = await this.repository.timelineQuestions([requestId]);
    return {
      id: request.id,
      status: request.status,
      kind: request.kind,
      priceToman: Number(request.price_toman),
      createdAt: request.created_at.toISOString(),
      events: events.items.map((event) => ({ kind: event.kind, createdAt: event.created_at.toISOString() })),
      questions: questions.items.map((question) => ({
        id: question.id,
        prompt: this.services.cipher.decrypt(question.prompt),
        required: question.required,
        status: question.status,
      })),
    };
  }

  async correct(actorId: string, requestId: string) {
    return this.repository.transaction( async (client) => {
      const request = await this.lockRequest(client, actorId, 'specialist', requestId);
      if (request.status !== 'published' || !request.week_start) {
        throw new ApiError(409, 'not_published', 'فقط برنامهٔ منتشرشدهٔ این هفته اصلاح می‌شود');
      }
      if (tehranToday() > fridayOfWeek(request.week_start)) {
        throw new ApiError(409, 'week_closed', 'هفتهٔ این برنامه تمام شده است');
      }
      const draft = await client.correctionDraft([requestId]);
      if ((draft.count ?? 0) > 0) throw new ApiError(409, 'correction_open', 'یک اصلاح باز وجود دارد');
      const published = await client.correctionBase([requestId]);
      const version = published.items[0];
      if (!version) throw new ApiError(409, 'not_published', 'برنامهٔ منتشرشده‌ای نیست');
      const days = await client.readDays(version.id);
      await client.insertDays(requestId,
        version.version_number + 1,
        actorId,
        days.map((day) => day.meals.map(meal=>({...meal,options:meal.options?.map(o=>({...o,approved:false}))}))),
      );
      await client.startCorrection([requestId]);
      await client.recordCorrection([uuidv7(), requestId, actorId]);
      return { status: 'in_review' as const };
    });
  }

  async patientPlanVersions(actorId: string, patientId: string) {
    const assigned = await this.repository.patientAssignment([patientId, actorId]);
    if ((assigned.count ?? 0) === 0) throw new ApiError(404, 'not_found', 'بیمار پیدا نشد');
    const rows = await this.repository.patientVersions([patientId]);
    return rows.items.map((row) => ({
      id: row.id,
      requestId: row.request_id,
      status: row.status,
      versionNumber: row.version_number,
      publishedAt: row.published_at ? row.published_at.toISOString() : null,
      weekStart: row.week_start,
    }));
  }

  async adminPlanVersion(actorId: string, versionId: string, reason: string | null) {
    if (!reason || reason.trim().length < 3) {
      throw new ApiError(400, 'reason_required', 'دلیل مشاهده را بنویسید');
    }
    const found = await this.repository.adminVersion([versionId]);
    const version = found.items[0];
    if (!version || version.status === 'draft') throw new ApiError(404, 'not_found', 'نسخهٔ برنامه پیدا نشد');
    await this.repository.recordVersionAccess([uuidv7(), actorId, version.request_id, reason.trim()]);
    const days = await this.repository.readDays(version.id);
    return {
      id: version.id,
      requestId: version.request_id,
      status: version.status,
      days: days.map((day) => ({ dayIndex: day.dayIndex, meals: day.meals })),
    };
  }

  private async datedVersions(userId: string, from: string, to: string): Promise<DatedVersion[]> {
    const rows = await this.repository.datedVersions([userId, from, to]);
    return rows.items.map((row) => ({
      versionId: row.version_id,
      requestId: row.request_id,
      status: row.status,
      publishedAt: row.published_at.toISOString(),
      publishedOn: tehranToday(row.published_at),
      civilDate: row.civil_date.slice(0, 10),
      dayIndex: row.day_index,
    }));
  }

  private async presentCivilDay(
    userId: string,
    date: string,
    rows: DatedVersion[],
    loaded: Map<string, PlanDay[]>,
  ) {
    const chosen = versionForDate(rows, date);
    if (!chosen) {
      return { date, requestId: null, versionId: null, versionStatus: null, meals: [] };
    }
    let days = loaded.get(chosen.versionId);
    if (!days) {
      days = await this.repository.readDays(chosen.versionId);
      loaded.set(chosen.versionId, days);
    }
    const day = days.find((item) => item.dayIndex === chosen.dayIndex);
    const logs = await this.repository.dayMealLogs([userId, chosen.requestId, date]);
    const eaten = new Map(logs.items.map((row) => [row.meal_uid, row.eaten]));
    const selections=(await this.repository.dayMealSelections([userId,date])).items;
    return {
      date,
      requestId: chosen.requestId,
      versionId: chosen.versionId,
      versionStatus: chosen.status,
      meals: (day?.meals ?? []).map((meal) => {
        const selection=selections.find(s=>s.meal_uid===meal.mealUid);
        const selected=meal.options?.find(o=>selection && selection.version_id===chosen.versionId?o.optionId===selection.option_uid:o.kind==='primary');
        const log=logs.items.find(l=>l.meal_uid===meal.mealUid);
        return ({
        ...meal,
        selectedOptionId:selected?.optionId ?? null,
        selectedOption:selected ?? null,
        selectionRevision:selection?.revision ?? 0,
        plannedCalories:selected?selected.calories:meal.calories,
        consumptionRevision:log?.revision ?? 0,
        consumptionState:log?.details.state ?? (log?.eaten?'as_planned':'unrecorded'),
        eaten: eaten.get(meal.mealUid) === true,
        consumption: logs.items.filter(l=>l.meal_uid===meal.mealUid)
          .map(l=>({versionId:l.plan_version_id,optionId:l.option_uid,eaten:l.eaten,...l.details,
            consumedCalories:typeof l.details.consumedCalories==='number'?l.details.consumedCalories:null}))[0] ?? null,
      });}),
    };
  }

  private async lockRequest(client: PlanSession, actorId: string, role: Role, requestId: string) {
    const row = await client.lockRequest([requestId]);
    const request = row.items[0];
    if (!request) throw new ApiError(404, 'not_found', 'درخواست پیدا نشد');
    if (role === 'specialist' && request.assigned_specialist_id !== actorId) {
      throw new ApiError(404, 'not_found', 'درخواست پیدا نشد');
    }
    return request;
  }

  private async presentRequest(requestId: string, includeDraft: boolean) {
    const row = await this.repository.requestDetails([requestId]);
    const request = row.items[0];
    if (!request) throw new ApiError(404, 'not_found', 'درخواست پیدا نشد');
    const questions = await this.repository.requestQuestions([requestId]);
    const answers = await this.repository.requestAnswers([requestId]);
    const conversation = await this.repository.careConversation([requestId]);
    let version: { id:string; versionNumber:number; status: string; lockVersion: number; days: DayInput[] } | null = null;
    let warnings: unknown[] = [];
    let profile: ModelProfile | null = null;
    let aiReview: unknown = null;
    if (includeDraft) {
      const draft = await this.repository.reviewVersion([requestId]);
      if (draft.items[0]) {
        const days = await this.repository.readDays(draft.items[0].id);
        version = {
          id:draft.items[0].id,
          versionNumber:draft.items[0].version_number,
          status: draft.items[0].status,
          lockVersion: draft.items[0].lock_version,
          days: days.map((day) => ({ meals: day.meals })),
        };
      }
      const warningRow = await this.repository.generationWarnings([requestId]);
      warnings = Array.isArray(warningRow.items[0]?.warnings) ? warningRow.items[0].warnings : [];
      [profile, aiReview] = await Promise.all([
        this.services.profiles.loadModelProfile(request.user_id),
        this.loadAiReview(requestId),
      ]);
    }
    return {
      id: request.id,
      status: request.status,
      kind: request.kind,
      priceToman: Number(request.price_toman),
      weekStart: request.week_start,
      effectiveFrom: request.effective_from,
      displayName: request.display_name,
      conversationId: conversation.items[0]?.id ?? null,
      questions: questions.items.map((question) => ({
        id: question.id,
        prompt: this.services.cipher.decrypt(question.prompt),
        required: question.required,
        status: question.status,
        answers: answers.items
          .filter((answer) => answer.question_id === question.id)
          .map((answer) => ({ body: this.services.cipher.decrypt(answer.body), createdAt: answer.created_at.toISOString() })),
      })),
      version,
      ...(includeDraft ? { warnings, profile, aiReview, riskFlags: await this.riskFlags(requestId) } : {}),
    };
  }

  private async riskFlags(requestId: string): Promise<string[]> {
    const row = await this.repository.requestRiskFlags([requestId]);
    return row.items[0]?.flags ?? [];
  }

  /** What the doctor needs to judge the draft: who made it, what it cost, and what the checks found. */
  private async loadAiReview(requestId: string) {
    const row = await this.repository.latestGenerationReview([requestId]);
    const g = row.items[0];
    if (!g) return null;
    const chain = Array.isArray(g.attempt_chain) ? (g.attempt_chain as Array<Record<string, unknown>>) : [];
    const notes = g.ai_notes ?? {};
    return {
      generationId: g.id,
      status: g.status,
      skippedReason: g.skipped_reason,
      provider: g.provider,
      model: g.model,
      poolCode: g.pool_code,
      promptVersion: g.prompt_version,
      costMicros: Number(g.cost_micros),
      tokens: g.tokens,
      attemptNo: g.attempt_no,
      createdAt: g.created_at.toISOString(),
      validatorWarnings: Array.isArray(notes.warnings) ? notes.warnings : [],
      critic: notes.critic ?? null,
      dayTotals: Array.isArray(notes.dayTotals) ? notes.dayTotals : [],
      attempts: chain.map((a) => ({
        provider: a.provider ?? null, model: a.model ?? null, outcome: a.outcome ?? a.status ?? null, errorCode: a.errorCode ?? a.code ?? null,
      })),
    };
  }
}

