<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('alter table `ai_providers` drop check `ai_providers_kind_check`');
        DB::statement("alter table `ai_providers` add constraint `ai_providers_kind_check` check (`kind` in ('openrouter', 'closerouter', 'openai_compatible'))");
    }

    public function down(): void
    {
        DB::statement('alter table `ai_providers` drop check `ai_providers_kind_check`');
        DB::statement("alter table `ai_providers` add constraint `ai_providers_kind_check` check (`kind` in ('openrouter', 'openai_compatible'))");
    }
};
