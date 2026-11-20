<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('demo_lead_submissions', function (Blueprint $table): void {
            $table->uuid('canonical_submission_id')->nullable();
        });
        Schema::create('plan_first_reads', function (Blueprint $table): void {
            $table->foreignUuid('request_id')->primary()->references('id')->on('plan_requests')->cascadeOnDelete();
            $table->dateTime('read_at', 6)->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('plan_first_reads');
        Schema::table('demo_lead_submissions', function (Blueprint $table): void {
            $table->dropColumn('canonical_submission_id');
        });
    }
};
