<#
.SYNOPSIS
    Stops whatever run.ps1 started: the frontend on :5173 and the backend on :8000.

.DESCRIPTION
    run.ps1 already tears its children down on Ctrl+C. This exists for the
    other cases: a terminal was closed, a machine was rebooted, or a server was
    started by hand and left behind.

    It kills whatever *listens* on the two project ports, which is more
    reliable than tracking PIDs — a PID recorded yesterday is meaningless after
    a reboot, but the port is still occupied.

.PARAMETER Force
    Do not ask for confirmation.
#>
[CmdletBinding()]
param([switch]$Force)

$ErrorActionPreference = 'Stop'

$targets = @(
    @{ Port = 5173; Label = 'frontend' },
    @{ Port = 8000; Label = 'backend'  }
)

function Get-Owners([int]$Port) {
    # OwningProcess can repeat across rows when a listener has children, so the
    # set is de-duplicated by PID.
    $pids = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique
    return @($pids | Where-Object { $_ })
}

function Stop-Tree([int]$ProcessId) {
    # npm/vite are parent-child chains; stopping the parent alone leaves the
    # child holding the port, which is the exact failure this script exists for.
    taskkill /PID $ProcessId /T /F 2>&1 | Out-Null
}

$found = @()
foreach ($t in $targets) {
    foreach ($pid_ in Get-Owners $t.Port) {
        $name = ''
        try { $name = (Get-Process -Id $pid_ -ErrorAction Stop).ProcessName } catch {}
        $found += [PSCustomObject]@{ Port = $t.Port; Label = $t.Label; PID = $pid_; Name = $name }
    }
}

if ($found.Count -eq 0) {
    Write-Host 'Nothing is listening on 5173 or 8000 — already stopped.' -ForegroundColor DarkGray
    exit 0
}

Write-Host ''
Write-Host 'Will stop:' -ForegroundColor Yellow
$found | ForEach-Object {
    Write-Host ("  {0,-9} :{1,-5} PID {2,-6} {3}" -f $_.Label, $_.Port, $_.PID, $_.Name)
}
Write-Host ''

if (-not $Force) {
    $answer = Read-Host 'Proceed? [y/N]'
    if ($answer -notmatch '^(y|yes)$') {
        Write-Host 'Cancelled.' -ForegroundColor DarkGray
        exit 0
    }
}

Write-Host ''
foreach ($row in $found) {
    Stop-Tree $row.PID
    Write-Host ("  stopped {0} (PID {1})" -f $row.Label, $row.PID) -ForegroundColor DarkGray
}

# Give the OS a moment to release the sockets before we claim victory.
Start-Sleep -Milliseconds 800

$remaining = @()
foreach ($t in $targets) {
    if (Get-Owners $t.Port) { $remaining += $t.Label }
}

if ($remaining.Count -gt 0) {
    Write-Host ''
    Write-Warn "still holding a port: $($remaining -join ', ')"
    exit 1
}

Write-Host ''
Write-Host 'All stopped.' -ForegroundColor Green