<?php
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$j = json_decode(file_get_contents('storage/logs/draft-last.txt'), true);
$slots = App\Modules\Onboarding\Domain\EnergyEngine::slots(1500, 3);
echo 'slots '.implode(',', array_map(fn ($s) => $s['mealType'].':'.$s['kcal'], $slots)).PHP_EOL;
$db = Illuminate\Support\Facades\DB::connection();
foreach ($j['days'] as $day) {
    foreach ($slots as $slot) {
        $found = array_values(array_filter($day['meals'], fn ($m) => ($m['mealType'] ?? null) === $slot['mealType']));
        if (count($found) !== 1) { echo "missing {$day['day']} {$slot['mealType']}\n"; continue; }
        foreach (['primary', 'alternative'] as $key) {
            $cal = 0; $bad = [];
            foreach ($found[0][$key] as $item) {
                $food = $db->table('food_catalog')->where('slug', $item['slug'])->first();
                if (!$food) { $bad[] = 'unknown '.$item['slug']; continue; }
                $cal += $food->kcal * $item['servings'];
            }
            $limit = $slot['kcal'] * 0.2;
            $flag = abs($cal - $slot['kcal']) > $limit ? 'ENERGY' : 'ok';
            if ($bad || $flag === 'ENERGY') echo "day {$day['day']} {$slot['mealType']} $key $flag cal=$cal target={$slot['kcal']} ".implode(' ', $bad).PHP_EOL;
        }
    }
}
echo "done\n";
