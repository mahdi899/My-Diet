<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plan_checkouts', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id')->index();
            $table->string('service_code', 40);
            $table->string('plan_code', 40)->nullable();
            $table->unsignedSmallInteger('duration_days')->nullable();
            $table->uuid('submission_id');
            $table->uuid('parent_request_id')->nullable();
            $table->unsignedBigInteger('amount_toman');
            $table->unsignedBigInteger('amount_rial');
            $table->string('idempotency_key', 80);
            $table->char('request_hash', 64);
            $table->string('gateway', 40);
            $table->string('status', 16)->default('pending');
            $table->string('authority', 64)->nullable();
            $table->text('redirect_url')->nullable();
            $table->string('ref_id', 100)->nullable();
            $table->uuid('order_id')->nullable();
            $table->uuid('request_id')->nullable();
            $table->dateTime('created_at', 6)->useCurrent();
            $table->dateTime('paid_at', 6)->nullable();
            $table->unique(['user_id', 'idempotency_key']);
            $table->index(['user_id', 'status']);
        });
        DB::statement("alter table plan_checkouts add constraint plan_checkouts_status_check check (status in ('pending','paid','failed'))");
        DB::statement('alter table plan_checkouts add constraint plan_checkouts_amount_check check (amount_toman > 0 and amount_rial = amount_toman * 10)');
    }

    public function down(): void
    {
        Schema::dropIfExists('plan_checkouts');
    }
};
