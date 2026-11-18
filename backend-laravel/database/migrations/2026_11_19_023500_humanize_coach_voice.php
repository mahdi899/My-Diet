<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const MARKER = 'لحن گفتگو:';

    private const RULE = <<<'TEXT'
لحن گفتگو: مثل یک مشاور تغذیه که روبه‌رو نشسته حرف بزن. جمله‌های طبیعی، گرم و کوتاه، بدون فهرست، بدون ستاره، بدون بولت، بدون عنوان، بدون ایموجی و بدون مارک‌داون.
اسم غذا را دقیقاً همان نام فارسی کاتالوگ بگو. کلمه «خانواده» را کنار هیچ اسم غذایی ننویس و غذا را دسته‌بندی نکن.
اگر غذای جایگزین پیشنهاد می‌کنی فقط از فهرست «غذاهای مجاز کاتالوگ» انتخاب کن. غذایی که آنجا نیست نساز. اگر آن فهرست خالی است بگو گزینهٔ نزدیکی در کاتالوگ نیست.
TEXT;

    public function up(): void
    {
        foreach (DB::table('ai_prompt_templates')->where('key', 'coach_system')->get() as $row) {
            $prompt = (string) $row->system_prompt;
            if (str_contains($prompt, self::MARKER)) {
                continue;
            }
            DB::table('ai_prompt_templates')->where('id', $row->id)->update([
                'system_prompt' => rtrim($prompt)."\n\n".self::RULE,
            ]);
        }
    }

    public function down(): void
    {
        foreach (DB::table('ai_prompt_templates')->where('key', 'coach_system')->get() as $row) {
            $prompt = (string) $row->system_prompt;
            $cut = strpos($prompt, "\n\n".self::MARKER);
            if ($cut === false) {
                continue;
            }
            DB::table('ai_prompt_templates')->where('id', $row->id)->update([
                'system_prompt' => rtrim(substr($prompt, 0, $cut)),
            ]);
        }
    }
};
