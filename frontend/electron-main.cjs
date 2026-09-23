const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let backendProcess = null;
let backendReady = false;
let externalDataDir = null;

// ========== المجلد الخارجي بره المشروع ==========
function getExternalDataDir() {
  // 1. متغير بيئة
  if (process.env.SALON_DATA_DIR) return path.resolve(process.env.SALON_DATA_DIR);
  if (process.env.SALON_EXTERNAL_DIR) return path.resolve(process.env.SALON_EXTERNAL_DIR);

  // 2. في حالة البرنامج المبني (portable/installed) -> بجانب الـ exe
  if (app.isPackaged) {
    try {
      const exeDir = path.dirname(app.getPath('exe'));
      // portable: exe بجانب SalonProData
      return path.join(exeDir, 'SalonProData');
    } catch {}
  }

  // 3. في وضع التطوير -> مجلد أخ خارج المشروع (sibling) - المختار SalonPro_External
  // __dirname = frontend/ , project root = .. , parent = Downloads
  try {
    const projectRoot = path.resolve(__dirname, '..'); // frontend -> Salon-Management-Pro
    const parent = path.resolve(projectRoot, '..'); // Downloads
    const chosen = path.join(parent, 'SalonPro_External');
    if (fs.existsSync(chosen)) return chosen;
    const legacy = path.join(parent, 'SalonPro_External_Data');
    if (fs.existsSync(legacy)) return legacy;
    return chosen;
  } catch {}

  // 4. fallback -> Documents
  try {
    return path.join(app.getPath('documents'), 'SalonProData');
  } catch {
    return path.join(process.cwd(), 'SalonProData');
  }
}

function ensureExternalDataStructure() {
  externalDataDir = getExternalDataDir();
  const dataDir = path.join(externalDataDir, 'data');
  const uploadsDir = path.join(dataDir, 'uploads');
  const invoicesDir = path.join(dataDir, 'generated_invoices');
  const receiptsDir = path.join(dataDir, 'generated_receipts');
  const backupsDir = path.join(externalDataDir, 'backups');
  const logsDir = path.join(externalDataDir, 'logs');
  const updatesDir = path.join(externalDataDir, 'updates');

  [externalDataDir, dataDir, uploadsDir, invoicesDir, receiptsDir, backupsDir, logsDir, updatesDir].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
  // subfolders for uploads
  ["business", "products", "services", "employees", "invoices", "documents", "profiles", "expenses"].forEach(sub => {
    const p = path.join(uploadsDir, sub);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  });

  // أنشئ ملف تعريف
  const readme = path.join(externalDataDir, 'README.txt');
  if (!fs.existsSync(readme)) {
    fs.writeFileSync(readme, `SalonPro External Data\nالمجلد الخارجي بره المشروع - لا تمسحه\nالبيانات: ${dataDir}\nالتحديثات: ${updatesDir}\n`, 'utf8');
  }

  // هجرة بيانات قديمة من داخل المشروع (مرة واحدة)
  try { migrateLegacyData(externalDataDir, dataDir, uploadsDir); } catch (e) { console.warn('[Migrate] failed', e); }

  console.log('[External] Data dir:', externalDataDir);
  console.log('[External] Uploads:', uploadsDir);
  return { externalDataDir, dataDir, uploadsDir, invoicesDir, receiptsDir, backupsDir, logsDir, updatesDir };
}

