import { Inject, Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { PromptStore } from '../ai/draft/prompts.js';
import { normalizeFa } from './text.js';
import { tehranToday } from '../common/time.js';
import { COACH_LLM, type CoachLlm } from './llm.js';
import { CoachInsights } from './insights.js';
import { CoachStore } from './store.js';

const MEMORY_KINDS = ['preference', 'dislike', 'allergy_note', 'habit', 'goal', 'schedule', 'health_note', 'other'] as const;
/** Updating after every turn is wasteful: wait until this many new messages piled up. */
export const MEMORY_BATCH = 8;

const SENSITIVE = /\d{8,}|@|https?:|www\.|password|رمز|کد ملی|شماره کارت|ignore (all |the )?(previous|above)|نادیده بگیر/i;

const outputSchema = z.object({
  summary: z.string().trim().max(1200).optional(),
  memories: z
    .array(z.object({ kind: z.enum(MEMORY_KINDS), content: z.string().trim().min(3).max(300), importance: z.number().int().min(1).max(5).default(3) }))
    .max(5)
    .default([]),
});

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor(
    private readonly store: CoachStore,
    private readonly insights: CoachInsights,
    private readonly prompts: PromptStore,
    @Inject(COACH_LLM) private readonly llm: CoachLlm,
  ) {}

  /** True when enough unsummarised messages exist to be worth a memory pass. */
  async due(userId: string): Promise<boolean> {
    const thread = await this.store.ensureThread(userId);
    const { rows } = await this.store.pool.query<{ n: number }>(`select count(*)::int as n from coach_messages where thread_id = $1 and seq > $2`, [thread.id, thread.summaryUptoSeq]);
    return (rows[0]?.n ?? 0) >= MEMORY_BATCH;
  }

  /** Extracts durable facts and refreshes the rolling summary. Safe to call twice; failures never reach the user. */
  async run(userId: string): Promise<{ saved: number; summarised: boolean }> {
    const profile = await this.insights.profile(userId);
    if (!profile?.consented) return { saved: 0, summarised: false };
    const thread = await this.store.ensureThread(userId);
    const recent = await this.store.recent(thread.id, thread.summaryUptoSeq, 40);
    if (recent.length < 2) return { saved: 0, summarised: false };
    const existing = await this.store.memories(userId, 40);
    const prompt = await this.prompts.active('coach_memory');
    const lines = recent
      .filter((message) => message.type === 'text' || message.type === 'user_photo')
      .map((message) => `${message.role === 'user' ? 'کاربر' : 'مربی'}: ${message.fallbackText.slice(0, 400)}`);
    const user = [
      `خلاصهٔ قبلی: ${thread.summary || '(خالی)'}`,
      `حافظهٔ موجود:\n${existing.map((memory) => `- ${memory.content}`).join('\n') || '(خالی)'}`,
      `گفتگوی جدید:\n${lines.join('\n')}`,
    ].join('\n\n');
    let value: Record<string, unknown>;
    try {
      value = (await this.llm.json({ requestId: null, system: prompt.systemPrompt, user })).value;
    } catch (error) {
      this.logger.warn(`memory pass failed: ${error instanceof Error ? error.message : 'unknown'}`);
      return { saved: 0, summarised: false };
    }
    const parsed = outputSchema.safeParse(value);
    if (!parsed.success) return { saved: 0, summarised: false };
    let saved = 0;
    for (const memory of parsed.data.memories) {
      if (SENSITIVE.test(normalizeFa(memory.content))) continue;
      if (await this.store.saveMemory(userId, memory.kind, memory.content, 'extractor', memory.importance)) saved += 1;
    }
    const upto = recent[recent.length - 1]!.seq;
    let summarised = false;
    if (parsed.data.summary && !SENSITIVE.test(normalizeFa(parsed.data.summary))) {
      await this.store.setSummary(thread.id, parsed.data.summary, upto);
      summarised = true;
    } else {
      await this.store.setSummary(thread.id, thread.summary, upto);
    }
    await this.store.engage(userId, 'memory_pass', tehranToday(), { saved, summarised });
    return { saved, summarised };
  }
}
