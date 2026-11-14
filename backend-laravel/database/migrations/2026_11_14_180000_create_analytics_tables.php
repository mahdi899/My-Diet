<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Umami-shaped tables used when analytics is pointed at this MySQL server. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('website_event', function (Blueprint $table): void {
            $table->uuid('event_id')->primary();
            $table->uuid('website_id');
            $table->uuid('session_id');
            $table->uuid('visit_id');
            $table->unsignedTinyInteger('event_type')->default(1);
            $table->string('event_name', 50);
            $table->string('url_path', 500);
            $table->string('utm_source', 255)->nullable();
            $table->string('utm_campaign', 255)->nullable();
            $table->string('referrer_domain', 255)->nullable();
            $table->string('tag', 50)->nullable();
            $table->dateTime('created_at', 6);
            $table->index(['website_id', 'created_at']);
        });
        Schema::create('event_data', function (Blueprint $table): void {
            $table->uuid('website_event_id');
            $table->string('data_key', 50);
            $table->text('string_value')->nullable();
            $table->double('number_value')->nullable();
            $table->primary(['website_event_id', 'data_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('event_data');
        Schema::dropIfExists('website_event');
    }
};
