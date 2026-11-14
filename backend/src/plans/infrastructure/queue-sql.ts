import type { QueueBucket } from '../domain/queue.js';

const BUCKET_SQL: Record<QueueBucket, string> = {
  generating: `r.status in ('queued', 'generating')`,
  awaiting_review: `r.status = 'in_review' and r.kind = 'new_plan'`,
  awaiting_user: `r.status = 'awaiting_user'`,
  response_received: `r.status = 'response_received'`,
  revisions: `r.kind in ('ai_revision', 'specialist_revision') and r.status not in ('published', 'cancelled')`,
  published: `r.status = 'published'`,
};

/** Fixed SQL fragment. The caller must pass a parsed bucket, never the query string. */
export function bucketSql(bucket: QueueBucket): string {
  return BUCKET_SQL[bucket];
}

