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
        Schema::table('worker_jobs', function (Blueprint $table) {
            Schema::table('worker_jobs', function (Blueprint $table): void {
                $table->uuid('lease_token')->nullable();
            });
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('worker_jobs', function (Blueprint $table) {
            Schema::table('worker_jobs', function (Blueprint $table): void {
                $table->dropColumn('lease_token');
            });
        });
    }
};
