<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('worker_jobs', function ($table): void {
            $table->uuid('id')->primary();
            $table->uuid('outbox_id')->nullable()->unique();
            $table->string('topic', 64);
            $table->char('aggregate_id', 36);
            $table->json('payload');
            $table->string('status', 16)->default('pending');
            $table->unsignedInteger('attempts')->default(0);
            $table->dateTime('available_at', 6)->useCurrent();
            $table->dateTime('lease_until', 6)->nullable();
            $table->text('last_error')->nullable();
            $table->dateTime('created_at', 6)->useCurrent();
            $table->dateTime('updated_at', 6)->useCurrent();
            $table->index(['status', 'available_at']);
        });
        DB::statement("alter table worker_jobs add constraint worker_jobs_status_check check (status in ('pending','leased','succeeded','failed','dead'))");
        Schema::create('worker_status', function ($table): void {
            $table->string('role', 32)->primary();
            $table->dateTime('heartbeat_at', 6);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('worker_status');
        Schema::dropIfExists('worker_jobs');
    }
};
