<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('onboarding_analytics_journeys', function (Blueprint $table): void {
            $table->uuid('submission_id')->nullable()->unique();
        });
    }

    public function down(): void
    {
        Schema::table('onboarding_analytics_journeys', function (Blueprint $table): void {
            $table->dropUnique(['submission_id']);
            $table->dropColumn('submission_id');
        });
    }
};
