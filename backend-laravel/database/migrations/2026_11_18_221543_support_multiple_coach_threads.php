<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('coach_threads', function (Blueprint $table) {
            $table->string('title', 80)->nullable();
            $table->index(['user_id', 'last_message_at', 'id'], 'coach_threads_user_activity');
            $table->dropUnique('coach_threads_user_id_key');
        });
        DB::statement('update coach_threads t set last_message_at = (select max(m.created_at) from coach_messages m where m.thread_id = t.id) where t.last_message_at is null');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::table('coach_threads')->groupBy('user_id')->havingRaw('count(*) > 1')->exists()) {
            throw new RuntimeException('Cannot restore one thread per user without losing conversations.');
        }
        Schema::table('coach_threads', function (Blueprint $table) {
            $table->unique('user_id', 'coach_threads_user_id_key');
            $table->dropIndex('coach_threads_user_activity');
            $table->dropColumn('title');
        });
    }
};
