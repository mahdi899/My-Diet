<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('ai_pools')->where('code', 'plan_draft')->where('max_tokens', '<=', 6000)->update(['max_tokens' => 16000]);
        DB::table('ai_pools')->where('code', 'plan_draft')->where('timeout_ms', '<=', 90000)->update(['timeout_ms' => 180000]);
        $prompt = DB::table('ai_prompt_templates')->where(['key' => 'plan_draft', 'status' => 'active'])->orderByDesc('version')->first();
        if ($prompt !== null && ! str_contains((string) $prompt->system_prompt, 'دقیقاً ۷ روز')) {
            DB::table('ai_prompt_templates')->where('id', $prompt->id)->update([
                'system_prompt' => $prompt->system_prompt.' دقیقاً ۷ روز کامل برگردان و JSON را وسط کار قطع نکن. کالری هر وعده باید در بازهٔ ۳۵٪ هدف همان وعده بماند و جمع روز در بازهٔ ۱۵٪ کالری هدف. اگر یک غذا به بازه نمی‌رسد چند غذا از همان وعده را جمع کن.',
            ]);
        }
    }

    public function down(): void
    {
        DB::table('ai_pools')->where('code', 'plan_draft')->where('max_tokens', 16000)->update(['max_tokens' => 6000]);
        DB::table('ai_pools')->where('code', 'plan_draft')->where('timeout_ms', 180000)->update(['timeout_ms' => 90000]);
    }
};
