<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('food_ingredients', function (Blueprint $table): void {
            $table->string('code', 32)->primary();
            $table->string('name_fa');
            $table->string('category', 32);
            $table->text('nutrition_reference')->nullable();
        });
        Schema::create('food_recipe_details', function (Blueprint $table): void {
            $table->uuid('food_id')->primary();
            $table->foreign('food_id')->references('id')->on('food_catalog')->cascadeOnDelete();
            $table->string('source_code', 32)->unique();
            $table->unsignedInteger('servings');
            $table->unsignedInteger('cook_minutes');
            $table->longText('instructions');
            $table->json('metadata');
            $table->longText('source_markdown');
        });
        Schema::create('food_recipe_ingredients', function (Blueprint $table): void {
            $table->uuid('food_id');
            $table->string('ingredient_code', 32);
            $table->unsignedSmallInteger('position');
            $table->decimal('quantity', 14, 5);
            $table->string('unit', 24);
            $table->primary(['food_id', 'position']);
            $table->foreign('food_id')->references('id')->on('food_catalog')->cascadeOnDelete();
            $table->foreign('ingredient_code')->references('code')->on('food_ingredients');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('food_recipe_ingredients');
        Schema::dropIfExists('food_recipe_details');
        Schema::dropIfExists('food_ingredients');
    }
};
