<?php

namespace App\Modules\Identity\Presentation;

use App\Modules\Identity\Application\IdentityService;
use App\Modules\Identity\Application\IdentitySettings;
use App\Modules\Identity\Application\OtpSender;
use App\Shared\Domain\Problem;
use App\Shared\Presentation\StrictInput as Input;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class IdentityController
{
    public function __construct(private IdentityService $identity, private IdentitySettings $settings, private OtpSender $sms) {}

    public function adminLogin(Request $request): JsonResponse
    {
        return $this->staffLogin($request, 'admin');
    }

    public function specialistLogin(Request $request): JsonResponse
    {
        return $this->staffLogin($request, 'specialist');
    }

    private function staffLogin(Request $request, string $role): JsonResponse
    {
        $body = Input::body($request, ['username', 'password']);
        if ($role === 'specialist') {
            $password = $body['password'] ?? null;
            if (!is_string($password) || $password === '' || Input::length($password) > 256) {
                throw new Problem(401, 'unauthorized', 'نام کاربری یا رمز عبور نادرست است');
            }
        } else {
            $password = Input::string($body, 'password', 256);
        }
        return $this->present($request, $this->identity->staffLogin($role, Input::string($body, 'username', 80), $password));
    }

    public function requestOtp(Request $request): JsonResponse
    {
        $body = Input::body($request, ['phone', 'existingAccountOnly']);
        if (array_key_exists('existingAccountOnly', $body) && !is_bool($body['existingAccountOnly'])) {
            throw new Problem(400, 'validation', 'نوع درخواست معتبر نیست');
        }
        $result = $this->identity->requestOtp(Input::phone(Input::string($body, 'phone', 32)), substr($request->ip() ?: 'unknown', 0, 64), $body['existingAccountOnly'] ?? false);
        return response()->json($result, 201);
    }

    public function verifyOtp(Request $request): JsonResponse
    {
        $body = Input::body($request, ['phone', 'code', 'deviceLabel', 'platform']);
        $code = Input::code($body, 'کد واردشده درست نیست');
        return $this->present($request, $this->identity->verifyOtp(
            Input::phone(Input::string($body, 'phone', 32)), $code,
            Input::optional($body, 'deviceLabel', 80), Input::optional($body, 'platform', 40)));
    }

    public function totp(Request $request): JsonResponse
    {
        $body = Input::body($request, ['totpToken', 'code']);
        $code = Input::code($body, 'کد ورود دومرحله‌ای درست نیست');
        return $this->present($request, $this->identity->completeTotp(Input::string($body, 'totpToken', 200), $code));
    }

    public function refresh(Request $request): JsonResponse
    {
        $body = Input::body($request, ['refreshToken'], true);
        $token = is_string($body['refreshToken'] ?? null) ? $body['refreshToken'] : '';
        if ($token === '') {
            $cookie = $request->cookies->get('sabzine_refresh');
            if ($cookie && $request->header('x-sabzine-client') !== 'web') {
                throw new Problem(401, 'unauthorized', 'نشست معتبر نیست');
            }
            $token = is_string($cookie) ? $cookie : '';
        }
        if ($token === '') {
            throw new Problem(401, 'unauthorized', 'نشست معتبر نیست');
        }
        return $this->present($request, $this->identity->refresh($token));
    }

    public function latest(Request $request): array
    {
        $phone = $request->query('phone');
        if ($this->settings->environment !== 'development' || !is_string($phone) || $phone === '') {
            throw new Problem(404, 'not_found', 'یافت نشد');
        }
        $code = $this->sms->latest(Input::phone($phone));
        if ($code === null) {
            throw new Problem(404, 'not_found', 'یافت نشد');
        }
        return ['code' => $code];
    }

    public function logout(Request $request): JsonResponse
    {
        $actor = $request->attributes->get('actor');
        $this->identity->logout($actor['id'], $actor['sessionId']);
        return response()->json(['ok' => true], 201)->header('Set-Cookie', $this->cookie('', 0));
    }

    public function sessions(Request $request): array
    {
        $actor = $request->attributes->get('actor');
        return $this->identity->sessions($actor['id'], $actor['sessionId']);
    }

    public function revoke(Request $request, string $id): array
    {
        $this->identity->revokeSession($request->attributes->get('actor')['id'], Input::uuid($id));
        return ['ok' => true];
    }

    public function profile(Request $request): array
    {
        $actor = $request->attributes->get('actor');
        return $this->identity->profile($actor['id'], $actor['role']);
    }

    public function rename(Request $request): array
    {
        $body = Input::body($request, ['displayName']);
        $actor = $request->attributes->get('actor');
        return $this->identity->rename($actor['id'], $actor['role'], Input::string($body, 'displayName', 80));
    }

    public function personalDetails(Request $request): array
    {
        return $this->identity->personalDetails($request->attributes->get('actor')['id']);
    }

    public function savePersonalDetails(Request $request): array
    {
        $body = Input::body($request, ['name', 'age', 'contactPhone', 'height', 'weight', 'photo']);
        $age = $body['age'] ?? null;
        $height = $body['height'] ?? null;
        $weight = $body['weight'] ?? null;
        $photo = $body['photo'] ?? null;
        $number = fn (mixed $v): bool => (is_int($v) || is_float($v)) && is_finite((float) $v);
        $invalid = fn (): Problem => new Problem(400, 'validation', 'اطلاعات فردی معتبر نیست.');
        if (!$number($age) || floor($age) !== (float) $age || $age < 1 || $age > 130 ||
            !$number($height) || $height <= 0 || $height > 300 || !$number($weight) || $weight <= 0 || $weight > 700 ||
            !array_key_exists('photo', $body)) {
            throw $invalid();
        }
        if ($photo !== null) {
            if (!is_string($photo) || strlen($photo) > 450000 || !preg_match('/^[A-Za-z0-9+\/]+={0,2}$/D', $photo)) {
                throw $invalid();
            }
            $bytes = base64_decode($photo);
            if (!str_starts_with($bytes, hex2bin('ffd8ff')) && !str_starts_with($bytes, hex2bin('89504e470d0a1a0a'))) {
                throw $invalid();
            }
        }
        return $this->identity->savePersonalDetails($request->attributes->get('actor')['id'], [
            'name' => Input::string($body, 'name', 80), 'contactPhone' => Input::phone(Input::string($body, 'contactPhone', 32)),
            'age' => $age, 'height' => $height, 'weight' => $weight, 'photo' => $photo,
        ]);
    }

    public function totpStatus(Request $request): array
    {
        return $this->identity->totpStatus($request->attributes->get('actor')['id']);
    }

    public function setupTotp(Request $request): JsonResponse
    {
        $actor = $request->attributes->get('actor');
        $result = $this->identity->setupTotp($actor['id']);
        $result['otpauthUrl'] = 'otpauth://totp/Sabzine:'.$actor['role'].'?secret='.$result['secret'].'&issuer=Sabzine&digits=6&period=30';
        return response()->json($result, 201);
    }

    public function confirmTotp(Request $request): JsonResponse
    {
        $body = Input::body($request, ['code']);
        return response()->json($this->identity->confirmTotp($request->attributes->get('actor')['id'], Input::code($body, 'کد ورود دومرحله‌ای درست نیست')), 201);
    }

    private function present(Request $request, array $issued): JsonResponse
    {
        $response = response()->json($issued, 201);
        if (($issued['totpRequired'] ?? false) || $request->header('x-sabzine-client') !== 'web') {
            return $response;
        }
        $maxAge = max(0, (int) floor((float) (new \DateTimeImmutable($issued['sessionExpiresAt']))->format('U.u') - microtime(true)));
        $response->header('Set-Cookie', $this->cookie($issued['refreshToken'], $maxAge));
        unset($issued['refreshToken']);
        return $response->setData($issued);
    }

    private function cookie(string $token, int $maxAge): string
    {
        return 'sabzine_refresh='.rawurlencode($token).'; HttpOnly; SameSite=Strict; Path=/v1/auth; Max-Age='.$maxAge.
            (in_array($this->settings->environment, ['production', 'staging'], true) ? '; Secure' : '');
    }
}
