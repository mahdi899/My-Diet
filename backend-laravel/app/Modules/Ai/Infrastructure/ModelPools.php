<?php

namespace App\Modules\Ai\Infrastructure;

use App\Modules\Plans\Domain\CivilDates;
use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;
use Illuminate\Database\ConnectionInterface;

final class ModelPools
{
    public function __construct(private ConnectionInterface $db, private ProviderClient $client) {}

    public function run(string $code, array $messages, ?string $request = null, ?string $user = null, bool $json = false, ?\Closure $validate = null): array
    {
        $pool = $this->db->table('ai_pools')->where('code', $code)->first();
        if (! $pool || ! $pool->enabled) {
            throw new Problem(503, 'pool_unavailable', 'استخر مدل فعال نیست');
        }
        $members = $this->db->select('select m.*,p.name as provider_name,p.kind,p.base_url,p.api_key_encrypted,p.http_referer,p.app_title,h.cooldown_until from ai_pool_members m join ai_providers p on p.id=m.provider_id left join ai_pool_health h on h.member_id=m.id where m.pool_id=? and m.enabled=1 and p.active=1 and (h.cooldown_until is null or h.cooldown_until<=current_timestamp(6)) order by m.position,m.id', [$pool->id]);
        if ($pool->strategy === 'cost_first') {
            usort($members, fn ($a, $b) => ($a->price_in_micros_per_m + $a->price_out_micros_per_m) <=> ($b->price_in_micros_per_m + $b->price_out_micros_per_m));
        } elseif ($pool->strategy === 'weighted') {
            foreach ($members as $member) {
                $member->weightedPriority = -log(random_int(1, PHP_INT_MAX) / PHP_INT_MAX) / max(1, $member->weight);
            }
            usort($members, fn ($a, $b) => $a->weightedPriority <=> $b->weightedPriority);
        }
        $last = null;
        foreach (array_slice($members, 0, max(1, $pool->max_attempts)) as $index => $member) {
            $inputBound = strlen(json_encode($messages, JSON_THROW_ON_ERROR)) + 256;
            $estimate = (int) ceil(($inputBound * $member->price_in_micros_per_m + $pool->max_tokens * $member->price_out_micros_per_m) / 1_000_000);
            $reservation = $this->reserve($estimate, $request, $user);
            $started = microtime(true);
            $result = null;
            try {
                $result = $this->client->complete((array) $member, $member->model, $messages, $pool->max_tokens, $pool->timeout_ms, (float) $pool->temperature, $json);
                $result['costMicros'] ??= $result['usageKnown']
                    ? (int) ceil(($result['tokensIn'] * $member->price_in_micros_per_m + $result['tokensOut'] * $member->price_out_micros_per_m) / 1_000_000) : $estimate;
                $result['value'] = $validate ? $validate($result['text']) : $result['text'];
                $this->finish($reservation, $member, $code, $request, $index + 1, $result, 'ok', $started);

                return $result + ['provider' => $member->provider_name, 'poolCode' => $code];
            } catch (\Throwable $error) {
                $outcome = $error instanceof Problem ? $error->problemCode :
                    ($error instanceof \InvalidArgumentException ? 'invalid_plan' : 'outcome_unknown');
                $last = $outcome;
                $cost = $result['costMicros'] ?? ($outcome === 'outcome_unknown' ? $estimate : 0);
                $this->finish($reservation, $member, $code, $request, $index + 1,
                    ($result ?? ['tokensIn' => 0, 'tokensOut' => 0]) + ['costMicros' => $cost], $outcome, $started);
                if (in_array($outcome, ['outcome_unknown', 'ai_disabled', 'ai_key_missing', 'endpoint_invalid'], true)) {
                    throw new Problem(503, $outcome, 'اجرای مدل تکمیل نشد؛ وضعیت هزینه و تنظیمات را بررسی کنید');
                }
            }
        }
        throw new Problem(503, $last ?? 'pool_empty', 'هیچ مدل آماده‌ای پاسخ معتبر نداد');
    }

