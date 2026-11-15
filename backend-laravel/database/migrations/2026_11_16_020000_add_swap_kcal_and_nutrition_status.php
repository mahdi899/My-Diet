<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('meal_swap_logs', function (Blueprint $table): void {
            $table->unsignedSmallInteger('new_kcal')->nullable()->after('new_title');
        });
        Schema::table('food_catalog', function (Blueprint $table): void {
            $table->string('nutrition_status', 16)->default('verified')->after('nutrition');
        });
        DB::statement("alter table food_catalog add constraint food_catalog_nutrition_status_check check (nutrition_status in ('estimated','calculated','verified'))");
    }

    public function down(): void
    {
        DB::statement('alter table food_catalog drop check food_catalog_nutrition_status_check');
        Schema::table('food_catalog', function (Blueprint $table): void {
            $table->dropColumn('nutrition_status');
        });
        Schema::table('meal_swap_logs', function (Blueprint $table): void {
            $table->dropColumn('new_kcal');
        });
    }
};
