# Launch API and Frontend in separate PowerShell windows
param(
  [string]$PostgresUrl = 'postgres://postgres:dev@127.0.0.1:5434/postgres',
  [int]$ApiPort = 5174,
  [string]$ApiBaseUrl = 'http://localhost:5174',
  [string]$ApiToken = ''
)

$script:ErrorActionPreference = 'Stop'

# Ensure root
Set-Location -Path $PSScriptRoot

# Start API window
$apiCmd = @(
  '-NoExit',
  '-Command',
  "& { `$env:POSTGRES_URL='$PostgresUrl'; `$env:PORT='$ApiPort'; ${(($ApiToken -ne '') ? "`$env:API_TOKEN='$ApiToken'; " : '')}npm run api }"
)
Start-Process -FilePath 'powershell.exe' -ArgumentList $apiCmd -WindowStyle Normal -WorkingDirectory $PSScriptRoot

# Start Frontend window (api mode only)
$frontCmd = @(
  '-NoExit',
  '-Command',
  "& { `$env:VITE_BACKEND_MODE='api'; `$env:VITE_API_BASE_URL='$ApiBaseUrl'; ${(($ApiToken -ne '') ? "`$env:VITE_API_TOKEN='$ApiToken'; " : '')}npm run dev }"
)
Start-Process -FilePath 'powershell.exe' -ArgumentList $frontCmd -WindowStyle Normal -WorkingDirectory $PSScriptRoot

Write-Host "Started API (port=$ApiPort) and Frontend (mode=$Mode)" -ForegroundColor Green