    private function reserve(int $estimate, ?string $request, ?string $user): string
    {
        return $this->db->transaction(function () use ($estimate, $request, $user): string {
            $controls = $this->db->table('ai_controls')->where('id', 1)->lockForUpdate()->first();
            if (! $controls || $controls->kill_switch) {
                throw new Problem(503, 'ai_budget_exceeded', 'هوش مصنوعی موقتاً خاموش است');
            }
            if ($estimate === 0 && ($controls->daily_cost_cap_micros !== null || $controls->monthly_cost_cap_micros !== null || $controls->per_request_cap_micros !== null)) {
                throw new Problem(503, 'ai_pricing_required', 'برای کنترل سقف هزینه، قیمت مدل را تنظیم کنید');
            }
            $zone = new \DateTimeZone('Asia/Tehran');
            $day = (new \DateTimeImmutable(CivilDates::today(), $zone))->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d H:i:s');
            $month = (new \DateTimeImmutable(substr(CivilDates::today(), 0, 7).'-01', $zone))->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d H:i:s');
            foreach ([[$controls->daily_cost_cap_micros, $day], [$controls->monthly_cost_cap_micros, $month]] as [$cap, $from]) {
                $used = (int) $this->db->table('ai_usage_ledger')->where('created_at', '>=', $from)->sum('cost_micros');
                $held = (int) $this->db->table('ai_call_reservations')->where('state', 'reserved')->where('created_at', '>=', $from)->sum('reserved_micros');
                if ($cap !== null && $used + $held + $estimate > $cap) {
                    throw new Problem(429, 'ai_budget_exceeded', 'سقف هزینهٔ هوش مصنوعی پر شده است');
                }
            }
            if ($controls->per_request_cap_micros !== null) {
                $used = $request ? (int) $this->db->table('ai_usage_ledger')->where('request_id', $request)->sum('cost_micros') : 0;
                $held = $request ? (int) $this->db->table('ai_call_reservations')->where('state', 'reserved')->where('request_id', $request)->sum('reserved_micros') : 0;
                if ($used + $held + $estimate > $controls->per_request_cap_micros) {
                    throw new Problem(429, 'ai_budget_exceeded', 'سقف هزینهٔ درخواست پر شده است');
                }
            }
            $id = Crypto::uuid();
            $this->db->table('ai_call_reservations')->insert(['id' => $id, 'request_id' => $request, 'user_id' => $user, 'reserved_micros' => $estimate, 'state' => 'reserved']);

            return $id;
        });
    }

    private function finish(string $reservation, object $member, string $code, ?string $request, int $attempt, array $result, string $outcome, float $started): void
    {
        $this->db->transaction(function () use ($reservation, $member, $code, $request, $attempt, $result, $outcome, $started): void {
            $row = $this->db->table('ai_call_reservations')->where('id', $reservation)->lockForUpdate()->first();
            if (! $row || $row->state !== 'reserved') {
                return;
            }
            $this->db->table('ai_usage_ledger')->insert(['id' => Crypto::uuid(), 'request_id' => $request, 'task' => $code, 'pool_code' => $code,
                'member_id' => $member->id, 'provider_name' => $member->provider_name, 'model' => $member->model, 'attempt_no' => $attempt,
                'outcome' => in_array($outcome, ['ok', 'rate_limited', 'auth_failed', 'rejected', 'timeout', 'invalid_json', 'invalid_plan', 'outcome_unknown', 'budget_blocked'], true) ? $outcome : 'rejected', 'tokens_in' => $result['tokensIn'] ?? 0, 'tokens_out' => $result['tokensOut'] ?? 0,
                'cost_micros' => $result['costMicros'] ?? 0, 'cost_source' => $result['costSource'] ?? 'estimate',
                'latency_ms' => (int) ((microtime(true) - $started) * 1000), 'error_code' => $outcome === 'ok' ? null : $outcome]);
            $this->db->table('ai_call_reservations')->where('id', $reservation)->update(['state' => 'settled']);
            $this->db->statement('insert ignore into ai_pool_health(member_id) values(?)', [$member->id]);
            if ($outcome === 'ok') {
                $this->db->update('update ai_pool_health set consecutive_failures=0,cooldown_until=null,last_error_code=null,last_ok_at=current_timestamp(6),total_ok=total_ok+1 where member_id=?', [$member->id]);
            } else {
                $this->db->update('update ai_pool_health set consecutive_failures=consecutive_failures+1,cooldown_until=date_add(current_timestamp(6),interval 60 second),last_error_code=?,last_fail_at=current_timestamp(6),total_fail=total_fail+1 where member_id=?', [$outcome, $member->id]);
            }
        });
    }
}
