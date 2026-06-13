# Pinnacle Restaurant Manager — quick start (Windows)
Set-Location $PSScriptRoot

Write-Host "Installing dependencies..." -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Setting up database..." -ForegroundColor Cyan
npm run db:push
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Clearing stale build cache..." -ForegroundColor Cyan
npm run clean

Write-Host "Stopping old dev servers on port 3000..." -ForegroundColor Cyan
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

Write-Host ""
Write-Host "Starting app at http://localhost:3000" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop." -ForegroundColor Gray
Write-Host ""

Start-Sleep -Seconds 1
Start-Process "http://localhost:3000"
npm run dev
