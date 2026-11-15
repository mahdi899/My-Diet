<?php

namespace App\Modules\Food\Application;

use App\Modules\Food\Domain\FoodCsv;
use App\Modules\Food\Domain\FoodRules as Rules;
use App\Shared\Domain\Problem;

final class FoodService
{
    public function __construct(private FoodStore $store, private Rules $rules) {}

    public function get(string $slug): array
    {
        return $this->store->get($slug) ?? throw new Problem(404, 'not_found', 'غذا پیدا نشد');
    }

    public function listing(array $filter): array
    {
        if (! empty($filter['category']) && ! in_array($filter['category'], ['breakfast', 'main', 'side', 'soup', 'salad', 'protein', 'carb', 'dairy', 'fruit', 'snack', 'drink', 'dessert'], true)) {
            throw new Problem(400, 'validation', 'دستهٔ غذا نامعتبر است');
        }
        $q = $filter['q'] ?? '';
        preg_match_all('/[\p{L}\p{N}]+/u', \Normalizer::normalize($q, \Normalizer::FORM_KC), $matches);
        $words = array_slice($matches[0], 0, 6);
        $items = array_values(array_filter($this->store->all(), function ($food) use ($filter, $q, $words): bool {
            if (! empty($filter['category']) && $food['category'] !== $filter['category']) {
                return false;
            }
            if (in_array($filter['active'] ?? null, ['true', 'false'], true) && $food['active'] !== ($filter['active'] === 'true')) {
                return false;
            }
            if (! empty($filter['cursor']) && strcmp($food['slug'], $filter['cursor']) <= 0) {
                return false;
            }
            if ($q !== '' && str_contains(strtolower($food['slug']), strtolower($q))) {
                return true;
            }
            if ($words) {
                foreach ($words as $word) {
                    if (! preg_match('/(?:^|[^\p{L}\p{N}])'.preg_quote($word, '/').'/iu', $food['nameFa'])) {
                        return false;
                    }
                }
            } elseif ($q !== '') {
                return false;
            }

            return true;
        }));
        $limit = max(1, min(200, (int) ($filter['limit'] ?? 50)));
        $page = array_slice($items, 0, $limit);

        return ['items' => $page, 'nextCursor' => count($items) > $limit ? $page[count($page) - 1]['slug'] : null];
    }

    public function compose(array $input): array
    {
        return Rules::compose($input, array_column($this->store->all(), null, 'slug'));
    }

    public function save(string $actor, array $input, ?string $slug = null): array
    {
        $photo = Rules::photo($input);
        $food = $this->rules->parse($slug === null ? $input : [...$input, 'slug' => $slug]);
        if ($photo['bytes'] !== null) {
            $food['image'] = '/v1/public/food-images/'.$food['slug'].'.jpg';
        } elseif ($photo['changed'] && $slug !== null && str_starts_with($food['image'] ?? '', '/v1/public/food-images/')) {
            $food['image'] = null;
        }

        return $this->store->transaction(function () use ($actor, $food, $photo, $slug): array {
            $exists = $this->store->get($food['slug']);
            if ($slug === null && $exists) {
                throw new Problem(409, 'conflict', 'غذایی با این شناسه وجود دارد');
            }
            if ($slug !== null && ! $exists) {
                throw new Problem(404, 'not_found', 'غذا پیدا نشد');
            }
            $this->store->put($food, $slug === null, $photo);
            $this->store->audit($actor, $slug === null ? 'food_created' : 'food_updated', ['slug' => $food['slug']]);

            return $this->get($food['slug']);
        });
    }

    public function activate(string $actor, string $slug, mixed $active): array
    {
        if (! is_bool($active)) {
            throw new Problem(400, 'validation', 'وضعیت نامعتبر است');
        }

        return $this->store->transaction(function () use ($actor, $slug, $active): array {
            $this->get($slug);
            $this->store->activate($slug, $active);
            $this->store->audit($actor, $active ? 'food_enabled' : 'food_disabled', ['slug' => $slug]);

            return $this->get($slug);
        });
    }

    public function image(string $file): string
    {
        if (! preg_match('/^([a-z][a-z0-9_]{1,63})\.jpg$/D', $file, $match)) {
            throw new Problem(404, 'not_found', 'عکس غذا پیدا نشد');
        }

        return $this->store->image($match[1]) ?? throw new Problem(404, 'not_found', 'عکس غذا پیدا نشد');
    }

    public function revision(): array
    {
        return ['revision' => $this->store->revision()];
    }

