<?php

namespace App\Modules\Money\Infrastructure;

use App\Modules\Money\Application\MoneyStore;
use App\Modules\Money\Domain\SubscriptionPlans;
use App\Shared\Domain\Amount;
use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Collection;

final class MySqlMoney implements MoneyStore
{
    public function __construct(private ConnectionInterface $db) {}

    private function row(?object $row): ?array
    {
        return $row === null ? null : (array) $row;
    }

    private function json(mixed $value): string
    {
        return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }

    public function catalog(): array
    {
        $services = $this->db->select('select s.code,s.title_fa,p.amount_toman from services s join service_prices p on p.id=(select id from service_prices where service_code=s.code and effective_from<=current_timestamp(6) order by effective_from desc limit 1) order by s.code');

        return ['services' => array_map(fn ($r) => ['code' => $r->code, 'titleFa' => $r->title_fa, 'priceToman' => Amount::safe($r->amount_toman)], $services),
            'topups' => array_map(fn ($r) => ['code' => $r->code, 'amountToman' => Amount::safe($r->amount_toman), 'amountRial' => Amount::safe((string) (Amount::safe($r->amount_toman) * 10))], $this->db->table('topup_packages')->where('active', true)->orderBy('amount_toman')->get()->all()),
            'weeklyRewardToman' => Amount::safe((string) ($this->db->table('reward_policies')->where('kind', 'weekly_completion')->where('active', true)->value('amount_toman') ?? 0))];
    }

    public function wallet(string $user, bool $lock = false): ?array
    {
        $q = $this->db->table('wallets')->where('user_id', $user);

        return $this->row(($lock ? $q->lockForUpdate() : $q)->first());
    }

    public function checkout(string $id, bool $lock = false): ?array
    {
        $query = $this->db->table('plan_checkouts')->where('id', $id);

        return $this->row(($lock ? $query->lockForUpdate() : $query)->first());
    }

    public function priorCheckout(string $user, string $key): ?array
    {
        return $this->row($this->db->table('plan_checkouts')->where(['user_id' => $user, 'idempotency_key' => $key])->first());
    }

    public function pendingCheckout(string $user): ?array
    {
        return $this->row($this->db->table('plan_checkouts')->where('user_id', $user)->where('status', 'pending')->first());
    }

    public function createCheckout(array $checkout): void
    {
        $this->db->table('plan_checkouts')->insert($checkout);
    }

    public function updateCheckout(string $id, array $changes): void
    {
        $this->db->table('plan_checkouts')->where('id', $id)->update($changes);
    }

    public function activateSubscription(string $user, string $service, int $days): void
    {
        $this->db->statement('insert into user_service_access (user_id, service_code, ends_at) values (?, ?, date_add(current_timestamp(6), interval ? day)) as incoming on duplicate key update service_code=incoming.service_code, ends_at=date_add(greatest(user_service_access.ends_at, current_timestamp(6)), interval ? day), updated_at=current_timestamp(6)', [$user, $service, $days, $days]);
    }

    public function orders(string $user): array
    {
        return array_map(function ($row): array {
            $row->title_fa = SubscriptionPlans::ALL[$row->plan_code ?? '']['title'] ?? $row->title_fa;

            return (array) $row;
        }, $this->db->table('orders as o')->join('services as s', 's.code', '=', 'o.service_code')->leftJoin('plan_checkouts as c', 'c.order_id', '=', 'o.id')->where('o.user_id', $user)->select('o.*', 's.title_fa', 'c.plan_code')->orderByDesc('o.created_at')->limit(100)->get()->all());
    }

    public function subscription(string $user): ?array
    {
        $access = $this->db->table('user_service_access as a')->join('services as s', 's.code', '=', 'a.service_code')->where('a.user_id', $user)->select('a.service_code', 's.title_fa', 'a.ends_at', 'a.updated_at')->first();
        $order = $this->db->table('orders as o')->join('services as s', 's.code', '=', 'o.service_code')->join('plan_requests as r', 'r.order_id', '=', 'o.id')->where('o.user_id', $user)->where('o.service_code', 'new_plan')->where('o.status', 'paid')->where('r.status', '<>', 'cancelled')->orderByDesc('o.created_at')->select('o.*', 's.title_fa', 'r.status as request_status')->first();
        if ($access !== null) {
            $checkout = $this->db->table('plan_checkouts')->where('user_id', $user)->where('status', 'paid')->whereNotNull('plan_code')->orderByDesc('paid_at')->orderByDesc('created_at')->first();
            $access->title_fa = SubscriptionPlans::ALL[$checkout->plan_code ?? '']['title'] ?? $access->title_fa;
            $active = new \DateTimeImmutable($access->ends_at, new \DateTimeZone('UTC')) > new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
            if ($active || $order === null || $order->created_at <= $access->updated_at) {
                return ['serviceCode' => $access->service_code, 'planId' => $checkout->plan_code ?? null, 'title' => $access->title_fa, 'status' => $active ? 'active' : 'expired', 'endsAt' => Crypto::iso($access->ends_at)];
            }
        }
        if ($order !== null) {
            return ['serviceCode' => $order->service_code, 'title' => $order->title_fa, 'status' => 'active', 'requestStatus' => $order->request_status, 'startedAt' => Crypto::iso($order->created_at), 'endsAt' => null];
        }

        return null;
    }

