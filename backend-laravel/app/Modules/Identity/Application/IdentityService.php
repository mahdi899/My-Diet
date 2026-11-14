<?php

namespace App\Modules\Identity\Application;

use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;
use Throwable;

final class IdentityService
{
    public function __construct(private IdentityStore $store, private OtpSender $sms, private IdentitySettings $settings) {}

    public function staffLogin(string $role, string $username, string $password): array
    {
        $outcome = $this->store->transaction(function () use ($role, $username, $password): ?array {
            $row = $this->store->credential($role, mb_strtolower(trim($username)));
            $valid = Crypto::verifyPassword($password, $row['password_hash'] ?? str_repeat('0', 32).':'.str_repeat('00', 64));
            if (! $row || ! $valid || $row['status'] !== 'active' || ($row['locked_until'] && strtotime($row['locked_until']) > time())) {
                if ($row) {
                    $this->store->recordLogin($role, $row['user_id'], false);
                }

                return null;
            }
            $this->store->recordLogin($role, $row['user_id'], true);
            $label = $role === 'admin' ? 'Admin website' : 'Specialist website';
            if ($this->store->totpSecret($row['user_id'], true)) {
                return $this->challenge($row['user_id'], $label, 'web');
            }

            return $this->issue($row['user_id'], $role, $label, 'web');
        });
        if ($outcome === null) {
            throw new Problem(401, 'unauthorized', 'نام کاربری یا رمز عبور نادرست است یا ورود موقتاً مسدود شده است');
        }

        return $outcome;
    }

    public function requestOtp(string $phone, string $ip, bool $existingOnly): array
    {
        $code = $this->settings->environment === 'development' && $this->settings->fixedOtp !== null
            ? $this->settings->fixedOtp : str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $this->store->transaction(function () use ($phone, $ip, $existingOnly, $code): void {
            $budget = $this->store->lockOtpBudgets($phone, $ip);
            $message = match (true) {
                $budget['locks'] >= 3 && $budget['recently_locked'] => 'به‌خاطر تلاش‌های ناموفق، ورود تا چند دقیقه ممکن نیست',
                $budget['hourly'] >= 5 => 'تعداد درخواست کد در این ساعت به سقف رسیده است',
                $budget['daily'] >= 10 => 'تعداد درخواست کد در امروز به سقف رسیده است',
                $budget['network'] >= 20 => 'تعداد درخواست از این شبکه به سقف رسیده است',
                (bool) $budget['cooling'] => 'درخواست کد جدید کمی بعد ممکن است',
                default => null,
            };
            if ($message !== null) {
                throw new Problem(429, 'rate_limited', $message);
            }
            if ($existingOnly) {
                $status = $this->store->accountStatus($phone);
                if ($status === null || $status === 'deleted') {
                    throw new Problem(404, 'account_not_registered', 'هنوز ثبت‌نام نکردی');
                }
                if ($status === 'suspended') {
                    throw new Problem(403, 'suspended', 'این حساب غیرفعال است');
                }
            }
            $id = Crypto::uuid();
            $this->store->createOtp($id, $phone, $this->otpHmac($id, $code), $ip);
            try {
                $this->sms->send($phone, $code);
            } catch (Throwable) {
                throw new Problem(503, 'sms_unavailable', 'ارسال کد ممکن نشد. کمی بعد دوباره تلاش کن');
            }
        });

        return ['expiresInSeconds' => 120, 'resendAfterSeconds' => 60];
    }

    public function verifyOtp(string $phone, string $code, ?string $label, ?string $platform): array
    {
        $outcome = $this->store->transaction(function () use ($phone, $code, $label, $platform): array|Problem {
            $row = $this->store->lockOtp($phone);
            if (! $row || $row['consumed_at'] || $row['superseded_at'] || $row['locked_at']) {
                throw new Problem(401, 'unauthorized', 'کد واردشده درست نیست');
            }
            if ($row['expired']) {
                throw new Problem(401, 'unauthorized', 'کد منقضی شده است');
            }
            $valid = hash_equals($row['code_hmac'], $this->otpHmac($row['id'], $code));
            $this->store->consumeOtp($row['id'], $valid);
            if (! $valid) {
                return new Problem(401, 'unauthorized', $row['attempts'] + 1 >= 5 ? 'کد دیگر معتبر نیست. کد جدید بگیرید' : 'کد واردشده درست نیست');
            }
            $user = $this->store->lockUser($phone);
            if (! $user) {
                $id = Crypto::uuid();
                $this->store->createCustomer($id, Crypto::uuid(), $phone);
                $user = ['id' => $id, 'role' => 'user', 'status' => 'pending'];
            }
            if ($user['role'] === 'admin') {
                return new Problem(403, 'admin_web_only', 'برای ورود مدیر از نام کاربری و رمز عبور پنل وب استفاده کنید');
            }
            if ($user['status'] === 'deleted') {
                return new Problem(403, 'account_deleted', 'این حساب حذف شده است');
            }
            if ($user['status'] === 'suspended') {
                return new Problem(403, 'suspended', 'این حساب غیرفعال است');
            }
            if ($user['role'] !== 'user' && $this->store->totpSecret($user['id'], true)) {
                return $this->challenge($user['id'], $label, $platform);
            }

            return $this->issue($user['id'], $user['role'], $label, $platform);
        });

        return $this->committedOutcome($outcome);
    }

