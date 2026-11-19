<?php

namespace App\Modules\Admin\Presentation;

use App\Modules\Admin\Domain\AdminRules;
use App\Modules\Admin\Infrastructure\MySqlAdminDesk;
use App\Modules\Money\Application\MoneyService;
use App\Modules\Plans\Domain\CivilDates;
use App\Modules\Publishing\Application\PublishingService;
use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;
use App\Shared\Presentation\StrictInput as Input;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AdminDeskController
{
    public function __construct(private MySqlAdminDesk $desk, private PublishingService $publishing, private MoneyService $money) {}

    public function createSpecialist(Request $request): JsonResponse
    {
        $body = Input::body($request, ['phone', 'displayName', 'firstName', 'lastName', 'birthDate', 'councilNo', 'education', 'portrait', 'credential', 'bio', 'capacity', 'username', 'password']);
        $capacity = array_key_exists('capacity', $body) && $body['capacity'] !== null ? $body['capacity'] : 20;
        if (! is_int($capacity) || $capacity < 0 || $capacity > 500) {
            throw new Problem(400, 'validation', 'ظرفیت درست نیست');
        }
        $first = Input::optional($body, 'firstName', 40);
        $display = $first !== null ? trim($first.' '.(Input::optional($body, 'lastName', 40) ?? '')) : Input::string($body, 'displayName', 80);
        if (Input::length($display) < 2 || Input::length($display) > 80) {
            throw new Problem(400, 'validation', 'نام پزشک درست نیست');
        }
        $education = Input::optional($body, 'education', 120) ?? Input::optional($body, 'credential', 120) ?? '';
        $council = ($body['councilNo'] ?? null) === null || $body['councilNo'] === '' ? '' : AdminRules::councilExact(Input::string($body, 'councilNo', 20));
        $phoneRaw = Input::string($body, 'phone', 32);
        $digits = preg_replace('/\D/', '', strtr($phoneRaw, array_combine(preg_split('//u', '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', -1, PREG_SPLIT_NO_EMPTY), str_split('01234567890123456789'))));
        if (! preg_match('/^09\d{9}$/', $digits)) {
            throw new Problem(400, 'validation', 'شماره تلفن باید ۱۱ رقم و با ۰۹ شروع شود');
        }
        $username = Input::optional($body, 'username', 32);
        $password = is_string($body['password'] ?? null) ? $body['password'] : null;
        if (($username === null) !== ($password === null || $password === '')) {
            throw new Problem(400, 'validation', 'نام کاربری و رمز عبور را با هم وارد کنید');
        }
        $hash = null;
        if ($username !== null && $password !== null) {
            $username = AdminRules::loginName($username);
            if (strlen($password) < 8 || strlen($password) > 256) {
                throw new Problem(400, 'validation', 'رمز عبور باید بین ۸ تا ۲۵۶ نویسه باشد');
            }
            $hash = Crypto::hashPassword($password, 8);
        }
        $birth = null;
        if (($body['birthDate'] ?? null) !== null && $body['birthDate'] !== '') {
            $birth = AdminRules::civil(Input::string($body, 'birthDate', 10), 'تاریخ تولد درست نیست');
            if ($birth < '1920-01-01' || $birth > CivilDates::today()) {
                throw new Problem(400, 'validation', 'تاریخ تولد درست نیست');
            }
        }
        $portrait = Input::optional($body, 'portrait', 180000) ?? '';
        if ($portrait !== '' && ! preg_match('/^data:image\/(?:jpeg|png);base64,[A-Za-z0-9+\/=]+$/D', $portrait)) {
            throw new Problem(400, 'validation', 'تصویر پروفایل درست نیست');
        }

        return response()->json($this->desk->createSpecialist($this->actor($request), [
            'phone' => Input::phone($digits), 'displayName' => $display, 'credential' => $education, 'bio' => Input::optional($body, 'bio', 500) ?? '',
            'capacity' => $capacity, 'councilNo' => $council, 'birthDate' => $birth, 'education' => $education, 'portrait' => $portrait,
            'username' => $username, 'passwordHash' => $hash,
        ]), 201);
    }

    public function updateSpecialist(Request $request, string $id): array
    {
        $body = Input::body($request, ['active', 'capacity', 'displayName', 'credential', 'bio', 'rating']);
        $rating = null;
        if (array_key_exists('rating', $body) && $body['rating'] !== null) {
            if (! is_int($body['rating']) && ! is_float($body['rating'])) {
                throw new Problem(400, 'validation', 'امتیاز باید بین ۰ و ۵ باشد');
            }
            $rating = round((float) $body['rating'], 2);
            if ($rating < 0 || $rating > 5) {
                throw new Problem(400, 'validation', 'امتیاز باید بین ۰ و ۵ باشد');
            }
        }
        if (array_key_exists('active', $body) && $body['active'] !== null && ! is_bool($body['active'])) {
            throw new Problem(400, 'validation', 'اطلاعات واردشده ناقص یا نادرست است');
        }

        return $this->desk->updateSpecialist($this->actor($request), Input::uuid($id), array_filter([
            'active' => is_bool($body['active'] ?? null) ? $body['active'] : null,
            'capacity' => is_int($body['capacity'] ?? null) ? $body['capacity'] : null,
            'displayName' => Input::optional($body, 'displayName', 80),
            'credential' => Input::optional($body, 'credential', 120),
            'bio' => Input::optional($body, 'bio', 500),
            'rating' => $rating,
        ], fn ($value) => $value !== null));
    }

    public function saveProfile(Request $request): array
    {
        $body = Input::body($request, ['displayName', 'credential', 'bio', 'councilNo', 'portrait', 'education']);
        $input = array_filter([
            'displayName' => Input::optional($body, 'displayName', 80),
        ], fn ($value) => $value !== null);
        foreach (['credential' => 120, 'bio' => 1000, 'education' => 120, 'portrait' => 180000] as $field => $limit) {
            if (isset($body[$field])) {
                $input[$field] = $body[$field] === '' ? '' : Input::string($body, $field, $limit);
            }
        }
        if (! empty($input['portrait']) && ! preg_match('/^data:image\/(?:jpeg|png);base64,[A-Za-z0-9+\/=]+$/D', $input['portrait'])) {
            throw new Problem(400, 'validation', 'تصویر باید JPEG یا PNG باشد');
        }
        if (array_key_exists('councilNo', $body)) {
            if (! is_string($body['councilNo'])) {
                throw new Problem(400, 'validation', 'شمارهٔ نظام درست نیست');
            }
            $input['councilNo'] = AdminRules::councilOptional($body['councilNo']);
        }

        return $this->desk->updateOwnProfile($this->actor($request), $input);
    }

    public function ownMembers(Request $request): array
    {
        return $this->desk->doctorMembers($this->actor($request), $request->query('progress') === '1');
    }

    public function ownMember(Request $request, string $userId): array
    {
        return $this->desk->doctorMember($this->actor($request), Input::uuid($userId));
    }

    public function removeOwnMember(Request $request, string $userId): array
    {
        $actor = $this->actor($request);

        return $this->desk->removeMember($actor, $actor, Input::uuid($userId));
    }

    public function ownMemberActivity(Request $request, string $userId): array
    {
        return $this->desk->doctorMemberActivity($this->actor($request), Input::uuid($userId));
    }

    public function members(Request $request, string $id): array
    {
        $available = $request->query('available');

        return $this->desk->members(Input::uuid($id), $available === '1' || $available === 'true');
    }

    public function addMember(Request $request, string $id): JsonResponse
    {
        $body = Input::body($request, ['userId']);

        return response()->json($this->desk->addMember($this->actor($request), Input::uuid($id), Input::uuid(is_string($body['userId'] ?? null) ? $body['userId'] : '')), 201);
    }

    public function removeMember(Request $request, string $id, string $userId): array
    {
        return $this->desk->removeMember($this->actor($request), Input::uuid($id), Input::uuid($userId));
    }

    public function assign(Request $request, string $id): JsonResponse
    {
        $body = Input::body($request, ['specialistId', 'reason']);

        return response()->json($this->desk->assign($this->actor($request), Input::uuid($id), Input::uuid(is_string($body['specialistId'] ?? null) ? $body['specialistId'] : ''), Input::string($body, 'reason', 200)), 201);
    }

    public function subscriptionPrices(): array
    {
        return $this->desk->subscriptionPrices();
    }

    public function subscriptionPrice(Request $request): array
    {
        $body = Input::body($request, ['planId', 'amountToman']);
        if (! is_int($body['amountToman'] ?? null)) {
            throw new Problem(400, 'validation', 'مبلغ درست نیست');
        }

        return $this->desk->setSubscriptionPrice($this->actor($request), Input::string($body, 'planId', 40), $body['amountToman']);
    }

    public function reward(Request $request): array
    {
        $body = Input::body($request, ['amountToman']);
        if (! is_int($body['amountToman'] ?? null)) {
            throw new Problem(400, 'validation', 'مبلغ درست نیست');
        }

        return $this->desk->setReward($this->actor($request), $body['amountToman']);
    }

    public function reviews(Request $request): array
    {
        $status = $request->query('status');
        if (! is_string($status)) {
            throw new Problem(400, 'validation', 'وضعیت نظر شناخته نشد');
        }

        return $this->desk->reviews($status);
    }

    public function moderate(Request $request, string $id): JsonResponse
    {
        $body = Input::body($request, ['status']);
        $status = Input::string($body, 'status', 20);
        if (! in_array($status, ['approved', 'rejected'], true)) {
            throw new Problem(400, 'validation', 'وضعیت نظر درست نیست');
        }

        return response()->json($this->desk->moderateReview($this->actor($request), Input::uuid($id), $status), 201);
    }

    public function ledger(Request $request): array
    {
        $user = $request->query('userId');

        return $this->desk->ledger(is_string($user) && $user !== '' ? Input::uuid($user) : null);
    }

    public function generations(): array
    {
        return $this->desk->generations();
    }

    public function executions(): array
    {
        return $this->desk->executions();
    }

    public function reconcile(Request $request, string $id): JsonResponse
    {
        $body = Input::body($request, ['costMicros', 'reason']);
        if (! is_int($body['costMicros'] ?? null)) {
            throw new Problem(400, 'validation', 'هزینه و دلیل بررسی معتبر نیست');
        }

        return response()->json($this->desk->reconcile($this->actor($request), Input::uuid($id), $body['costMicros'], Input::string($body, 'reason', 500)), 201);
    }

    public function user(string $id): array
    {
        return $this->desk->user(Input::uuid($id));
    }

    public function requests(): array
    {
        return $this->desk->requests();
    }

    public function support(): array
    {
        return $this->desk->support();
    }

    public function saveDaily(Request $request): array
    {
        $body = Input::body($request, ['date', 'body']);

        return $this->desk->saveDaily($this->actor($request), AdminRules::civil(Input::string($body, 'date', 10), 'تاریخ درست نیست'), Input::string($body, 'body', 500));
    }

    public function daily(Request $request): array
    {
        $date = $request->query('date');
        if (! is_string($date)) {
            throw new Problem(400, 'validation', 'تاریخ درست نیست');
        }

        return $this->desk->daily(AdminRules::civil($date, 'تاریخ درست نیست'));
    }

    public function users(): array
    {
        return $this->desk->users();
    }

    public function status(Request $request, string $id): JsonResponse
    {
        $body = Input::body($request, ['status']);
        $status = Input::string($body, 'status', 20);
        if (! in_array($status, ['active', 'suspended', 'pending'], true)) {
            throw new Problem(400, 'validation', 'وضعیت حساب درست نیست');
        }

        return response()->json($this->desk->setStatus($this->actor($request), Input::uuid($id), $status), 201);
    }

    public function deleteUser(Request $request, string $id): JsonResponse
    {
        $body = Input::body($request, ['confirmation']);
        if (Input::string($body, 'confirmation', 40) !== 'حذف حساب') {
            throw new Problem(400, 'validation', 'برای حذف حساب عبارت تأیید لازم است');
        }

        return response()->json($this->desk->deleteUser($this->actor($request), Input::uuid($id)), 201);
    }

    public function package(Request $request, string $id): array
    {
        $body = Input::body($request, ['daysRemaining']);
        if (! is_int($body['daysRemaining'] ?? null)) {
            throw new Problem(400, 'validation', 'تعداد روز درست نیست');
        }

        return $this->desk->setPackageDays($this->actor($request), Input::uuid($id), $body['daysRemaining']);
    }

    public function verification(Request $request, string $id): JsonResponse
    {
        $body = Input::body($request, ['status']);
        $status = Input::string($body, 'status', 20);
        if (! in_array($status, AdminRules::VERIFICATION, true)) {
            throw new Problem(400, 'validation', 'وضعیت تأیید درست نیست');
        }

        return response()->json($this->desk->setVerification($this->actor($request), Input::uuid($id), $status), 201);
    }

    public function controls(): array
    {
        return $this->desk->controls();
    }

    public function setControls(Request $request): array
    {
        $body = Input::body($request, ['killSwitch', 'dailyCostCapMicros']);
        $input = [];
        if (array_key_exists('killSwitch', $body)) {
            if (! is_bool($body['killSwitch'])) {
                throw new Problem(400, 'validation', 'اطلاعات واردشده ناقص یا نادرست است');
            }
            $input['killSwitch'] = $body['killSwitch'];
        }
        if (array_key_exists('dailyCostCapMicros', $body)) {
            if ($body['dailyCostCapMicros'] !== null && ! is_int($body['dailyCostCapMicros'])) {
                throw new Problem(400, 'validation', 'سقف هزینه درست نیست');
            }
            $input['dailyCostCapMicros'] = $body['dailyCostCapMicros'];
        }

        return $this->desk->setControls($this->actor($request), $input);
    }

    public function cost(): array
    {
        return $this->desk->cost();
    }

    public function adjust(Request $request): JsonResponse
    {
        $body = Input::body($request, ['userId', 'amountToman', 'direction', 'reason', 'referenceId']);
        $direction = Input::string($body, 'direction', 10);
        if (! in_array($direction, ['debit', 'credit'], true) || ! is_int($body['amountToman'] ?? null)) {
            throw new Problem(400, 'validation', 'جهت اصلاح درست نیست');
        }

        return response()->json($this->desk->adjust($this->actor($request), ['userId' => Input::uuid(is_string($body['userId'] ?? null) ? $body['userId'] : ''), 'amount' => $body['amountToman'], 'direction' => $direction, 'reason' => Input::string($body, 'reason', 500), 'referenceId' => Input::uuid(is_string($body['referenceId'] ?? null) ? $body['referenceId'] : '')]), 201);
    }

    public function dead(): array
    {
        return $this->desk->deadLetters();
    }

    public function retry(Request $request, string $id): JsonResponse
    {
        return response()->json($this->desk->retryDead($this->actor($request), Input::uuid($id)), 201);
    }

    public function maintenance(Request $request): JsonResponse
    {
        return response()->json($this->desk->maintenance($this->actor($request)), 201);
    }

    public function config(): array
    {
        $site = $this->publishing->config();

        return ['minAppVersion' => $site['minAppVersion'], 'download' => $site['download'], ...$this->money->catalog()];
    }

    private function actor(Request $request): string
    {
        return $request->attributes->get('actor')['id'];
    }
}