function migrateLegacyData(externalDataDir, dataDir, uploadsDir) {
  // projectRoot = Salon-Management-Pro
  const projectRoot = path.resolve(__dirname, '..');
  const parent = path.resolve(projectRoot, '..');
  const legacyUploads = [
    path.join(projectRoot, 'uploads'),
    path.join(projectRoot, 'backend', 'uploads'),
    path.join(parent, 'uploads'), // Downloads/uploads bug
  ];
  const legacyDbs = [
    path.join(projectRoot, 'salon_pro.db'),
    path.join(projectRoot, 'backend', 'salon_pro.db'),
    path.join(projectRoot, 'backend', 'salon.db'),
    path.join(projectRoot, 'backend', 'app.db'),
  ];
  const legacyInvoices = [
    path.join(projectRoot, 'backend', 'generated_invoices'),
    path.join(projectRoot, 'generated_invoices'),
  ];

  const destDb = path.join(dataDir, 'salon_pro.db');
  const destWal = destDb + '-wal';
  const destShm = destDb + '-shm';

  // DB
  if (!fs.existsSync(destDb) || fs.statSync(destDb).size === 0) {
    for (const ldb of legacyDbs) {
      if (fs.existsSync(ldb) && fs.statSync(ldb).size > 0) {
        fs.copyFileSync(ldb, destDb);
        console.log(`[Migrate] DB ${ldb} -> ${destDb}`);
        // copy wal/shm if exists
        if (fs.existsSync(ldb + '-wal')) try { fs.copyFileSync(ldb + '-wal', destWal); } catch {}
        if (fs.existsSync(ldb + '-shm')) try { fs.copyFileSync(ldb + '-shm', destShm); } catch {}
        break;
      }
    }
  }

  // uploads
  for (const legacy of legacyUploads) {
    if (!fs.existsSync(legacy)) continue;
    if (path.resolve(legacy) === path.resolve(uploadsDir)) continue;
    // copy subfolders
    const subs = fs.readdirSync(legacy, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
    for (const sub of subs) {
      const srcSub = path.join(legacy, sub);
      const destSub = path.join(uploadsDir, sub);
      if (!fs.existsSync(destSub)) fs.mkdirSync(destSub, { recursive: true });
      const files = fs.readdirSync(srcSub);
      for (const f of files) {
        const src = path.join(srcSub, f);
        const dest = path.join(destSub, f);
        if (!fs.existsSync(dest) && fs.statSync(src).isFile()) {
          try { fs.copyFileSync(src, dest); } catch {}
        }
      }
    }
    // also root files
    try {
      const files = fs.readdirSync(legacy).filter(f => fs.statSync(path.join(legacy, f)).isFile());
      for (const f of files) {
        const src = path.join(legacy, f);
        const dest = path.join(uploadsDir, f);
        if (!fs.existsSync(dest)) try { fs.copyFileSync(src, dest); } catch {}
      }
    } catch {}
  }

  // invoices pdfs
  const destInvoices = path.join(dataDir, 'generated_invoices');
  if (!fs.existsSync(destInvoices)) fs.mkdirSync(destInvoices, { recursive: true });
  for (const lp of legacyInvoices) {
    if (!fs.existsSync(lp)) continue;
    if (path.resolve(lp) === path.resolve(destInvoices)) continue;
    const files = fs.readdirSync(lp);
    for (const f of files) {
      const src = path.join(lp, f);
      const dest = path.join(destInvoices, f);
      if (!fs.existsSync(dest) && fs.statSync(src).isFile()) {
        try { fs.copyFileSync(src, dest); } catch {}
      }
    }
  }
}

// ========== الباك إند ==========
function getBackendPath() {
  if (app.isPackaged) {
    // في النسخة المبنية: resources/app/backend/backend.exe أو dist/backend.exe
    const candidates = [
      path.join(process.resourcesPath, 'app', 'backend', 'backend.exe'),
      path.join(process.resourcesPath, 'backend', 'backend.exe'),
      path.join(path.dirname(app.getPath('exe')), 'backend', 'backend.exe'),
    ];
    for (const c of candidates) if (fs.existsSync(c)) return path.dirname(c);
    return path.join(process.resourcesPath, 'app', 'backend');
  }
  return path.join(__dirname, '..', 'backend');
}

function startBackend() {
  const { externalDataDir: extDir, dataDir, uploadsDir, invoicesDir, receiptsDir } = ensureExternalDataStructure();
  const backendDir = getBackendPath();
  const dbPath = path.join(dataDir, 'salon_pro.db');

  let cmd, args, cwd, env;

  if (app.isPackaged) {
    const exeCandidates = [
      path.join(backendDir, 'backend.exe'),
      path.join(process.resourcesPath, 'app', 'backend', 'backend.exe'),
    ];
    const exePath = exeCandidates.find(p => fs.existsSync(p));
    if (exePath) {
      cmd = exePath;
      args = [];
      cwd = backendDir;
      env = {
        ...process.env,
        SALON_DATA_DIR: extDir,
        SALON_EXTERNAL_DIR: extDir,
        UPLOADS_DIR: uploadsDir,
        PDF_DIR: invoicesDir,
        RECEIPT_DIR: receiptsDir,
        DATABASE_URL: `sqlite:///${dbPath.replace(/\\/g, '/')}`,
        PYTHONPATH: backendDir,
      };
      console.log('[Backend] Packaged mode:', cmd);
    } else {
      console.warn('[Backend] backend.exe not found, trying python fallback');
      // fallback to python if available (dev portable with source)
      cmd = 'python';
      args = ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'];
      cwd = backendDir;
      env = {
        ...process.env,
        SALON_DATA_DIR: extDir,
        UPLOADS_DIR: uploadsDir,
        PDF_DIR: invoicesDir,
        RECEIPT_DIR: receiptsDir,
        DATABASE_URL: `sqlite:///${dbPath.replace(/\\/g, '/')}`,
        PYTHONPATH: backendDir,
      };
    }
  } else {
    cmd = 'python';
    args = ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000', '--reload'];
    cwd = backendDir;
    env = {
      ...process.env,
      SALON_DATA_DIR: extDir,
      UPLOADS_DIR: uploadsDir,
      PDF_DIR: invoicesDir,
      RECEIPT_DIR: receiptsDir,
      DATABASE_URL: `sqlite:///${dbPath.replace(/\\/g, '/')}`,
      PYTHONPATH: backendDir,
    };
    console.log('[Backend] Dev mode:', cmd, args);
  }

  console.log('[Backend] DB:', env.DATABASE_URL);
  console.log('[Backend] Uploads:', env.UPLOADS_DIR);

  backendProcess = spawn(cmd, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });

  backendProcess.stdout.on('data', (data) => {
    const s = data.toString();
    console.log(`[Backend] ${s}`);
    if (s.includes('Uvicorn running on') || s.includes('Application startup complete')) {
      backendReady = true;
      if (mainWindow) mainWindow.webContents.send('backend-ready');
    }
  });
  backendProcess.stderr.on('data', (data) => {
    console.error(`[Backend Error] ${data}`);
  });
  backendProcess.on('close', (code) => {
    console.log(`Backend exited ${code}`);
    backendReady = false;
  });
  backendProcess.on('error', (err) => {
    console.error('Failed to start backend:', err);
    if (mainWindow) dialog.showErrorBox('خطأ الباك إند', `فشل تشغيل الخادم:\n${err.message}\n\nتأكد من تثبيت Python أو بناء backend.exe`);
  });
}