    public function ledger(string $user): array
    {
        return array_map(fn ($r) => (array) $r, $this->db->table('wallet_ledger')->where('user_id', $user)->orderByDesc('created_at')->limit(100)->get()->all());
    }

    public function order(string $id, bool $lock = false): ?array
    {
        $q = $this->db->table('orders')->where('id', $id);
        $row = $this->row(($lock ? $q->lockForUpdate() : $q)->first());

        return $row === null ? null : [...$row, 'direct_payment' => $this->db->table('plan_checkouts')->where('order_id', $id)->exists()];
    }

    public function payment(string $id, bool $lock = false): ?array
    {
        $q = $this->db->table('payments')->where('id', $id);

        return $this->row(($lock ? $q->lockForUpdate() : $q)->first());
    }

    public function package(string $code): ?array
    {
        return $this->row($this->db->table('topup_packages')->where('code', $code)->where('active', true)->first());
    }

    public function createPayment(array $payment): void
    {
        $this->db->table('payments')->insert($payment);
    }

    public function paymentAuthority(string $id, string $authority): void
    {
        $this->db->table('payments')->where('id', $id)->update(['authority' => $authority]);
    }

    public function failPayment(string $id, string $reason): void
    {
        $this->db->table('payments')->where('id', $id)->where('status', 'pending')->update(['status' => 'failed', 'failure_reason' => $reason]);
    }

    public function creditPayment(string $id, ?string $reference): void
    {
        $this->db->table('payments')->where('id', $id)->update(['status' => 'credited', 'credited_at' => $this->db->raw('current_timestamp(6)'), 'ref_id' => $reference]);
    }

    public function changeWallet(string $user, int $cash, int $promo): void
    {
        $this->db->update('update wallets set cash_toman=cash_toman+?,promo_toman=promo_toman+?,version=version+1 where user_id=?', [$cash, $promo, $user]);
    }

    public function appendLedger(string $user, string $bucket, int $amount, string $kind, string $reference): void
    {
        $this->db->table('wallet_ledger')->insert(['id' => Crypto::uuid(), 'user_id' => $user, 'bucket' => $bucket, 'amount_toman' => $amount, 'kind' => $kind, 'reference_id' => $reference]);
    }

    public function priorOrder(string $user, string $key): ?array
    {
        $row = $this->row($this->db->table('idempotency_records')->where(['user_id' => $user, 'idempotency_key' => $key])->first());

        return $row === null ? null : [...$row, 'response' => $row['response'] === null ? null : json_decode($row['response'], true, 512, JSON_THROW_ON_ERROR)];
    }

    public function beginOrder(string $user, string $key, string $hash): void
    {
        $this->db->table('idempotency_records')->insert(['id' => Crypto::uuid(), 'user_id' => $user, 'idempotency_key' => $key, 'request_hash' => $hash]);
    }

    public function finishOrder(string $user, string $key, array $response): void
    {
        $this->db->table('idempotency_records')->where(['user_id' => $user, 'idempotency_key' => $key])->update(['response' => $this->json($response)]);
    }

    public function admission(string $user, ?string $parent): array
    {
        $profile = $this->db->table('nutrition_profiles')->where('user_id', $user)->first();
        $parentPublished = $parent !== null && $this->db->table('plan_requests as r')->join('plan_versions as v', 'v.request_id', '=', 'r.id')->where('r.id', $parent)->where('r.user_id', $user)->where('v.status', 'published')->exists();

        return ['open' => $this->db->table('plan_requests')->where('user_id', $user)->whereIn('status', ['queued', 'generating', 'in_review', 'awaiting_user', 'response_received'])->exists(),
            'submission' => $this->db->table('questionnaire_submissions')->where('user_id', $user)->orderByDesc('submitted_at')->value('id'),
            'consented' => $profile === null || $profile->consented_at !== null, 'parentPublished' => $parentPublished,
            'includedChanges' => $this->includedChanges($user)];
    }