    public function completeTotp(string $token, string $code): array
    {
        $outcome = $this->store->transaction(function () use ($token, $code): array|Problem {
            $row = $this->store->lockTotpChallenge(hash('sha256', $token));
            if (! $row || $row['consumed_at'] || $row['expired']) {
                throw new Problem(401, 'unauthorized', 'ورود دومرحله‌ای منقضی شده است');
            }
            if ($row['status'] !== 'active' || ! in_array($row['role'], ['admin', 'specialist'], true)) {
                throw new Problem(403, 'suspended', 'این حساب غیرفعال است');
            }
            $valid = Crypto::totpMatches($this->secretBytes($row['secret_encrypted']), $code);
            $this->store->consumeTotpChallenge($row['id'], $valid);
            if (! $valid) {
                return new Problem(401, 'unauthorized', $row['attempts'] + 1 >= 5 ? 'کد دیگر معتبر نیست' : 'کد ورود دومرحله‌ای درست نیست');
            }

            return $this->issue($row['user_id'], $row['role'], $row['device_label'], $row['platform']);
        });

        return $this->committedOutcome($outcome);
    }

    public function totpStatus(string $userId): array
    {
        return ['enabled' => $this->store->totpSecret($userId, true) !== null];
    }

    public function setupTotp(string $userId): array
    {
        if ($this->store->totpSecret($userId, true)) {
            throw new Problem(409, 'totp_enabled', 'ورود دومرحله‌ای قبلاً فعال شده است');
        }
        $secret = random_bytes(20);
        $this->store->saveTotp($userId, Crypto::encrypt(Crypto::base64url($secret), $this->settings->fieldKey));

        return ['secret' => Crypto::base32($secret)];
    }

    public function confirmTotp(string $userId, string $code): array
    {
        $row = $this->store->totpSecret($userId);
        if (! $row) {
            throw new Problem(409, 'totp_missing', 'ابتدا ورود دومرحله‌ای را راه‌اندازی کن');
        }
        if ($row['confirmed_at']) {
            throw new Problem(409, 'totp_enabled', 'ورود دومرحله‌ای قبلاً فعال شده است');
        }
        if (! Crypto::totpMatches($this->secretBytes($row['secret_encrypted']), $code)) {
            throw new Problem(401, 'unauthorized', 'کد ورود دومرحله‌ای درست نیست');
        }
        $this->store->confirmTotp($userId);

        return ['enabled' => true];
    }

    public function refresh(string $token): array
    {
        $outcome = $this->store->transaction(function () use ($token): array|Problem {
            $row = $this->store->lockRefresh(hash('sha256', $token));
            if (! $row) {
                throw new Problem(401, 'unauthorized', 'نشست معتبر نیست');
            }
            if ($row['used_at']) {
                $this->store->revoke($row['user_id'], $row['session_id'], 'refresh_reuse');

                return new Problem(401, 'unauthorized', 'نشست پایان یافته است');
            }
            if ($row['revoked_at'] || $row['expired']) {
                throw new Problem(401, 'unauthorized', 'نشست پایان یافته است');
            }
            if ($row['status'] === 'deleted') {
                throw new Problem(403, 'account_deleted', 'این حساب حذف شده است');
            }
            if ($row['status'] !== 'active') {
                throw new Problem(403, 'suspended', 'این حساب غیرفعال است');
            }
            $this->store->useRefresh($row['id'], $row['session_id']);
            $refresh = Crypto::base64url(random_bytes(32));
            $expires = $this->store->addRefresh(Crypto::uuid(), $row['session_id'], hash('sha256', $refresh), $row['id']);

            return $this->tokens($row['user_id'], $row['session_id'], $row['role'], $expires, $refresh);
        });

        return $this->committedOutcome($outcome);
    }

