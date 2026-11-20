<?php

namespace App\Modules\Shopping\Infrastructure;

use App\Modules\Shopping\Application\ShoppingStore;
use App\Modules\Shopping\Domain\IngredientAggregation;
use Closure;
use Illuminate\Database\ConnectionInterface;

final class MySqlShopping implements ShoppingStore
{
    public function __construct(private ConnectionInterface $db) {}

    public function transaction(Closure $work): mixed
    {
        return $this->db->transaction($work);
    }

    public function lock(string $user): void
    {
        $this->db->select('select id from users where id=? for update', [$user]);
    }

    public function project(string $user, string $weekStart, array $days): array
    {
        $placeholders = implode(',', array_fill(0, count($days), '?'));
        $rows = $this->db->select("select d.id as day_id,d.civil_date,v.id as version_id,v.published_at from plan_days d
            join plan_versions v on v.id=d.plan_version_id join plan_requests r on r.id=v.request_id
            join orders paid on paid.id=r.order_id and paid.status='paid'
            where r.user_id=? and d.civil_date in ($placeholders) and v.status in ('published','superseded')
            and date(convert_tz(v.published_at,'+00:00','+03:30'))<=d.civil_date and d.civil_date>=r.effective_from
            order by d.civil_date,v.published_at desc,v.id desc", [$user, ...$days]);
        $chosen = [];
        foreach ($rows as $row) {
            $date = substr((string) $row->civil_date, 0, 10);
            $chosen[$date] ??= $row;
        }
        $ingredients = [];
        $covered = [];
        $sourceRows = [];
        foreach ($chosen as $date => $day) {
            $meals = $this->db->select('select id,meal_uid,title,position from plan_meals where plan_day_id=? order by position,id', [$day->day_id]);
            foreach ($meals as $meal) {
                $covered[$date] = true;
                $selection = $this->db->selectOne('select option_uid,revision,updated_at from meal_selections where user_id=? and civil_date=? and meal_uid=? and version_id=?', [$user, $date, $meal->meal_uid, $day->version_id]);
                $option = $selection === null
                    ? $this->db->selectOne("select document from plan_meal_options where meal_id=? and kind='primary' and approved_by is not null", [$meal->id])
                    : $this->db->selectOne('select document from plan_meal_options where meal_id=? and option_uid=? and approved_by is not null', [$meal->id, $selection->option_uid]);
                $document = $option === null ? null : json_decode($option->document, true, 512, JSON_THROW_ON_ERROR);
                $swap = $this->db->table('meal_swap_logs')->where(['meal_id' => $meal->id, 'user_id' => $user])->latest('created_at')->first(['food_snapshot', 'created_at']);
                if (isset($swap->food_snapshot) && $swap->created_at > ($selection->updated_at ?? '')) {
                    $document = json_decode($swap->food_snapshot, true, 512, JSON_THROW_ON_ERROR);
                }
                $items = is_array($document) && array_key_exists('ingredients', $document) ? $document['ingredients'] : array_map(fn ($item) => ['name' => $item->name, 'quantity' => $item->quantity === null ? null : (float) $item->quantity, 'unit' => $item->unit], $this->db->select('select name,quantity,unit from plan_meal_items where meal_id=? order by position', [$meal->id]));
                if ($items === []) {
                    $ingredients[] = ['name' => $meal->title, 'quantity' => null, 'unit' => null, 'basis' => 'unknown', 'source' => $date.':'.$meal->meal_uid.':missing'];
                }
                foreach (array_values($items) as $index => $item) {
                    $item = (array) $item;
                    $quantity = $item['quantity'] ?? null;
                    $ingredients[] = ['name' => (string) ($item['name'] ?? ''), 'quantity' => is_numeric($quantity) ? $quantity + 0 : null, 'unit' => $item['unit'] ?? null, 'basis' => $item['basis'] ?? 'unknown', 'category' => $item['category'] ?? null, 'source' => $date.':'.$meal->meal_uid.':'.$index];
                }
                $sourceRows[] = ['date' => $date, 'version' => $day->version_id, 'meal' => $meal->meal_uid, 'option' => $selection->option_uid ?? null, 'selection' => $selection === null ? null : (int) $selection->revision, 'items' => $items];
            }
        }
        $flags = array_map(fn ($row) => ['key' => $row->ingredient_key, 'alreadyHave' => (bool) $row->already_have, 'purchased' => (bool) $row->purchased, 'quantity' => $row->quantity === null ? null : (float) $row->quantity], $this->db->select('select ingredient_key,already_have,purchased,quantity from shopping_flags where user_id=? and week_start=? order by ingredient_key', [$user, $weekStart]));
        $byKey = [];
        foreach ($flags as $flag) {
            $byKey[$flag['key']] = $flag;
        }
        $items = array_map(function (array $item) use ($byKey): array {
            $flag = $byKey[$item['key']] ?? null;
            $changed = $flag !== null && ($flag['alreadyHave'] || $flag['purchased']) && ($flag['quantity'] === null ? $item['quantity'] !== null : abs($flag['quantity'] - (float) $item['quantity']) > 1e-6);

            return [...$item, 'alreadyHave' => $flag['alreadyHave'] ?? false, 'purchased' => $flag['purchased'] ?? false, 'quantityChangedSinceFlag' => $changed];
        }, IngredientAggregation::aggregate($ingredients));
        $missing = array_values(array_filter($days, fn (string $date): bool => ! isset($covered[$date])));
        $document = ['weekStart' => $weekStart, 'days' => $days, 'items' => $items, 'missingDays' => $missing, 'incomplete' => $missing !== [] || array_any($items, fn (array $item): bool => $item['incomplete'])];
        $key = hash('sha256', json_encode(['weekStart' => $weekStart, 'days' => $days], JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
        $source = hash('sha256', json_encode(['rows' => $sourceRows, 'flags' => $flags], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
        $this->db->statement('insert into shopping_projections(user_id,projection_key,week_start,source_hash,document) values(?,?,?,?,?) as new
            on duplicate key update revision=shopping_projections.revision+if(shopping_projections.source_hash=new.source_hash,0,1),source_hash=new.source_hash,document=new.document,updated_at=current_timestamp(6)', [$user, $key, $weekStart, $source, json_encode($document, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)]);
        $revision = (int) $this->db->table('shopping_projections')->where(['user_id' => $user, 'projection_key' => $key])->value('revision');

        return [...$document, 'projectionKey' => $key, 'revision' => $revision];
    }

    public function saveFlag(string $user, string $weekStart, string $key, bool $alreadyHave, bool $purchased, ?float $quantity): void
    {
        $this->db->statement('insert into shopping_flags(user_id,week_start,ingredient_key,already_have,purchased,quantity) values(?,?,?,?,?,?) as new
            on duplicate key update already_have=new.already_have,purchased=new.purchased,quantity=new.quantity,updated_at=current_timestamp(6)', [$user, $weekStart, $key, $alreadyHave, $purchased, $quantity]);
    }
}
