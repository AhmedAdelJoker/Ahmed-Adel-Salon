const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let backendProcess = null;
let backendReady = false;

function getBackendPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'backend', 'backend.exe');
  }
  return path.join(__dirname, '..', 'backend');
}

function getPythonPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'backend', 'python', 'python.exe');
  }
  return 'python';
}

function startBackend() {
  const backendDir = getBackendPath();
  const pythonPath = getPythonPath();
  
  let cmd, args;
  
  if (app.isPackaged) {
    cmd = path.join(backendDir, 'backend.exe');
    args = [];
  } else {
    cmd = pythonPath;
    args = ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000', '--reload'];
  }

  console.log('Starting backend:', cmd, args);
  
  backendProcess = spawn(cmd, args, {
    cwd: backendDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PYTHONPATH: backendDir }
  });

  backendProcess.stdout.on('data', (data) => {
    console.log(`[Backend] ${data}`);
    if (data.toString().includes('Uvicorn running on') || data.toString().includes('Application startup complete')) {
      backendReady = true;
      if (mainWindow) {
        mainWindow.webContents.send('backend-ready');
      }
    }
  });

  backendProcess.stderr.on('data', (data) => {
    console.error(`[Backend Error] ${data}`);
  });

  backendProcess.on('close', (code) => {
    console.log(`Backend exited with code ${code}`);
    backendReady = false;
  });

  backendProcess.on('error', (err) => {
    console.error('Failed to start backend:', err);
  });
}

function stopBackend() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
    backendReady = false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'electron-preload.cjs'),
      webSecurity: false
    },
    icon: fs.existsSync(path.join(__dirname, 'build', 'icon.png')) ? path.join(__dirname, 'build', 'icon.png') : undefined,
    titleBarStyle: 'default',
    show: false
  });

  // Debug helpers
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Electron] Failed to load ${validatedURL}: ${errorDescription} (${errorCode})`);
  });
  mainWindow.webContents.on('console-message', (event, level, message) => {
    console.log(`[Renderer] ${message}`);
  });

  if (app.isPackaged) {
    const candidates = [
      path.join(__dirname, 'index.html'),
      path.join(__dirname, 'dist', 'index.html'),
      path.join(process.resourcesPath, 'app', 'index.html'),
      path.join(process.resourcesPath, 'app', 'dist', 'index.html'),
    ];
    let indexPath = candidates.find(p => fs.existsSync(p));
    if (!indexPath) {
      console.error('[Electron] index.html not found. Searched:', candidates);
      indexPath = candidates[0];
    } else {
      console.log('[Electron] Loading:', indexPath);
    }
    mainWindow.loadFile(indexPath).catch(err => console.error('[Electron] loadFile error:', err));
    // افتح DevTools مؤقتاً لتشخيص الشاشة البيضاء - احذف السطر بعد التأكد
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    if (!app.isPackaged) {
      const checkBackend = setInterval(() => {
        if (backendReady) {
          clearInterval(checkBackend);
        }
      }, 500);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  startBackend();
  
  setTimeout(() => {
    createWindow();
  }, 2000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopBackend();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  stopBackend();
});

ipcMain.handle('get-backend-status', () => backendReady);