<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscription_plan_prices', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('plan_code', 40);
            $table->unsignedBigInteger('amount_toman');
            $table->dateTime('effective_from', 6)->useCurrent();
            $table->index(['plan_code', 'effective_from']);
        });
        DB::statement('alter table subscription_plan_prices add constraint subscription_plan_prices_code_check check (plan_code in (\'weekly\', \'monthly\', \'quarterly\'))');
        DB::statement('alter table subscription_plan_prices add constraint subscription_plan_prices_amount_check check (amount_toman > 0)');
        DB::table('subscription_plan_prices')->insert([
            ['id' => '10000000-0000-4000-8000-000000000101', 'plan_code' => 'weekly', 'amount_toman' => 1290000],
            ['id' => '10000000-0000-4000-8000-000000000102', 'plan_code' => 'monthly', 'amount_toman' => 1990000],
            ['id' => '10000000-0000-4000-8000-000000000103', 'plan_code' => 'quarterly', 'amount_toman' => 8990000],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('subscription_plan_prices');
    }
};