    public function export(): array
    {
        return ['version' => 1, 'foods' => $this->store->all()];
    }

    public function csv(): string
    {
        return FoodCsv::export($this->store->all());
    }

    public function import(string $actor, mixed $text): array
    {
        if (! is_string($text)) {
            throw new Problem(400, 'validation', 'محتوای فایل ارسال نشده است');
        }
        if (Rules::length($text) > 2000000) {
            throw new Problem(400, 'validation', 'فایل بیش از حد بزرگ است');
        }
        $rows = FoodCsv::rows($text);
        $header = isset($rows[0]) ? array_map(Rules::trim(...), $rows[0]) : [];
        if (count($header) < 19 || count($header) > 21 || $header !== array_slice(FoodCsv::COLUMNS, 0, count($header))) {
            throw new Problem(400, 'validation', 'سرستون‌های فایل با قالب استاندارد نمی‌خواند');
        }
        if (count($rows) > 1001) {
            throw new Problem(400, 'validation', 'حداکثر هزار غذا در هر فایل مجاز است');
        }
        $foods = [];
        foreach (array_slice($rows, 1) as $index => $cells) {
            try {
                $foods[] = $this->rules->parse(FoodCsv::food($cells));
            } catch (\Throwable $error) {
                $message = $error instanceof Problem ? $error->getMessage() : 'ردیف معتبر نیست';
                throw new Problem(400, 'validation', 'خط '.($index + 2).': '.$message);
            }
        }

        return $this->store->transaction(function () use ($actor, $foods): array {
            $counts = ['created' => 0, 'updated' => 0];
            foreach ($foods as $food) {
                $new = $this->store->get($food['slug']) === null;
                $this->store->put($food, $new, ['changed' => false, 'bytes' => null]);
                $counts[$new ? 'created' : 'updated']++;
            }
            $this->store->audit($actor, 'food_csv_import', $counts);

            return $counts;
        });
    }

    public function replace(string $actor, array $input): array
    {
        $invalid = fn (): never => throw new Problem(400, 'validation', 'فایل جایگزینی معتبر نیست');
        if (! is_string($input['operationId'] ?? null) || ! self::uuid($input['operationId']) || ! is_string($input['expectedRevision'] ?? null) || ! preg_match('/^[a-f0-9]{32}$/D', $input['expectedRevision'])
            || ! is_array($input['foods'] ?? null) || ! array_is_list($input['foods']) || count($input['foods']) < 1 || count($input['foods']) > 1000) {
            $invalid();
        }
        try {
            $foods = array_map($this->rules->parse(...), $input['foods']);
        } catch (Problem) {
            $invalid();
        }
        if (count(array_unique(array_column($foods, 'slug'))) !== count($foods)) {
            throw new Problem(400, 'validation', 'شناسهٔ غذای تکراری در فایل وجود دارد');
        }
        $id = strtolower($input['operationId']);

        return $this->store->transaction(function () use ($actor, $input, $foods, $id): array {
            $previous = $this->store->replacement($id);
            if ($previous) {
                return ['replaced' => $previous['replacement_count'], 'backupId' => $id, 'duplicate' => true];
            }
            if ($this->store->revision() !== $input['expectedRevision']) {
                throw new Problem(409, 'catalog_changed', 'کاتالوگ تغییر کرده است؛ پیش‌نمایش را دوباره باز کن');
            }
            $previous = $this->store->all();
            $this->store->replace($id, $actor, $foods, $previous);
            $this->store->audit($actor, 'food_catalog_replaced', ['backupId' => $id, 'previousCount' => count($previous), 'count' => count($foods), 'digest' => hash('sha256', json_encode($foods, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR))]);

            return ['replaced' => count($foods), 'removed' => count($previous), 'backupId' => $id];
        });
    }

    public function backup(string $id): array
    {
        if (! self::uuid($id)) {
            throw new Problem(400, 'validation', 'شناسهٔ پشتیبان معتبر نیست');
        }
        $backup = $this->store->replacement(strtolower($id)) ?? throw new Problem(404, 'not_found', 'نسخهٔ پشتیبان پیدا نشد');

        return ['version' => 1, 'foods' => $backup['previous_foods']];
    }

    private static function uuid(string $id): bool
    {
        return preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iD', $id) === 1 || in_array($id, [str_repeat('0', 8).'-0000-0000-0000-'.str_repeat('0', 12), 'ffffffff-ffff-ffff-ffff-ffffffffffff'], true);
    }
}
