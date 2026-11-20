<?php

namespace App\Modules\Coach\Infrastructure;

use App\Modules\Food\Application\FoodStore;
use App\Modules\Plans\Application\CatalogConstraints;
use App\Modules\Plans\Domain\CivilDates;
use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;
use Illuminate\Database\ConnectionInterface;

final class CoachPhotoPlan
{
    public function __construct(private ConnectionInterface $db, private FoodStore $foods) {}

    /** Resolve the photo to known foods and size a replacement for today's meal. */
    public function preview(string $user, array $items, string $mealType): array
    {
        $profile = $this->db->table('nutrition_profiles')->where('user_id', $user)->first();
        if ($profile === null) {
            throw new Problem(409, 'no_profile', 'برای بررسی با برنامه، اول پرسش‌نامهٔ تغذیه را کامل کن.');
        }
        $allergens = json_decode($profile->allergens, true) ?: [];
        if ($profile->safety_tier !== 'ai_ok' || in_array('other', $allergens, true)) {
            throw new Problem(409, 'profile_requires_review', 'اضافه‌کردن این غذا به برنامه‌ات نیاز به بررسی متخصص دارد.');
        }
        $meal = $this->db->table('active_plan_versions as a')->join('plan_days as d', 'd.plan_version_id', '=', 'a.version_id')
            ->join('plan_meals as m', 'm.plan_day_id', '=', 'd.id')->where('a.user_id', $user)
            ->where('d.civil_date', CivilDates::today())->where('m.meal_type', $mealType)
            ->select('m.*', 'a.version_id as active_version_id')->orderBy('m.position')->lockForUpdate()->first();
        if ($meal === null) {
            throw new Problem(409, 'no_plan_meal', 'برای این وعده در برنامهٔ امروزت غذایی پیدا نکردم؛ فعلاً چیزی به برنامه اضافه نمی‌کنم.');
        }
        if ($this->db->table('meal_logs')->where(['user_id' => $user, 'plan_meal_id' => $meal->id, 'scheduled_date' => CivilDates::today(), 'eaten' => true])->exists()) {
            throw new Problem(409, 'meal_already_eaten', 'این وعده را قبلاً خورده‌شده ثبت کرده‌ای؛ برای تغییر برنامه یک وعدهٔ دیگر انتخاب کن.');
        }
        $swap = $this->db->table('meal_swap_logs')->where('meal_id', $meal->id)->orderByDesc('created_at')->first();
        $selection = $this->db->table('meal_selections')->where(['user_id' => $user, 'meal_id' => $meal->id, 'version_id' => $meal->active_version_id, 'civil_date' => CivilDates::today()])->lockForUpdate()->first();
        $option = $this->db->table('plan_meal_options')->where(['meal_id' => $meal->id, 'kind' => 'primary'])->value('document');
        $selected = $selection !== null && ($swap?->food_snapshot === null || $swap->created_at <= $selection->updated_at)
            ? $this->db->table('plan_meal_options')->where(['meal_id' => $meal->id, 'option_uid' => $selection->option_uid])->value('document')
            : null;
        $selected = $selected === null ? null : json_decode($selected, true);
        $oldTitle = $selected['title'] ?? $swap?->new_title ?? $meal->title;
        $target = (int) ($selected['calories'] ?? $swap?->new_kcal ?? $meal->calories);
        $baseline = $swap?->food_snapshot !== null
            ? (json_decode($swap->food_snapshot, true)['nutrition'] ?? [])
            : (json_decode($option ?? '{}', true)['nutrition'] ?? []);
        if ($selected !== null) {
            $baseline = $selected['nutrition'] ?? [];
        }
        $avoid = $this->db->table('coach_preferences')->where(['user_id' => $user, 'pref_key' => 'food_dislike', 'active' => 1])->pluck('value')->all();
        $notes = $this->db->table('coach_preferences')->where(['user_id' => $user, 'pref_key' => 'specialist_note', 'active' => 1])->pluck('value')->all();
        $catalog = $this->foods->all();
        $chosen = [];
        $gate = new CatalogConstraints;
        foreach ($items as $item) {
            $name = $this->normalize((string) ($item['name'] ?? ''));
            $matches = array_values(array_filter($catalog, fn ($food) => ! empty($food['active']) && $this->normalize($food['nameFa']) === $name));
            if (count($matches) !== 1) {
                throw new Problem(409, 'photo_food_unknown', 'غذا را از روی عکس تخمین زدم، اما ترکیب تأییدشدهٔ آن را برای بررسی با برنامه پیدا نکردم؛ فعلاً اضافه‌اش نمی‌کنم.');
            }
            $food = $matches[0];
            $tags = $food['tags'] ?? [];
            if (array_intersect($allergens, $food['allergens'] ?? []) !== []
                || ($profile->diet_style === 'vegan' && ! in_array('vegan', $tags, true))
                || ($profile->diet_style === 'vegetarian' && array_intersect(['meat', 'poultry', 'fish'], $tags) !== [])
                || ! $gate->allows($food, (array) $profile, $avoid, $notes, false)) {
                throw new Problem(409, 'photo_food_blocked', 'این غذا با حساسیت، ترجیحات یا محدودیت ثبت‌شده در برنامه‌ات سازگار نیست؛ اضافه‌اش نمی‌کنم.');
            }
            if ($chosen === [] && ! in_array($mealType, $food['mealTypes'] ?? [], true)) {
                throw new Problem(409, 'photo_meal_mismatch', 'این غذا برای وعدهٔ انتخاب‌شده در برنامه مناسب نیست.');
            }
            $chosen[] = $food;
        }
        $baseKcal = array_sum(array_column($chosen, 'kcal'));
        $ratio = $baseKcal > 0 ? $target / $baseKcal : 0;
        if ($items === [] || $ratio < .25 || $ratio > 4) {
            throw new Problem(409, 'photo_portion_mismatch', 'سهم مناسبی از این غذا برای انرژی این وعده پیدا نکردم؛ فعلاً برنامه را تغییر نمی‌دهم.');
        }
        $nutrition = [];
        foreach (['proteinG', 'carbsG', 'fatG', 'fiberG'] as $key) {
            $nutrition[$key] = round(array_sum(array_column($chosen, $key)) * $ratio, 1);
            if ($key !== 'fiberG' && ($baseline[$key] ?? 0) > 0 && abs($nutrition[$key] - $baseline[$key]) > $baseline[$key] * .2) {
                throw new Problem(409, 'photo_nutrition_mismatch', 'ترکیب پروتئین، کربوهیدرات یا چربی این غذا با وعدهٔ برنامه‌ات هماهنگ نیست؛ برای اضافه‌شدن باید متخصص بررسی کند.');
            }
        }
        $portions = array_map(fn ($food) => ['name' => $food['nameFa'], 'slug' => $food['slug'], 'servings' => round($ratio, 2), 'servingLabel' => $food['servingLabel']], $chosen);
        $ingredients = [];
        foreach ($chosen as $food) {
            foreach ($food['ingredients'] ?? [] as $ingredient) {
                $ingredients[] = [...$ingredient, 'quantity' => isset($ingredient['quantity']) ? round($ingredient['quantity'] * $ratio, 2) : null, 'basis' => 'as_served'];
            }
        }
        $title = mb_substr(implode(' و ', array_column($chosen, 'nameFa')), 0, 120);
        $snapshot = [
            'portion' => ['quantity' => round($ratio, 2), 'unit' => 'serving', 'basis' => 'as_served'],
            'servingDisplay' => implode(' + ', array_map(fn ($item) => $item['servings'].' × '.$item['servingLabel'].' '.$item['name'], $portions)),
            'ingredients' => $ingredients, 'nutrition' => $nutrition,
            'instructions' => implode("\n", array_filter(array_map(fn ($food) => $food['instructions'] ?? $food['recipe']['instructions'] ?? '', $chosen))),
            'preparationMinutes' => max(array_map(fn ($food) => (int) ($food['prepMinutes'] ?? 0) + (int) ($food['cookMinutes'] ?? $food['recipe']['cookMinutes'] ?? 0), $chosen)),
        ];
        $preview = ['mealId' => $meal->id, 'mealType' => $mealType, 'oldTitle' => $oldTitle, 'title' => $title, 'kcal' => $target, 'items' => $portions, 'snapshot' => $snapshot, 'foodSlug' => $chosen[0]['slug']];
        $preview['checkKey'] = hash('sha256', json_encode([$preview, $swap?->id, $selection?->revision, CivilDates::today()], JSON_THROW_ON_ERROR));

        return $preview;
    }

    /** Called only after consent, with a fresh comparison against the current plan. */
    public function apply(string $user, array $preview): void
    {
        $this->db->table('meal_swap_logs')->insert([
            'id' => Crypto::uuid(), 'user_id' => $user, 'meal_id' => $preview['mealId'],
            'old_title' => $preview['oldTitle'], 'new_food_slug' => $preview['foodSlug'], 'new_title' => $preview['title'],
            'new_kcal' => $preview['kcal'], 'food_snapshot' => json_encode($preview['snapshot'], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), 'reason' => 'variety',
        ]);
    }

    private function normalize(string $name): string
    {
        return trim(preg_replace('/\s+/u', ' ', str_replace(['ي', 'ك', "\u{200c}", 'ٔ', 'ۀ'], ['ی', 'ک', ' ', '', 'ه'], $name)));
    }
}
