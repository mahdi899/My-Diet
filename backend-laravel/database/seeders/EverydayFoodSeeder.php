<?php

namespace Database\Seeders;

use App\Modules\Food\Domain\RecipeTitle;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

final class EverydayFoodSeeder extends Seeder
{
    public function run(): void
    {
        $db = app(ConnectionInterface::class);
        $staples = [
            ['barbari', 'نان بربری', 30, '۱ کف دست', 'side', 'side', 1, 1, 2.7, 16, 0.8, 0.7, 'gluten', 'vegan'],
            ['sangak', 'نان سنگک', 30, '۱ کف دست', 'side', 'side', 1, 1, 3, 15, 0.4, 1.1, 'gluten', 'vegan'],
            ['taftoon', 'نان تافتون', 30, '۱ کف دست', 'side', 'side', 1, 1, 2.8, 16, 0.5, 0.8, 'gluten', 'vegan'],
            ['rice', 'برنج پخته', 120, 'حدود سه‌چهارم پیمانه پخته', 'side', 'side', 1, 30, 3.2, 34, 0.3, 0.5, '', 'vegan'],
            ['plain-yogurt', 'ماست ساده', 120, 'نصف لیوان', 'snack,side', 'side', 1, 1, 4.5, 5.6, 2.7, 0, 'dairy', 'vegetarian'],
            ['apple', 'سیب', 150, '۱ عدد متوسط', 'snack', 'side', 1, 1, 0.4, 20.7, 0.3, 3.6, '', 'vegan'],
            ['orange', 'پرتقال', 130, '۱ عدد متوسط', 'snack', 'side', 1, 1, 1.2, 15.3, 0.2, 3.1, '', 'vegan'],
            ['cucumber', 'خیار', 100, '۱ عدد متوسط', 'side', 'side', 1, 1, 0.7, 3.6, 0.1, 0.5, '', 'vegan'],
            ['tomato', 'گوجه‌فرنگی', 100, '۱ عدد متوسط', 'side', 'side', 1, 1, 0.9, 3.9, 0.2, 1.2, '', 'vegan'],
            ['date', 'خرما', 14, '۲ عدد کوچک', 'snack', 'side', 1, 1, 0.3, 10.5, 0, 1.1, '', 'vegan'],
            ['boiled-egg', 'تخم‌مرغ آب‌پز', 50, '۱ عدد', 'side', 'side', 1, 12, 6.3, 0.6, 5.3, 0, 'egg', 'vegetarian'],
            ['tea', 'چای سیاه بدون قند', 240, '۱ لیوان', 'side', 'drink', 1, 7, 0, 0.3, 0, 0, '', 'vegan'],
            ['milk', 'شیر کم‌چرب', 240, '۱ لیوان', 'snack,side', 'drink', 1, 1, 8, 12, 3.6, 0, 'dairy', 'vegetarian'],
            ['walnut', 'مغز گردو', 15, 'حدود ۳ مغز کامل', 'snack,side', 'side', 2, 1, 2.3, 2.1, 9.8, 1, 'nuts', 'vegan'],
            ['white-cheese', 'پنیر سفید', 30, '۱ برش ۳۰ گرمی', 'side', 'side', 1, 1, 4.5, 1.2, 6.3, 0, 'dairy', 'vegetarian'],
        ];
        $meals = [
            ['egg-bread', 'تخم‌مرغ آب‌پز و سنگک با گوجه و خیار', 'breakfast', 14, [['تخم‌مرغ آب‌پز', 100], ['نان سنگک', 65], ['گوجه‌فرنگی', 100], ['خیار', 80]], 21, 40, 12, 4, 'egg,gluten', 'vegetarian'],
            ['cheese-bread', 'نان و پنیر و گردو با خیار', 'breakfast', 8, [['نان سنگک', 75], ['پنیر سفید', 45], ['مغز گردو', 15], ['خیار', 100]], 18, 45, 20, 5, 'gluten,dairy,nuts', 'vegetarian'],
            ['lentils', 'عدسی خانگی با نان سنگک', 'breakfast,dinner', 40, [['عدس پخته', 180], ['نان سنگک', 65], ['پیاز', 40], ['روغن مایع', 5]], 22, 72, 7, 13, 'gluten', 'vegan'],
            ['yogurt-orange', 'ماست ساده و پرتقال', 'snack', 5, [['ماست ساده', 170], ['پرتقال', 130]], 8, 23, 4, 3, 'dairy', 'vegetarian'],
            ['apple-walnut', 'سیب و گردو', 'snack', 5, [['سیب', 150], ['مغز گردو', 10]], 2, 22, 7, 4, 'nuts', 'vegan'],
            ['milk-dates', 'شیر کم‌چرب و خرما', 'snack', 3, [['شیر کم‌چرب', 240], ['خرما', 14]], 8, 23, 4, 1, 'dairy', 'vegetarian'],
            ['small-cheese', 'لقمهٔ نان و پنیر و خیار', 'snack', 6, [['نان سنگک', 35], ['پنیر سفید', 30], ['خیار', 60]], 8, 21, 7, 2, 'dairy,gluten', 'vegetarian'],
            ['bean', 'خوراک لوبیا چیتی و سنگک', 'lunch,dinner', 55, [['لوبیا چیتی پخته', 200], ['نان سنگک', 75], ['گوجه‌فرنگی', 100], ['پیاز', 40], ['روغن مایع', 8]], 26, 94, 11, 20, 'gluten', 'vegan'],
            ['potato-egg', 'کوکوی سیب‌زمینی با نان و سالاد شیرازی', 'lunch,dinner', 40, [['سیب‌زمینی', 220], ['تخم‌مرغ', 100], ['نان سنگک', 60], ['گوجه‌فرنگی', 90], ['خیار', 100], ['روغن مایع', 10]], 24, 75, 21, 8, 'egg,gluten', 'vegetarian'],
            ['chicken-bread', 'خوراک مرغ و سبزیجات با نان سنگک', 'lunch,dinner', 38, [['سینه مرغ پخته', 130], ['نان سنگک', 95], ['فلفل دلمه‌ای', 70], ['گوجه‌فرنگی', 100], ['روغن مایع', 8]], 50, 57, 15, 6, 'gluten', 'poultry'],
            ['yogurt-cucumber', 'آب‌دوغ‌خیار خانگی با نان خشک', 'dinner', 12, [['ماست ساده', 240], ['خیار', 180], ['نان خشک', 65], ['مغز گردو', 15], ['نعناع خشک', 2]], 19, 62, 17, 6, 'dairy,gluten,nuts', 'vegetarian'],
            ['falafel', 'فلافل خانگی تنوری با نان و سبزی', 'lunch,dinner', 42, [['نخود پخته', 170], ['نان سنگک', 80], ['پیاز', 30], ['جعفری', 15], ['روغن مایع', 8]], 25, 91, 14, 16, 'gluten', 'vegan'],
        ];
        $instructions = [
            'egg-bread' => 'تخم‌مرغ را آب‌پز کن و کنار سنگک، خیار و گوجه سرو کن.',
            'cheese-bread' => 'پنیر و گردو را روی نان بگذار. خیار را برش بزن و کنار لقمه سرو کن.',
            'lentils' => 'پیاز را با روغن تفت بده، عدس پخته را با کمی آب اضافه کن و بگذار جا بیفتد. با سنگک سرو کن.',
            'yogurt-orange' => 'پرتقال را پوست بگیر و در کنار ماست ساده سرو کن.',
            'apple-walnut' => 'سیب را بشوی، برش بزن و با مغز گردو سرو کن.',
            'milk-dates' => 'هستهٔ خرما را بگیر و آن را با شیر کم‌چرب سرو کن.',
            'small-cheese' => 'پنیر و خیار را داخل نان بگذار و لقمه را بپیچ.',
            'bean' => 'پیاز و گوجه را با روغن تفت بده، لوبیای پخته را اضافه کن و بگذار خوراک غلیظ شود. با سنگک سرو کن.',
            'potato-egg' => 'سیب‌زمینی را بپز و با تخم‌مرغ مخلوط کن. کوکو را در تابه بپز و با سنگک و سالاد خیار و گوجه سرو کن.',
            'chicken-bread' => 'فلفل و گوجه را تفت بده و مرغ پخته را برای گرم‌شدن اضافه کن. با سنگک سرو کن.',
            'yogurt-cucumber' => 'ماست، خیار خردشده، گردو و نعناع را با کمی آب خنک مخلوط کن. نان خشک را موقع سرو اضافه کن.',
            'falafel' => 'نخود پخته، پیاز، جعفری و روغن را مخلوط کن، شکل بده و در فر بپز. با نان سرو کن.',
        ];
        $db->transaction(function () use ($db, $staples, $meals, $instructions): void {
            foreach ($db->table('food_catalog')->where('name_fa', 'like', 'باقلاپلو با ماهیچه لطیف و آب پیاز زعفرانی(%')->get(['id', 'name_fa']) as $food) {
                $title = RecipeTitle::normalize($food->name_fa);
                if ($title !== $food->name_fa) {
                    $db->table('food_catalog')->where(['id' => $food->id, 'name_fa' => $food->name_fa])->update(['name_fa' => $title]);
                }
            }
            foreach ($staples as [$slug, $name, $grams, $portion, $slots, $category, $cost, $minutes, $protein, $carbs, $fat, $fiber, $allergens, $style]) {
                if (! $db->table('food_ingredients')->where('name_fa', $name)->exists()) {
                    $ingredientCategory = match ($slug) {
                        'barbari', 'sangak', 'taftoon', 'rice' => 'grains',
                        'plain-yogurt', 'milk', 'white-cheese' => 'dairy',
                        'apple', 'orange', 'date' => 'fruit',
                        'cucumber', 'tomato' => 'vegetables',
                        'boiled-egg' => 'protein',
                        'walnut' => 'nuts',
                        default => 'other',
                    };
                    $db->table('food_ingredients')->insertOrIgnore([
                        'code' => 'STAPLE-'.$slug, 'name_fa' => $name, 'category' => $ingredientCategory,
                    ]);
                }
            }
            foreach ($meals as [$slug, $name, $slots, $minutes, $ingredients, $protein, $carbs, $fat, $fiber, $allergens, $style]) {
                $category = str_contains($slots, 'breakfast') ? 'breakfast' : ($slots === 'snack' ? 'side' : 'main');
                $this->add($db, $slug, $name, array_sum(array_column($ingredients, 1)), '۱ وعدهٔ خانگی', $slots, $category, 1, $minutes, $protein, $carbs, $fat, $fiber, $allergens, $style, $ingredients);
                $foodId = $db->table('food_catalog')->where(['slug' => 'everyday-'.$slug, 'source' => 'seed'])->value('id');
                if ($foodId !== null) {
                    $db->table('food_recipe_details')->insertOrIgnore([
                        'food_id' => $foodId, 'source_code' => 'EVERYDAY-'.$slug, 'servings' => 1, 'cook_minutes' => 0,
                        'instructions' => $instructions[$slug], 'metadata' => '{"nutrition":"estimated"}', 'source_markdown' => '',
                    ]);
                }
            }
        });
    }

