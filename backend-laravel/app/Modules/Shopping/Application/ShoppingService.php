<?php

namespace App\Modules\Shopping\Application;

use App\Modules\Plans\Domain\CivilDates;
use App\Shared\Domain\Problem;

final class ShoppingService
{
    public function __construct(private ShoppingStore $store) {}

    public function scope(mixed $weekStart, mixed $days): array
    {
        if (! is_string($weekStart) || ($days !== null && ! is_array($days))) {
            throw new Problem(400, 'validation', 'محدوده لیست خرید معتبر نیست');
        }
        if (! CivilDates::valid($weekStart) || CivilDates::saturday($weekStart) !== $weekStart) {
            throw new Problem(400, 'validation', 'شروع هفته باید شنبه باشد');
        }
        $selected = $days ?? array_map(fn (int $offset): string => CivilDates::add($weekStart, $offset), range(0, 6));
        $end = CivilDates::add($weekStart, 6);
        if ($selected === [] || count($selected) > 7 || count($selected) !== count(array_unique($selected)) || array_filter($selected, fn ($day): bool => ! is_string($day) || ! CivilDates::valid($day) || $day < $weekStart || $day > $end)) {
            throw new Problem(400, 'validation', 'روزهای انتخاب‌شده معتبر نیست');
        }
        sort($selected);

        return ['weekStart' => $weekStart, 'days' => array_values($selected)];
    }

    public function get(string $user, array $scope): array
    {
        return $this->store->transaction(function () use ($user, $scope): array {
            $this->store->lock($user);

            return $this->store->project($user, $scope['weekStart'], $scope['days']);
        });
    }

    public function flag(string $user, array $body, string $key): array
    {
        if (! preg_match('/^[a-f0-9]{64}$/D', $key) || array_diff(array_keys($body), ['weekStart', 'days', 'expectedRevision', 'alreadyHave', 'purchased']) || ! is_int($body['expectedRevision'] ?? null) || $body['expectedRevision'] < 1 || ! is_bool($body['alreadyHave'] ?? null) || ! is_bool($body['purchased'] ?? null)) {
            throw new Problem(400, 'validation', 'تغییر لیست خرید معتبر نیست');
        }
        $scope = $this->scope($body['weekStart'], $body['days'] ?? null);

        return $this->store->transaction(function () use ($user, $scope, $key, $body): array {
            $this->store->lock($user);
            $current = $this->store->project($user, $scope['weekStart'], $scope['days']);
            if ($current['revision'] !== $body['expectedRevision']) {
                throw new Problem(409, 'lock_conflict', 'لیست خرید تغییر کرده است');
            }
            $item = array_find($current['items'], fn (array $row): bool => $row['key'] === $key);
            if ($item === null) {
                throw new Problem(404, 'not_found', 'ماده اولیه پیدا نشد');
            }
            $this->store->saveFlag($user, $scope['weekStart'], $key, $body['alreadyHave'], $body['purchased'], $item['quantity']);

            return $this->store->project($user, $scope['weekStart'], $scope['days']);
        });
    }

    public function share(string $user, array $scope): array
    {
        $list = $this->get($user, $scope);
        $line = fn (string $value): string => preg_replace("/[\r\n\x{2028}\x{2029}]/u", ' ', $value);

        return ['revision' => $list['revision'], 'text' => implode("\n", array_map(fn (array $item): string => ($item['purchased'] ? '✓' : ($item['alreadyHave'] ? '☑' : '☐')).' '.$line($item['name']).': '.($item['quantity'] ?? 'نامشخص').' '.$line((string) ($item['unit'] ?? '')).' ('.$line($item['category']).')', $list['items'])), 'incomplete' => $list['incomplete']];
    }
}
