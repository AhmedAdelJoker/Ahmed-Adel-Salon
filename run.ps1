<#
.SYNOPSIS
    Runs SalonPro: backend (uvicorn, :8000) + frontend (vite, :5173).

.DESCRIPTION
    Starts both dev servers in one shot, in separate windows, and waits for
    each to answer before moving on — so the browser never opens onto a page
    whose API is not up yet.

    Ports follow the project rules: 5173 is the only frontend port (strictPort,
    so a clash fails loudly rather than silently drifting to 5174), and the
    backend is 8000. The vite proxy forwards /api and /ws to 8000, so the
    frontend itself never hardcodes the backend origin.

.PARAMETER BackendOnly
    Start only the backend.

.PARAMETER FrontendOnly
    Start only the frontend.

.PARAMETER Seed
    Seed the database before starting the backend (admin + demo data).

.PARAMETER Fresh
    Recreate the SQLite database before starting. Destructive: drops the file.

.PARAMETER Install
    Install backend requirements and frontend node_modules if missing.

.EXAMPLE
    .\run.ps1

.EXAMPLE
    .\run.ps1 -Fresh -Seed

.EXAMPLE
    .\run.ps1 -BackendOnly
#>
[CmdletBinding()]
param(
    [switch]$BackendOnly,
    [switch]$FrontendOnly,
    [switch]$Seed,
    [switch]$Fresh,
    [switch]$Install
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$backend = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'

$BACKEND_PORT = 8000
$FRONTEND_PORT = 5173

function Write-Step($msg)  { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)    { Write-Host "    $msg" -ForegroundColor DarkGray }
function Write-Bad($msg)   { Write-Host "!!! $msg" -ForegroundColor Red }
function Write-Warn($msg)  { Write-Host "    $msg" -ForegroundColor Yellow }

# Prefer the project venv so a stray global python never runs the wrong deps.
function Get-BackendPython {
    $venv = Join-Path $backend '.venv\Scripts\python.exe'
    if (Test-Path $venv) { return $venv }
    return 'python'
}

function Get-PortOwner([int]$Port) {
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    return $conn | Select-Object -First 1
}

function Test-Port([int]$Port) {
    return $null -ne (Get-PortOwner $Port)
}

function Wait-ForPort([int]$Port, [int]$TimeoutSec = 60, [string]$Label = 'service') {
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        if (Test-Port $Port) { return $true }
        Start-Sleep -Milliseconds 400
    }
    return $false
}

function Wait-ForHttp([string]$Url, [int]$TimeoutSec = 60) {
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
            if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { return $true }
        } catch {
            # Connection refused is the normal state while booting.
        }
        Start-Sleep -Milliseconds 500
    }
    return $false
}

function Assert-PortFree([int]$Port, [string]$Label) {
    if (Test-Port $Port) {
        $owner = Get-PortOwner $Port
        $procName = ''
        try { $procName = (Get-Process -Id $owner.OwningProcess -ErrorAction Stop).ProcessName } catch {}
        Write-Bad "$Label needs port $Port but it is already in use by $procName (PID $($owner.OwningProcess))."
        Write-Host "    Close that process, or stop the other instance first." -ForegroundColor Yellow
        exit 1
    }
}

# --------------------------------------------------------------------------- #
# Install (optional)
# --------------------------------------------------------------------------- #
if ($Install) {
    $py = Get-BackendPython
    Write-Step 'Installing backend requirements'
    & $py -m pip install -r (Join-Path $backend 'requirements.txt')

    Write-Step 'Installing frontend packages'
    Push-Location $frontend
    try { npm install } finally { Pop-Location }
}

# --------------------------------------------------------------------------- #
# Database
# --------------------------------------------------------------------------- #
$dbFile = Join-Path $backend 'salon_pro.db'

if ($Fresh) {
    Write-Step 'Recreating the database'
    foreach ($suffix in @('', '-wal', '-shm')) {
        $p = "$dbFile$suffix"
        if (Test-Path $p) {
            Remove-Item $p -Force
            Write-Ok "removed $(Split-Path $p -Leaf)"
        }
    }
}

if (-not $FrontendOnly) {
    $py = Get-BackendPython

    # Applies schema + seeds the first-run rows when the DB is empty.
    Write-Step 'Preparing the database'
    Push-Location $backend
    try {
        if ($Seed) {
            & $py -m app.db.seed
            if ($LASTEXITCODE -ne 0) {
                Write-Bad 'Seeding failed.'
                exit 1
            }
            Write-Ok 'seeded'
        } else {
            & $py -c "from app.db.runtime_schema import ensure_runtime_schema; from app.db.session import engine; from app.db.base import Base; Base.metadata.create_all(bind=engine); ensure_runtime_schema(); print('schema ready')"
            if ($LASTEXITCODE -ne 0) {
                Write-Bad 'Schema preparation failed.'
                exit 1
            }
            Write-Ok 'schema ready'
        }
    } finally {
        Pop-Location
    }
}

