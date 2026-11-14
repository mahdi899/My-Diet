<?php

namespace App\Modules\Realtime\Infrastructure;

use App\Modules\Identity\Application\IdentitySettings;
use App\Modules\Realtime\Application\PushSender;
use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

final class FcmPush implements PushSender
{
    public function __construct(private ConnectionInterface $db, private IdentitySettings $settings) {}

    public function send(string $token, string $kind): void
    {
        $stored = $this->db->table('app_settings')->where('key', 'firebase_admin')->value('value');
        $encrypted = json_decode($stored ?? '{}', true)['encrypted'] ?? null;
        if (! is_string($encrypted)) {
            throw new Problem(503, 'firebase_required', 'Firebase تنظیم نشده است');
        }
        $account = json_decode(Crypto::decrypt($encrypted, $this->settings->fieldKey), true, 512, JSON_THROW_ON_ERROR);
        $project = $account['projectId'] ?? '';
        if (! preg_match('/^[a-z0-9][a-z0-9-]{2,62}$/D', $project)) {
            throw new Problem(503, 'firebase_invalid', 'تنظیمات Firebase معتبر نیست');
        }
        $cacheKey = 'fcm-oauth:'.hash('sha256', $encrypted);
        $access = Cache::get($cacheKey);
        if (! is_string($access)) {
            $now = time();
            $header = Crypto::base64url('{"alg":"RS256","typ":"JWT"}');
            $claims = Crypto::base64url(json_encode(['iss' => $account['clientEmail'], 'scope' => 'https://www.googleapis.com/auth/firebase.messaging', 'aud' => 'https://oauth2.googleapis.com/token', 'iat' => $now, 'exp' => $now + 3600], JSON_THROW_ON_ERROR));
            if (! openssl_sign($header.'.'.$claims, $signature, $account['privateKey'], OPENSSL_ALGO_SHA256)) {
                throw new Problem(503, 'firebase_invalid', 'کلید Firebase معتبر نیست');
            }
            $auth = Http::asForm()->timeout(15)->withoutRedirecting()->post('https://oauth2.googleapis.com/token', [
                'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer', 'assertion' => $header.'.'.$claims.'.'.Crypto::base64url($signature)]);
            $access = $auth->json('access_token');
            if (! $auth->successful() || ! is_string($access) || $access === '') {
                throw new Problem(503, 'push_auth_failed', 'احراز هویت سرویس اعلان ناموفق بود');
            }
            Cache::put($cacheKey, $access, max(1, min(3500, (int) $auth->json('expires_in', 3600) - 60)));
        }
        $message = ['token' => $token, 'data' => ['kind' => $kind]];
        if (str_starts_with($kind, 'campaign:')) {
            $campaign = $this->db->table('push_campaigns')->where('id', substr($kind, 9))->whereNull('deleted_at')->first();
            if (! $campaign) {
                throw new Problem(404, 'not_found', 'اعلان پیدا نشد');
            }
            $message['notification'] = ['title' => $campaign->title, 'body' => $campaign->body];
        }
        $sent = Http::withToken($access)->timeout(15)->withoutRedirecting()->post('https://fcm.googleapis.com/v1/projects/'.$project.'/messages:send', ['message' => $message]);
        if ($sent->status() === 401) {
            Cache::forget($cacheKey);
        }
        if (! $sent->successful() || ! is_string($sent->json('name'))) {
            $unregistered = array_any($sent->json('error.details', []), fn ($d) => ($d['errorCode'] ?? '') === 'UNREGISTERED');
            if ($unregistered) {
                $this->db->table('devices')->where('push_token', $token)->update(['revoked_at' => $this->db->raw('current_timestamp(6)')]);
            }
            throw new Problem(502, $unregistered ? 'push_unregistered' : 'push_unavailable', 'ارسال اعلان تأیید نشد');
        }
    }
}
