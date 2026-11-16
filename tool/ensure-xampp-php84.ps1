# Keeps C:\xampp\php on PHP 8.4 (WinGet). Run after XAMPP updates that overwrite php\.
$ErrorActionPreference = 'Stop'
$wingetPhp = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Filter 'PHP.PHP.8.4_*' -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $wingetPhp) { throw 'PHP 8.4 WinGet package not found' }
$target = $wingetPhp.FullName
$xamppPhp = 'C:\xampp\php'
$current = Get-Item $xamppPhp -ErrorAction SilentlyContinue
if ($current.LinkType -eq 'Junction' -and ($current.Target -join '') -eq $target) {
    Write-Host "OK: $xamppPhp -> $target"
    & "$xamppPhp\php.exe" -v | Select-Object -First 1
    exit 0
}
if ($current -and $current.LinkType -ne 'Junction') {
    $backup = "C:\xampp\php-8.2.12-backup-$(Get-Date -Format yyyyMMdd)"
    if (-not (Test-Path $backup)) { Rename-Item $xamppPhp $backup.Split('\')[-1] -ErrorAction SilentlyContinue; Rename-Item $xamppPhp $backup -ErrorAction SilentlyContinue }
}
if (-not (Test-Path $xamppPhp)) {
    cmd /c mklink /J `"$xamppPhp`" `"$target`"
}
Write-Host "PHP 8.4 linked at $xamppPhp"
& "$xamppPhp\php.exe" -v | Select-Object -First 1