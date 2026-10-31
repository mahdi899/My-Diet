$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Test-Path -LiteralPath 'node_modules')) {
  npm ci
  if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed' }
}
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
node local-admin.mjs
