<?php

namespace Tests\Feature;

use App\Modules\Ai\Application\AiCatalog;
use App\Modules\Ai\Infrastructure\ConfiguredAiCatalog;
use App\Modules\Coach\Application\CoachModel;
use App\Modules\Coach\Infrastructure\ConfiguredCoachModel;
use App\Modules\Plans\Application\DraftProvider;
use App\Modules\Plans\Infrastructure\ConfiguredDraftProvider;
use App\Modules\Realtime\Application\PushSender;
use App\Modules\Realtime\Infrastructure\FcmPush;
use Tests\TestCase;

final class StandaloneRuntimeTest extends TestCase
{
    public function test_application_defaults_to_real_adapters_without_test_overrides(): void
    {
        self::assertInstanceOf(ConfiguredAiCatalog::class, app(AiCatalog::class));
        self::assertInstanceOf(ConfiguredCoachModel::class, app(CoachModel::class));
        self::assertInstanceOf(ConfiguredDraftProvider::class, app(DraftProvider::class));
        self::assertInstanceOf(FcmPush::class, app(PushSender::class));
        self::assertTrue(app(DraftProvider::class)->callsExternalNetwork());
        self::assertTrue(app(CoachModel::class)->callsExternalNetwork());
    }
}
