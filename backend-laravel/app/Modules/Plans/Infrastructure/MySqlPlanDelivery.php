<?php

namespace App\Modules\Plans\Infrastructure;

use App\Shared\Domain\LegacyCrypto as Crypto;
use Illuminate\Database\ConnectionInterface;

final class MySqlPlanDelivery
{
    public function __construct(private ConnectionInterface $db) {}

    public function markReceived(string $request): void
    {
        $this->db->table('plan_first_reads')->insertOrIgnore(['request_id' => $request]);
    }

    public function report(string $search = ''): array
    {
        $match = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $search).'%';
        $rows = $this->db->select("with sales as (
            select coalesce(c.id, o.id) as id, o.id as orderId, o.user_id, r.id as requestId, r.status,
                coalesce(c.plan_code, o.service_code) as plan, o.price_toman as amount, coalesce(c.paid_at,o.created_at) as paidAt,
                case when c.gateway in ('web_transfer','web_zibal') then 'web' else 'app' end as source, r.assigned_specialist_id
            from orders o left join plan_checkouts c on c.order_id=o.id left join plan_requests r on r.order_id=o.id
            where o.status='paid' and o.service_code='new_plan'
            union all
            select t.id,null,t.user_id,null,null,t.plan,t.amount_toman,t.confirmed_at,'web',null
            from onboarding_transfers t left join plan_checkouts c on c.id=t.id
            where t.confirmed_at is not null and c.id is null
        ) select sales.*, u.phone_e164 as phone, u.display_name as customer, sp.display_name as specialist,
            (select min(v.published_at) from plan_versions v where v.request_id=sales.requestId) as publishedAt,
            (select max(g.status) from ai_generations g where g.request_id=sales.requestId and g.created_at=(select max(latest.created_at) from ai_generations latest where latest.request_id=sales.requestId)) as generationStatus,
            m.logged_at as firstMealAt,
            f.read_at as firstReceivedAt, case when p.user_id is null then 'profile' when p.consented_at is null then 'consent' else 'reconcile' end as pendingReason
        from sales join users u on u.id=sales.user_id left join nutrition_profiles p on p.user_id=sales.user_id
        left join specialist_profiles sp on sp.user_id=sales.assigned_specialist_id
        left join plan_first_reads f on f.request_id=sales.requestId
        left join plan_first_meal_logs m on m.request_id=sales.requestId
        where (?='' or u.phone_e164 like ? escape '!' or u.display_name like ? escape '!' or sales.id like ? escape '!' or sales.orderId like ? escape '!' or sales.requestId like ? escape '!')
        order by case when sales.requestId is null then 0 else 1 end, sales.paidAt desc limit 250", [$search, $match, $match, $match, $match, $match]);

        return array_map(function ($row): array {
            $result = (array) $row;
            foreach (['paidAt', 'publishedAt', 'firstReceivedAt', 'firstMealAt'] as $date) {
                $result[$date] = $row->{$date} === null ? null : Crypto::iso($row->{$date});
            }
            $result['amount'] = (int) $row->amount;
            $result['pendingReason'] = $row->requestId === null ? $row->pendingReason : null;
            unset($result['user_id'], $result['assigned_specialist_id']);

            return $result;
        }, $rows);
    }
}
