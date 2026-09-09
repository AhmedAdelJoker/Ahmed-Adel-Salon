$projectDir = "C:\Users\Ahmed\Downloads\Salon-Management-Pro\frontend"
$outputDir = "$projectDir\dist-electron\SalonPro-Portable"
$electronVersion = "44.0.0"
$cacheDir = "$env:USERPROFILE\.electron"
$electronExtractDir = "$cacheDir\electron-v$electronVersion-win32-x64"

if (Test-Path $outputDir) {
    Write-Host "Cleaning $outputDir"
    try { Remove-Item -Recurse -Force $outputDir -ErrorAction Stop } catch { Write-Host "Clean failed, overwriting..." }
}
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
New-Item -ItemType Directory -Force -Path "$outputDir\resources\app" | Out-Null

Write-Host "Copying Electron..."
Copy-Item -Path "$electronExtractDir\*" -Destination $outputDir -Recurse -Force
if (Test-Path "$outputDir\electron.exe") {
    Rename-Item -Path "$outputDir\electron.exe" -NewName "SalonPro.exe" -Force
}
if (Test-Path "$outputDir\Salon Management Pro.exe") {
    Rename-Item -Path "$outputDir\Salon Management Pro.exe" -NewName "SalonPro.exe" -Force -ErrorAction SilentlyContinue
}

Write-Host "Copying dist..."
Copy-Item -Path "$projectDir\dist\*" -Destination "$outputDir\resources\app" -Recurse -Force
Copy-Item -Path "$projectDir\electron-main.cjs" -Destination "$outputDir\resources\app\electron-main.cjs" -Force
Copy-Item -Path "$projectDir\electron-preload.cjs" -Destination "$outputDir\resources\app\electron-preload.cjs" -Force

# Fix package.json
$pkg = Get-Content "$projectDir\package.json" | ConvertFrom-Json
$pkg.PSObject.Properties.Remove('devDependencies')
$pkg.PSObject.Properties.Remove('scripts')
$pkg.main = "electron-main.cjs"
$pkg | ConvertTo-Json -Depth 10 | Set-Content "$outputDir\resources\app\package.json" -Encoding UTF8

Write-Host "Done - checking..."
Get-ChildItem "$outputDir\resources\app" | Format-Table Name, Length
Get-Content "$outputDir\resources\app\index.html" | Select-String "src="
