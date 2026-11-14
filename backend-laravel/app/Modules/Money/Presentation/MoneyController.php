<?php

namespace App\Modules\Money\Presentation;

use App\Modules\Money\Application\MoneyService;
use App\Shared\Domain\Problem;
use App\Shared\Presentation\StrictInput as Input;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class MoneyController
{
    public function __construct(private MoneyService $service) {}

    private function actor(Request $request): string
    {
        return $request->attributes->get('actor')['id'];
    }

    public function catalog(): array
    {
        return $this->service->catalog();
    }

    public function gateways(): array
    {
        return $this->service->gateways();
    }

    public function wallet(Request $request): array
    {
        return $this->service->wallet($this->actor($request));
    }

    public function subscription(Request $request): array
    {
        return $this->service->subscription($this->actor($request));
    }

    public function orders(Request $request): array
    {
        return $this->service->orders($this->actor($request));
    }

    public function startCheckout(Request $request): JsonResponse
    {
        $body = Input::body($request, ['serviceCode', 'expectedPriceToman', 'parentRequestId', 'gateway', 'planId']);
        $key = $request->header('idempotency-key', '');
        $expected = $body['expectedPriceToman'] ?? null;
        if (! preg_match('/^[A-Za-z0-9_-]{8,80}$/D', $key) || ! is_int($expected) || $expected < 0 || $expected > 900719925474099) {
            throw new Problem(400, 'validation', 'اطلاعات پرداخت معتبر نیست');
        }
        $parent = ($body['parentRequestId'] ?? null) === null ? null : Input::uuid(is_string($body['parentRequestId']) ? $body['parentRequestId'] : '');

        return response()->json($this->service->startCheckout($this->actor($request), $key, Input::string($body, 'serviceCode', 40), $expected, $parent, Input::optional($body, 'gateway', 40), Input::optional($body, 'planId', 40)), 201);
    }

    public function checkout(Request $request, string $id): array
    {
        return $this->service->checkoutStatus($this->actor($request), Input::uuid($id));
    }

    public function checkoutSandbox(Request $request, string $id): array
    {
        $payment = $this->service->checkoutStatus($this->actor($request), Input::uuid($id));
        if ($payment['gateway'] !== 'sandbox') {
            throw new Problem(404, 'not_found', 'پرداخت آزمایشی پیدا نشد');
        }
        $body = Input::body($request, ['success']);
        if (! is_bool($body['success'] ?? null)) {
            throw new Problem(400, 'validation', 'نتیجهٔ پرداخت معتبر نیست');
        }
        if (! $body['success']) {
            $this->service->failCheckout($id);

            return $this->service->checkoutStatus($this->actor($request), $id);
        }

        return $this->service->completeCheckout($id, 'sandbox');
    }

    public function checkoutCallback(Request $request, string $gateway): Response
    {
        $id = Input::uuid(is_string($request->query('paymentId')) ? $request->query('paymentId') : '');
        $outcome = $this->service->checkoutCallback($gateway, $id, is_string($request->query('Authority')) ? $request->query('Authority') : null, is_string($request->query('Status')) ? $request->query('Status') : null);
        $message = match ($outcome) {
            'paid' => 'پرداخت موفق بود و پلن شما فعال شد.',
            'failed' => 'پرداخت انجام نشد. برای تلاش دوباره به برنامه برگردید.',
            default => 'پرداخت در حال بررسی است. نتیجه در برنامه نمایش داده می‌شود.',
        };

        return response('<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>پرداخت پلن</title><body style="font-family:Tahoma,sans-serif;text-align:center;padding:48px;background:#f7f8f0;color:#233c2d"><h1>'.$message.'</h1><a href="sabzine://payment?status='.$outcome.'">بازگشت به برنامه</a></body></html>', 200, ['Content-Type' => 'text/html; charset=utf-8']);
    }

    public function ledger(Request $request): array
    {
        return $this->service->ledger($this->actor($request));
    }

    public function order(Request $request, string $id): array
    {
        return $this->service->order($this->actor($request), Input::uuid($id));
    }

    public function payment(Request $request, string $id): array
    {
        return $this->service->payment($this->actor($request), Input::uuid($id));
    }

    public function topup(Request $request): JsonResponse
    {
        $body = Input::body($request, ['packageCode', 'gateway']);

        return response()->json($this->service->topup($this->actor($request), Input::string($body, 'packageCode', 40), Input::optional($body, 'gateway', 40)), 201);
    }

    public function place(Request $request): JsonResponse
    {
        $body = Input::body($request, ['serviceCode', 'expectedPriceToman', 'parentRequestId']);
        $key = $request->header('idempotency-key', '');
        if (! preg_match('/^[A-Za-z0-9_-]{8,80}$/D', $key)) {
            throw new Problem(400, 'validation', 'کلید تکرار درخواست معتبر نیست');
        }
        $expected = $body['expectedPriceToman'] ?? null;
        if ((! is_int($expected) && ! is_float($expected)) || ! is_finite((float) $expected) || floor((float) $expected) !== (float) $expected || abs((float) $expected) > 9007199254740991) {
            throw new Problem(400, 'validation', 'اطلاعات واردشده ناقص یا نادرست است');
        }
        $parent = ($body['parentRequestId'] ?? null) === null ? null : Input::uuid(is_string($body['parentRequestId']) ? $body['parentRequestId'] : '');

        return response()->json($this->service->place($this->actor($request), $key, Input::string($body, 'serviceCode', 40), (int) $expected, $parent), 201);
    }

    public function cancel(Request $request, string $id): JsonResponse
    {
        return response()->json($this->service->cancel($this->actor($request), Input::uuid($id)), 201);
    }

    public function cancelRequest(Request $request, string $id): JsonResponse
    {
        return response()->json($this->service->cancelRequest($this->actor($request), Input::uuid($id)), 201);
    }

    public function compensate(Request $request, string $id): JsonResponse
    {
        return response()->json($this->service->cancel($this->actor($request), Input::uuid($id), true), 201);
    }

    public function sandbox(Request $request): JsonResponse
    {
        $body = Input::body($request, ['paymentId']);

        return response()->json($this->service->sandbox(Input::uuid(is_string($body['paymentId'] ?? null) ? $body['paymentId'] : '')), 201);
    }

    public function callback(Request $request, string $gateway): Response
    {
        $id = Input::uuid(is_string($request->query('paymentId')) ? $request->query('paymentId') : '');
        if ($gateway === 'sandbox') {
            return response()->json($this->service->sandbox($id));
        }
        $outcome = $this->service->hosted($gateway, $id, is_string($request->query('Authority')) ? $request->query('Authority') : null, is_string($request->query('Status')) ? $request->query('Status') : null);
        $messages = ['credited' => ['پرداخت موفق بود', 'کیف پولت شارژ شد. به برنامهٔ سبزینه برگرد.'],
            'failed' => ['پرداخت انجام نشد', 'اگه مبلغی کم شده، تا چند ساعت دیگه برمی‌گرده. به برنامه برگرد و دوباره تلاش کن.'],
            'pending' => ['در حال بررسی پرداخت', 'تأیید پرداخت کمی طول کشید. به برنامه برگرد؛ نتیجه همونجا نشون داده می‌شه.']];
        [$title,$message] = $messages[$outcome];
        $html = '<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'.$title.'</title><style>body{font-family:system-ui,Tahoma,sans-serif;background:#f7f8f0;color:#233c2d;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;text-align:center}main{max-width:380px}h1{font-size:22px}p{color:#76836e;line-height:2}a{display:inline-block;margin-top:16px;background:#205638;color:#fff;border-radius:14px;padding:12px 22px;text-decoration:none}</style></head><body><main><h1>'.$title.'</h1><p>'.$message.'</p><a href="sabzine://payment?status='.$outcome.'">بازگشت به سبزینه</a></main></body></html>';

        return response($html, 200, ['Content-Type' => 'text/html; charset=utf-8']);
    }
}
