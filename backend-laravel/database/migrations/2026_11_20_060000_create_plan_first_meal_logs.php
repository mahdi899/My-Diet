<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plan_first_meal_logs', function (Blueprint $table): void {
            $table->foreignUuid('request_id')->primary()->references('id')->on('plan_requests')->cascadeOnDelete();
            $table->dateTime('logged_at', 6)->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('plan_first_meal_logs');
    }
};
