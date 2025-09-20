# Starts the Vite frontend (API mode by default)
param(
  [string]$ApiBaseUrl = 'http://localhost:5174',
  [string]$ApiToken = ''
)

$script:ErrorActionPreference = 'Stop'

Write-Host "Starting frontend (mode=api)..." -ForegroundColor Cyan
$env:VITE_BACKEND_MODE = 'api'
$env:VITE_API_BASE_URL = $ApiBaseUrl
if ($ApiToken -ne '') { $env:VITE_API_TOKEN = $ApiToken }

# Ensure we run in the repo root
Set-Location -Path "$PSScriptRoot"

npm run dev
