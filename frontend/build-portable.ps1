#!/usr/bin/env pwsh
# Manual portable build for Electron app - avoids electron-builder Windows Defender issues

$ErrorActionPreference = "Stop"

$projectDir = $PSScriptRoot
$outputDir = "$projectDir\dist-electron\Salon Management Pro-win32-x64"
$electronVersion = "44.0.0"
$electronUrl = "https://github.com/electron/electron/releases/download/v$electronVersion/electron-v$electronVersion-win32-x64.zip"

Write-Host "Building portable Electron app..." -ForegroundColor Green

# Clean output
if (Test-Path $outputDir) {
    Remove-Item -Recurse -Force $outputDir
}
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

# Download Electron if not cached
$cacheDir = "$env:USERPROFILE\.electron"
$electronZip = "$cacheDir\electron-v$electronVersion-win32-x64.zip"
$electronExtractDir = "$cacheDir\electron-v$electronVersion-win32-x64"

if (-not (Test-Path $electronExtractDir)) {
    Write-Host "Downloading Electron v$electronVersion..." -ForegroundColor Yellow
    if (-not (Test-Path $cacheDir)) {
        New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null
    }
    Invoke-WebRequest -Uri $electronUrl -OutFile $electronZip -UseBasicParsing
    
    Write-Host "Extracting Electron..." -ForegroundColor Yellow
    Expand-Archive -Path $electronZip -DestinationPath $electronExtractDir -Force
}

# Copy Electron files
Write-Host "Copying Electron files..." -ForegroundColor Yellow
Copy-Item -Path "$electronExtractDir\*" -Destination $outputDir -Recurse -Force

# Rename electron.exe to app name
Rename-Item -Path "$outputDir\electron.exe" -NewName "$outputDir\Salon Management Pro.exe" -Force

# Copy app files
Write-Host "Copying app files..." -ForegroundColor Yellow
$resourcesDir = "$outputDir\resources"
New-Item -ItemType Directory -Force -Path $resourcesDir | Out-Null

# Copy frontend dist
Copy-Item -Path "$projectDir\dist" -Destination "$resourcesDir\app" -Recurse -Force

# Copy Electron main and preload
Copy-Item -Path "$projectDir\electron-main.cjs" -Destination "$resourcesDir\app\electron-main.cjs" -Force
Copy-Item -Path "$projectDir\electron-preload.cjs" -Destination "$resourcesDir\app\electron-preload.cjs" -Force

# Copy package.json (without devDependencies)
$packageJson = Get-Content "$projectDir\package.json" | ConvertFrom-Json
$packageJson.PSObject.Properties.Remove('devDependencies')
$packageJson.PSObject.Properties.Remove('scripts')
$packageJson.main = "electron-main.cjs"
$packageJson | ConvertTo-Json -Depth 10 | Set-Content "$resourcesDir\app\package.json" -Encoding UTF8

# Copy backend (Python source for now - will need PyInstaller build separately)
$backendSource = Join-Path $projectDir "..\backend"
$backendDest = "$resourcesDir\app\backend"
if (Test-Path $backendSource) {
    Copy-Item -Path $backendSource -Destination $backendDest -Recurse -Force
    # Remove unnecessary files
    Get-ChildItem -Path $backendDest -Recurse -Force -Include ".env", ".env.*", "__pycache__", "*.pyc", "*.pyo", ".pytest_cache", ".venv", "uploads", "logs", "*.db", "*.db-*", "*.sqlite", "*.sqlite3", "*.log" | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}

# Create a simple launcher batch file
$launcher = @"
@echo off
cd /d "%~dp0"
start "" "Salon Management Pro.exe"
"@
Set-Content -Path "$outputDir\Salon Management Pro.bat" -Value $launcher -Encoding ASCII

Write-Host "Portable build complete!" -ForegroundColor Green
Write-Host "Output: $outputDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "Note: The backend needs to be built separately with PyInstaller." -ForegroundColor Yellow
Write-Host "Run: cd ..\backend && pyinstaller --clean backend.spec" -ForegroundColor Yellow
Write-Host "Then copy the dist/backend folder to: $resourcesDir\app\backend" -ForegroundColor Yellow