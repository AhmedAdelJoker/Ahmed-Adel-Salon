param(
    [switch]$KeepStack
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker CLI is not installed or is not on PATH."
}

& docker compose config --quiet
if ($LASTEXITCODE -ne 0) {
    throw "Docker Compose configuration is invalid."
}

$existing = @(& docker compose ps -q)
$started = $false

try {
    & docker compose up -d --build
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose failed to start the stack."
    }
    $started = $true

    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        try {
            $backend = Invoke-WebRequest -Uri "http://localhost:8000/" -UseBasicParsing -TimeoutSec 5
            $frontend = Invoke-WebRequest -Uri "http://localhost/" -UseBasicParsing -TimeoutSec 5
            if ($backend.StatusCode -eq 200 -and $frontend.StatusCode -eq 200) {
                $ready = $true
                break
            }
        }
        catch {
        }
        Start-Sleep -Seconds 2
    }

    if (-not $ready) {
        & docker compose logs --no-color backend frontend
        throw "The application did not become ready before the timeout."
    }

    & docker compose ps
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose status check failed."
    }
}
finally {
    if ($started -and -not $KeepStack -and $existing.Count -eq 0) {
        & docker compose down
    }
}
