<?php

namespace App\Modules\Food\Application;

interface FoodStore
{
    public function all(): array;

    public function get(string $slug): ?array;

    public function put(array $food, bool $new, array $photo): void;

    public function activate(string $slug, bool $active): void;

    public function image(string $slug): ?string;

    public function revision(): string;

    public function replacement(string $id): ?array;

    public function replace(string $id, string $actor, array $foods, array $previous): void;

    public function audit(string $actor, string $action, array $detail): void;

    public function transaction(\Closure $work): mixed;
}
