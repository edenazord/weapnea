param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("frontend", "php", "static", "all")]
  [string]$Target,

  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

function Read-SftpConfig {
  $configPath = Join-Path -Path $PSScriptRoot -ChildPath ".vscode/sftp.json"
  if (!(Test-Path $configPath)) {
    throw "Config non trovata: $configPath"
  }
  try {
    $json = Get-Content $configPath -Raw | ConvertFrom-Json
  } catch {
    throw "Impossibile leggere .vscode/sftp.json: $($_.Exception.Message)"
  }
  return $json
}

function Get-WinSCPPath {
  $exe = "winscp.com"
  $exists = Get-Command $exe -ErrorAction SilentlyContinue
  if (-not $exists) {
    throw "winscp.com non trovato nel PATH. Installa WinSCP (https://winscp.net/) e assicurati che 'winscp.com' sia nel PATH."
  }
  return $exists.Path
}

function Invoke-Upload {
  param(
    [Parameter(Mandatory=$true)] [object]$Cfg,
    [Parameter(Mandatory=$true)] [array]$Items
  )

  # Se non è un dry-run, verifica la presenza di WinSCP
  $winscp = $null
  if (-not $DryRun) {
    $winscp = Get-WinSCPPath
  }

  $remoteHost = $Cfg.host
  $port = if ($Cfg.port) { [int]$Cfg.port } else { 22 }
  $user = $Cfg.username
  $pass = $Cfg.password
  $remote = ($Cfg.remotePath.TrimEnd('/'))

  # ATTENZIONE: -hostkey=* accetta qualunque host key. Valutare di fissare l'host key in produzione.
  $scriptLines = @(
    "option batch continue",
    "option confirm off"
  )
  $openCmd = ('open sftp://{0}:"{1}"@{2}:{3} -hostkey=*' -f $user, $pass, $remoteHost, $port)
  $scriptLines += $openCmd

  foreach ($item in $Items) {
    $local = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($item.Local)
    $remotePath = if ($item.Remote.StartsWith("/")) { $item.Remote } else { "$remote/$($item.Remote)" }
    $transfer = if ($item.Ascii) { "ascii" } else { "binary" }
    $opts = "-transfer=$transfer"
    if ($item.FileMask) {
      $opts = $opts + ' -filemask="' + $item.FileMask + '"'
    }

    $scriptLines += "put $opts `"$local`" `"$remotePath`""
  }

  $scriptLines += "exit"

  if ($DryRun) {
    Write-Host "[DRY-RUN] Script WinSCP generato:" -ForegroundColor Yellow
    $scriptLines | ForEach-Object { Write-Host "  $_" }
    return
  }

  $tempScript = New-TemporaryFile
  try {
    Set-Content -Path $tempScript -Value ($scriptLines -join [Environment]::NewLine) -Encoding ASCII
    & $winscp /ini=nul /script="$tempScript" | Write-Host
  } finally {
    Remove-Item $tempScript -Force -ErrorAction SilentlyContinue | Out-Null
  }
}

function Invoke-FrontendBuild {
  if ($DryRun) {
    Write-Host "[DRY-RUN] Salto la build frontend (npm run build)" -ForegroundColor Yellow
    return
  }
  Write-Host "Eseguo build frontend (npm run build)" -ForegroundColor Cyan
  $npmExe = $null
  $npmCmd = Get-Command "npm.cmd" -ErrorAction SilentlyContinue
  if ($npmCmd) { $npmExe = $npmCmd.Path } else {
    $npm = Get-Command "npm" -ErrorAction SilentlyContinue
    if ($npm) { $npmExe = $npm.Path }
  }
  if (-not $npmExe) {
    throw "npm non trovato nel PATH. Installa Node.js oppure aggiungi npm al PATH."
  }
  $proc = Start-Process -FilePath $npmExe -ArgumentList "run","build" -NoNewWindow -PassThru -Wait
  if ($proc.ExitCode -ne 0) {
    throw "Build fallita con codice $($proc.ExitCode)"
  }
}

# MAIN
$cfg = Read-SftpConfig

$items = @()

switch ($Target) {
  "frontend" {
    Invoke-FrontendBuild
    $items += @(
      @{ Local = "dist/index.html"; Remote = "index.html"; Ascii = $true },
      @{ Local = "dist/assets/*";  Remote = "assets/";    Ascii = $false }
    )
  }
  "static" {
    $items += @(
      @{ Local = "public/*"; Remote = "."; Ascii = $false }
    )
  }
  "php" {
    # Carica il contenuto di php/ nella root remota, escludendo vendor/ e storage/uploads/
    $items += @(
      @{ Local = "php/*"; Remote = "."; Ascii = $false; FileMask = "|vendor/;storage/uploads/" }
    )
  }
  "all" {
    Invoke-FrontendBuild
    $items += @(
      @{ Local = "dist/index.html"; Remote = "index.html"; Ascii = $true },
      @{ Local = "dist/assets/*";  Remote = "assets/";    Ascii = $false },
      @{ Local = "public/*";      Remote = ".";          Ascii = $false },
      @{ Local = "php/*";         Remote = ".";          Ascii = $false; FileMask = "|vendor/;storage/uploads/" }
    )
  }
}

if ($items.Count -eq 0) {
  throw "Nessun item da caricare per Target='$Target'"
}

Write-Host "Inizio upload "$Target" verso $($cfg.host):$($cfg.port) -> $($cfg.remotePath)" -ForegroundColor Green
Invoke-Upload -Cfg $cfg -Items $items
Write-Host "Completato." -ForegroundColor Green
