<?php

namespace Tests\Feature;

use App\Shared\Domain\LegacyCrypto as Crypto;
use Illuminate\Database\QueryException;
use Tests\MySqlTestCase;

final class ProductSchemaTest extends MySqlTestCase
{
    public function test_every_source_table_and_column_has_a_mysql_destination(): void
    {
        $catalog = json_decode(file_get_contents(base_path('contracts/postgres-schema.json')), true);
        self::assertCount(119, $catalog['tables']);
        foreach ($catalog['tables'] as $table) {
            self::assertTrue($this->db->getSchemaBuilder()->hasTable($table['name']), $table['name']);
            $actual = $this->db->getSchemaBuilder()->getColumnListing($table['name']);
            self::assertSame([], array_values(array_diff(array_column($table['columns'], 'name'), $actual)), $table['name']);
        }
        $triggers = $this->db->select('select trigger_name from information_schema.triggers where trigger_schema=database()');
        self::assertGreaterThanOrEqual(30, count($triggers));
    }

    public function test_wallet_ledger_is_append_only_and_payment_amount_cannot_change(): void
    {
        $user = $this->actor();
        $id = Crypto::uuid();
        $this->db->table('wallet_ledger')->insert(['id' => $id, 'user_id' => $user['id'], 'bucket' => 'cash', 'amount_toman' => 100,
            'kind' => 'adjustment', 'reference_id' => Crypto::uuid()]);
        foreach (['update', 'delete'] as $operation) {
            try {
                $query = $this->db->table('wallet_ledger')->where('id', $id);
                $operation === 'update' ? $query->update(['amount_toman' => 200]) : $query->delete();
                self::fail('Ledger mutation was accepted');
            } catch (QueryException $error) {
                self::assertStringContainsString('append-only', $error->getMessage());
            }
        }
        $payment = Crypto::uuid();
        $this->db->table('payments')->insert(['id' => $payment, 'user_id' => $user['id'], 'package_code' => 'p50',
            'amount_toman' => 200000, 'amount_rial' => 2000000, 'status' => 'pending', 'gateway' => 'sandbox']);
        $this->db->table('payments')->where('id', $payment)->update(['status' => 'failed']);
        $this->expectException(QueryException::class);
        $this->db->table('payments')->where('id', $payment)->update(['amount_toman' => 1]);
    }

    public function test_partial_unique_index_allows_drafts_but_only_one_published_schema(): void
    {
        $next = (int) $this->db->table('questionnaire_schemas')->max('version') + 1;
        $this->db->table('questionnaire_schemas')->insert(['version' => $next, 'document' => '{}', 'status' => 'draft']);
        $this->expectException(QueryException::class);
        $this->db->table('questionnaire_schemas')->where('version', $next)->update(['status' => 'published']);
    }

    public function test_published_plan_content_is_immutable_and_superseding_preserves_it(): void
    {
        $user = $this->actor();
        $ids = $this->planFixture($user['id'], true);
        foreach ([['plan_days', 'id', $ids['day'], ['civil_date' => '2026-11-15']], ['plan_meals', 'id', $ids['meal'], ['title' => 'تغییر']],
            ['plan_meal_items', 'id', $ids['item'], ['quantity' => 90]], ['plan_meal_options', 'meal_id', $ids['meal'], ['document' => '{}']],
            ['plan_version_context', 'version_id', $ids['version'], ['questionnaire_snapshot' => '{"changed":true}']], ['plan_versions', 'id', $ids['version'], ['lock_version' => 2]]] as [$table,$key,$id,$values]) {
            try {
                $this->db->table($table)->where($key, $id)->update($values);
                self::fail('Published plan mutation was accepted: '.$table);
            } catch (QueryException $error) {
                self::assertStringContainsString('immutable', $error->getMessage());
            }
        }
        $this->db->table('plan_versions')->where('id', $ids['version'])->update(['status' => 'superseded']);
        self::assertSame('superseded', $this->db->table('plan_versions')->where('id', $ids['version'])->value('status'));
    }

    public function test_meal_history_and_reward_acknowledgement_guards(): void
    {
        $user = $this->actor();
        $ids = $this->planFixture($user['id'], true);
        $log = Crypto::uuid();
        $this->db->table('meal_logs')->insert(['id' => $log, 'user_id' => $user['id'], 'request_id' => $ids['request'], 'scheduled_date' => '2026-11-14', 'meal_uid' => $ids['mealUid'], 'eaten' => true, 'details' => '{"portion":1}']);
        $this->db->table('meal_logs')->where('id', $log)->update(['eaten' => false]);
        $stored = $this->db->table('meal_logs')->where('id', $log)->first();
        self::assertSame(2, $stored->revision);
        self::assertSame('{}', $stored->details);
        $history = $this->db->table('meal_log_history')->where('log_id', $log)->orderBy('id')->get();
        self::assertCount(2, $history);
        self::assertTrue(json_decode($history[1]->previous, true)['eaten']);
        self::assertFalse(json_decode($history[1]->current, true)['eaten']);
        $reward = Crypto::uuid();
        $this->db->table('weekly_rewards')->insert(['id' => $reward, 'user_id' => $user['id'], 'request_id' => $ids['request'], 'week_start' => '2026-11-14', 'amount_toman' => 100]);
        $this->db->table('weekly_rewards')->where('id', $reward)->update(['acknowledged_at' => '2026-11-14 12:00:00']);
        $this->expectException(QueryException::class);
        $this->db->table('weekly_rewards')->where('id', $reward)->update(['acknowledged_at' => null]);
    }
}
