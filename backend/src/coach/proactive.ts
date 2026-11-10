import { Inject, Injectable, Logger } from '@nestjs/common';
import { notify, withTransaction } from '../common/sql.js';
import { addCivilDays, civilNow } from '../common/time.js';
import { ENV, type Env } from '../config/env.js';
import { Cards, MEAL_LABEL } from './cards.js';
import { tehranClock } from './clock.js';
import { CoachEffects } from './effects.js';
import { CoachInsights } from './insights.js';
import { planProactive, type ProactiveIntent, type ProactivePlanInput } from './proactive-plan.js';
import { CoachStore } from './store.js';
import { faNumber } from './text.js';
import type { CardSpec, CoachProfile } from './types.js';

const NAGS = ['day_brief', 'meal_reminder', 'missed_meal'];
const BUDGETED = ['day_brief', 'meal_reminder', 'missed_meal', 'milestone'];
const SILENCE_MS = 5 * 24 * 60 * 60 * 1000;
const NAG_GAP_MS = 3 * 60 * 60 * 1000;

@Injectable()
export class ProactiveService {
  private readonly logger = new Logger(ProactiveService.name);

  constructor(
    private readonly store: CoachStore,
    private readonly insights: CoachInsights,
    private readonly effects: CoachEffects,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** One pass over onboarded users. Safe to run on a schedule; every send is deduped. */
  async run(now = civilNow()): Promise<number> {
    if (!this.env.COACH_PROACTIVE_ENABLED) return 0;
    let sent = 0;
    let after: string | null = null;
    for (;;) {
      const ids = await this.store.proactiveUserIds(after, 200);
      if (!ids.length) break;
      for (const userId of ids) {
        try {
          sent += await this.runForUser(userId, now);
        } catch (error) {
          this.logger.warn(`proactive user failed: ${error instanceof Error ? error.name : 'error'}`);
        }
      }
      after = ids[ids.length - 1] ?? null;
      if (ids.length < 200) break;
    }
    return sent;
  }

  async runForUser(userId: string, now = civilNow()): Promise<number> {
    if (!this.env.COACH_PROACTIVE_ENABLED) return 0;
    const profile = await this.insights.profile(userId);
    if (!profile) return 0;
    const clock = tehranClock(now);
    const input = await this.snapshot(userId, profile, now, clock);
    const intents = planProactive(input);
    let sent = 0;
    for (const intent of intents) sent += await this.deliver(userId, profile, clock.date, input.weekStart, intent);
    return sent;
  }

  private async snapshot(
    userId: string,
    profile: CoachProfile,
    now: Date,
    clock: ReturnType<typeof tehranClock>,
  ): Promise<ProactivePlanInput & { weekStart: string }> {
    const quiet = clock.minutes >= 22 * 60 || clock.minutes < 7 * 60;
    const weekStart = clock.weekday === 6 ? addCivilDays(this.insights.weekOf(clock.date), -7) : this.insights.weekOf(clock.date);
    const [thread, today, sentToday, recentNag, lastUser, milestoneKeys, weeklyKeys, dayRows] = await Promise.all([
      this.store.ensureThread(userId),
      this.insights.today(userId, profile),
      this.store.countEngagementToday(userId, clock.date, BUDGETED),
      this.store.engagementSince(userId, NAGS, new Date(now.getTime() - NAG_GAP_MS)),
      this.store.lastUserMessageAt(userId),
      this.store.dedupeKeys(userId, 'milestone'),
      this.store.dedupeKeys(userId, 'weekly_review'),
      this.store.engagementOn(userId, clock.date, ['meal_reminder', 'missed_meal']),
    ]);
    const startKg = await this.store.startingWeightKg(userId);
    const latest = today.weight.latestKg;
    const lossKg = profile.track === 'weight_loss' && startKg != null && latest != null ? Math.max(0, startKg - latest) : 0;
    const numbers = (prefix: string) => milestoneKeys.filter((key) => key.startsWith(prefix)).map((key) => Number(key.slice(prefix.length))).filter((value) => Number.isFinite(value));
    return {
      quiet,
      hour: Math.floor(clock.minutes / 60),
      minutes: clock.minutes,
      weekday: clock.weekday,
      sentToday,
      dailyMax: this.env.COACH_PROACTIVE_DAILY_MAX,
      backedOff: lastUser != null && now.getTime() - lastUser.getTime() > SILENCE_MS,
      recentNag: recentNag > 0,
      dayBriefSent: thread.dayBriefDate === clock.date,
      weeklySent: weeklyKeys.includes(`weekly:${weekStart}`),
      meals: today.planMeals,
      reminded: dayRows.filter((row) => row.kind === 'meal_reminder').map((row) => String(row.detail.mealUid ?? '')),
      missedSent: dayRows.filter((row) => row.kind === 'missed_meal').map((row) => String(row.detail.mealUid ?? '')),
      dueStepNote: quiet ? null : await this.store.peekNextStep(userId, now),
      streak: today.streakDays,
      streakMilestonesSent: numbers('streak:'),
      lossKg,
      lossMilestonesSent: numbers('loss:'),
      weekStart,
    };
  }

  private async deliver(userId: string, profile: CoachProfile, date: string, weekStart: string, intent: ProactiveIntent): Promise<number> {
    switch (intent.kind) {
      case 'next_step': {
        const claimed = await this.store.claimNextStep(userId, civilNow());
        if (!claimed) return 0;
        const message = await this.post(userId, Cards.text(`یادآوری: ${claimed.note}`));
        await this.push(userId, 'next_step', message.fallbackText, message.id);
        return 1;
      }
      case 'day_brief': {
        const brief = await this.effects.ensureDayBrief(userId);
        if (!brief.created) return 0;
        await this.push(userId, 'day_brief', brief.message.fallbackText, brief.message.id);
        return 1;
      }
      case 'meal_reminder': {
        const label = MEAL_LABEL[intent.mealType];
        return this.once(userId, 'meal_reminder', date, `meal_reminder:${date}:${intent.mealUid}`, { mealUid: intent.mealUid },
          Cards.text(`یادآوری ${label}، ساعت ${intent.suggestedTime}: ${intent.title}. اگر خوردی بگو تا ثبت کنم.`));
      }
      case 'missed_meal': {
        const label = MEAL_LABEL[intent.mealType];
        return this.once(userId, 'missed_meal', date, `missed:${date}:${intent.mealUid}`, { mealUid: intent.mealUid },
          Cards.text(`به نظر می‌رسد ${label} (${intent.title}) ثبت نشده. اگر خوردی بگو؛ اگر نخوردی هم اشکالی ندارد.`));
      }
      case 'weekly_review': {
        const stats = await this.insights.weekStats(userId, weekStart, profile.targetKcal);
        const wins = [];
        if (stats.daysLogged >= 5) wins.push(`${faNumber(stats.daysLogged)} روز ثبت غذا`);
        if (stats.adherencePercent != null && stats.adherencePercent >= 60) wins.push('نزدیک به هدف کالری');
        if (!wins.length) wins.push('این هفته را با هم جمع می‌کنیم');
        const focus = stats.daysLogged < 3
          ? 'هفتهٔ بعد فقط ثبت وعده‌ها را ادامه بده.'
          : 'یک وعدهٔ پروتئینی را در ناهار ثابت نگه دار.';
        return this.once(userId, 'weekly_review', date, `weekly:${weekStart}`, { weekStart }, Cards.weeklyReview({
          weekStart: stats.weekStart,
          weekEnd: stats.weekEnd,
          daysLogged: stats.daysLogged,
          avgKcal: stats.avgKcal,
          targetKcal: profile.targetKcal,
          adherencePercent: stats.adherencePercent,
          weightChangeKg: stats.weightChangeKg,
          waterAvgMl: stats.waterAvgMl,
          wins,
          focus,
        }));
      }
      case 'milestone': {
        const streak = intent.milestone === 'streak';
        const title = streak ? `${faNumber(intent.value)} روز پیوستگی` : `${faNumber(intent.value)} کیلوگرم`;
        const body = streak
          ? `${faNumber(intent.value)} روز پشت سر هم غذایت را ثبت کردی. همین را ادامه بده.`
          : `از شروع مسیر حدود ${faNumber(intent.value)} کیلوگرم کم کردی. آرام و پیوسته پیش می‌روی.`;
        return this.once(userId, 'milestone', date, intent.key, { milestone: intent.milestone, value: intent.value }, Cards.milestone({
          kind: intent.milestone, title, body, value: intent.value,
        }));
      }
      default:
        return 0;
    }
  }

  private async once(userId: string, kind: string, day: string, dedupeKey: string, detail: Record<string, unknown>, card: CardSpec): Promise<number> {
    const fresh = await this.store.engage(userId, kind, day, detail, dedupeKey);
    if (!fresh) return 0;
    const message = await this.post(userId, card);
    await this.push(userId, kind, message.fallbackText, message.id);
    return 1;
  }

  private async post(userId: string, card: CardSpec) {
    const thread = await this.store.ensureThread(userId);
    return this.store.insertMessage({ threadId: thread.id, userId, role: 'assistant', card });
  }

  private async push(userId: string, kind: string, body: string, messageId: string): Promise<void> {
    try {
      await withTransaction(this.store.pool, (client) => notify(client, userId, 'coach', {
        type: kind, messageId, title: 'مربی تغذیه', body: body.slice(0, 180),
      }));
    } catch (error) {
      this.logger.warn(`coach push skipped: ${error instanceof Error ? error.name : 'error'}`);
    }
  }
}
