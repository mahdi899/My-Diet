<?php

namespace App\Shared\Presentation;

use App\Shared\Domain\Problem;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

final class ProblemRenderer
{
    public static function render(Throwable $error): JsonResponse
    {
        if ($error instanceof Problem) {
            return response()->json($error->body(), $error->status);
        }
        $status = $error instanceof HttpExceptionInterface ? $error->getStatusCode() : 500;
        [$code, $message] = match ($status) {
            400 => ['validation', 'اطلاعات واردشده ناقص یا نادرست است'],
            401 => ['unauthorized', 'نشست معتبر نیست'],
            403 => ['forbidden', 'اجازهٔ این کار را ندارید'],
            404 => ['not_found', 'یافت نشد'],
            409 => ['conflict', 'این کار با وضعیت فعلی نمی‌خواند'],
            429 => ['rate_limited', 'تعداد درخواست بیش از حد است'],
            502, 503 => ['dependency_outage', 'سرویس وابسته در دسترس نیست'],
            504 => ['timeout', 'پاسخ سرویس به‌موقع نرسید'],
            default => ['internal', 'خطای داخلی رخ داد'],
        };
        $problem = new Problem($status, $code, $message);
        return response()->json($problem->body(), $status);
    }
}
