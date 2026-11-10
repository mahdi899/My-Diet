import { Inject, Injectable, Logger } from '@nestjs/common';
import { civilNow, tehranToday } from '../common/time.js';
import { ENV, type Env } from '../config/env.js';
import { PromptStore } from '../ai/draft/prompts.js';
import type { ChatMessage, ToolCall } from '../ai/pool/types.js';
import { StreamBrokenError } from '../ai/pool/types.js';
import { Cards } from './cards.js';
import { buildContext } from './context.js';
import { CoachEffects } from './effects.js';
import { CoachInsights } from './insights.js';
import { COACH_LLM, type ChatResult, type CoachLlm } from './llm.js';
import { MemoryService } from './memory.js';
import { SafetyGuard } from './safety.js';
import { CoachStore, type ThreadRow } from './store.js';
import { cleanUserText } from './text.js';
import { toolSpecs, runTool } from './tools.js';
import type { CardSpec, CoachMessage, CoachProfile, Json, SseEvent } from './types.js';
import { CoachError } from './types.js';
import { FoodPhotoService, decodeImage } from './vision.js';

export const NO_CONSENT_TEXT =
  'برای اینکه مربی با توجه به سن، وزن و شرایطت جواب بدهد، باید رضایت ارسال دادهٔ سلامت به مدل را در آنبوردینگ داده باشی. تا آن موقع می‌توانم وعده، آب و وزن را همین‌جا ثبت کنم، بدون فرستادن اطلاعاتت به مدل.';

export interface Incoming {
  clientMessageId: string;
  kind: 'text' | 'quick_reply' | 'card_action' | 'photo';
  /** Visible text, quick-reply label, or photo caption. Already trimmed by the caller when possible. */
  text: string;
  action: string | null;
  args: Json;
  sourceMessageId: string | null;
  mediaId: string | null;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' | null;
}

export interface Accepted {
  profile: CoachProfile;
  thread: ThreadRow;
  userMessage: CoachMessage;
  incoming: Incoming;
  replies: CoachMessage[];
  replay: boolean;
  locked: boolean;
}

export type Emit = (event: SseEvent) => void;

@Injectable()
export class CoachRunner {
  private readonly logger = new Logger(CoachRunner.name);

