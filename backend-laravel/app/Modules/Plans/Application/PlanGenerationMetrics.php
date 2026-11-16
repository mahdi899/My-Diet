<?php

namespace App\Modules\Plans\Application;

use Illuminate\Database\ConnectionInterface;

/**
 * Track and report metrics for plan generation quality and cost.
 */
final class PlanGenerationMetrics
{
    public function __construct(private ConnectionInterface $db) {}

    /**
     * Get detailed metrics for a specific request.
     */
    public function requestMetrics(string $requestId): array
    {
        $request = $this->db->table('plan_requests')->where('id', $requestId)->first();
        if (!$request) {
            return ['error' => 'Request not found'];
        }

        $generations = $this->db->table('ai_generations')
            ->where('request_id', $requestId)
            ->orderBy('attempt_no')
            ->get();

        $usage = $this->db->table('ai_usage_ledger')
            ->where('request_id', $requestId)
            ->get();

        $totalCost = $usage->sum('cost_micros');
        $totalTokens = $usage->sum(fn($u) => $u->tokens_in + $u->tokens_out);
        $inputTokens = $usage->sum('tokens_in');
        $outputTokens = $usage->sum('tokens_out');

        $attempts = [];
        foreach ($generations as $gen) {
            $genUsage = $usage->where('created_at', '>=', $gen->created_at);
            $attempts[] = [
                'attempt' => $gen->attempt_no,
                'status' => $gen->status,
                'skipped_reason' => $gen->skipped_reason,
                'model' => $gen->model,
                'tokens' => $gen->tokens,
                'cost_micros' => $gen->cost_micros,
                'cost_usd' => round($gen->cost_micros / 1_000_000, 4),
            ];
        }

        return [
            'request_id' => $requestId,
            'status' => $request->status,
            'user_id' => $request->user_id,
            'total_attempts' => count($generations),
            'total_cost_micros' => $totalCost,
            'total_cost_usd' => round($totalCost / 1_000_000, 4),
            'total_tokens' => $totalTokens,
            'input_tokens' => $inputTokens,
            'output_tokens' => $outputTokens,
            'attempts' => $attempts,
        ];
    }

    /**
     * Get aggregated metrics for a date range.
     */
    public function periodMetrics(string $from, string $to): array
    {
        $requests = $this->db->table('plan_requests')
            ->whereBetween('created_at', [$from, $to])
            ->count();

        $generations = $this->db->table('ai_generations')
            ->whereBetween('created_at', [$from, $to])
            ->get();

        $usage = $this->db->table('ai_usage_ledger')
            ->whereBetween('created_at', [$from, $to])
            ->where('task', 'plan_draft')
            ->get();

        $successful = $generations->where('status', 'drafted')->count();
        $failed = $generations->where('status', 'failed')->count();
        $skipped = $generations->where('status', 'skipped')->count();

        $totalCost = $usage->sum('cost_micros');
        $avgCostPerRequest = $successful > 0 ? $totalCost / $successful : 0;

        $outcomes = $usage->groupBy('outcome')->map(fn($group) => $group->count());

        return [
            'period' => ['from' => $from, 'to' => $to],
            'total_requests' => $requests,
            'successful' => $successful,
            'failed' => $failed,
            'skipped' => $skipped,
            'success_rate' => $requests > 0 ? round($successful / $requests * 100, 2) : 0,
            'total_cost_usd' => round($totalCost / 1_000_000, 4),
            'avg_cost_per_success_usd' => round($avgCostPerRequest / 1_000_000, 4),
            'total_tokens' => $usage->sum(fn($u) => $u->tokens_in + $u->tokens_out),
            'avg_tokens_per_call' => $usage->count() > 0 ? round($usage->sum(fn($u) => $u->tokens_in + $u->tokens_out) / $usage->count()) : 0,
            'outcomes' => $outcomes->toArray(),
        ];
    }

    /**
     * Estimate cost for a catalog size.
     */
    public function estimateCostForCatalog(int $catalogSize, int $mealsPerDay = 3): array
    {
        // Average food item after minimization: ~200 characters
        // With JSON overhead: ~250 chars per food
        $avgFoodsPerSlot = min(50, max(20, $catalogSize / 20));
        $slots = $mealsPerDay <= 2 ? 2 : ($mealsPerDay >= 4 ? 4 : 3);
        
        $totalFoods = $avgFoodsPerSlot * $slots;
        $promptSize = $totalFoods * 250; // characters
        $tokenEstimate = (int) ceil($promptSize / 3.5); // rough tokens
        
        // System prompt + user context: ~1000 tokens
        $inputTokens = $tokenEstimate + 1000;
        
        // Output: 7 days * meals * 2 options * ~200 tokens = ~2800 tokens
        $outputTokens = $slots * 7 * 2 * 200;
        
        // Using typical pricing: $3/M input, $15/M output (GPT-4 class)
        $costInput = ($inputTokens / 1_000_000) * 3;
        $costOutput = ($outputTokens / 1_000_000) * 15;
        $totalCost = $costInput + $costOutput;
        
        return [
            'catalog_size' => $catalogSize,
            'foods_sent_to_ai' => (int) $totalFoods,
            'estimated_input_tokens' => $inputTokens,
            'estimated_output_tokens' => $outputTokens,
            'estimated_cost_usd' => round($totalCost, 4),
            'note' => 'Estimates based on smart selection. Old approach would send ALL foods.',
        ];
    }
}