# --------------------------------------------------------------------------- #
# Backend
# --------------------------------------------------------------------------- #
$backendProc = $null

if (-not $FrontendOnly) {
    Assert-PortFree $BACKEND_PORT 'Backend'
    $py = Get-BackendPython
    Write-Step "Starting backend on :$BACKEND_PORT"

    $backendProc = Start-Process -FilePath $py `
        -ArgumentList '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', "$BACKEND_PORT" `
        -WorkingDirectory $backend `
        -PassThru `
        -RedirectStandardOutput (Join-Path $backend 'run-backend.out.log') `
        -RedirectStandardError  (Join-Path $backend 'run-backend.err.log')

    if (Wait-ForHttp "http://127.0.0.1:$BACKEND_PORT/" 90) {
        Write-Ok "backend is up (PID $($backendProc.Id))"
    } else {
        Write-Bad "backend did not answer on :$BACKEND_PORT within 90s."
        Write-Host '    Last lines of run-backend.err.log:' -ForegroundColor Yellow
        if (Test-Path (Join-Path $backend 'run-backend.err.log')) {
            Get-Content (Join-Path $backend 'run-backend.err.log') -Tail 25 |
                ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
        }
        if ($backendProc -and -not $backendProc.HasExited) { Stop-Process -Id $backendProc.Id -Force }
        exit 1
    }
}

# --------------------------------------------------------------------------- #
# Frontend
# --------------------------------------------------------------------------- #
$frontendProc = $null

if (-not $BackendOnly) {
    Assert-PortFree $FRONTEND_PORT 'Frontend'
    Write-Step "Starting frontend on :$FRONTEND_PORT"

    # npm needs the shim resolved through cmd on Windows, and vite needs the
    # project directory as its cwd.
    $frontendProc = Start-Process -FilePath 'npm.cmd' `
        -ArgumentList 'run', 'dev', '--', '--port', "$FRONTEND_PORT", '--strictPort' `
        -WorkingDirectory $frontend `
        -PassThru `
        -RedirectStandardOutput (Join-Path $frontend 'run-frontend.out.log') `
        -RedirectStandardError  (Join-Path $frontend 'run-frontend.err.log')

    if (Wait-ForHttp "http://localhost:$FRONTEND_PORT/" 90) {
        Write-Ok "frontend is up (PID $($frontendProc.Id))"
    } else {
        Write-Bad "frontend did not answer on :$FRONTEND_PORT within 90s."
        if (Test-Path (Join-Path $frontend 'run-frontend.err.log')) {
            Get-Content (Join-Path $frontend 'run-frontend.err.log') -Tail 25 |
                ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
        }
        if ($frontendProc -and -not $frontendProc.HasExited) { Stop-Process -Id $frontendProc.Id -Force }
        if ($backendProc -and -not $backendProc.HasExited) { Stop-Process -Id $backendProc.Id -Force }
        exit 1
    }
}

# --------------------------------------------------------------------------- #
# Summary
# --------------------------------------------------------------------------- #
Write-Host ''
Write-Host '  SalonPro is running' -ForegroundColor Green
Write-Host '  --------------------------------------------------'
if (-not $FrontendOnly) { Write-Host "  API      http://127.0.0.1:$BACKEND_PORT/docs" }
if (-not $BackendOnly)  { Write-Host "  App      http://localhost:$FRONTEND_PORT" }
Write-Host '  --------------------------------------------------'
Write-Host '  Logs     backend/run-backend.err.log' -ForegroundColor DarkGray
Write-Host '           frontend/run-frontend.err.log' -ForegroundColor DarkGray
Write-Host ''
Write-Host '  Press Ctrl+C to stop this script.' -ForegroundColor DarkGray
Write-Host '  Both servers keep running; close them from the terminal' -ForegroundColor DarkGray
Write-Host '  or run .\stop.ps1' -ForegroundColor DarkGray
Write-Host ''

# Keeps the script alive so the child processes are not orphaned silently;
# Ctrl+C reaches here and the finally block tears both down.
try {
    while ($true) {
        foreach ($proc in @($backendProc, $frontendProc)) {
            if ($proc -and $proc.HasExited) {
                Write-Warn "a server exited (PID $($proc.Id)); shutting the other down."
                throw 'child exited'
            }
        }
        Start-Sleep -Seconds 2
    }
} catch {
    # fall through to cleanup
} finally {
    Write-Host ''
    Write-Step 'Stopping'
    foreach ($proc in @($frontendProc, $backendProc)) {
        if ($proc -and -not $proc.HasExited) {
            try {
                # vite spawns a child; kill the tree so the port is really free.
                if ($proc.ProcessName -eq 'npm') {
                    taskkill /PID $proc.Id /T /F | Out-Null
                } else {
                    Stop-Process -Id $proc.Id -Force
                }
                Write-Ok "stopped $($proc.ProcessName) (PID $($proc.Id))"
            } catch {
                Write-Warn "could not stop PID $($proc.Id): $_"
            }
        }
    }
    Write-Host 'Stopped.' -ForegroundColor Cyan
}