function stopBackend() {
  if (backendProcess) {
    try { backendProcess.kill(); } catch {}
    backendProcess = null;
    backendReady = false;
  }
}

// ========== نظام التحديث من مجلد خارجي ==========
function checkForUpdates() {
  if (!externalDataDir) return;
  const updatesDir = path.join(externalDataDir, 'updates');
  const versionFile = path.join(updatesDir, 'version.json');
  const pendingDir = path.join(updatesDir, 'pending');

  if (!fs.existsSync(versionFile)) return;

  try {
    const info = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
    const current = app.getVersion();
    const latest = info.version || info.latestVersion;
    const notes = info.notes || info.description || '';
    if (!latest || latest === current) return;

    // قارن الإصدارات ببساطة
    if (latest <= current) return;

    console.log(`[Updater] New version available: ${latest} (current ${current})`);

    // هل في ملفات تحديث جاهزة؟
    const hasPending = fs.existsSync(pendingDir) && fs.readdirSync(pendingDir).length > 0;
    const updateZip = path.join(updatesDir, `update-${latest}.zip`);
    const hasZip = fs.existsSync(updateZip);

    if (!hasPending && !hasZip) {
      console.log('[Updater] version.json found but no update files (pending/ or zip)');
      return;
    }

    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'info',
      buttons: ['تحديث الآن', 'لاحقاً'],
      defaultId: 0,
      title: 'تحديث متوفر',
      message: `إصدار جديد متوفر: ${latest}`,
      detail: notes + '\n\nالملفات في: ' + updatesDir + '\nسيتم تطبيق التحديث وإعادة التشغيل.',
    });
    if (choice !== 0) return;

    applyUpdate(updatesDir, pendingDir, updateZip, latest);
  } catch (e) {
    console.error('[Updater] check failed', e);
  }
}

