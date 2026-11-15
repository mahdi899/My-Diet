<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Creates coach quota, add-on credits, and preferences tables.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create("coach_quotas", function (Blueprint $table): void {
            $table->char("user_id", 36)->primary();
            $table->string("plan_code", 32)->nullable();
            $table->unsignedSmallInteger("daily_msg_limit")->default(8);
            $table->unsignedSmallInteger("period_msg_limit")->default(120);
            $table->unsignedSmallInteger("vision_limit")->default(8);
            $table->unsignedSmallInteger("daily_msg_used")->default(0);
            $table->unsignedSmallInteger("period_msg_used")->default(0);
            $table->unsignedSmallInteger("vision_used")->default(0);
            $table->date("reset_daily_at")->nullable();
            $table->date("period_start")->nullable();
            $table->timestamp("updated_at", 6)->useCurrent()->useCurrentOnUpdate();
        });

        Schema::create("coach_addon_credits", function (Blueprint $table): void {
            $table->char("id", 36)->primary();
            $table->char("user_id", 36);
            $table->char("source_order_id", 36)->nullable();
            $table->unsignedSmallInteger("credits_total");
            $table->unsignedSmallInteger("credits_remaining");
            $table->string("pack_code", 32);
            $table->timestamp("expires_at", 6)->nullable();
            $table->timestamp("created_at", 6)->useCurrent();
            $table->index("user_id");
        });

        Schema::create("coach_preferences", function (Blueprint $table): void {
            $table->char("id", 36)->primary();
            $table->char("user_id", 36);
            $table->string("pref_key", 32);
            $table->string("value", 255);
            $table->string("source", 16)->default("auto");
            $table->tinyInteger("strength")->default(1);
            $table->boolean("active")->default(true);
            $table->timestamp("created_at", 6)->useCurrent();
            $table->timestamp("updated_at", 6)->useCurrent()->useCurrentOnUpdate();
            $table->index(["user_id", "pref_key", "active"]);
        });

        Schema::create("coach_plan_quotas", function (Blueprint $table): void {
            $table->string("plan_code", 32)->primary();
            $table->unsignedSmallInteger("daily_msg_limit")->default(8);
            $table->unsignedSmallInteger("period_msg_limit")->default(120);
            $table->unsignedSmallInteger("period_days")->default(15);
            $table->unsignedSmallInteger("vision_limit")->default(8);
            $table->timestamp("updated_at", 6)->useCurrent()->useCurrentOnUpdate();
        });

        \DB::table("coach_plan_quotas")->insert([
            ["plan_code" => "weekly",    "daily_msg_limit" => 8,  "period_msg_limit" => 120, "period_days" => 15, "vision_limit" => 8],
            ["plan_code" => "monthly",   "daily_msg_limit" => 12, "period_msg_limit" => 240, "period_days" => 30, "vision_limit" => 20],
            ["plan_code" => "quarterly", "daily_msg_limit" => 20, "period_msg_limit" => 450, "period_days" => 30, "vision_limit" => 40],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists("coach_plan_quotas");
        Schema::dropIfExists("coach_preferences");
        Schema::dropIfExists("coach_addon_credits");
        Schema::dropIfExists("coach_quotas");
    }
};
