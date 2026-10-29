import type { ColumnType, Generated } from 'kysely';

export interface AppSettingsTable {
  key: string;
  value: ColumnType<unknown, unknown, unknown>;
  version: Generated<number>;
  updated_at: Generated<Date>;
}

export interface OutboxEventsTable {
  id: string;
  topic: string;
  aggregate_id: string;
  payload: ColumnType<unknown, unknown, unknown>;
  created_at: Generated<Date>;
  dispatched_at: Date | null;
  attempts: Generated<number>;
}

export interface Database {
  app_settings: AppSettingsTable;
  outbox_events: OutboxEventsTable;
}

export const PG_POOL = Symbol('PG_POOL');
export const PG_REPLICA = Symbol('PG_REPLICA');
export const KYSELY = Symbol('KYSELY');
