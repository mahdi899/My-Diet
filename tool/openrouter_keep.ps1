# Keeps the OpenRouter forwarder and the SSH tunnel alive for the production API.
$ErrorActionPreference = "Continue"
$mutex = New-Object System.Threading.Mutex($false, "Global\SabzineOpenRouterEgress")
if (-not $mutex.WaitOne(0)) { exit 0 }

$repo = "d:\sabzine\sabzine"
$python = "C:\Python315\python.exe"
$ssh = "C:\WINDOWS\System32\OpenSSH\ssh.exe"
$key = Join-Path $env:USERPROFILE ".ssh\id_ed25519"
$logDir = Join-Path $env:LOCALAPPDATA "Sabzine"
$log = Join-Path $logDir "openrouter-egress.log"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Write-Log([string]$message) {
    $line = "{0} {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $message
    Add-Content -Path $log -Value $line
}

function Test-Forwarder {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $wait = $client.BeginConnect("127.0.0.1", 18081, $null, $null)
        if (-not $wait.AsyncWaitHandle.WaitOne(500)) { return $false }
        $client.EndConnect($wait)
        return $client.Connected
    } catch {
        return $false
    } finally {
        $client.Close()
    }
}

function Start-Forwarder {
    if (Test-Forwarder) { return }
    Write-Log "starting forwarder"
    Start-Process -FilePath $python -ArgumentList "tool\openrouter_egress.py" -WorkingDirectory $repo -WindowStyle Hidden
    for ($i = 0; $i -lt 20; $i++) {
        if (Test-Forwarder) { return }
        Start-Sleep -Milliseconds 250
    }
    Write-Log "forwarder did not listen"
}

Write-Log "supervisor started"
while ($true) {
    Start-Forwarder
    Write-Log "connecting tunnel"
    & $ssh -i $key -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=15 -o ServerAliveCountMax=3 -o BatchMode=yes -R "172.18.0.1:18081:127.0.0.1:18081" root@87.107.190.112
    Write-Log "tunnel exited $LASTEXITCODE"
    Start-Sleep -Seconds 5
}
