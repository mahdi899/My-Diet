<?php

namespace App\Modules\Plans\Presentation;

use App\Modules\Plans\Application\PlanChanges;
use App\Shared\Domain\Problem;
use App\Shared\Presentation\StrictInput;
use Illuminate\Http\Request;

final class PlanChangeController
{
    public function __construct(private PlanChanges $changes) {}

    public function reasons(): array
    {
        return $this->changes->reasons(true);
    }

    public function submit(Request $request): array
    {
        return $this->changes->submit($this->actor($request), $this->object($request));
    }

    public function mine(Request $request): array
    {
        return $this->changes->mine($this->actor($request));
    }

    public function one(Request $request, string $id): array
    {
        return $this->changes->customer($this->actor($request), StrictInput::uuid($id));
    }

    public function reply(Request $request, string $id): array
    {
        return $this->changes->reply($this->actor($request), StrictInput::uuid($id), $this->object($request));
    }

    public function queue(Request $request): array
    {
        return $this->changes->queue($this->actor($request));
    }

    public function staff(Request $request, string $id): array
    {
        return $this->changes->staff($this->actor($request), StrictInput::uuid($id));
    }

    public function review(Request $request, string $id): array
    {
        return $this->changes->review($this->actor($request), StrictInput::uuid($id));
    }

    public function reject(Request $request, string $id): array
    {
        return $this->changes->reject($this->actor($request), StrictInput::uuid($id), $this->object($request));
    }

    public function clarify(Request $request, string $id): array
    {
        return $this->changes->clarify($this->actor($request), StrictInput::uuid($id), $this->object($request));
    }

    public function approve(Request $request, string $id): array
    {
        $match = $request->header('if-match', '');
        if (! preg_match('/^[0-9]+$/D', $match)) {
            throw new Problem(400, 'validation', 'نسخهٔ ویرایش لازم است');
        }

        return $this->changes->approve($this->actor($request), StrictInput::uuid($id), (int) $match);
    }

    public function allReasons(): array
    {
        return $this->changes->reasons(false);
    }

    public function updateReason(Request $request, string $id): array
    {
        return $this->changes->updateReason($id, $this->object($request));
    }

    private function actor(Request $request): string
    {
        return $request->attributes->get('actor')['id'];
    }

    private function object(Request $request): array
    {
        try {
            $body = json_decode($request->getContent(), true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new Problem(400, 'validation', 'اطلاعات درخواست کامل نیست');
        }
        if (! is_array($body) || array_is_list($body)) {
            throw new Problem(400, 'validation', 'اطلاعات درخواست کامل نیست');
        }

        return $body;
    }
}
