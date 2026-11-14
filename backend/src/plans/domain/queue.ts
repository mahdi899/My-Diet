export const QUEUE_BUCKETS = [
  'generating',
  'awaiting_review',
  'awaiting_user',
  'response_received',
  'revisions',
  'published',
] as const;

export type QueueBucket = (typeof QUEUE_BUCKETS)[number];

export interface QueueRow {
  status: string;
  kind: string;
}

export function isQueueBucket(raw: unknown): raw is QueueBucket {
  return typeof raw === 'string' && (QUEUE_BUCKETS as readonly string[]).includes(raw);
}

export function inBucket(row: QueueRow, bucket: QueueBucket): boolean {
  const openRevision =
    (row.kind === 'ai_revision' || row.kind === 'specialist_revision') &&
    row.status !== 'published' &&
    row.status !== 'cancelled';
  switch (bucket) {
    case 'generating':
      return row.status === 'queued' || row.status === 'generating';
    case 'awaiting_review':
      return row.status === 'in_review' && row.kind === 'new_plan';
    case 'awaiting_user':
      return row.status === 'awaiting_user';
    case 'response_received':
      return row.status === 'response_received';
    case 'revisions':
      return openRevision;
    case 'published':
      return row.status === 'published';
    default:
      return false;
  }
}