    private function includedChanges(string $user): bool
    {
        $checkout = $this->db->table('plan_checkouts')->where('user_id', $user)->where('status', 'paid')->whereNotNull('plan_code')->orderByDesc('paid_at')->first();
        $access = $this->db->table('user_service_access')->where('user_id', $user)->where('ends_at', '>', $this->db->raw('current_timestamp(6)'))->exists();
        if ($checkout !== null) {
            $limit = ['weekly' => 0, 'monthly' => 2, 'quarterly' => 6][$checkout->plan_code] ?? 0;
            $used = $this->db->table('orders')->where('user_id', $user)->where('service_code', '<>', 'new_plan')->where('status', 'paid')->where('created_at', '>=', $checkout->paid_at)->count();

            return $access && $used < $limit;
        }

        return $access || $this->db->table('payments')->where('user_id', $user)->where('status', 'credited')->exists() || $this->db->table('orders')->where('user_id', $user)->where('service_code', 'new_plan')->where('status', 'paid')->exists();
    }

    public function price(string $service): int
    {
        return Amount::safe((string) ($this->db->table('service_prices')->where('service_code', $service)->where('effective_from', '<=', $this->db->raw('current_timestamp(6)'))->orderByDesc('effective_from')->value('amount_toman') ?? 0));
    }

    public function planPrice(string $plan): int
    {
        $stored = $this->db->table('subscription_plan_prices')->where('plan_code', $plan)->where('effective_from', '<=', $this->db->raw('current_timestamp(6)'))->orderByDesc('effective_from')->value('amount_toman');

        return Amount::safe((string) ($stored ?? SubscriptionPlans::ALL[$plan]['priceToman'] ?? 0));
    }

    public function assignSpecialist(?string $submissionId = null): ?string
    {
        $this->db->statement('insert into identity_mutexes(lock_key) values(?) as incoming on duplicate key update lock_key=incoming.lock_key', [hash('sha256', 'plans:assignment')]);
        $track = $submissionId === null ? null : $this->db->table('nutrition_profiles')->where('submission_id', $submissionId)->value('track');
        $hints = match ($track) {
            'pregnancy' => ['بارداری', 'pregnancy'],
            'weight_loss' => ['کاهش', 'weight_loss'],
            'weight_gain' => ['افزایش', 'weight_gain'],
            default => [],
        };
        $people = $this->db->table('specialist_profiles')->where('active', true)->orderBy('user_id')->lockForUpdate()->get();
        $matched = $hints === [] ? $people : $people->filter(function ($specialist) use ($hints): bool {
            $text = ($specialist->credential ?? '').' '.($specialist->bio ?? '').' '.($specialist->education ?? '');
            foreach ($hints as $hint) {
                if (mb_stripos($text, $hint) !== false) {
                    return true;
                }
            }

            return false;
        });
        if ($matched->isEmpty()) {
            $matched = $people;
        }

        return $this->leastLoaded($matched);
    }

    private function leastLoaded(Collection $people): ?string
    {
        $chosen = null;
        $least = INF;
        foreach ($people as $specialist) {
            $count = $this->db->table('plan_requests')->select('id')->where('assigned_specialist_id', $specialist->user_id)->whereIn('status', ['queued', 'generating', 'in_review', 'awaiting_user', 'response_received'])->lockForUpdate()->get()->count();
            if ($count < $specialist->capacity && $count < $least) {
                $least = $count;
                $chosen = $specialist->user_id;
            }
        }

        return $chosen;
    }

    public function createOrder(array $order, array $request): void
    {
        $this->db->table('orders')->insert($order);
        $this->db->table('plan_requests')->insert($request);
        $this->db->table('users')->where('id', $order['user_id'])->where('role', 'user')->update(['status' => 'active']);
        if ($request['kind'] !== 'specialist_revision') {
            $this->db->table('outbox_events')->insert(['id' => Crypto::uuid(), 'topic' => 'plan.generate', 'aggregate_id' => $request['id'], 'payload' => $this->json(['requestId' => $request['id']])]);
        }
        $conversation = Crypto::uuid();
        $this->db->table('conversations')->insert(['id' => $conversation, 'kind' => 'care', 'user_id' => $order['user_id'], 'request_id' => $request['id']]);
        $this->db->table('conversation_participants')->insert(['conversation_id' => $conversation, 'user_id' => $order['user_id']]);
        if ($request['assigned_specialist_id'] !== null) {
            $this->db->table('conversation_participants')->insert(['conversation_id' => $conversation, 'user_id' => $request['assigned_specialist_id']]);
        }
        $this->db->table('request_events')->insert(['id' => Crypto::uuid(), 'request_id' => $request['id'], 'actor_id' => $order['user_id'], 'kind' => 'ordered']);
    }

