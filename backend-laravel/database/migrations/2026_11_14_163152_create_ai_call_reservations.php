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
        Schema::create('ai_call_reservations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('request_id')->nullable()->index();
            $table->uuid('user_id')->nullable()->index();
            $table->unsignedBigInteger('reserved_micros');
            $table->string('state', 16);
            $table->dateTime('created_at', 6)->useCurrent()->index();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ai_call_reservations');
    }
};
