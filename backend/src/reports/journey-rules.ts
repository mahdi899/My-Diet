import { createHash } from 'node:crypto';
import { ApiError } from '../common/errors.js';

export const JOURNEY_BATCH_LIMIT = 40;
export const JOURNEY_RATE_LIMIT = 20;
export const JOURNEY_SKEW_MS = 5 * 60 * 1000;
export const JOURNEY_GAP_MS = 30 * 60 * 1000;
export const JOURNEY_MAX_ACTIVE_MS = 30 * 60 * 1000;
export const JOURNEY_GRAPH_NODES = 40;
export const JOURNEY_GRAPH_EDGES = 80;
export const JOURNEY_GRAPH_PATHS = 25;
export const JOURNEY_SCAN_LIMIT = 2000;

export const JOURNEY_LIMITATIONS =
  'Edges come only from recorded navigation. Active time sums activeMs and ignores background gaps. Linking an install to an account does not prove the same person across devices. This feed is not the payment or reward ledger.';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z][a-z0-9_]{0,40}$/;
const VERSION = /^\d+\.\d+\.\d+$/;
const PLATFORMS = new Set(['android', 'ios', 'web']);

export interface CleanEvent {
  id: string;
  type: string;
  occurredAt: string;
  properties: Record<string, string | number>;
}

export interface JourneySample {
  date: string;
  platform: string;
  appVersion: string;
  sessionType: 'first_visit' | 'returning';
  firstAuthenticated: boolean;
  gapped: boolean;
  events: Array<{ type: string; properties: Record<string, unknown> }>;
}

export interface JourneyEdge {
  fromScreenId: string;
  toScreenId: string;
  count: number;
  percent: number | null;
}

export function payloadHash(event: CleanEvent): string {
  const keys = Object.keys(event.properties).sort();
  const properties = Object.fromEntries(keys.map((key) => [key, event.properties[key]]));
  return createHash('sha256')
    .update(JSON.stringify({ type: event.type, occurredAt: event.occurredAt, properties }))
    .digest('hex');
}

export function parseBatch(body: unknown, now: Date): { installId: string; sessionId: string; events: CleanEvent[] } {
  if (!body || typeof body !== 'object') throw new ApiError(400, 'validation', 'دستهٔ رویداد نامعتبر است');
  const record = body as Record<string, unknown>;
  const installId = uuid(record.installId);
  const sessionId = uuid(record.sessionId);
  if (!installId || !sessionId) throw new ApiError(400, 'validation', 'شناسهٔ نصب یا نشست نامعتبر است');
  if (!Array.isArray(record.events) || record.events.length === 0 || record.events.length > JOURNEY_BATCH_LIMIT) {
    throw new ApiError(400, 'validation', 'اندازهٔ دستهٔ رویداد مجاز نیست');
  }
  const events = record.events.map((item) => parseEvent(item, now));
  for (let index = 1; index < events.length; index += 1) {
    if (events[index]!.occurredAt < events[index - 1]!.occurredAt) {
      throw new ApiError(400, 'validation', 'زمان رویدادها باید به ترتیب باشد');
    }
  }
  return { installId, sessionId, events };
}

export function isGapped(previous: string | null, occurredAt: string): boolean {
  if (!previous) return false;
  return new Date(occurredAt).getTime() - new Date(previous).getTime() > JOURNEY_GAP_MS;
}