  constructor(
    private readonly store: CoachStore,
    private readonly insights: CoachInsights,
    private readonly effects: CoachEffects,
    private readonly guard: SafetyGuard,
    private readonly prompts: PromptStore,
    private readonly photos: FoodPhotoService,
    private readonly memory: MemoryService,
    @Inject(COACH_LLM) private readonly llm: CoachLlm,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /**
   * Persists the user message once per clientMessageId. A completed turn is returned as a replay and does not
   * take the lock. A new turn holds the lock until `respond` finishes.
   */
  async accept(userId: string, incoming: Incoming): Promise<Accepted> {
    const profile = await this.insights.profile(userId);
    if (!profile) throw new CoachError(409, 'no_profile', 'اول پرسش‌نامهٔ تغذیه را کامل کن تا مربی بتواند کمک کند.');
    const text = cleanUserText(incoming.text, this.env.COACH_MAX_MESSAGE_CHARS);
    const normalized: Incoming = { ...incoming, text };
    if ((normalized.kind === 'text' || (normalized.kind === 'quick_reply' && !normalized.action)) && !text) {
      throw new CoachError(400, 'validation', 'متن پیام خالی است');
    }
    if (normalized.kind === 'card_action' && !normalized.action) throw new CoachError(400, 'validation', 'عمل مشخص نشده است');
    if (normalized.kind === 'photo' && !normalized.mediaId) throw new CoachError(400, 'validation', 'عکس مشخص نشده است');

    const thread = await this.store.ensureThread(userId);
    let message = await this.store.byClient(thread.id, normalized.clientMessageId);
    if (!message) {
      const recent = await this.store.userMessagesLastMinute(userId);
      if (recent >= this.env.COACH_RATE_PER_MINUTE) {
        throw new CoachError(429, 'rate_limited', 'پیام‌ها پشت سر هم زیاد شده. یک دقیقه صبر کن.', true);
      }
      const inserted = await this.store.insertUserMessage({
        threadId: thread.id,
        userId,
        role: 'user',
        card: await this.userCard(userId, normalized),
        clientMessageId: normalized.clientMessageId,
      });
      message = inserted.message;
    }
    const replies = await this.store.repliesTo(userId, message.id);
    if (replies.length) {
      return { profile, thread, userMessage: message, incoming: normalized, replies, replay: true, locked: false };
    }
    const locked = await this.store.acquireTurn(thread.id);
    if (!locked) throw new CoachError(409, 'turn_busy', 'مربی هنوز مشغول جواب قبلی است. چند ثانیهٔ دیگر دوباره بفرست.', true);
    return { profile, thread, userMessage: message, incoming: normalized, replies: [], replay: false, locked: true };
  }

  async respond(accepted: Accepted, emit: Emit): Promise<void> {
    try {
      emit({ event: 'user_message', data: { message: accepted.userMessage } });
      if (accepted.replay) {
        for (const message of accepted.replies) emit({ event: 'message', data: { message } });
        emit({ event: 'done', data: { replayed: true, userMessageId: accepted.userMessage.id, messageIds: accepted.replies.map((message) => message.id) } });
        return;
      }
      const produced = await this.generate(accepted, emit);
      emit({
        event: 'done',
        data: { replayed: false, userMessageId: accepted.userMessage.id, messageIds: produced.map((message) => message.id) },
      });
    } finally {
      if (accepted.locked) await this.store.releaseTurn(accepted.thread.id);
    }
  }

  private async generate(accepted: Accepted, emit: Emit): Promise<CoachMessage[]> {
    const { incoming, profile, thread, userMessage } = accepted;
    const produced: CoachMessage[] = [];
    const say = async (card: CardSpec, entryId?: string | null) => {
      const message = await this.store.insertMessage({
        threadId: thread.id, userId: profile.userId, role: 'assistant', card, replyTo: userMessage.id,
      });
      if (entryId) await this.store.attachEntryMessage(entryId, message.id);
      produced.push(message);
      emit({ event: 'message', data: { message } });
      return message;
    };

    const shortcut = incoming.action && (incoming.kind === 'card_action' || incoming.kind === 'quick_reply') ? incoming.action : null;
    if (shortcut) {
      const cards = await this.effects.handle(profile, thread.id, shortcut, { ...incoming.args, ...(incoming.sourceMessageId ? { sourceMessageId: incoming.sourceMessageId } : {}) });
      if (!cards) {
        await say(Cards.text('این دکمه را نمی‌شناسم.'));
        return produced;
      }
      for (const card of cards) {
        const entryId = typeof card.payload.entryId === 'string' ? card.payload.entryId : null;
        await say(card, entryId);
      }
      return produced;
    }

    if (incoming.kind === 'photo' && incoming.mediaId) {
      await this.answerPhoto(accepted, say);
      return produced;
    }

    const pre = this.guard.precheck(incoming.text, profile);
    if (pre.action === 'block' && pre.reply) {
      await say(Cards.text(pre.reply));
      return produced;
    }
    if (!profile.consented) {
      await say(Cards.systemNote('no_consent', NO_CONSENT_TEXT));
      return produced;
    }

    const day = tehranToday();
    const usage = await this.store.usage(profile.userId, day);
    if (usage.chatTurns >= this.env.COACH_DAILY_TURNS) {
      throw new CoachError(429, 'coach_daily_limit', 'سقف گفتگوی امروز پر شده. فردا دوباره حرف می‌زنیم.', true);
    }

    const [history, memories, today, prompt] = await Promise.all([
      this.store.preceding(thread.id, userMessage.seq, this.env.COACH_HISTORY_MESSAGES),
      this.store.memories(profile.userId),
      this.insights.today(profile.userId, profile),
      this.prompts.active('coach_system'),
    ]);
    await this.store.touchMemories(memories.map((memory) => memory.id));
    let transcript: ChatMessage[] = buildContext({
      systemPrompt: prompt.systemPrompt,
      directives: pre.directives,
      profile,
      today,
      memories,
      summary: thread.summary,
      history,
      current: { text: incoming.text },
      now: civilNow(),
    });
    const specs = toolSpecs();
    const ctx = this.effects.context(profile, thread.id);
    let tokensIn = 0;
    let tokensOut = 0;
    let costMicros = 0;
    let model = '';
    let called = false;
    const maxRounds = this.env.COACH_MAX_TOOL_ROUNDS;
    let segment = 0;

    try {
      for (let round = 0; round < maxRounds; round += 1) {
        const allowTools = round < maxRounds - 1;
        let streamed = '';
        let result: ChatResult;
        try {
          result = await this.llm.chat({
            messages: transcript,
            tools: allowTools ? specs : [],
            requestId: userMessage.id,
            onDelta: (chunk) => {
              streamed += chunk;
            },
          });
        } catch (error) {
          if (error instanceof StreamBrokenError && (error.partialText.trim() || streamed.trim())) {
            result = { content: error.partialText || streamed, toolCalls: [], model: 'partial', tokensIn: 0, tokensOut: 0, costMicros: 0 };
          } else if (produced.length) {
            await say(Cards.text('ادامهٔ جواب الان نرسید. اگر چیزی کم بود دوباره بپرس.'));
            break;
          } else throw error;
        }
        called = true;
        tokensIn += result.tokensIn;
        tokensOut += result.tokensOut;
        costMicros += result.costMicros;
        model = result.model || model;
        const safe = this.guard.sanitize(result.content || streamed, profile);
        const toolCalls = allowTools ? result.toolCalls : [];
        if (safe.text) {
          segment += 1;
          this.emitChunks(safe.text, segment, emit);
          const saved = await say(Cards.text(safe.text));
          if (round === maxRounds - 1 || toolCalls.length === 0) {
            await this.stamp(saved.id, profile.userId, model, tokensIn, tokensOut);
          }
        }
        if (!toolCalls.length) break;
        transcript = this.appendToolTurn(transcript, safe.text, toolCalls);
        for (const call of toolCalls) {
          emit({ event: 'tool', data: { name: call.function.name, status: 'running' } });
          const run = await runTool(ctx, call.function.name, call.function.arguments);
          emit({ event: 'tool', data: { name: call.function.name, status: run.ok ? 'done' : 'failed' } });
          if (run.card) await say(run.card, run.entryId);
          transcript.push({ role: 'tool', tool_call_id: call.id, content: run.content });
        }
      }
      if (!produced.length) await say(Cards.text('متوجه نشدم. یک بار دیگر، کوتاه بگو.'));
    } finally {
      if (called) await this.store.addUsage(profile.userId, day, { chatTurns: 1, tokensIn, tokensOut, costMicros });
    }
    this.scheduleMemory(profile.userId);
    return produced;
  }

  private async answerPhoto(accepted: Accepted, say: (card: CardSpec, entryId?: string | null) => Promise<CoachMessage>): Promise<void> {
    const { profile, incoming } = accepted;
    if (!profile.consented) {
      await say(Cards.systemNote('no_consent', NO_CONSENT_TEXT));
      return;
    }
    const pre = this.guard.precheck(incoming.text, profile);
    if (pre.action === 'block' && pre.reply) {
      await say(Cards.text(pre.reply));
      return;
    }
    const analysis = await this.photos.analyze(profile, accepted.thread.id, incoming.mediaId!, {
      mealTypeHint: incoming.mealType,
      caption: incoming.text,
      requestId: accepted.userMessage.id,
    });
    await say(analysis.card, analysis.entryId);
  }

  /** JSON photo upload: stores bytes, then runs the same turn as a `photo` message. */
  async submitPhoto(userId: string, input: { clientMessageId: string; image: string; mime?: string; caption?: string; mealType?: Incoming['mealType'] }): Promise<{ userMessage: CoachMessage; messages: CoachMessage[] }> {
    const decoded = decodeImage(input.image, input.mime);
    const profile = await this.insights.profile(userId);
    if (!profile) throw new CoachError(409, 'no_profile', 'اول پرسش‌نامهٔ تغذیه را کامل کن تا مربی بتواند کمک کند.');
    const thread = await this.store.ensureThread(userId);
    const existing = await this.store.byClient(thread.id, input.clientMessageId);
    if (!existing && (await this.store.userMessagesLastMinute(userId)) >= this.env.COACH_RATE_PER_MINUTE) {
      throw new CoachError(429, 'rate_limited', 'پیام‌ها پشت سر هم زیاد شده. یک دقیقه صبر کن.', true);
    }
    let mediaId = existing && typeof existing.payload.mediaId === 'string' ? existing.payload.mediaId : null;
    if (!existing) {
      if (profile.consented) await this.photos.assertQuota(userId, tehranToday());
      mediaId = await this.store.saveMedia(userId, decoded.mime, decoded.bytes);
    }
    if (!mediaId) throw new CoachError(404, 'not_found', 'عکس پیدا نشد');
    const accepted = await this.accept(userId, {
      clientMessageId: input.clientMessageId,
      kind: 'photo',
      text: input.caption ?? '',
      action: null,
      args: {},
      sourceMessageId: null,
      mediaId,
      mealType: input.mealType ?? null,
    });
    if (accepted.replay) return { userMessage: accepted.userMessage, messages: accepted.replies };
    const messages: CoachMessage[] = [];
    await this.respond(accepted, (event) => {
      if (event.event === 'message') messages.push(event.data.message);
    });
    return { userMessage: accepted.userMessage, messages };
  }

  private async userCard(userId: string, incoming: Incoming): Promise<CardSpec> {
    if (incoming.kind === 'photo' && incoming.mediaId) {
      const media = await this.store.media(userId, incoming.mediaId);
      if (!media) throw new CoachError(404, 'not_found', 'عکس پیدا نشد');
      return Cards.userPhoto({ mediaId: incoming.mediaId, mime: media.mime, caption: incoming.text });
    }
    const label = incoming.text || (incoming.action ? 'انجام شد' : '');
    const payload: Json = { text: label };
    if (incoming.action) {
      payload.action = incoming.action;
      payload.args = incoming.args;
    }
    if (incoming.kind === 'quick_reply') payload.quickReply = true;
    return { type: 'text', payload, fallbackText: label };
  }

  private appendToolTurn(transcript: ChatMessage[], text: string, toolCalls: ToolCall[]): ChatMessage[] {
    return [
      ...transcript,
      { role: 'assistant', content: text || null, tool_calls: toolCalls },
    ];
  }

  private emitChunks(text: string, segment: number, emit: Emit): void {
    const parts = text.match(/.{1,24}/gsu) ?? [];
    for (const part of parts) emit({ event: 'delta', data: { segment, text: part } });
  }

  private async stamp(messageId: string, userId: string, model: string, tokensIn: number, tokensOut: number): Promise<void> {
    await this.store.pool.query(
      `update coach_messages set model = $3, tokens_in = $4, tokens_out = $5 where id = $1 and user_id = $2`,
      [messageId, userId, model.slice(0, 120) || null, tokensIn, tokensOut],
    );
  }

  private scheduleMemory(userId: string): void {
    setImmediate(() => {
      void this.memory.due(userId).then((due) => (due ? this.memory.run(userId) : null)).catch((error: unknown) => {
        this.logger.warn(`memory pass skipped: ${error instanceof Error ? error.name : 'error'}`);
      });
    });
  }
}