    public function authenticate(string $token): array
    {
        $claims = Crypto::verify($token, $this->settings->jwtSecret);
        $row = $this->store->authenticatedSession($claims['sub'], $claims['sid']);
        if (! $row || $row['revoked_at']) {
            throw new Problem(401, 'unauthorized', 'نشست پایان یافته است');
        }
        if ($row['status'] === 'deleted') {
            throw new Problem(403, 'account_deleted', 'این حساب حذف شده است');
        }
        if ($row['status'] === 'suspended' || ($row['role'] !== 'user' && $row['status'] !== 'active') ||
            ($row['role'] === 'specialist' && $row['specialist_active'] !== true)) {
            throw new Problem(403, 'suspended', 'این حساب غیرفعال است');
        }

        return ['id' => $claims['sub'], 'role' => $row['role'], 'sessionId' => $claims['sid']];
    }

    public function logout(string $userId, string $sessionId): void
    {
        $this->store->revoke($userId, $sessionId, 'logout');
    }

    public function revokeSession(string $userId, string $sessionId): void
    {
        if ($this->store->revoke($userId, $sessionId, 'revoked') === 0) {
            throw new Problem(404, 'not_found', 'نشست پیدا نشد');
        }
    }

    public function sessions(string $userId, string $currentId): array
    {
        return array_map(fn (array $row) => ['id' => $row['id'], 'createdAt' => Crypto::iso($row['created_at']),
            'sessionExpiresAt' => Crypto::iso($row['absolute_expires_at']), 'platform' => $row['platform'],
            'deviceLabel' => $row['device_label'], 'current' => $row['id'] === $currentId], $this->store->sessions($userId));
    }

    public function profile(string $userId, string $role): array
    {
        return ['id' => $userId, 'role' => $role, 'displayName' => $this->store->profile($userId)];
    }

    public function rename(string $userId, string $role, string $name): array
    {
        $this->store->rename($userId, $name);

        return $this->profile($userId, $role);
    }

    public function personalDetails(string $userId): array
    {
        $encrypted = $this->store->personalDetails($userId);

        return ['details' => $encrypted === null ? null : json_decode(Crypto::decrypt($encrypted, $this->settings->fieldKey), false, 512, JSON_THROW_ON_ERROR)];
    }

    public function savePersonalDetails(string $userId, array $details): array
    {
        $encrypted = Crypto::encrypt(json_encode($details, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR), $this->settings->fieldKey);
        $this->store->savePersonalDetails($userId, $details['name'], $encrypted);

        return ['details' => $details];
    }

    private function otpHmac(string $id, string $code): string
    {
        return hash_hmac('sha256', $id.':'.$code, $this->settings->otpPepper);
    }

    private function challenge(string $id, ?string $label, ?string $platform): array
    {
        $token = Crypto::base64url(random_bytes(32));
        $this->store->createTotpChallenge(Crypto::uuid(), $id, hash('sha256', $token), $label, $platform);

        return ['totpRequired' => true, 'totpToken' => $token];
    }

    private function secretBytes(string $encrypted): string
    {
        return Crypto::decode64(Crypto::decrypt($encrypted, $this->settings->fieldKey));
    }

    /** Failures that update counters/revoke sessions must commit before being thrown. */
    private function committedOutcome(array|Problem $outcome): array
    {
        if ($outcome instanceof Problem) {
            throw $outcome;
        }

        return $outcome;
    }

    private function issue(string $userId, string $role, ?string $label, ?string $platform): array
    {
        $sessionId = Crypto::uuid();
        $expires = $this->store->createSession($sessionId, $userId, $label, $platform);
        $refresh = Crypto::base64url(random_bytes(32));
        $this->store->addRefresh(Crypto::uuid(), $sessionId, hash('sha256', $refresh), null);

        return $this->tokens($userId, $sessionId, $role, $expires, $refresh);
    }

    private function tokens(string $userId, string $sessionId, string $role, string $expires, string $refresh): array
    {
        $iat = time();
        $exp = min($iat + 600, strtotime($expires));

        return ['accessToken' => Crypto::sign(['sub' => $userId, 'sid' => $sessionId, 'role' => $role, 'iat' => $iat, 'exp' => $exp], $this->settings->jwtSecret),
            'refreshToken' => $refresh, 'accessExpiresAt' => gmdate('Y-m-d\TH:i:s', $exp).'.000Z',
            'sessionExpiresAt' => Crypto::iso($expires), 'role' => $role];
    }
}
