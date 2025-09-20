# Starts the local API server connected to Postgres
param(
  [string]$PostgresUrl = "postgres://postgres:dev@127.0.0.1:5434/postgres",
  [int]$Port = 5174,
  [string]$ApiToken = ""
)

$script:ErrorActionPreference = 'Stop'

Write-Host "Starting API server..." -ForegroundColor Cyan
$env:POSTGRES_URL = $PostgresUrl
$env:PORT = "$Port"
if ($ApiToken -ne "") { $env:API_TOKEN = $ApiToken }

# Ensure we run in the repo root
Set-Location -Path "$PSScriptRoot"

npm run api
