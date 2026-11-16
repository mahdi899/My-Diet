<?php

declare(strict_types=1);

use App\Shared\Domain\LegacyCrypto as Crypto;
use Illuminate\Contracts\Console\Kernel;

$root = dirname(__DIR__).'/backend-laravel';
require $root.'/vendor/autoload.php';
$app = require $root.'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

$username = $argv[1] ?? 'admin';
$password = $argv[2] ?? 'Sabzine-Admin-2026';
$phone = $argv[3] ?? '+989120000001';

$db = app(Illuminate\Database\ConnectionInterface::class);
$existing = $db->table('admin_credentials')->whereRaw('lower(username)=?', [strtolower($username)])->first();
if ($existing !== null) {
    fwrite(STDERR, "Admin username already exists: {$username}\n");
    exit(1);
}

$id = Crypto::uuid();
$hash = Crypto::hashPassword($password);

$db->transaction(function () use ($db, $id, $phone, $username, $hash): void {
    $db->table('users')->insert([
        'id' => $id,
        'phone_e164' => $phone,
        'role' => 'admin',
        'status' => 'active',
        'display_name' => 'مدیر سیستم',
    ]);
    $db->table('admin_credentials')->insert([
        'user_id' => $id,
        'username' => $username,
        'password_hash' => $hash,
        'failed_attempts' => 0,
        'locked_until' => null,
    ]);
});

echo "admin_user_id={$id}\nusername={$username}\n";