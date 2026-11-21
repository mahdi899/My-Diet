<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('plan_checkouts', function (Blueprint $table): void {
            $table->string('store_sku', 80)->nullable();
            $table->string('store_order_id', 128)->nullable();
            $table->string('store_token', 512)->nullable()->unique();
            $table->text('store_signature')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('plan_checkouts', function (Blueprint $table): void {
            $table->dropUnique(['store_token']);
            $table->dropColumn(['store_sku', 'store_order_id', 'store_token', 'store_signature']);
        });
    }
};
