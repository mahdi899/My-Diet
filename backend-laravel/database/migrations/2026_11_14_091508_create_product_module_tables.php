<?php

use App\Shared\Infrastructure\ProductSchema;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        app(ProductSchema::class)->up();
    }

    public function down(): void
    {
        app(ProductSchema::class)->down();
    }
};
