<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('ai_provider_models')) {
            return;
        }

        DB::statement("create table `ai_provider_models` (
`id` char(36) not null,
`provider_id` char(36) not null,
`model` varchar(255) not null,
`name` varchar(255) null,
`price_in_micros_per_m` bigint not null default 0,
`price_out_micros_per_m` bigint not null default 0,
`created_at` datetime(6) not null default current_timestamp(6),
PRIMARY KEY (`id`)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_0900_bin");
        DB::statement('alter table `ai_provider_models` add constraint `ai_provider_models_price_in_micros_per_m_check` check (`price_in_micros_per_m` >= 0)');
        DB::statement('alter table `ai_provider_models` add constraint `ai_provider_models_price_out_micros_per_m_check` check (`price_out_micros_per_m` >= 0)');
        DB::statement('alter table `ai_provider_models` add constraint `ai_provider_models_provider_id_fkey` foreign key (`provider_id`) references `ai_providers`(`id`) on delete cascade');
        DB::statement('alter table `ai_provider_models` add constraint `ai_provider_models_provider_id_model_key` unique (`provider_id`, `model`)');
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_provider_models');
    }
};
