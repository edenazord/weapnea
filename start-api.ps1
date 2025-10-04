# Starts the local API server connected to Postgres
param(
  [string]$PostgresUrl = "postgres://postgres:dev@127.0.0.1:5434/postgres",
  [int]$Port = 5174,
  [string]$ApiToken = "",
  [switch]$UseRenderDb
)

$script:ErrorActionPreference = 'Stop'

Write-Host "Starting API server..." -ForegroundColor Cyan

# If requested, read RENDER_EXTERNAL_DB_URL from .env and use it
if ($UseRenderDb) {
  try {
    $envPath = Join-Path $PSScriptRoot ".env"
    if (Test-Path $envPath) {
      $line = (Get-Content $envPath | Where-Object { $_ -match '^RENDER_EXTERNAL_DB_URL=' } | Select-Object -First 1)
      if ($line) {
        $val = $line -replace '^RENDER_EXTERNAL_DB_URL=', ''
        if ($val) {
          $PostgresUrl = $val.Trim()
          Write-Host "Using RENDER_EXTERNAL_DB_URL from .env" -ForegroundColor Yellow
        }
      }
    }
  } catch {
    Write-Warning "Could not read RENDER_EXTERNAL_DB_URL from .env: $_"
  }
}
$env:POSTGRES_URL = $PostgresUrl
$env:PORT = "$Port"
if ($ApiToken -ne "") { $env:API_TOKEN = $ApiToken }

# Ensure we run in the repo root
Set-Location -Path "$PSScriptRoot"

npm run api
