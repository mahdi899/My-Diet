<?php

namespace App\Modules\Onboarding\Infrastructure;

use App\Modules\Onboarding\Application\WebIntakeStore;
use Illuminate\Database\ConnectionInterface;

final class MySqlWebIntakes implements WebIntakeStore
{
    public function __construct(private ConnectionInterface $db) {}

    public function questionnaires(): array
    {
        $result = [];
        foreach ($this->db->table('demo_questionnaire_settings')->get() as $row) {
            $result[$row->goal] = json_decode($row->document, false, 512, JSON_THROW_ON_ERROR);
        }

        return $result;
    }

    public function saveQuestionnaire(string $goal, array $document): void
    {
        $this->db->table('demo_questionnaire_settings')->upsert(['goal' => $goal, 'document' => json_encode($document, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)], ['goal'], ['document']);
    }

    public function joinCommunity(string $completionId): int
    {
        return $this->db->transaction(function () use ($completionId): int {
            $inserted = $this->db->table('onboarding_community_completions')->insertOrIgnore(['completion_id' => $completionId]);
            if ($inserted > 0) {
                $this->db->statement("insert into app_settings (`key`,value) values ('demo.community_join_counter','1622') as incoming on duplicate key update value=cast(cast(app_settings.value as unsigned)+1 as json),version=app_settings.version+1,updated_at=current_timestamp(6)");
            }

            return (int) $this->db->table('app_settings')->where('key', 'demo.community_join_counter')->value('value');
        });
    }

    public function saveLead(array $lead): bool
    {
        return $this->db->transaction(function () use ($lead): bool {
            $this->db->statement('insert into demo_lead_submissions(id,phone_hash,phone_encrypted,goal,answers_encrypted,campaign_slug) values(?,?,?,?,?,?) as incoming on duplicate key update id=demo_lead_submissions.id',
                [$lead['id'], $lead['phone_hash'], $lead['phone_encrypted'], $lead['goal'], $lead['answers_encrypted'], $lead['campaign_slug']]);

            return $this->db->table('demo_lead_submissions')->where('id', $lead['id'])->where('phone_hash', $lead['phone_hash'])->exists();
        });
    }

    public function verifyLead(string $id, string $hash): bool
    {
        return $this->db->transaction(function () use ($id, $hash): bool {
            $row = $this->db->table('demo_lead_submissions')->where('id', $id)->where('phone_hash', $hash)->lockForUpdate()->first();
            if (! $row) {
                return false;
            }
            $this->db->table('demo_lead_submissions')->where('id', $id)->update(['phone_verified' => true]);

            return true;
        });
    }

    public function phone(string $user): ?string
    {
        return $this->db->table('users')->where('id', $user)->value('phone_e164');
    }

    public function linkJourney(string $id, string $user, string $phone): void
    {
        $this->db->statement('insert into onboarding_analytics_journeys(journey_id,user_id,phone_e164) values(?,?,?) as incoming on duplicate key update user_id=incoming.user_id,phone_e164=incoming.phone_e164,verified_at=current_timestamp(6)', [$id, $user, $phone]);
    }
}
