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
        Schema::create('onboarding_daily_cache', function (Blueprint $table) {
            $table->date('day');
            $table->string('track', 32);
            $table->string('source', 8);
            $table->unsignedInteger('profiles');
            $table->decimal('avg_bmi', 8, 1);
            $table->unsignedInteger('doctor_only');
            $table->primary(['day', 'track', 'source']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('onboarding_daily_cache');
    }
};
