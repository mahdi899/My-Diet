# Local app preview with auto-rebuild on save.
# Open http://127.0.0.1:8781/app/ in the browser and refresh after each build.
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Split-Path $here -Parent)
node (Join-Path $here 'preview_app_dev.cjs')
