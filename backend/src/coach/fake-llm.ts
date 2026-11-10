import { messageText } from '../ai/pool/types.js';
import type { ChatMessage, ToolCall } from '../ai/pool/types.js';
import type { ChatResult, ChatTurn, CoachLlm, JsonInput, LlmUsage, VisionInput } from './llm.js';
import { normalizeFa } from './text.js';

const USAGE: LlmUsage = { model: 'fake-coach', tokensIn: 0, tokensOut: 0, costMicros: 0 };

let counter = 0;
const call = (name: string, args: Record<string, unknown>): ToolCall => ({
  id: `fake_${(counter += 1)}`,
  type: 'function',
  function: { name, arguments: JSON.stringify(args) },
});

const MEAL_WORDS: Array<[RegExp, 'breakfast' | 'lunch' | 'dinner' | 'snack']> = [
  [/صبحانه/, 'breakfast'],
  [/ناهار/, 'lunch'],
  [/شام/, 'dinner'],
  [/میان ?وعده|عصرانه|اسنک/, 'snack'],
];

const mealOf = (text: string) => MEAL_WORDS.find(([pattern]) => pattern.test(text))?.[1];

/** Pulls the first number out of normalized text (digits are already ASCII). */
const numberIn = (text: string): number | null => {
  const match = /(\d+(?:[.٫,]\d+)?)/.exec(text);
  return match ? Number(match[1]!.replace(/[٫,]/, '.')) : null;
};

const STOP = new Set(['من', 'امروز', 'یه', 'یک', 'خوردم', 'خورد', 'با', 'و', 'برای', 'رو', 'را', 'کمی', 'مقداری', 'صبحانه', 'ناهار', 'شام', 'میان', 'وعده', 'عصرانه']);

/** Splits «ناهار قیمه و ماست خوردم» into catalogue-friendly names. */
function foodsIn(text: string): string[] {
  const before = text.split('خوردم')[0] ?? text;
  const words = before.replace(/[.,،!؟?]/g, ' ').split(/\s+/).filter((word) => word && !STOP.has(word) && !/^\d+$/.test(word));
  if (!words.length) return [];
  const names = before.split(/ و |،|,/).map((part) => part.split(/\s+/).filter((word) => !STOP.has(word) && !/^\d+$/.test(word)).join(' ').trim()).filter(Boolean);
  return names.slice(0, 3);
}

function lastUserText(messages: ChatMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]!.role === 'user') return messageText(messages[index]!);
  }
  return '';
}

/** Tool results that arrived after the last user message, paired with the tool that produced them. */
function toolResultsSinceUser(messages: ChatMessage[]): Array<{ name: string; result: Record<string, unknown> }> {
  let start = 0;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]!.role === 'user') {
      start = index;
      break;
    }
  }
  const names = new Map<string, string>();
  const out: Array<{ name: string; result: Record<string, unknown> }> = [];
  for (const message of messages.slice(start)) {
    if (message.role === 'assistant') for (const toolCall of message.tool_calls ?? []) names.set(toolCall.id, toolCall.function.name);
    if (message.role === 'tool' && message.tool_call_id) {
      try {
        out.push({ name: names.get(message.tool_call_id) ?? 'tool', result: JSON.parse(messageText(message)) as Record<string, unknown> });
      } catch {
        out.push({ name: names.get(message.tool_call_id) ?? 'tool', result: {} });
      }
    }
  }
  return out;
}

function targetFromContext(messages: ChatMessage[]): number | null {
  for (const message of messages) {
    if (message.role !== 'system') continue;
    const match = /هدف کالری روزانه: (\d+)/.exec(normalizeFa(messageText(message)));
    if (match) return Number(match[1]);
  }
  return null;
}

