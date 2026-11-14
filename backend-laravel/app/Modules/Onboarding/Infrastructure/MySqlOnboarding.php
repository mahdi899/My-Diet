<?php

namespace App\Modules\Onboarding\Infrastructure;

use App\Modules\Onboarding\Application\OnboardingStore;
use App\Shared\Domain\LegacyCrypto as Crypto;
use Illuminate\Database\ConnectionInterface;

final class MySqlOnboarding implements OnboardingStore
{
    public function __construct(private ConnectionInterface $db) {}

    private function row(?object $row): ?array
    {
        if (! $row) {
            return null;
        }
        $row = (array) $row;
        foreach (['answers', 'risk_flags', 'allergens', 'conditions', 'safety_reasons', 'preferences'] as $column) {
            if (isset($row[$column])) {
                $row[$column] = json_decode($row[$column], false, 512, JSON_THROW_ON_ERROR);
                if ($row[$column] instanceof \stdClass) {
                    $row[$column] = (array) $row[$column];
                }
            }
        }

        return $row;
    }

    private function json(mixed $value): string
    {
        return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }

    public function transaction(string $user, \Closure $work): mixed
    {
        return $this->db->transaction(function () use ($user, $work): mixed {
            $this->db->table('users')->where('id', $user)->lockForUpdate()->first();

            return $work();
        });
    }

    public function draft(string $user): ?array
    {
        return $this->row($this->db->table('onboarding_drafts')->where('user_id', $user)->first());
    }

    public function saveDraft(string $user, ?string $track, array $answers, ?string $step, ?int $progress, ?string $source = null): array
    {
        $current = $this->draft($user);
        if (! $current) {
            $this->db->table('onboarding_drafts')->insert(['user_id' => $user, 'spec_version' => 2, 'track' => $track, 'answers' => $this->json((object) $answers),
                'step_key' => $step, 'progress' => $progress ?? 0, 'source' => $source ?? 'app']);
        } else {
            $values = ['spec_version' => 2, 'track' => $track, 'answers' => $this->json((object) $answers), 'version' => $current['version'] + 1, 'updated_at' => $this->db->raw('current_timestamp(6)')];
            if ($source !== null) {
                $values['source'] = $source;
            } else {
                if ($step !== null) {
                    $values['step_key'] = $step;
                }
                if ($progress !== null) {
                    $values['progress'] = $progress;
                }
            }
            $this->db->table('onboarding_drafts')->where('user_id', $user)->update($values);
        }

        return $this->draft($user);
    }

    public function latest(string $user): ?array
    {
        return $this->row($this->db->table('questionnaire_submissions')->where('user_id', $user)->orderByDesc('submitted_at')->first());
    }

    public function profile(string $user): ?array
    {
        return $this->row($this->db->table('nutrition_profiles')->where('user_id', $user)->first());
    }

    public function storeProfile(string $user, string $submission, string $source, array $profile, bool $consented): void
    {
        $p = $profile;
        $energy = $p['energy'];
        $row = ['user_id' => $user, 'submission_id' => $submission, 'spec_version' => 2, 'track' => $p['track'], 'goal' => $p['goal'], 'source' => $source, 'sex' => $p['sex'], 'age' => $p['age'],
            'height_cm' => $p['heightCm'], 'weight_kg' => $p['weightKg'], 'target_weight_kg' => $p['targetWeightKg'], 'activity' => $p['activity'], 'bmi' => $p['bmi'],
            'bmr_kcal' => $energy['bmrKcal'], 'tdee_kcal' => $energy['tdeeKcal'], 'target_kcal' => $energy['targetKcal'], 'protein_g' => $energy['proteinG'], 'carbs_g' => $energy['carbsG'], 'fat_g' => $energy['fatG'],
            'diet_style' => $p['dietStyle'], 'meals_per_day' => $p['mealsPerDay'], 'budget' => $p['budget'], 'region' => $p['region'],
            'allergens' => $this->json($p['allergens']), 'conditions' => $this->json($p['conditions']), 'risk_flags' => $this->json($p['riskFlags']), 'safety_tier' => $p['safety']['tier'],
            'safety_reasons' => $this->json($p['safety']['reasons']), 'preferences' => $this->json((object) $p['preferences']),
            'consented_at' => $consented ? gmdate('Y-m-d H:i:s') : null];
        $columns = array_keys($row);
        $updates = array_map(fn ($name) => '`'.$name.'`=incoming.`'.$name.'`', array_values(array_diff($columns, ['user_id', 'consented_at'])));
        $updates[] = 'consented_at=coalesce(nutrition_profiles.consented_at,incoming.consented_at)';
        $updates[] = 'updated_at=current_timestamp(6)';
        $this->db->statement('insert into nutrition_profiles(`'.implode('`,`', $columns).'`) values('.implode(',', array_fill(0, count($columns), '?')).') as incoming on duplicate key update '.implode(',', $updates), array_values($row));
        $this->db->table('nutrition_profile_history')->insert(['id' => Crypto::uuid(), 'user_id' => $user, 'submission_id' => $submission, 'weight_kg' => $p['weightKg'], 'target_kcal' => $energy['targetKcal'],
            'snapshot' => $this->json(['track' => $p['track'], 'bmi' => $p['bmi'], 'energy' => $energy, 'safety' => $p['safety']])]);
    }

    public function deleteDraft(string $user): void
    {
        $this->db->table('onboarding_drafts')->where('user_id', $user)->delete();
    }

    public function facts(string $submission, array $facts): void
    {
        foreach ($facts as $fact) {
            $row = ['submission_id' => $submission, 'question_key' => $fact['key'], 'value_code' => $fact['code'], 'value_num' => $fact['num']];
            if (! $this->db->table('onboarding_answer_facts')->where(['submission_id' => $submission, 'question_key' => $fact['key'], 'value_code' => $fact['code']])->exists()) {
                $this->db->table('onboarding_answer_facts')->insert($row);
            }
        }
    }

    public function consent(string $user): void
    {
        $this->db->table('nutrition_profiles')->where('user_id', $user)->whereNull('consented_at')->update(['consented_at' => $this->db->raw('current_timestamp(6)')]);
    }

    public function audit(string $user, string $action, string $type, string $id, array $detail): void
    {
        $this->db->table('audit_logs')->insert(['id' => Crypto::uuid(), 'actor_id' => $user, 'action' => $action, 'target_type' => $type, 'target_id' => $id, 'detail' => $this->json((object) $detail)]);
    }

    public function phone(string $user): ?string
    {
        return $this->db->table('users')->where('id', $user)->value('phone_e164');
    }

    public function lead(string $hash): ?array
    {
        return $this->row($this->db->table('demo_lead_submissions')->where('phone_hash', $hash)->whereNull('claimed_user_id')->orderByDesc('created_at')->lock('for update skip locked')->first());
    }

    public function claimLead(string $user, string $lead): void
    {
        $this->db->table('demo_lead_submissions')->where('id', $lead)->update(['claimed_user_id' => $user, 'claimed_at' => $this->db->raw('current_timestamp(6)'), 'phone_verified' => true]);
    }

    public function claimName(string $user, ?string $name): void
    {
        if ($name !== null && $name !== '') {
            $this->db->table('users')->where('id', $user)->whereNull('display_name')->update(['display_name' => $name]);
        }
        $this->db->table('users')->where('id', $user)->where('signup_channel', 'app')->update(['signup_channel' => 'demo']);
    }
}
