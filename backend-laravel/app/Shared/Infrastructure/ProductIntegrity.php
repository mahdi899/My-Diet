<?php

namespace App\Shared\Infrastructure;

use Illuminate\Database\ConnectionInterface;

final class ProductIntegrity
{
    public function __construct(private ConnectionInterface $db) {}

    public function install(): void
    {
        $fail = fn (string $message): string => "signal sqlstate '45000' set message_text='".$message."';";
        foreach (['wallet_ledger' => 'wallet_ledger is append-only', 'meal_log_history' => 'meal history is append-only', 'meal_selection_history' => 'meal history is append-only'] as $table => $message) {
            foreach (['update', 'delete'] as $event) {
                $this->trigger($table, $event, $fail($message));
            }
        }
        $this->trigger('payments', 'update', 'if new.amount_toman<>old.amount_toman or new.amount_rial<>old.amount_rial or new.user_id<>old.user_id or new.package_code<>old.package_code then '.$fail('payment amount is immutable').' end if;');
        $this->trigger('plan_versions', 'update', "if old.status<>'draft' and not (old.status='published' and new.status='superseded' and new.request_id=old.request_id and new.version_number=old.version_number and new.lock_version=old.lock_version and (new.published_at<=>old.published_at)) then ".$fail('plan version is immutable').' end if;');
        foreach (['insert', 'update', 'delete'] as $event) {
            $ref = $event === 'delete' ? 'old' : 'new';
            $this->trigger('plan_days', $event, "select status into st from plan_versions where id=$ref.plan_version_id; if not(st<=>'draft') then ".$fail('plan content is immutable').' end if;', 'declare st varchar(32);');
            $this->trigger('plan_meals', $event, "select v.status into st from plan_days d join plan_versions v on v.id=d.plan_version_id where d.id=$ref.plan_day_id; if not(st<=>'draft') then ".$fail('plan content is immutable').' end if;', 'declare st varchar(32);');
            $this->trigger('plan_meal_items', $event, "select v.status into st from plan_meals m join plan_days d on d.id=m.plan_day_id join plan_versions v on v.id=d.plan_version_id where m.id=$ref.meal_id; if not(st<=>'draft') then ".$fail('plan content is immutable').' end if;', 'declare st varchar(32);');
            $oldFirst = $event === 'insert' ? 'new' : 'old';
            $move = $event === 'update' ? 'if old.meal_id<>new.meal_id then '.$fail('option cannot move').' end if;' : '';
            $this->trigger('plan_meal_options', $event, "select v.status into st from plan_meals m join plan_days d on d.id=m.plan_day_id join plan_versions v on v.id=d.plan_version_id where m.id=$oldFirst.meal_id; if not(st<=>'draft') then ".$fail('plan options are immutable').' end if;'.$move, 'declare st varchar(32);');
            $move = $event === 'update' ? 'if old.version_id<>new.version_id then '.$fail('context cannot move').' end if;' : '';
            $this->trigger('plan_version_context', $event, $move."select status into st from plan_versions where id=$oldFirst.version_id; if st<>'draft' then ".$fail('plan context is immutable').' end if;', 'declare st varchar(32);');
        }
        $this->trigger('weekly_rewards', 'delete', $fail('weekly reward is immutable'));
        $this->trigger('weekly_rewards', 'update', 'if new.id<>old.id or new.user_id<>old.user_id or new.request_id<>old.request_id or new.week_start<>old.week_start or new.amount_toman<>old.amount_toman or new.created_at<>old.created_at or (old.acknowledged_at is not null and not(new.acknowledged_at<=>old.acknowledged_at)) then '.$fail('weekly reward is immutable').' end if;');
        $this->trigger('questionnaire_submissions', 'delete', $fail('questionnaire submission is immutable'));
        $this->trigger('questionnaire_submissions', 'update', 'if coalesce(@sabzine_anonymize,0)<>1 or new.id<>old.id or new.user_id<>old.user_id then '.$fail('questionnaire submission is immutable').' end if;');
        $this->trigger('meal_logs', 'update', 'set new.revision=old.revision+1; if new.details=old.details and new.eaten<>old.eaten then set new.details=json_object(); end if;', '', 'before', 'revision');
        $source = json_decode(file_get_contents(base_path('contracts/postgres-schema.json')), true, 512, JSON_THROW_ON_ERROR);
        $columns = array_values(array_filter($source['tables'], fn ($table) => $table['name'] === 'meal_logs'))[0]['columns'];
        $json = function (string $ref) use ($columns): string {
            $fields = [];
            foreach ($columns as $column) {
                $value = "$ref.`".$column['name'].'`';
                if ($column['type'] === 'boolean') {
                    $value = "json_extract(if($value,'true','false'),'$')";
                } elseif ($column['type'] === 'timestamp with time zone') {
                    $value = "date_format($value,'%Y-%m-%dT%H:%i:%s.%fZ')";
                }
                $fields[] = "'".$column['name']."',".$value;
            }

            return 'json_object('.implode(',', $fields).')';
        };
        foreach (['insert', 'update'] as $event) {
            $this->trigger('meal_logs', $event, 'insert into meal_log_history(log_id,user_id,previous,current) values(new.id,new.user_id,'.($event === 'update' ? $json('old') : 'null').','.$json('new').');', '', 'after', 'history');
        }
    }

    private function trigger(string $table, string $event, string $body, string $declare = '', string $timing = 'before', string $suffix = 'integrity'): void
    {
        $name = substr($table.'_'.$event.'_'.$suffix, 0, 64);
        $this->db->unprepared("drop trigger if exists `$name`");
        $this->db->unprepared("create trigger `$name` $timing $event on `$table` for each row begin $declare if coalesce(@sabzine_import,0)=0 then $body end if; end");
    }
}
