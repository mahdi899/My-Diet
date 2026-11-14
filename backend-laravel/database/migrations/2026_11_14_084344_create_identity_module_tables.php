<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** Identity and the minimal customer aggregates created atomically during OTP signup. */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            throw new RuntimeException('The Laravel backend targets MySQL 8.4 LTS.');
        }
        Schema::create('users', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('phone_e164', 32)->unique();
            $table->string('role', 16);
            $table->text('display_name')->nullable();
            $table->string('status', 16)->default('pending');
            $table->dateTime('created_at', 6)->useCurrent();
            $table->dateTime('deleted_at', 6)->nullable();
            $table->text('signup_channel')->default(DB::raw("('app')"));
        });
        DB::statement("alter table users add constraint users_role_check check(role in ('user','specialist','admin')), add constraint users_status_check check(status in ('active','suspended','deleted','pending'))");

        Schema::create('identity_mutexes', function (Blueprint $table): void {
            $table->char('lock_key', 64)->primary();
        });
        Schema::create('otp_challenges', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('phone_e164', 32);
            $table->char('code_hmac', 64);
            $table->string('ip', 64);
            $table->dateTime('expires_at', 6);
            $table->integer('attempts')->default(0);
            $table->dateTime('consumed_at', 6)->nullable();
            $table->dateTime('superseded_at', 6)->nullable();
            $table->dateTime('locked_at', 6)->nullable();
            $table->dateTime('created_at', 6)->useCurrent();
            $table->index(['phone_e164', 'created_at']);
            $table->index(['ip', 'created_at']);
        });
        DB::statement('alter table otp_challenges add constraint otp_attempts_check check(attempts>=0)');

        Schema::create('sessions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained('users');
            $table->dateTime('created_at', 6);
            $table->dateTime('absolute_expires_at', 6);
            $table->dateTime('revoked_at', 6)->nullable();
            $table->text('revoke_reason')->nullable();
            $table->text('platform')->nullable();
            $table->text('device_label')->nullable();
            $table->dateTime('last_seen_at', 6)->nullable();
            $table->index(['user_id', 'created_at']);
        });
        DB::statement('alter table sessions add constraint sessions_fixed_lifetime check(absolute_expires_at=date_add(created_at, interval 30 day))');

        Schema::create('refresh_tokens', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('session_id')->constrained('sessions');
            $table->char('token_hash', 64)->unique();
            $table->foreignUuid('parent_id')->nullable()->constrained('refresh_tokens');
            $table->dateTime('issued_at', 6)->useCurrent();
            $table->dateTime('expires_at', 6);
            $table->dateTime('used_at', 6)->nullable();
        });
        DB::unprepared("create trigger refresh_tokens_match_session before insert on refresh_tokens for each row
            begin
                declare session_expiry datetime(6);
                if coalesce(@sabzine_import,0)=0 then
                select absolute_expires_at into session_expiry from sessions where id=new.session_id;
                if session_expiry is null or new.expires_at<>session_expiry then
                    signal sqlstate '45000' set message_text='refresh token cannot extend the session';
                end if;
                end if;
            end");

        foreach (['admin_credentials', 'specialist_credentials'] as $name) {
            Schema::create($name, function (Blueprint $table): void {
                $table->foreignUuid('user_id')->primary()->constrained('users');
                $table->string('username', 255)->unique();
                $table->text('password_hash');
                $table->integer('failed_attempts')->default(0);
                $table->dateTime('locked_until', 6)->nullable();
            });
        }
        DB::statement('alter table specialist_credentials add constraint specialist_failed_attempts_check check(failed_attempts>=0)');

        Schema::create('staff_totp', function (Blueprint $table): void {
            $table->foreignUuid('user_id')->primary()->constrained('users');
            $table->text('secret_encrypted');
            $table->dateTime('confirmed_at', 6)->nullable();
            $table->dateTime('created_at', 6)->useCurrent();
        });
        Schema::create('totp_challenges', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained('users');
            $table->char('token_hash', 64)->unique();
            $table->text('device_label')->nullable();
            $table->text('platform')->nullable();
            $table->integer('attempts')->default(0);
            $table->dateTime('expires_at', 6);
            $table->dateTime('consumed_at', 6)->nullable();
            $table->dateTime('created_at', 6)->useCurrent();
        });
        DB::statement('alter table totp_challenges add constraint totp_attempts_check check(attempts>=0)');

        Schema::create('user_personal_details', function (Blueprint $table): void {
            $table->foreignUuid('user_id')->primary()->constrained('users')->cascadeOnDelete();
            $table->longText('details_encrypted');
        });

        Schema::create('wallets', function (Blueprint $table): void {
            $table->foreignUuid('user_id')->primary()->constrained('users');
            $table->bigInteger('cash_toman')->default(0);
            $table->bigInteger('promo_toman')->default(0);
            $table->integer('version')->default(1);
        });
        DB::statement('alter table wallets add constraint wallet_cash_check check(cash_toman>=0), add constraint wallet_promo_check check(promo_toman>=0)');

        Schema::create('specialist_profiles', function (Blueprint $table): void {
            $table->foreignUuid('user_id')->primary()->constrained('users');
            $table->text('display_name');
            $table->text('credential')->default(DB::raw("('')"));
            $table->text('bio')->default(DB::raw("('')"));
            $table->integer('capacity')->default(20);
            $table->boolean('active')->default(true);
            $table->string('medical_council_no', 255)->default('');
            $table->string('verification_status', 16)->default('verified');
            $table->date('birth_date')->nullable();
            $table->text('education')->default(DB::raw("('')"));
            $table->longText('portrait')->default(DB::raw("('')"));
            $table->decimal('rating', 3, 2)->nullable();
            $table->string('nonempty_council', 255)->nullable()->storedAs("nullif(medical_council_no,'')")->unique();
        });
        DB::statement("alter table specialist_profiles add constraint specialist_capacity_check check(capacity>=0), add constraint specialist_rating_check check(rating is null or rating between 0 and 5), add constraint specialist_verification_check check(verification_status in ('pending','verified','rejected','suspended'))");

        Schema::create('conversations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('kind', 16);
            $table->foreignUuid('user_id')->constrained('users');
            $table->uuid('request_id')->nullable();
            $table->dateTime('created_at', 6)->useCurrent();
        });
        DB::statement("alter table conversations add constraint conversation_kind_check check(kind in ('care','support'))");
        Schema::create('conversation_participants', function (Blueprint $table): void {
            $table->foreignUuid('conversation_id')->constrained('conversations');
            $table->foreignUuid('user_id')->constrained('users');
            $table->dateTime('last_read_at', 6)->nullable();
            $table->primary(['conversation_id', 'user_id']);
        });
    }

    public function down(): void
    {
        foreach (['conversation_participants', 'conversations', 'specialist_profiles', 'wallets', 'user_personal_details',
            'totp_challenges', 'staff_totp', 'specialist_credentials', 'admin_credentials', 'refresh_tokens', 'sessions',
            'otp_challenges', 'identity_mutexes', 'users'] as $name) {
            Schema::dropIfExists($name);
        }
    }
};
