<?php

namespace App\Shared\Domain;

use RuntimeException;

final class Problem extends RuntimeException
{
    public function __construct(public readonly int $status, public readonly string $problemCode, public readonly string $messageFa)
    {
        parent::__construct($messageFa);
    }

    public function body(): array
    {
        return ['status' => $this->status, 'code' => $this->problemCode, 'messageFa' => $this->messageFa,
            'retryable' => in_array($this->problemCode, ['dependency_outage', 'timeout', 'sms_unavailable', 'provider_rate_limited', 'rate_limited'], true)];
    }
}
