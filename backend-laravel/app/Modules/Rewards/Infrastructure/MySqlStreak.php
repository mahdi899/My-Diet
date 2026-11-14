<?php

namespace App\Modules\Rewards\Infrastructure;

use App\Modules\Plans\Domain\CivilDates;
use App\Modules\Rewards\Application\StreakStore;
use App\Modules\Rewards\Domain\StreakRules;
use App\Shared\Domain\Amount;
use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;
use Closure;
use Illuminate\Database\ConnectionInterface;

final class MySqlStreak implements StreakStore
{
    public function __construct(private ConnectionInterface $db) {}

    public function transaction(Closure $work): mixed
    {
        return $this->db->transaction($work);
    }

    public function lockWallet(string $user): void
    {
        $this->db->select('select user_id from wallets where user_id=? for update', [$user]);
    }

    public function claim(string $user, string $command): ?array
    {
        $row = $this->db->selectOne('select response from streak_claims where user_id=? and command_id=?', [$user, $command]);

        return $row === null ? null : json_decode($row->response, true, 512, JSON_THROW_ON_ERROR);
    }

    public function saveClaim(string $user, string $command, array $response): void
    {
        $this->db->table('streak_claims')->insert(['user_id' => $user, 'command_id' => $command, 'response' => json_encode($response, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)]);
    }

    public function promo(string $user): int
    {
        return Amount::safe((string) ($this->db->table('wallets')->where('user_id', $user)->value('promo_toman') ?? 0));
    }

    public function participation(string $user, string $today): ?array
    {
        $row = $this->db->selectOne('select p.id,p.campaign_id,p.cycle_start from streak_participations p join streak_campaigns c on c.id=p.campaign_id where p.user_id=? and p.cycle_start<=? and date_add(p.cycle_start, interval c.consecutive_days day)>? order by p.created_at desc limit 1', [$user, $today, $today]);

        return $row === null ? null : ['id' => $row->id, 'campaign_id' => $row->campaign_id, 'cycle_start' => substr((string) $row->cycle_start, 0, 10)];
    }

    public function latest(): ?array
    {
        $id = $this->db->table('streak_campaigns')->orderByDesc('version')->value('id');

        return $id === null ? null : $this->rules($id);
    }

    public function rules(string $id): array
    {
        $row = $this->db->selectOne('select id,version,consecutive_days,starts_on,ends_on,effective_on,`repeat` from streak_campaigns where id=?', [$id]);
        if ($row === null) {
            throw new Problem(404, 'not_found', 'کمپین پیدا نشد');
        }
        $milestones = array_map(fn ($item) => ['day' => (int) $item->day_index, 'amountToman' => Amount::safe((string) $item->amount_toman)], $this->db->select('select day_index,amount_toman from streak_milestones where campaign_id=? order by day_index', [$id]));

        return ['id' => $row->id, 'version' => (int) $row->version, 'consecutiveDays' => (int) $row->consecutive_days, 'milestones' => $milestones, 'startsOn' => substr((string) $row->starts_on, 0, 10), 'endsOn' => $row->ends_on === null ? null : substr((string) $row->ends_on, 0, 10), 'effectiveOn' => substr((string) $row->effective_on, 0, 10), 'repeat' => $row->repeat];
    }

    public function ids(): array
    {
        return array_map(fn ($row) => $row->id, $this->db->select('select id from streak_campaigns order by version'));
    }

    public function saveCampaign(array $input, array $milestones): array
    {
        return $this->transaction(function () use ($input, $milestones): array {
            $current = $this->db->selectOne('select version from streak_campaigns order by version desc limit 1 for update');
            $id = Crypto::uuid();
            $this->db->table('streak_campaigns')->insert(['id' => $id, 'version' => (int) ($current->version ?? 0) + 1, 'consecutive_days' => $input['consecutiveDays'], 'qualifying_rule' => 'recorded_meals', 'starts_on' => $input['startsOn'], 'ends_on' => $input['endsOn'], 'effective_on' => $input['effectiveOn'], 'repeat' => $input['repeat'], 'participant_policy' => 'finish_current_version']);
            foreach ($milestones as $milestone) {
                $this->db->table('streak_milestones')->insert(['campaign_id' => $id, 'day_index' => $milestone['day'], 'amount_toman' => $milestone['amountToman']]);
            }

            return $this->rules($id);
        });
    }

    public function ensureParticipation(string $user, string $campaign, string $cycleStart): array
    {
        $id = Crypto::uuid();
        $this->db->table('streak_participations')->insertOrIgnore(['id' => $id, 'user_id' => $user, 'campaign_id' => $campaign, 'cycle_start' => $cycleStart]);
        $row = $this->db->selectOne('select id,campaign_id from streak_participations where user_id=? and cycle_start=?', [$user, $cycleStart]);

        return ['id' => $row->id, 'campaign_id' => $row->campaign_id];
    }

