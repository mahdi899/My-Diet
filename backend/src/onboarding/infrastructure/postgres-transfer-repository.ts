import type { Pool } from 'pg';
import { audit, withTransaction, type Queryable } from '../../common/sql.js';
import type { TransferRecord, TransferRepository, TransferSession } from '../application/transfer-ports.js';

const fields = 'id, plan, amount_toman, expires_at, confirmed_at, (zibal_track_id is not null) as gateway_started';

class PostgresTransferSession implements TransferSession {
  constructor(private readonly client: Queryable) {}
  async lockUser(userId: string) {
    const { rows } = await this.client.query<{ phone_e164: string }>('select phone_e164 from users where id=$1 for update', [userId]);
    return rows[0] ? { phone: rows[0].phone_e164 } : null;
  }
  async isVerifiedSubmission(submissionId: string, phoneHash: string) {
    const result = await this.client.query('select 1 from demo_lead_submissions where id=$1 and phone_hash=$2 and phone_verified', [submissionId, phoneHash]);
    return (result.rowCount ?? 0) > 0;
  }
  async reusable(userId: string, submissionId: string, plan: string) {
    const { rows } = await this.client.query<TransferRecord>(
      'select '+fields+' from onboarding_transfers where user_id=$1 and submission_id=$2 and plan=$3 and (confirmed_at is not null or expires_at>now()) order by created_at desc limit 1',
      [userId, submissionId, plan],
    );
    return rows[0] ?? null;
  }
  async insert(input: { id: string; userId: string; submissionId: string; plan: string; amountToman: number }) {
    const { rows } = await this.client.query<TransferRecord>(
      "insert into onboarding_transfers(id,user_id,submission_id,plan,amount_toman,expires_at) values($1,$2,$3,$4,$5,now()+interval '30 minutes') on conflict(amount_toman) do nothing returning "+fields,
      [input.id, input.userId, input.submissionId, input.plan, input.amountToman],
    );
    return rows[0] ?? null;
  }
  async lockPayment(id: string, userId: string) {
    const { rows } = await this.client.query<{ amount_toman: number; zibal_track_id: string | null; confirmed_at: Date | null; active: boolean }>(
      'select amount_toman, zibal_track_id, confirmed_at, expires_at > now() as active from onboarding_transfers where id=$1 and user_id=$2 for update', [id, userId],
    );
    const row = rows[0];
    return row ? { amountToman: row.amount_toman, trackId: row.zibal_track_id, confirmed: row.confirmed_at != null, active: row.active } : null;
  }
  async attachGateway(id: string, trackId: string) {
    await this.client.query('update onboarding_transfers set zibal_track_id=$2 where id=$1', [id, trackId]);
  }
  async confirmGateway(id: string, reference: string) {
    const { rows } = await this.client.query<{ phone_e164: string }>(
      "update onboarding_transfers t set confirmed_at=now(),bank_reference=$2,sms_status='sending' from users u where t.id=$1 and t.user_id=u.id and t.confirmed_at is null returning u.phone_e164", [id, reference],
    );
    return rows[0] ? { phone: rows[0].phone_e164 } : null;
  }
  async lockBankReference(reference: string) {
    await this.client.query('select pg_advisory_xact_lock(hashtext($1))', [reference]);
  }
  async hasBankReference(reference: string, exceptId: string) {
    const result = await this.client.query('select 1 from onboarding_transfers where bank_reference=$1 and id<>$2', [reference, exceptId]);
    return (result.rowCount ?? 0) > 0;
  }
  async confirmBank(id: string, reference: string, amountToman: number) {
    const { rows } = await this.client.query<{ amount_toman: number; phone_e164: string }>(
      "update onboarding_transfers t set confirmed_at=now(),bank_reference=$2,sms_status='sending' from users u where t.id=$1 and t.user_id=u.id and t.confirmed_at is null and t.amount_toman=$3 and t.zibal_track_id is null returning t.amount_toman,u.phone_e164", [id, reference, amountToman],
    );
    return rows[0] ? { amountToman: rows[0].amount_toman, phone: rows[0].phone_e164 } : null;
  }
  audit(actorId: string | null, action: string, id: string, detail: object) {
    return audit(this.client, actorId, action, 'onboarding_transfer', id, detail);
  }
}

export class PostgresTransferRepository implements TransferRepository {
  constructor(private readonly pool: Pool) {}
  transaction<T>(run: (session: TransferSession) => Promise<T>) {
    return withTransaction(this.pool, client => run(new PostgresTransferSession(client)));
  }
  async status(id: string, userId: string) {
    const { rows } = await this.pool.query<TransferRecord>('select '+fields+' from onboarding_transfers where id=$1 and user_id=$2', [id, userId]);
    return rows[0] ?? null;
  }
  async byGatewayTrack(trackId: string) {
    const { rows } = await this.pool.query<{ id: string; amount_toman: number; confirmed_at: Date | null }>(
      'select id, amount_toman, confirmed_at from onboarding_transfers where zibal_track_id=$1', [trackId],
    );
    const row = rows[0];
    return row ? { id: row.id, amountToman: row.amount_toman, confirmed: row.confirmed_at != null } : null;
  }
  async list() {
    return (await this.pool.query<Record<string, unknown>>('select t.*, u.phone_e164 from onboarding_transfers t join users u on u.id=t.user_id order by t.created_at desc limit 200')).rows;
  }
  async setSmsStatus(id: string, status: 'sent' | 'failed') {
    await this.pool.query('update onboarding_transfers set sms_status=$2 where id=$1', [id, status]);
  }
}
