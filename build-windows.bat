@echo off
REM Build script for Salon Management Pro - Windows Electron App
echo Building Salon Management Pro...

echo.
echo =============================
echo Building Python Backend...
echo =============================
cd backend

REM Check if Python is available
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python not found in PATH
    echo Please install Python 3.10+ and add to PATH
    exit /b 1
)

REM Install PyInstaller if not present
pip show pyinstaller >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing PyInstaller...
    pip install pyinstaller
)

REM Build backend executable
echo Building backend.exe with PyInstaller...
pyinstaller --clean backend.spec
if %errorlevel% neq 0 (
    echo ERROR: Backend build failed
    exit /b 1
)

echo Backend built successfully!
cd ..

echo.
echo =============================
echo Building Frontend (Electron)...
echo =============================
cd frontend

REM Install dependencies if needed
if not exist node_modules (
    echo Installing npm dependencies...
    npm install
)

REM Build frontend
echo Building Vite frontend...
npm run build
if %errorlevel% neq 0 (
    echo ERROR: Frontend build failed
    exit /b 1
)

REM Build Electron app
echo Building Electron app...
npm run electron:build
if %errorlevel% neq 0 (
    echo ERROR: Electron build failed
    exit /b 1
)

echo.
echo =============================
echo Build Complete!
echo =============================
echo Output: frontend/dist-electron/
echo.
pause