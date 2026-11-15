<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Remember which advertising link a website signup arrived from. */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('demo_lead_submissions') && ! Schema::hasColumn('demo_lead_submissions', 'campaign_slug')) {
            Schema::table('demo_lead_submissions', function (Blueprint $table): void {
                $table->string('campaign_slug', 64)->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('demo_lead_submissions', 'campaign_slug')) {
            Schema::table('demo_lead_submissions', function (Blueprint $table): void {
                $table->dropColumn('campaign_slug');
            });
        }
    }
};