/** Final answer once the tool results are in. */
function summarize(results: Array<{ name: string; result: Record<string, unknown> }>): string {
  const parts: string[] = [];
  for (const { name, result } of results) {
    if (result.ok === false) {
      parts.push(typeof result.message === 'string' ? result.message : 'این کار الان نشد.');
      continue;
    }
    switch (name) {
      case 'show_calorie_ring':
        parts.push(`امروز ${result.consumed_kcal} از ${result.target_kcal} کالری رو مصرف کردی و ${result.remaining_kcal} کالری باقی مونده. آفرین!`);
        break;
      case 'log_meal':
        parts.push(`ثبت شد: «${String(result.title)}». ${result.remaining_kcal} کالری تا هدف امروز مونده.`);
        break;
      case 'suggest_meal':
        parts.push(`این پیشنهادم برای تو: «${String(result.title)}». اگه خوشت اومد تأییدش کن تا ثبت بشه.`);
        break;
      case 'show_plan_meal':
        parts.push(`وعدهٔ برنامه‌ات «${String(result.title)}» است.`);
        break;
      case 'swap_plan_meal':
        parts.push(`می‌تونی «${String(result.from)}» رو با «${String(result.to)}» عوض کنی؛ تفاوت کالری ${result.delta_kcal}. اگر موافقی تأیید کن.`);
        break;
      case 'log_weight':
        parts.push(`وزنت ثبت شد: ${result.kilograms} کیلوگرم. ادامه بده!`);
        break;
      case 'log_water':
        parts.push(`آب امروزت ${result.total_ml} از ${result.target_ml} میلی‌لیتر شد.`);
        break;
      case 'analyze_food_photo':
        parts.push('عکس رو بررسی کردم؛ مقادیر رو در کارت ببین و اگر درست بود تأیید کن.');
        break;
      case 'adjust_nutrition_target':
        parts.push(`هدف کالریت از ${result.old_kcal} به ${result.new_kcal} تغییر کرد.`);
        break;
      case 'save_memory':
        parts.push('یادم موند.');
        break;
      case 'escalate_to_specialist':
        parts.push(result.care_conversation_available ? 'متخصص رو در جریان گذاشتم؛ می‌تونی از بخش مراقبت پیام بدی.' : 'الان متخصصی تخصیص داده نشده، ولی توصیه می‌کنم با پزشکت هم در میون بذاری.');
        break;
      case 'plan_next_step':
        parts.push('باشه، بعداً یادآوری می‌کنم.');
        break;
      default:
        break;
    }
  }
  return parts.join(' ') || 'انجام شد.';
}

/**
 * Deterministic coach for local development and tests (`AI_PROVIDER=fake`): keyword-routed tool calls and
 * canned Persian answers streamed in small chunks. It needs no API key and never touches the network.
 */
export class FakeCoachLlm implements CoachLlm {
  readonly name = 'fake';