    public function copyPublishedDraft(string $parent, string $request): void
    {
        $published = $this->db->table('plan_versions')->where('request_id', $parent)->where('status', 'published')->first();
        if (! $published) {
            throw new Problem(409, 'no_published_plan', 'برنامهٔ تأییدشده‌ای برای اصلاح نیست');
        }
        $version = Crypto::uuid();
        $this->db->table('plan_versions')->insert(['id' => $version, 'request_id' => $request, 'version_number' => 1, 'status' => 'draft']);
        $context = $this->db->selectOne('select r.assigned_specialist_id,s.schema_version,s.answers,a.version_id,c.generation_id from plan_requests r join questionnaire_submissions s on s.id=r.submission_id left join active_plan_versions a on a.user_id=r.user_id left join plan_version_context c on c.version_id=a.version_id where r.id=?', [$request]);
        $this->db->table('plan_version_context')->insert(['version_id' => $version, 'assigned_specialist_id' => $context->assigned_specialist_id, 'questionnaire_schema_version' => $context->schema_version, 'questionnaire_snapshot' => $context->answers, 'replaces_version_id' => $context->version_id, 'generation_id' => $context->generation_id]);
        foreach ($this->db->table('plan_days')->where('plan_version_id', $published->id)->orderBy('day_index')->get() as $oldDay) {
            $day = Crypto::uuid();
            $this->db->table('plan_days')->insert(['id' => $day, 'plan_version_id' => $version, 'day_index' => $oldDay->day_index]);
            foreach ($this->db->table('plan_meals')->where('plan_day_id', $oldDay->id)->orderBy('position')->get() as $oldMeal) {
                $meal = Crypto::uuid();
                $this->db->table('plan_meals')->insert([...(array) $oldMeal, 'id' => $meal, 'plan_day_id' => $day]);
                foreach ($this->db->table('plan_meal_items')->where('meal_id', $oldMeal->id)->orderBy('position')->get() as $item) {
                    $this->db->table('plan_meal_items')->insert([...(array) $item, 'id' => Crypto::uuid(), 'meal_id' => $meal]);
                }
                foreach ($this->db->table('plan_meal_options')->where('meal_id', $oldMeal->id)->get() as $option) {
                    $document = json_decode($option->document, true, 512, JSON_THROW_ON_ERROR);
                    $document['approved'] = false;
                    $this->db->table('plan_meal_options')->insert(['meal_id' => $meal, 'option_uid' => $option->option_uid, 'kind' => $option->kind, 'document' => $this->json($document), 'approved_by' => null, 'approved_at' => null]);
                }
            }
        }
    }

    public function cancellation(string $order): ?array
    {
        $request = $this->row($this->db->table('plan_requests')->where('order_id', $order)->lockForUpdate()->first());
        if ($request === null) {
            return null;
        }

        return [...$request, 'edited' => $this->db->table('request_events')->where('request_id', $request['id'])->where('kind', 'draft_edited')->exists(),
            'asked' => $this->db->table('info_questions')->where('request_id', $request['id'])->exists(),
            'failed' => $this->db->table('ai_execution_claims')->where('request_id', $request['id'])->where('status', 'failed')->exists()];
    }

    public function requestOrder(string $user, string $request): ?string
    {
        return $this->db->table('plan_requests')->where('id', $request)->where('user_id', $user)->value('order_id');
    }

    public function refund(string $order, string $request): void
    {
        $this->db->table('orders')->where('id', $order)->update(['status' => 'refunded']);
        $this->db->table('plan_requests')->where('id', $request)->update(['status' => 'cancelled', 'updated_at' => $this->db->raw('current_timestamp(6)')]);
    }

    public function audit(string $actor, string $order, array $detail): void
    {
        $this->db->table('audit_logs')->insert(['id' => Crypto::uuid(), 'actor_id' => $actor, 'action' => 'order_compensated', 'target_type' => 'order', 'target_id' => $order, 'detail' => $this->json($detail)]);
    }

    public function transaction(\Closure $work): mixed
    {
        return $this->db->transaction($work);
    }
}
