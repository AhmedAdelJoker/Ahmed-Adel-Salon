#!/usr/bin/env pwsh
$ErrorActionPreference = "Stop"
$projectDir = "C:\Users\Ahmed\Downloads\Salon-Management-Pro\frontend"
$externalRoot = "C:\Users\Ahmed\Downloads\SalonPro_External"
$electronVersion = "44.0.0"
$cacheDir = "$env:USERPROFILE\.electron"
$electronExtractDir = "$cacheDir\electron-v$electronVersion-win32-x64"

Write-Host "=== Building SalonPro External ===" -ForegroundColor Green
Write-Host "External root: $externalRoot" -ForegroundColor Cyan

# clean external app folder only (keep Data/updates)
$appDir = "$externalRoot\app"
if (Test-Path $appDir) { Remove-Item -Recurse -Force $appDir -ErrorAction SilentlyContinue }
New-Item -ItemType Directory -Force -Path $appDir | Out-Null
New-Item -ItemType Directory -Force -Path "$externalRoot\Data\data\uploads" | Out-Null
New-Item -ItemType Directory -Force -Path "$externalRoot\updates\pending" | Out-Null
New-Item -ItemType Directory -Force -Path "$externalRoot\backups" | Out-Null

# ensure electron cached
if (-not (Test-Path $electronExtractDir)) {
    Write-Host "Downloading Electron..." -ForegroundColor Yellow
    $zip = "$cacheDir\electron-v$electronVersion-win32-x64.zip"
    Invoke-WebRequest -Uri "https://github.com/electron/electron/releases/download/v$electronVersion/electron-v$electronVersion-win32-x64.zip" -OutFile $zip -UseBasicParsing
    Expand-Archive -Path $zip -DestinationPath $electronExtractDir -Force
}

Write-Host "Copying Electron..." -ForegroundColor Yellow
Copy-Item -Path "$electronExtractDir\*" -Destination $appDir -Recurse -Force
if (Test-Path "$appDir\electron.exe") { Rename-Item -Path "$appDir\electron.exe" -NewName "SalonPro.exe" -Force }

# copy frontend dist + electron files to resources/app
$resourcesApp = "$appDir\resources\app"
New-Item -ItemType Directory -Force -Path $resourcesApp | Out-Null
Write-Host "Copying frontend dist..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "$resourcesApp\build" | Out-Null
Copy-Item -Path "$projectDir\dist\*" -Destination $resourcesApp -Recurse -Force
Copy-Item -Path "$projectDir\electron-main.cjs" -Destination $resourcesApp -Force
Copy-Item -Path "$projectDir\electron-preload.cjs" -Destination $resourcesApp -Force
Copy-Item -Path "$projectDir\build\icon.ico" -Destination "$resourcesApp\build\icon.ico" -Force -ErrorAction SilentlyContinue
Copy-Item -Path "$projectDir\build\icon.png" -Destination "$resourcesApp\build\icon.png" -Force -ErrorAction SilentlyContinue

# package.json for app
$pkg = Get-Content "$projectDir\package.json" | ConvertFrom-Json
$pkg.PSObject.Properties.Remove('devDependencies')
$pkg.PSObject.Properties.Remove('scripts')
$pkg.main = "electron-main.cjs"
$pkg | ConvertTo-Json -Depth 10 | Set-Content "$resourcesApp\package.json" -Encoding UTF8

# copy backend.exe standalone
$backendExe = "C:\Users\Ahmed\Downloads\Salon-Management-Pro\backend\dist\backend.exe"
$backendDest = "$resourcesApp\backend"
New-Item -ItemType Directory -Force -Path $backendDest | Out-Null
if (Test-Path $backendExe) {
    Write-Host "Copying backend.exe (76 MB)..." -ForegroundColor Yellow
    Copy-Item -Path $backendExe -Destination "$backendDest\backend.exe" -Force
    # copy alembic + .env template if needed
    Copy-Item -Path "C:\Users\Ahmed\Downloads\Salon-Management-Pro\backend\alembic" -Destination "$backendDest\alembic" -Recurse -Force -ErrorAction SilentlyContinue
    Copy-Item -Path "C:\Users\Ahmed\Downloads\Salon-Management-Pro\backend\alembic.ini" -Destination "$backendDest\alembic.ini" -Force -ErrorAction SilentlyContinue
} else {
    Write-Host "backend.exe not found, copying source as fallback" -ForegroundColor Yellow
    Copy-Item -Path "C:\Users\Ahmed\Downloads\Salon-Management-Pro\backend\app" -Destination "$backendDest\app" -Recurse -Force
}

# create version.json for updater
$ver = ($pkg.version)
@{ version = $ver; notes = "SalonPro External build $ver"; date = (Get-Date -Format "yyyy-MM-dd") } | ConvertTo-Json | Set-Content "$externalRoot\updates\version.json" -Encoding utf8NoBOM

# README
@"
SalonPro External - المجلد الخارجي بره المشروع
=====================================
التشغيل: شغّل app\SalonPro.exe
البيانات: Data\data\ (salon_pro.db + uploads)
التحديثات: ضع ملفات جديدة في updates\pending\ وحدّث updates\version.json ثم أعد التشغيل
المشروع الأصلي: Salon-Management-Pro (source فقط - لا تلمسه)

للتحديث السريع:
- pending: انسخ ملفات assets الجديدة من dist\ الى updates\pending\assets\
- version.json: غيّر version لرقم أعلى
- شغّل البرنامج -> سيظهر حوار التحديث
"@ | Set-Content "$externalRoot\README.txt" -Encoding UTF8

# launcher bat at root
@"
@echo off
start "" "%~dp0app\SalonPro.exe"
"@ | Set-Content "$externalRoot\SalonPro.bat" -Encoding ASCII -Force

Write-Host "External build done!" -ForegroundColor Green
Get-ChildItem "$externalRoot" -Recurse | Measure-Object | Select-Object Count
Write-Host "App: $appDir\SalonPro.exe" -ForegroundColor Cyan
Write-Host "Data: $externalRoot\Data" -ForegroundColor Cyan
Write-Host "Updates: $externalRoot\updates" -ForegroundColor Cyan