export function journeyReport(sessions: JourneySample[]) {
  const visits = new Map<string, number>();
  const active = new Map<string, number>();
  const exits = new Map<string, number>();
  const entries = new Map<string, number>();
  const edges = new Map<string, number>();
  const paths = new Map<string, number>();
  const signals = {
    planPurchaseStarted: 0,
    planPurchaseCompleted: 0,
    questionnaireCompleted: 0,
    mealRecorded: 0,
    alternativeSelected: 0,
    feedbackSubmitted: 0,
    gappedSessions: 0,
  };
  for (const item of sessions) {
    if (item.gapped) signals.gappedSessions += 1;
    const screens = item.events.filter((event) => event.type === 'screen_viewed');
    const path = screens.map((event) => String(event.properties.screenId ?? '')).join(' → ');
    if (path) paths.set(path, (paths.get(path) ?? 0) + 1);
    const first = screens[0];
    const last = screens.at(-1);
    if (first) entries.set(String(first.properties.screenId), (entries.get(String(first.properties.screenId)) ?? 0) + 1);
    if (last) exits.set(String(last.properties.screenId), (exits.get(String(last.properties.screenId)) ?? 0) + 1);
    for (const event of screens) {
      const screenId = String(event.properties.screenId);
      visits.set(screenId, (visits.get(screenId) ?? 0) + 1);
      const milliseconds = Number(event.properties.activeMs ?? 0);
      active.set(screenId, (active.get(screenId) ?? 0) + (Number.isFinite(milliseconds) ? milliseconds : 0));
    }
    for (const event of item.events) {
      if (event.type === 'navigation') {
        const key = `${event.properties.fromScreenId}\t${event.properties.toScreenId}`;
        edges.set(key, (edges.get(key) ?? 0) + 1);
      } else if (event.type === 'plan_purchase_started') signals.planPurchaseStarted += 1;
      else if (event.type === 'plan_purchase_completed') signals.planPurchaseCompleted += 1;
      else if (event.type === 'questionnaire_completed') signals.questionnaireCompleted += 1;
      else if (event.type === 'meal_recorded') signals.mealRecorded += 1;
      else if (event.type === 'alternative_selected') signals.alternativeSelected += 1;
      else if (event.type === 'feedback_submitted') signals.feedbackSubmitted += 1;
    }
  }
  const outgoing = new Map<string, number>();
  for (const [key, count] of edges) {
    const fromScreenId = key.split('\t')[0] ?? '';
    outgoing.set(fromScreenId, (outgoing.get(fromScreenId) ?? 0) + count);
  }
  const edgeRows: JourneyEdge[] = [...edges].map(([key, count]) => {
    const [fromScreenId, toScreenId] = key.split('\t');
    return {
      fromScreenId: fromScreenId ?? '',
      toScreenId: toScreenId ?? '',
      count,
      percent: share(count, outgoing.get(fromScreenId ?? '') ?? 0),
    };
  }).sort((left, right) => right.count - left.count || left.fromScreenId.localeCompare(right.fromScreenId));
  const ranked = (map: Map<string, number>) => [...map].map(([screenId, count]) => ({
    screenId,
    count,
    percent: share(count, sessions.length),
  })).sort((left, right) => right.count - left.count || left.screenId.localeCompare(right.screenId));
  const nodes = [...visits].map(([screenId, count]) => ({ screenId, count }))
    .sort((left, right) => right.count - left.count || left.screenId.localeCompare(right.screenId));
  const journeys = [...paths].map(([path, count]) => ({ path, count, percent: share(count, sessions.length) }))
    .sort((left, right) => right.count - left.count || left.path.localeCompare(right.path));
  const dropOff = [...exits].map(([screenId, count]) => ({
    screenId,
    count,
    visits: visits.get(screenId) ?? 0,
    percent: share(count, visits.get(screenId) ?? 0),
  })).sort((left, right) => (right.percent ?? -1) - (left.percent ?? -1) || left.screenId.localeCompare(right.screenId));
  const activeRows = [...active].map(([screenId, milliseconds]) => ({ screenId, milliseconds }))
    .sort((left, right) => right.milliseconds - left.milliseconds || left.screenId.localeCompare(right.screenId));
  const bounded = nodes.length > JOURNEY_GRAPH_NODES || edgeRows.length > JOURNEY_GRAPH_EDGES || journeys.length > JOURNEY_GRAPH_PATHS;
  return {
    sessions: sessions.length,
    bounded,
    nodes: nodes.slice(0, JOURNEY_GRAPH_NODES),
    edges: edgeRows.slice(0, JOURNEY_GRAPH_EDGES),
    journeys: journeys.slice(0, JOURNEY_GRAPH_PATHS),
    entries: ranked(entries),
    exits: ranked(exits),
    dropOff,
    active: activeRows,
    signals: { ...signals, authoritative: false as const },
  };
}

function share(count: number, total: number): number | null {
  return total ? Math.round((100 * count) / total) : null;
}

function parseEvent(item: unknown, now: Date): CleanEvent {
  if (!item || typeof item !== 'object') throw new ApiError(400, 'validation', 'رویداد نامعتبر است');
  const record = item as Record<string, unknown>;
  const id = uuid(record.id);
  if (!id) throw new ApiError(400, 'validation', 'شناسهٔ رویداد نامعتبر است');
  if (typeof record.type !== 'string') throw new ApiError(400, 'validation', 'نام رویداد نامعتبر است');
  const occurredAt = clock(record.occurredAt, now);
  const properties = cleanProperties(record.type, record.properties);
  return { id, type: record.type, occurredAt, properties };
}

function cleanProperties(type: string, value: unknown): Record<string, string | number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(400, 'validation', 'ویژگی رویداد نامعتبر است');
  }
  const raw = value as Record<string, unknown>;
  const keys = Object.keys(raw);
  if (keys.some((key) => FORBIDDEN.has(key))) throw new ApiError(400, 'sensitive_property', 'این ویژگی در تحلیل مسیر ذخیره نمی‌شود');
  if (type === 'session_started') return sessionProperties(raw);
  if (type === 'screen_viewed') return screenProperties(raw);
  if (type === 'navigation') return navigationProperties(raw);
  if (type === 'plan_purchase_started' || type === 'plan_purchase_completed') return idProperty(raw, 'serviceId');
  if (type === 'questionnaire_completed') return integerProperty(raw, 'schemaVersion', 1, 9999);
  if (type === 'meal_recorded') return idProperty(raw, 'mealId');
  if (type === 'alternative_selected') return idProperty(raw, 'optionId');
  if (type === 'feedback_submitted') return integerProperty(raw, 'rating', 1, 5);
  if (type === 'app_state') return stateProperty(raw);
  throw new ApiError(400, 'validation', 'نام رویداد نامعتبر است');
}

