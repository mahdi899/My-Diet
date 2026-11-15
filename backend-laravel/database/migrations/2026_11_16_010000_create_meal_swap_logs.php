<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('meal_swap_logs', function (Blueprint $table): void {
            $table->char('id', 36)->primary();
            $table->char('user_id', 36);
            $table->char('meal_id', 36);
            $table->string('old_title', 120);
            $table->string('new_food_slug', 60);
            $table->string('new_title', 120);
            $table->string('reason', 32)->default('variety');
            $table->timestamp('created_at', 6)->useCurrent();
            
            $table->index(['user_id', 'created_at']);
            $table->index('meal_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('meal_swap_logs');
    }
};
