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
        Schema::table('weekly_feedback', function (Blueprint $table) {
            $table->string('public_text', 500)->nullable();
            $table->json('details')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('weekly_feedback', function (Blueprint $table) {
            $table->dropColumn(['public_text', 'details']);
        });
    }
};
