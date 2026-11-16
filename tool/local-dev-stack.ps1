# Sabzine local stack (XAMPP). Run from repo root: powershell -File tool/local-dev-stack.ps1 -Status
param(
    [switch]$Status,
    [switch]$StartMysql,
    [switch]$StartApi
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $root 'backend-laravel\.env'
$mysqlHome = 'C:\xampp\mysql84\mysql-8.4.9-winx64'
$mysqld = Join-Path $mysqlHome 'bin\mysqld.exe'
$ini = 'C:\xampp\mysql84\my.ini'

function Get-DotEnvValue([string]$name) {
    if (-not (Test-Path $envFile)) { return $null }
    $line = Select-String -Path $envFile -Pattern "^$name=" | Select-Object -First 1
    if (-not $line) { return $null }
    return ($line.Line -split '=', 2)[1].Trim()
}

if ($Status) {
    Write-Host "PHP: $(& php -v 2>$null | Select-Object -First 1)"
    Write-Host "DATABASE_URL: $(Get-DotEnvValue 'DATABASE_URL')"
    $p3306 = Get-NetTCPConnection -LocalPort 3306 -State Listen -ErrorAction SilentlyContinue
    Write-Host "Port 3306: $(if ($p3306) { 'listen' } else { 'down' })"
    Write-Host "MYSQL_HOME: $mysqlHome"
    try {
        $live = Invoke-WebRequest -Uri 'http://127.0.0.1:8000/health/ready' -UseBasicParsing -TimeoutSec 5
        Write-Host "API ready: $($live.Content)"
    } catch {
        Write-Host "API ready: (not reachable) $($_.Exception.Message)"
    }
    exit 0
}

if ($StartMysql) {
    if (-not (Test-Path $mysqld)) { throw "MySQL 8.4 not found at $mysqlHome" }
    if (Get-NetTCPConnection -LocalPort 3306 -State Listen -ErrorAction SilentlyContinue) {
        Write-Host 'MySQL already listening on 3306.'
        exit 0
    }
    Start-Process -FilePath $mysqld -ArgumentList "--defaults-file=$ini" -WindowStyle Hidden
    Write-Host 'Started MySQL 8.4 (C:\xampp\mysql84) on 127.0.0.1:3306.'
    exit 0
}

if ($StartApi) {
    Push-Location (Join-Path $root 'backend-laravel')
    php artisan serve --host=127.0.0.1 --port=8000
    exit $LASTEXITCODE
}

Write-Host @"
Sabzine — everything under XAMPP
  php -v          # 8.4 via C:\xampp\php
  -Status
  -StartMysql     # C:\xampp\mysql84
  -StartApi
"@