const FORBIDDEN = new Set([
  'answers', 'audio', 'body', 'content', 'explanation', 'image', 'message', 'note', 'phone', 'photo', 'text',
]);

function sessionProperties(raw: Record<string, unknown>): Record<string, string> {
  const allowed = new Set(['platform', 'appVersion', 'sessionType', 'firstAuthenticated']);
  assertKeys(raw, allowed);
  if (typeof raw.platform !== 'string' || !PLATFORMS.has(raw.platform)) {
    throw new ApiError(400, 'validation', 'سکوی برنامه نامعتبر است');
  }
  if (typeof raw.appVersion !== 'string' || !VERSION.test(raw.appVersion)) {
    throw new ApiError(400, 'validation', 'نسخهٔ برنامه نامعتبر است');
  }
  if (raw.sessionType !== undefined && raw.sessionType !== 'first_visit' && raw.sessionType !== 'returning') {
    throw new ApiError(400, 'validation', 'نوع نشست نامعتبر است');
  }
  if (raw.firstAuthenticated !== undefined && typeof raw.firstAuthenticated !== 'boolean') {
    throw new ApiError(400, 'validation', 'نشانهٔ ورود نامعتبر است');
  }
  return { platform: raw.platform, appVersion: raw.appVersion };
}

function screenProperties(raw: Record<string, unknown>): Record<string, string | number> {
  assertKeys(raw, new Set(['screenId', 'activeMs']));
  const screenId = stable(raw.screenId);
  const properties: Record<string, string | number> = { screenId };
  if (raw.activeMs !== undefined) properties.activeMs = boundedInt(raw.activeMs, 0, JOURNEY_MAX_ACTIVE_MS, 'زمان فعال');
  return properties;
}

function navigationProperties(raw: Record<string, unknown>): Record<string, string> {
  assertKeys(raw, new Set(['fromScreenId', 'toScreenId']));
  const fromScreenId = stable(raw.fromScreenId);
  const toScreenId = stable(raw.toScreenId);
  if (fromScreenId === toScreenId) throw new ApiError(400, 'validation', 'گذار باید بین دو صفحهٔ متفاوت باشد');
  return { fromScreenId, toScreenId };
}

function idProperty(raw: Record<string, unknown>, key: string): Record<string, string> {
  assertKeys(raw, new Set([key]));
  return { [key]: stable(raw[key]) };
}

function integerProperty(raw: Record<string, unknown>, key: string, min: number, max: number): Record<string, number> {
  assertKeys(raw, new Set([key]));
  return { [key]: boundedInt(raw[key], min, max, 'مقدار رویداد') };
}

function stateProperty(raw: Record<string, unknown>): Record<string, string> {
  assertKeys(raw, new Set(['state']));
  if (raw.state !== 'foreground' && raw.state !== 'background') {
    throw new ApiError(400, 'validation', 'وضعیت برنامه نامعتبر است');
  }
  return { state: raw.state };
}

function assertKeys(raw: Record<string, unknown>, allowed: Set<string>): void {
  for (const key of Object.keys(raw)) {
    if (!allowed.has(key)) throw new ApiError(400, 'sensitive_property', 'این ویژگی در تحلیل مسیر ذخیره نمی‌شود');
  }
}

function stable(value: unknown): string {
  if (typeof value !== 'string') throw new ApiError(400, 'validation', 'شناسهٔ پایدار نامعتبر است');
  const sensitive = sensitiveText(value);
  if (sensitive) throw new ApiError(400, 'sensitive_property', 'این ویژگی در تحلیل مسیر ذخیره نمی‌شود');
  if (!SLUG.test(value) && !UUID.test(value)) throw new ApiError(400, 'validation', 'شناسهٔ پایدار نامعتبر است');
  return value;
}

function sensitiveText(value: string): boolean {
  return /\s/.test(value) || value.includes('@') || value.includes('+') || /\d{8,}/.test(value);
}

function boundedInt(value: unknown, min: number, max: number, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new ApiError(400, 'validation', `${label} نامعتبر است`);
  }
  return value;
}

function clock(value: unknown, now: Date): string {
  if (typeof value !== 'string') throw new ApiError(400, 'clock_skew', 'زمان رویداد با ساعت سرور فاصله دارد');
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || Math.abs(parsed.getTime() - now.getTime()) > JOURNEY_SKEW_MS) {
    throw new ApiError(400, 'clock_skew', 'زمان رویداد با ساعت سرور فاصله دارد');
  }
  return parsed.toISOString();
}

function uuid(value: unknown): string | null {
  return typeof value === 'string' && UUID.test(value) ? value.toLowerCase() : null;
}