function applyUpdate(updatesDir, pendingDir, zipPath, version) {
  try {
    const appPath = app.isPackaged ? path.dirname(app.getPath('exe')) : path.join(__dirname, '..');
    const resourcesApp = app.isPackaged ? path.join(process.resourcesPath, 'app') : path.join(__dirname);

    // 1. إذا في pending مجلد -> انسخ ملفاته فوق app
    if (fs.existsSync(pendingDir)) {
      console.log('[Updater] Applying pending files...');
      copyRecursiveSync(pendingDir, resourcesApp);
      // احذف pending بعد النسخ
      //fs.rmSync(pendingDir, { recursive: true, force: true });
      fs.renameSync(pendingDir, path.join(updatesDir, `applied-${version}-${Date.now()}`));
    }

    // 2. إذا في zip -> فكه
    if (fs.existsSync(zipPath)) {
      console.log('[Updater] Extracting zip...', zipPath);
      // استخدم Expand-Archive عبر PowerShell أو unzip داخلي بسيط
      const { execSync } = require('child_process');
      const tempExtract = path.join(updatesDir, `extract-${version}`);
      if (fs.existsSync(tempExtract)) fs.rmSync(tempExtract, { recursive: true, force: true });
      fs.mkdirSync(tempExtract, { recursive: true });
      try {
        execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${tempExtract}' -Force"`, { stdio: 'ignore' });
        copyRecursiveSync(tempExtract, resourcesApp);
        fs.rmSync(tempExtract, { recursive: true, force: true });
        fs.renameSync(zipPath, path.join(updatesDir, `installed-${version}.zip`));
      } catch (e) {
        console.error('[Updater] zip extract failed', e);
        dialog.showErrorBox('خطأ التحديث', 'فشل فك ملف التحديث: ' + e.message);
        return;
      }
    }

    dialog.showMessageBoxSync(mainWindow, {
      type: 'info',
      title: 'تم التحديث',
      message: `تم تثبيت الإصدار ${version} بنجاح. سيُعاد تشغيل البرنامج.`,
    });
    app.relaunch();
    app.quit();
  } catch (e) {
    console.error('[Updater] apply failed', e);
    dialog.showErrorBox('خطأ التحديث', e.message);
  }
}

function copyRecursiveSync(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursiveSync(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    // لا تستبدل المجلد الخارجي نفسه
    if (dest.includes('SalonProData')) return;
    fs.copyFileSync(src, dest);
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
      webSecurity: true
    },
    icon: fs.existsSync(path.join(__dirname, 'build', 'icon.png')) ? path.join(__dirname, 'build', 'icon.png') : undefined,
    titleBarStyle: 'default',
    show: false
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Electron] Failed to load ${validatedURL}: ${errorDescription} (${errorCode})`);
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
  } else {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // فحص التحديثات بعد 2 ثانية من الظهور
    setTimeout(() => checkForUpdates(), 2000);
  });

  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

app.whenReady().then(() => {
  startBackend();
  setTimeout(() => { createWindow(); }, 2000);
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { stopBackend(); if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { stopBackend(); });

// IPC
ipcMain.handle('get-backend-status', () => backendReady);
ipcMain.handle('get-external-path', () => externalDataDir);
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('check-updates', () => { checkForUpdates(); return true; });
ipcMain.handle('open-external-data', async () => {
  if (externalDataDir && fs.existsSync(externalDataDir)) await shell.openPath(externalDataDir);
  return externalDataDir;
});
ipcMain.on('open-external', (e, url) => shell.openExternal(url));
