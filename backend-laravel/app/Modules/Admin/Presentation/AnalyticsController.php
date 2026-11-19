<?php

namespace App\Modules\Admin\Presentation;

use App\Modules\Admin\Infrastructure\MySqlAnalytics;
use App\Shared\Domain\Problem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Validator;

final class AnalyticsController
{
    public function __construct(private MySqlAnalytics $analytics) {}

    public function report(Request $request): array
    {
        $days = (int) ($request->query('days') ?? '7');
        if (! in_array($days, [1, 7, 30, 90], true)) {
            throw new Problem(400, 'validation', 'بازهٔ گزارش معتبر نیست');
        }

        return $this->analytics->report($days, $this->campaign($request));
    }

    public function live(Request $request): array
    {
        return $this->analytics->live($this->campaign($request));
    }

    public function collect(Request $request): Response
    {
        abort_unless(app()->environment(['local', 'testing']), 404);
        $validator = Validator::make($request->all(), [
            'journey' => ['required', 'uuid'],
            'name' => ['required', 'in:pageview,step_view,step_time,active_heartbeat,presence_end,questionnaire_completed,phone_registered,otp_verified,goal_selected,start_clicked,question_interacted,back_clicked'],
            'page' => ['required', 'regex:~^/onboarding(?:/(?:goals|quiz|payment)?)?$~D'],
            'step' => ['required_unless:name,pageview', 'nullable', 'regex:/^(intro|goals|quiz|preparing|specialists|plans|contact|otp|payment|payment_gateway|payment_transfer|question:(weight_loss|weight_gain|pregnancy|detox):\d{1,3})$/D'],
            'goal' => ['nullable', 'in:weight_loss,weight_gain,pregnancy,detox'],
            'source' => ['nullable', 'regex:/^[a-zA-Z0-9_.-]{1,80}$/D'],
            'campaign' => ['nullable', 'max:64', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/D'],
            'activeMs' => ['nullable', 'integer', 'between:0,30000'],
        ]);
        if ($validator->fails()) {
            throw new Problem(422, 'validation', 'رویداد رهگیری معتبر نیست');
        }
        $this->analytics->collectLocal($validator->validated());

        return response()->noContent();
    }

    public function departures(Request $request): array
    {
        $from = $request->query('from');
        $to = $request->query('to');
        $within = $request->query('within');
        $hasFrom = is_string($from) && $from !== '';
        $hasTo = is_string($to) && $to !== '';
        $hasWithin = is_string($within) && $within !== '';
        $since = null;
        $until = null;
        if ($hasFrom || $hasTo || $hasWithin) {
            if ($hasWithin && ($hasFrom || $hasTo)) {
                throw new Problem(400, 'validation', 'بازهٔ زمانی معتبر نیست');
            }
            if ($hasWithin) {
                $hours = ['24h' => 24, '7d' => 168, '30d' => 720][$within] ?? null;
                if ($hours === null) {
                    throw new Problem(400, 'validation', 'بازهٔ زمانی معتبر نیست');
                }
                $since = gmdate('Y-m-d H:i:s', time() - $hours * 3600);
            } else {
                $start = strtotime(is_string($from) ? $from : '');
                $end = strtotime(is_string($to) ? $to : '');
                if ($start === false || $end === false) {
                    throw new Problem(400, 'validation', 'بازهٔ زمانی معتبر نیست');
                }
                if ($start >= $end) {
                    throw new Problem(400, 'validation', 'شروع بازه باید قبل از پایان آن باشد');
                }
                if ($end - $start > 90 * 86400 + 60) {
                    throw new Problem(400, 'validation', 'بازهٔ زمانی حداکثر ۹۰ روز است');
                }
                if ($end > time() + 300) {
                    throw new Problem(400, 'validation', 'پایان بازه نمی‌تواند در آینده باشد');
                }
                $since = gmdate('Y-m-d H:i:s', $start);
                $until = gmdate('Y-m-d H:i:s', $end);
            }
        }

        return $this->analytics->departures($this->campaign($request), $since, $until, $request->boolean('includePaid'));
    }

    public function reset(Request $request): JsonResponse
    {
        return response()->json($this->analytics->reset($request->attributes->get('actor')['id']), 201);
    }

    private function campaign(Request $request): ?string
    {
        $campaign = $request->query('campaign');
        if (! is_string($campaign) || $campaign === '') {
            return null;
        }
        if (! preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D', $campaign) || strlen($campaign) > 64) {
            throw new Problem(400, 'validation', 'لینک ورودی معتبر نیست');
        }

        return $campaign;
    }
}
