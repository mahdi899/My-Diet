<?php

namespace App\Shared\Domain;

/** Validates the exported contract subset and applies property defaults. */
final class JsonSchema
{
    public static function parse(mixed $value, array $schema, string $path = ''): mixed
    {
        $fail = static fn (): never => throw new \InvalidArgumentException($path);
        if (isset($schema['anyOf'])) {
            foreach ($schema['anyOf'] as $choice) {
                try {
                    return self::parse($value, $choice, $path);
                } catch (\InvalidArgumentException) {
                }
            }
            $fail();
        }
        $number = (is_int($value) || is_float($value)) && is_finite((float) $value);
        $valid = match ($schema['type'] ?? '') {
            'string' => is_string($value), 'number' => $number,
            'integer' => $number && floor((float) $value) === (float) $value,
            'boolean' => is_bool($value), 'null' => $value === null,
            'array' => is_array($value) && array_is_list($value),
            'object' => $value instanceof \stdClass || (is_array($value) && ! array_is_list($value)),
            default => throw new \LogicException('Unsupported contract type'),
        };
        if (! $valid || (isset($schema['enum']) && ! in_array($value, $schema['enum'], true)) || (array_key_exists('const', $schema) && $value !== $schema['const'])) {
            $fail();
        }
        if (is_string($value)) {
            $length = strlen(mb_convert_encoding($value, 'UTF-16LE', 'UTF-8')) / 2;
            if ($length < ($schema['minLength'] ?? 0) || $length > ($schema['maxLength'] ?? INF)
                || (isset($schema['pattern']) && preg_match('~'.str_replace('~', '\\~', $schema['pattern']).'~uD', $value) !== 1)
                || (($schema['format'] ?? '') === 'uri' && ! preg_match('~^[a-z][a-z0-9+.-]*:~i', $value))) {
                $fail();
            }
        }
        if ($number && ($value < ($schema['minimum'] ?? -INF) || $value > ($schema['maximum'] ?? INF)
            || (isset($schema['exclusiveMinimum']) && $value <= $schema['exclusiveMinimum']))) {
            $fail();
        }
        if (($schema['type'] ?? '') === 'array') {
            if (count($value) < ($schema['minItems'] ?? 0) || count($value) > ($schema['maxItems'] ?? INF)) {
                $fail();
            }

            return array_map(fn ($item, $index) => self::parse($item, $schema['items'], ltrim($path.'.'.$index, '.')), $value, array_keys($value));
        }
        if (($schema['type'] ?? '') === 'object') {
            $value = (array) $value;
            $result = [];
            foreach ($schema['properties'] as $key => $field) {
                $next = ltrim($path.'.'.$key, '.');
                if (array_key_exists($key, $value)) {
                    $result[$key] = self::parse($value[$key], $field, $next);
                } elseif (array_key_exists('default', $field)) {
                    $result[$key] = $field['default'];
                } elseif (in_array($key, $schema['required'] ?? [], true)) {
                    throw new \InvalidArgumentException($next);
                }
            }

            return $result;
        }

        return $value;
    }
}
