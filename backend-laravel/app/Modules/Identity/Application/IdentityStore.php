<?php

namespace App\Modules\Identity\Application;

use Closure;

interface IdentityStore
{
    public function transaction(Closure $work): mixed;

    public function credential(string $role, string $username): ?array;

    public function recordLogin(string $role, string $userId, bool $success): void;

    public function totpSecret(string $userId, bool $confirmedOnly = false): ?array;

    public function saveTotp(string $userId, string $encrypted): void;

    public function confirmTotp(string $userId): void;

    public function createTotpChallenge(string $id, string $userId, string $hash, ?string $label, ?string $platform): void;

    public function lockTotpChallenge(string $hash): ?array;

    public function consumeTotpChallenge(string $id, bool $success): void;

    public function lockOtpBudgets(string $phone, string $ip): array;

    public function accountStatus(string $phone): ?string;

    public function createOtp(string $id, string $phone, string $hmac, string $ip): void;

    public function lockOtp(string $phone): ?array;

    public function consumeOtp(string $id, bool $success): void;

    public function lockUser(string $phone): ?array;

    public function createCustomer(string $id, string $conversationId, string $phone): void;

    public function createSession(string $id, string $userId, ?string $label, ?string $platform): string;

    public function addRefresh(string $id, string $sessionId, string $hash, ?string $parentId): string;

    public function lockRefresh(string $hash): ?array;

    public function useRefresh(string $id, string $sessionId): void;

    public function revoke(string $userId, string $sessionId, string $reason): int;

    public function sessions(string $userId): array;

    public function authenticatedSession(string $userId, string $sessionId): ?array;

    public function profile(string $userId): ?string;

    public function rename(string $userId, string $name): void;

    public function personalDetails(string $userId): ?string;

    public function savePersonalDetails(string $userId, ?string $name, string $encrypted): void;
}
