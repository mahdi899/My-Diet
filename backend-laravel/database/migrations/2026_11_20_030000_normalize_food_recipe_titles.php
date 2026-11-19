<?php

use App\Modules\Food\Domain\RecipeTitle;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function (): void {
            DB::table('food_catalog')->select('id', 'name_fa')->where('name_fa', 'like', 'خانواده%')->chunkById(200, function ($foods): void {
                foreach ($foods as $food) {
                    $name = RecipeTitle::normalize($food->name_fa);
                    if ($name !== $food->name_fa) {
                        DB::table('food_catalog')->where('id', $food->id)->where('name_fa', $food->name_fa)->update(['name_fa' => $name]);
                    }
                }
            });
        });
    }

    public function down(): void
    {
        // Keep the corrected display names during rollback.
    }
};