    private function add(ConnectionInterface $db, string $slug, string $name, int $grams, string $portion, string $slots, string $category, int $cost, int $minutes, float $protein, float $carbs, float $fat, float $fiber, string $allergens, string $style, array $ingredients): void
    {
        $slug = 'everyday-'.$slug;
        if ($db->table('food_catalog')->where('slug', $slug)->exists()) {
            return;
        }
        $json = fn (array $value): string => json_encode($value, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        $db->table('food_catalog')->insert([
            'id' => Str::uuid()->toString(), 'slug' => $slug, 'name_fa' => $name, 'category' => $category,
            'meal_types' => $json(explode(',', $slots)), 'serving_label' => $portion, 'serving_g' => $grams,
            'kcal' => (int) round(4 * $protein + 4 * $carbs + 9 * $fat), 'protein_g' => $protein, 'carbs_g' => $carbs, 'fat_g' => $fat, 'fiber_g' => $fiber,
            'allergens' => $json($allergens === '' ? [] : explode(',', $allergens)), 'tags' => $json(['iranian', $style]),
            'regions' => '[]', 'seasons' => '[]', 'cost_tier' => $cost, 'prep_minutes' => $minutes, 'active' => true, 'source' => 'seed', 'nutrition_status' => 'estimated',
            'ingredients' => $json(array_map(fn ($item): array => ['name' => $item[0], 'quantity' => $item[1], 'unit' => 'g', 'category' => 'other'], $ingredients)),
        ]);
    }
}