    public function activity(string $user, string $cycleStart, int $length): array
    {
        $qualified = [];
        $partial = [];
        for ($index = 0; $index < $length; $index++) {
            $date = CivilDates::add($cycleStart, $index);
            $planned = $this->db->select("select m.meal_uid from active_plan_versions a join plan_versions v on v.id=a.version_id and v.status='published' join plan_requests r on r.id=v.request_id and r.status<>'cancelled' join orders o on o.id=r.order_id and o.status='paid' join plan_days d on d.plan_version_id=v.id and d.civil_date=? join plan_meals m on m.plan_day_id=d.id where a.user_id=?", [$date, $user]);
            if ($planned === []) {
                continue;
            }
            $done = [];
            foreach ($this->db->select('select meal_uid,eaten,details from meal_logs where user_id=? and scheduled_date=?', [$user, $date]) as $log) {
                $details = json_decode($log->details, true);
                if (StreakRules::recorded((bool) $log->eaten, is_array($details) ? ($details['state'] ?? null) : null)) {
                    $done[$log->meal_uid] = true;
                }
            }
            $recorded = count(array_filter($planned, fn ($meal) => isset($done[$meal->meal_uid])));
            if ($recorded === count($planned)) {
                $qualified[$date] = true;
            } elseif ($recorded > 0) {
                $partial[$date] = true;
            }
        }
        $anomaly = $this->db->selectOne('select 1 as found from meal_log_anomalies where user_id=? and scheduled_date>=? and scheduled_date<? limit 1', [$user, $cycleStart, CivilDates::add($cycleStart, $length)]) !== null;

        return ['qualified' => $qualified, 'partial' => $partial, 'anomaly' => $anomaly];
    }

    public function granted(string $participation): array
    {
        $days = [];
        foreach ($this->db->select("select milestone_day from streak_grants where participation_id=? and status='issued'", [$participation]) as $row) {
            $days[(int) $row->milestone_day] = true;
        }

        return $days;
    }

    public function reverseShortfall(string $user, string $participation, int $consecutive, string $today): void
    {
        $grants = $this->db->select("select id,milestone_day,amount_toman from streak_grants where participation_id=? and status='issued' and milestone_day>? for update", [$participation, $consecutive]);
        foreach ($grants as $grant) {
            $amount = Amount::safe((string) $grant->amount_toman);
            if ($this->promo($user) < $amount) {
                $this->db->table('streak_signals')->insertOrIgnore(['id' => Crypto::uuid(), 'user_id' => $user, 'civil_date' => $today, 'kind' => 'reversal_uncollected']);

                continue;
            }
            $this->db->update('update wallets set promo_toman=promo_toman-?,version=version+1 where user_id=?', [$amount, $user]);
            $this->db->table('wallet_ledger')->insert(['id' => Crypto::uuid(), 'user_id' => $user, 'bucket' => 'promo', 'amount_toman' => -$amount, 'kind' => 'campaign_reversal', 'reference_id' => $grant->id]);
            $this->db->table('streak_grants')->where('id', $grant->id)->update(['status' => 'reversed']);
        }
    }

    public function issue(string $user, string $participation, string $cycleStart, array $milestones, int $consecutive, bool $anomaly): array
    {
        $created = [];
        foreach ($milestones as $milestone) {
            if ($consecutive < $milestone['day'] || $milestone['amountToman'] <= 0) {
                continue;
            }
            $id = Crypto::uuid();
            if ($this->db->table('streak_grants')->insertOrIgnore(['id' => $id, 'user_id' => $user, 'participation_id' => $participation, 'milestone_day' => $milestone['day'], 'amount_toman' => $milestone['amountToman'], 'status' => $anomaly ? 'held' : 'issued']) === 0) {
                continue;
            }
            if ($anomaly) {
                $this->db->table('streak_signals')->insertOrIgnore(['id' => Crypto::uuid(), 'user_id' => $user, 'civil_date' => $cycleStart, 'kind' => 'late_bulk_hold']);
                $created[] = ['id' => $id, 'day' => $milestone['day'], 'amountToman' => $milestone['amountToman'], 'issued' => false];

                continue;
            }
            $this->db->update('update wallets set promo_toman=promo_toman+?,version=version+1 where user_id=?', [$milestone['amountToman'], $user]);
            $this->db->table('wallet_ledger')->insert(['id' => Crypto::uuid(), 'user_id' => $user, 'bucket' => 'promo', 'amount_toman' => $milestone['amountToman'], 'kind' => 'campaign_reward', 'reference_id' => $id]);
            $notice = Crypto::uuid();
            $this->db->table('notifications')->insert(['id' => $notice, 'user_id' => $user, 'kind' => 'campaign_reward', 'payload' => json_encode(['grantId' => $id, 'amountToman' => $milestone['amountToman']], JSON_THROW_ON_ERROR)]);
            $created[] = ['id' => $id, 'day' => $milestone['day'], 'amountToman' => $milestone['amountToman'], 'issued' => true];
        }

        return $created;
    }

    public function held(string $participation): bool
    {
        return $this->db->selectOne("select 1 as found from streak_grants where participation_id=? and status='held' limit 1", [$participation]) !== null;
    }
}
