# Mirrors this workspace into the Flutter project folder Android Studio uses.

param(
    [string]$Source = "",
    [string]$Target = ""
)

$ErrorActionPreference = "Stop"

if (-not $Source) {
    $Source = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Find-AndroidStudioSabzineRoot {
    param([string]$Override)
    if ($Override -and (Test-Path -LiteralPath $Override)) {
        return (Resolve-Path -LiteralPath $Override).Path
    }

    $configPath = Join-Path $PSScriptRoot "android_studio_target.txt"
    if (Test-Path -LiteralPath $configPath) {
        $line = (Get-Content -LiteralPath $configPath -Encoding UTF8 | Select-Object -First 1).Trim()
        if ($line -and (Test-Path -LiteralPath $line)) {
            return (Resolve-Path -LiteralPath $line).Path
        }
    }

    $repos = Join-Path $env:USERPROFILE "source\repos"
    if (-not (Test-Path -LiteralPath $repos)) {
        return $null
    }

    foreach ($dir in Get-ChildItem -LiteralPath $repos -Directory) {
        $pubspec = Join-Path $dir.FullName "pubspec.yaml"
        if (-not (Test-Path -LiteralPath $pubspec)) { continue }
        $text = Get-Content -LiteralPath $pubspec -Raw -Encoding UTF8
        if ($text -match "name:\s*sabzine_flutter") {
            return $dir.FullName
        }
    }
    return $null
}

if (-not (Test-Path -LiteralPath $Source)) {
    Write-Error "Source not found: $Source"
}

$Target = Find-AndroidStudioSabzineRoot -Override $Target
if (-not $Target) {
    Write-Error @"
Android Studio sabzine folder not found.
Create tool/android_studio_target.txt with one line: full path to the project Android Studio opens
(or open source\repos\<your-sabzine-folder> once and add that path).
"@
}

Write-Host "Sync Cursor -> Android Studio"
Write-Host "  From: $Source"
Write-Host "  To:   $Target"

if ([string]::Equals((Resolve-Path -LiteralPath $Source).Path, (Resolve-Path -LiteralPath $Target).Path, [StringComparison]::OrdinalIgnoreCase)) {
    Write-Host "Source and target are the same project. Nothing to copy."
    exit 0
}

& robocopy $Source $Target /E /XJ /NFL /NDL /NJH /NJS /NC /NS /XD ".git" "build" ".dart_tool" ".gradle" "ephemeral" ".idea" "node_modules" "dist" "coverage" /XF "local.properties" ".flutter-plugins-dependencies" "*.iml" "generated_plugin_registrant.cc" "generated_plugin_registrant.h" "generated_plugins.cmake" | Out-Null
if ($LASTEXITCODE -gt 7) {
    Write-Error "robocopy failed with exit code $LASTEXITCODE"
}

Write-Host "Done. In Android Studio: Sync Gradle if needed, then Hot Restart or Stop + Run."

# Robocopy uses exit codes 0..7 for successful copies.
exit 0