  async chat(turn: ChatTurn): Promise<ChatResult> {
    const afterTools = toolResultsSinceUser(turn.messages);
    const last = turn.messages[turn.messages.length - 1];
    let content = '';
    let toolCalls: ToolCall[] = [];
    if (last?.role === 'tool') {
      content = summarize(afterTools);
    } else {
      const raw = lastUserText(turn.messages);
      const text = normalizeFa(raw);
      const photo = /\[عکس غذا[^\]]*media_id=([0-9a-f-]{36})/i.exec(raw);
      if (photo) toolCalls = [call('analyze_food_photo', { media_id: photo[1] })];
      else if (/وزن/.test(text) && numberIn(text) !== null && numberIn(text)! >= 25) toolCalls = [call('log_weight', { kilograms: numberIn(text), ...(/تایید|مطمئن/.test(text) ? { confirm: true } : {}) })];
      else if (/(کاهش|کم|زیاد|افزایش|تغییر).{0,25}هدف کالری|هدف کالری.{0,25}(کم|زیاد|کاهش|افزایش|تغییر)/.test(text)) {
        const current = targetFromContext(turn.messages) ?? 1800;
        const asked = numberIn(text);
        toolCalls = [call('adjust_nutrition_target', { target_kcal: asked && asked >= 800 ? asked : current - 100, reason: 'درخواست کاربر برای تغییر هدف' })];
      } else if (/(^|\s)آب(\s|$)/.test(text) && /(خوردم|نوشیدم|ثبت|لیوان|سی ?سی|میلی)/.test(text)) {
        const n = numberIn(text);
        toolCalls = [call('log_water', { ml: /لیوان/.test(text) ? Math.min(1500, (n ?? 1) * 250) : n && n >= 50 ? n : 250 })];
      } else if (/خوردم/.test(text)) {
        const names = foodsIn(text);
        if (names.length) toolCalls = [call('log_meal', { ...(mealOf(text) ? { meal_type: mealOf(text) } : {}), items: names.map((name) => ({ name, servings: 1 })) })];
        else content = 'چی خوردی؟ اسم غذا رو بگو تا ثبتش کنم.';
      } else if (/جایگزین|عوضش|عوض کن/.test(text)) toolCalls = [call('swap_plan_meal', { ...(mealOf(text) ? { meal_type: mealOf(text) } : {}) })];
      else if (/برنامه/.test(text)) toolCalls = [call('show_plan_meal', { ...(mealOf(text) ? { meal_type: mealOf(text) } : {}) })];
      else if (/پیشنهاد|چی بخورم|ایده|چه بخورم/.test(text)) toolCalls = [call('suggest_meal', { meal_type: mealOf(text) ?? 'lunch', photo_hint: ['غذای ایرانی'] })];
      else if (/چقدر|کالری|حلقه|امروز چه|وضعیت/.test(text)) toolCalls = [call('show_calorie_ring', {})];
      else if (/یادت باشه|به خاطر بسپار|یادت بمونه/.test(text)) toolCalls = [call('save_memory', { kind: 'preference', content: raw.slice(0, 180) })];
      else if (/متخصص|دکتر|پزشک|مشاور/.test(text)) toolCalls = [call('escalate_to_specialist', { reason: raw.slice(0, 200) || 'درخواست کاربر' })];
      else if (/یادآوری|یادم بنداز|بعدا یادم/.test(text)) toolCalls = [call('plan_next_step', { delay_minutes: 120, note: 'پیگیری درخواست کاربر' })];
      else if (/گزینه|کمک|چه کارها/.test(text)) toolCalls = [call('show_quick_replies', { replies: ['امروز چقدر خوردم؟', 'یه غذا پیشنهاد بده', 'برنامهٔ امروزم'] })];
      else content = 'سلام! من مربی تغذیه‌ات هستم. می‌تونی بگی چی خوردی، عکس غذات رو بفرستی یا بپرسی امروز چقدر کالری مونده.';
    }
    if (content && turn.onDelta) {
      // Small chunks with a yield between them, like a real stream.
      const chunks = content.match(/.{1,14}/gsu) ?? [];
      for (const chunk of chunks) {
        turn.onDelta(chunk);
        await new Promise((resolve) => setImmediate(resolve));
      }
    }
    return { ...USAGE, content, toolCalls };
  }

  async vision(input: VisionInput): Promise<{ value: Record<string, unknown>; usage: LlmUsage }> {
    // Deterministic by image size so a test can pick the outcome: tiny images are «not food».
    const size = input.base64.length;
    if (/not-?food|غیر ?غذا/i.test(input.caption)) return { value: { is_food: false, items: [], confidence: 0.9, note: 'غذا نیست' }, usage: USAGE };
    const sets: Array<Record<string, unknown>> = [
      { is_food: true, meal_type: 'lunch', confidence: 0.82, items: [{ name_fa: 'کباب کوبیده', search_terms: ['کباب کوبیده', 'کوبیده'], servings: 1, kcal_estimate: 650, protein_g: 35, carbs_g: 60, fat_g: 28 }], note: '' },
      { is_food: true, meal_type: 'lunch', confidence: 0.7, items: [{ name_fa: 'قیمه', search_terms: ['قیمه'], servings: 1, kcal_estimate: 550, protein_g: 25, carbs_g: 55, fat_g: 22 }], note: '' },
      { is_food: true, meal_type: 'breakfast', confidence: 0.4, items: [{ name_fa: 'غذای ناشناخته', search_terms: ['زولبیا بامیه خانگی خیالی'], servings: 1, kcal_estimate: 300, protein_g: 6, carbs_g: 45, fat_g: 10 }], note: 'مطمئن نیستم' },
    ];
    return { value: sets[size % sets.length]!, usage: USAGE };
  }

  async json(input: JsonInput): Promise<{ value: Record<string, unknown>; usage: LlmUsage }> {
    const lines = input.user.split('\n').filter((line) => line.startsWith('کاربر:')).slice(-3);
    return { value: { summary: lines.join(' ').slice(0, 500), memories: [] }, usage: USAGE };
  }
}
