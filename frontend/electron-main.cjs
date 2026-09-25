const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');

// إصلاح الشاشة السوداء الناتجة عن تعطل الـ GPU على بعض أجهزة ويندوز
app.disableHardwareAcceleration();

let mainWindow;
let backendProcess = null;
let backendReady = false;
let externalDataDir = null;
let logFilePath = null;
const earlyLogs = [];

function writeLog(level, ...args) {
  const line = `[${new Date().toISOString()}] [${level}] ${args.map(a => {
    try { return typeof a === 'string' ? a : JSON.stringify(a); } catch { return String(a); }
  }).join(' ')}`;
  try {
    if (level === 'ERROR') console.error(line);
    else console.log(line);
  } catch {}
  if (logFilePath) {
    try { fs.appendFileSync(logFilePath, line + '\n', 'utf8'); } catch {}
  } else {
    earlyLogs.push(line);
    if (earlyLogs.length > 200) earlyLogs.shift();
  }
}
const log = (...a) => writeLog('INFO', ...a);
const logErr = (...a) => writeLog('ERROR', ...a);

process.on('uncaughtException', (err) => {
  logErr('uncaughtException:', err && err.stack || err);
});

// Single instance: يمنع تشغيل نسختين تتصارعان على البورت وقاعدة البيانات
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// ========== المجلد الخارجي بره المشروع ==========
function getExternalDataDir() {
  if (process.env.SALON_DATA_DIR) return path.resolve(process.env.SALON_DATA_DIR);
  if (process.env.SALON_EXTERNAL_DIR) return path.resolve(process.env.SALON_EXTERNAL_DIR);

  if (app.isPackaged) {
    try {
      const exeDir = path.dirname(app.getPath('exe'));
      // الهيكل: SalonPro_External/{app/SalonPro.exe, Data, updates, logs, backups}
      const externalRoot = path.resolve(exeDir, '..');
      if (fs.existsSync(path.join(externalRoot, 'Data'))) return externalRoot;
      if (fs.existsSync(path.join(exeDir, '..', 'SalonPro_External', 'Data')))
        return path.resolve(exeDir, '..', 'SalonPro_External');
      return path.join(exeDir, 'SalonProData');
    } catch {}
  }

  try {
    const projectRoot = path.resolve(__dirname, '..');
    const parent = path.resolve(projectRoot, '..');
    const chosen = path.join(parent, 'SalonPro_External');
    if (fs.existsSync(chosen)) return chosen;
    const legacy = path.join(parent, 'SalonPro_External_Data');
    if (fs.existsSync(legacy)) return legacy;
    return chosen;
  } catch {}

  try {
    return path.join(app.getPath('documents'), 'SalonProData');
  } catch {
    return path.join(process.cwd(), 'SalonProData');
  }
}

function setupFileLogging(logsDir) {
  try {
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    logFilePath = path.join(logsDir, 'electron.log');
    if (earlyLogs.length) {
      fs.appendFileSync(logFilePath, earlyLogs.join('\n') + '\n', 'utf8');
      earlyLogs.length = 0;
    }
    log('Log file:', logFilePath);
    log('isPackaged:', app.isPackaged, 'version:', app.getVersion());
  } catch (e) {
    console.error('setupFileLogging failed', e);
  }
}

function ensureExternalDataStructure() {
  externalDataDir = getExternalDataDir();
  // ملاحظة: مجلد البيانات على القرص اسمه Data (كابيتال) — نستخدم نفس الاسم
  const dataDir = path.join(externalDataDir, 'Data');
  const uploadsDir = path.join(dataDir, 'uploads');
  const invoicesDir = path.join(dataDir, 'generated_invoices');
  const receiptsDir = path.join(dataDir, 'generated_receipts');
  const backupsDir = path.join(externalDataDir, 'backups');
  const logsDir = path.join(externalDataDir, 'logs');
  const updatesDir = path.join(externalDataDir, 'updates');

  [externalDataDir, dataDir, uploadsDir, invoicesDir, receiptsDir, backupsDir, logsDir, updatesDir].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
  ["business", "products", "services", "employees", "invoices", "documents", "profiles", "expenses"].forEach(sub => {
    const p = path.join(uploadsDir, sub);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  });

  setupFileLogging(logsDir);

  // تنظيف بقايا قديمة: Data/data الزائد (كان يُنشأ بالاسم الصغير سابقاً)
  try {
    const staleNested = path.join(dataDir, 'data');
    if (fs.existsSync(staleNested) && fs.statSync(staleNested).isDirectory()) {
      const entries = fs.readdirSync(staleNested);
      let moved = 0;
      for (const e of entries) {
        const src = path.join(staleNested, e);
        const dest = path.join(dataDir, e);
        if (!fs.existsSync(dest)) {
          try { fs.renameSync(src, dest); moved++; } catch {}
        }
      }
      const left = fs.readdirSync(staleNested);
      if (left.length === 0) {
        fs.rmdirSync(staleNested);
        log('Removed stale nested dir:', staleNested, `moved=${moved}`);
      } else {
        log('Stale nested dir kept (has unique files):', staleNested, left);
      }
    }
  } catch (e) { logErr('stale dir cleanup failed', e && e.message); }

  try { migrateLegacyData(externalDataDir, dataDir, uploadsDir); } catch (e) { logErr('[Migrate] failed', e && e.message); }

  log('[External] root:', externalDataDir);
  log('[External] data:', dataDir);
  log('[External] uploads:', uploadsDir);
  return { externalDataDir, dataDir, uploadsDir, invoicesDir, receiptsDir, backupsDir, logsDir, updatesDir };
}

function migrateLegacyData(externalDataDir, dataDir, uploadsDir) {
  const projectRoot = path.resolve(__dirname, '..');
  const parent = path.resolve(projectRoot, '..');
  const legacyUploads = [
    path.join(projectRoot, 'uploads'),
    path.join(projectRoot, 'backend', 'uploads'),
    path.join(parent, 'uploads'),
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
  if ((!fs.existsSync(destDb) || fs.statSync(destDb).size === 0)) {
    for (const ldb of legacyDbs) {
      if (fs.existsSync(ldb) && fs.statSync(ldb).size > 0) {
        fs.copyFileSync(ldb, destDb);
        log(`[Migrate] DB ${ldb} -> ${destDb}`);
        if (fs.existsSync(ldb + '-wal')) try { fs.copyFileSync(ldb + '-wal', destDb + '-wal'); } catch {}
        if (fs.existsSync(ldb + '-shm')) try { fs.copyFileSync(ldb + '-shm', destDb + '-shm'); } catch {}
        break;
      }
    }
  }

  for (const legacy of legacyUploads) {
    if (!fs.existsSync(legacy)) continue;
    if (path.resolve(legacy) === path.resolve(uploadsDir)) continue;
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
  }

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

function waitForBackend(timeoutMs = 45000) {
  const start = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      const req = http.get('http://127.0.0.1:8000/', (res) => {
        res.resume();
        log('Backend health OK, status:', res.statusCode);
        resolve(true);
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          logErr('Backend health check timed out');
          resolve(false);
        } else {
          setTimeout(tick, 1000);
        }
      });
      req.setTimeout(3000, () => { try { req.destroy(); } catch {} });
    };
    tick();
  });
}

function startBackend() {
  const { externalDataDir: extDir, dataDir, uploadsDir, invoicesDir, receiptsDir } = ensureExternalDataStructure();
  const backendDir = getBackendPath();
  const dbPath = path.join(dataDir, 'salon_pro.db');
  const dbUrl = `sqlite:///${dbPath.replace(/\\/g, '/')}`;

  let cmd, args, cwd, env;

  if (app.isPackaged) {
    const exeCandidates = [
      path.join(backendDir, 'backend.exe'),
      path.join(process.resourcesPath, 'app', 'backend', 'backend.exe'),
    ];
    const exePath = exeCandidates.find(p => fs.existsSync(p));
    if (exePath) {
      cmd = exePath; args = []; cwd = backendDir;
      env = {
        ...process.env,
        SALON_DATA_DIR: extDir,
        SALON_EXTERNAL_DIR: extDir,
        UPLOADS_DIR: uploadsDir,
        PDF_DIR: invoicesDir,
        RECEIPT_DIR: receiptsDir,
        DATABASE_URL: dbUrl,
      };
      log('[Backend] Packaged mode:', cmd);
    } else {
      logErr('[Backend] backend.exe NOT FOUND. Searched:', exeCandidates);
      cmd = 'python';
      args = ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'];
      cwd = backendDir;
      env = { ...process.env, SALON_DATA_DIR: extDir, UPLOADS_DIR: uploadsDir, PDF_DIR: invoicesDir, RECEIPT_DIR: receiptsDir, DATABASE_URL: dbUrl };
    }
  } else {
    cmd = 'python';
    args = ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000', '--reload'];
    cwd = backendDir;
    env = { ...process.env, SALON_DATA_DIR: extDir, UPLOADS_DIR: uploadsDir, PDF_DIR: invoicesDir, RECEIPT_DIR: receiptsDir, DATABASE_URL: dbUrl };
    log('[Backend] Dev mode:', cmd, args.join(' '));
  }

  log('[Backend] cwd:', cwd);
  log('[Backend] DB:', dbUrl);
  log('[Backend] Uploads:', uploadsDir);

  try {
    backendProcess = spawn(cmd, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    logErr('spawn threw:', e && e.message);
    return;
  }

  backendProcess.stdout.on('data', (data) => {
    const s = data.toString();
    log(`[Backend] ${s.trim()}`);
    if (s.includes('Uvicorn running on') || s.includes('Application startup complete')) {
      backendReady = true;
      if (mainWindow) try { mainWindow.webContents.send('backend-ready'); } catch {}
    }
  });
  backendProcess.stderr.on('data', (data) => {
    logErr(`[Backend] ${data.toString().trim()}`);
  });
  backendProcess.on('close', (code) => {
    log(`Backend exited code=${code}`);
    backendReady = false;
  });
  backendProcess.on('error', (err) => {
    logErr('Failed to start backend:', err && err.message);
  });
}

function stopBackend() {
  if (backendProcess) {
    try { backendProcess.kill(); } catch {}
    backendProcess = null;
    backendReady = false;
  }
}

function isSafeExternalUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'https:' || parsed.protocol === 'mailto:';
  } catch {
    return false;
  }
}

function isAllowedNavigationUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (
      !app.isPackaged &&
      parsed.protocol === 'http:' &&
      ['localhost', '127.0.0.1'].includes(parsed.hostname) &&
      parsed.port === '5173'
    ) {
      return true;
    }
    if (parsed.protocol !== 'file:') return false;
    const appRoot = path.resolve(
      app.isPackaged ? path.join(process.resourcesPath, 'app') : __dirname,
    );
    const filePath = path.resolve(
      decodeURIComponent(parsed.pathname).replace(/^\/([A-Za-z]:)/, '$1'),
    );
    return filePath === appRoot || filePath.startsWith(`${appRoot}${path.sep}`);
  } catch {
    return false;
  }
}

function verifyUpdateArtifact(updatesDir, info, zipPath, version) {
  const expectedHash = String(info.sha256 || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(expectedHash)) {
    throw new Error('Update manifest is missing a valid SHA-256 hash');
  }
  const actualHash = crypto
    .createHash('sha256')
    .update(fs.readFileSync(zipPath))
    .digest('hex');
  if (actualHash !== expectedHash) {
    throw new Error('Update artifact hash mismatch');
  }

  const publicKeyPath =
    process.env.SALONPRO_UPDATE_PUBLIC_KEY ||
    path.join(updatesDir, 'update-public-key.pem');
  const bundledPublicKeyPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app', 'update-public-key.pem')
    : null;
  const signature = String(info.signature || '').trim();
  const resolvedPublicKeyPath =
    publicKeyPath && fs.existsSync(publicKeyPath)
      ? publicKeyPath
      : bundledPublicKeyPath && fs.existsSync(bundledPublicKeyPath)
        ? bundledPublicKeyPath
        : null;
  if (!signature || !resolvedPublicKeyPath) {
    throw new Error('Update signature verification is not configured');
  }
  const payload = `${version}:${expectedHash}`;
  const valid = crypto.verify(
    null,
    Buffer.from(payload),
    fs.readFileSync(resolvedPublicKeyPath),
    Buffer.from(signature, 'base64'),
  );
  if (!valid) throw new Error('Update signature verification failed');
}

// ========== نظام التحديث من مجلد خارجي ==========
function checkForUpdates() {
  if (!externalDataDir || !mainWindow) return;
  const updatesDir = path.join(externalDataDir, 'updates');
  const versionFile = path.join(updatesDir, 'version.json');
  if (!fs.existsSync(versionFile)) return;
  try {
    const info = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
    const current = app.getVersion();
    const latest = String(info.version || info.latestVersion || '');
    const notes = info.notes || info.description || '';
    if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(latest)) return;
    if (latest === current || latest <= current) return;
    const updateZip = path.join(updatesDir, `update-${latest}.zip`);
    if (!fs.existsSync(updateZip)) return;
    verifyUpdateArtifact(updatesDir, info, updateZip, latest);
    log(`[Updater] new verified version ${latest} (current ${current})`);
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'info', buttons: ['تحديث الآن', 'لاحقاً'], defaultId: 0,
      title: 'تحديث متوفر', message: `إصدار جديد متوفر: ${latest}`,
      detail: notes + '\n\nالملفات في: ' + updatesDir,
    });
    if (choice !== 0) return;
    applyUpdate(updatesDir, updateZip, latest);
  } catch (e) { logErr('[Updater] check failed', e && e.message); }
}

function applyUpdate(updatesDir, zipPath, version) {
  try {
    const resourcesApp = app.isPackaged ? path.join(process.resourcesPath, 'app') : path.join(__dirname);
    const tempExtract = path.join(updatesDir, `extract-${version}`);
    if (fs.existsSync(tempExtract)) fs.rmSync(tempExtract, { recursive: true, force: true });
    fs.mkdirSync(tempExtract, { recursive: true });
    try {
      const script = "$ErrorActionPreference='Stop'; Expand-Archive -LiteralPath $env:SALONPRO_UPDATE_ZIP -DestinationPath $env:SALONPRO_UPDATE_DEST -Force";
      const encodedScript = Buffer.from(script, 'utf16le').toString('base64');
      execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encodedScript], {
        env: { ...process.env, SALONPRO_UPDATE_ZIP: zipPath, SALONPRO_UPDATE_DEST: tempExtract },
        stdio: 'ignore',
      });
      copyRecursiveSync(tempExtract, resourcesApp);
      fs.rmSync(tempExtract, { recursive: true, force: true });
      fs.renameSync(zipPath, path.join(updatesDir, `installed-${version}.zip`));
    } catch (e) {
      logErr('[Updater] zip extract failed', e && e.message);
      dialog.showErrorBox('خطأ التحديث', 'فشل فك ملف التحديث: ' + e.message);
      return;
    }
    dialog.showMessageBoxSync(mainWindow, { type: 'info', title: 'تم التحديث', message: `تم تثبيت ${version}. سيُعاد التشغيل.` });
    app.relaunch(); app.quit();
  } catch (e) { logErr('[Updater] apply failed', e && e.message); }
}

function copyRecursiveSync(src, dest) {
  const sourceRoot = path.resolve(src);
  const destinationRoot = path.resolve(dest);
  const stat = fs.statSync(sourceRoot);
  if (stat.isDirectory()) {
    if (!fs.existsSync(destinationRoot)) fs.mkdirSync(destinationRoot, { recursive: true });
    for (const entry of fs.readdirSync(sourceRoot)) {
      const sourcePath = path.resolve(sourceRoot, entry);
      const destinationPath = path.resolve(destinationRoot, entry);
      const relativeSource = path.relative(sourceRoot, sourcePath);
      const relativeDestination = path.relative(destinationRoot, destinationPath);
      if (
        relativeSource.startsWith('..') ||
        path.isAbsolute(relativeSource) ||
        relativeDestination.startsWith('..') ||
        path.isAbsolute(relativeDestination)
      ) {
        throw new Error('Update path escapes the application directory');
      }
      copyRecursiveSync(sourcePath, destinationPath);
    }
  } else {
    if (destinationRoot.includes('SalonProData')) return;
    fs.copyFileSync(sourceRoot, destinationRoot);
  }
}

async function runDiagnostics(trigger) {
  if (!mainWindow) return null;
  try {
    const state = await mainWindow.webContents.executeJavaScript(`(() => {
      const root = document.getElementById('root');
      const cs = root ? getComputedStyle(root) : null;
      const bodyCs = getComputedStyle(document.body);
      return {
        url: location.href,
        title: document.title,
        rootExists: !!root,
        rootChildren: root ? root.children.length : -1,
        rootText: root ? (root.innerText || '').slice(0, 200) : null,
        rootHTMLLen: root ? root.innerHTML.length : -1,
        bodyBg: bodyCs ? bodyCs.backgroundColor : null,
        scripts: Array.from(document.scripts).map(s => s.src || 'inline').slice(0, 10),
        stylesheets: Array.from(document.styleSheets).map(s => { try { return { href: s.href, rules: s.cssRules.length }; } catch (e) { return { href: s.href, rules: 'blocked' }; } }).slice(0, 10),
      };
    })()`, true);
    log(`[Diag:${trigger}] DOM:`, state);
    try {
      const img = await mainWindow.capturePage();
      const outPath = logFilePath
        ? path.join(path.dirname(logFilePath), `screenshot-${Date.now()}.png`)
        : path.join(app.getPath('temp'), `salonpro-shot-${Date.now()}.png`);
      fs.writeFileSync(outPath, img.toPNG());
      log(`[Diag:${trigger}] screenshot saved:`, outPath);
    } catch (e) { logErr('[Diag] screenshot failed', e && e.message); }
    return state;
  } catch (e) {
    logErr('[Diag] executeJavaScript failed', e && e.message);
    return null;
  }
}

function resolveIndexHtml() {
  const candidates = [
    path.join(__dirname, 'index.html'),
    path.join(__dirname, 'dist', 'index.html'),
    path.join(process.resourcesPath, 'app', 'index.html'),
    path.join(process.resourcesPath, 'app', 'dist', 'index.html'),
  ];
  const found = candidates.find(p => fs.existsSync(p));
  if (found) log('[Electron] Loading:', found);
  else logErr('[Electron] index.html NOT FOUND. Searched:', candidates);
  return found || candidates[0];
}

function createWindow() {
  const preloadPath = path.join(__dirname, 'electron-preload.cjs');
  log('Preload exists:', fs.existsSync(preloadPath), preloadPath);

  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 1000, minHeight: 700,
    backgroundColor: '#f8fafc',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
    icon: fs.existsSync(path.join(__dirname, 'build', 'icon.png')) ? path.join(__dirname, 'build', 'icon.png') : undefined,
    titleBarStyle: 'default',
    show: false,
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  const blockUnexpectedNavigation = (event, url) => {
    if (isAllowedNavigationUrl(url)) return;
    event.preventDefault();
    logErr('[Electron] blocked navigation:', url);
  };
  mainWindow.webContents.on('will-navigate', blockUnexpectedNavigation);
  mainWindow.webContents.on('will-redirect', blockUnexpectedNavigation);
  mainWindow.webContents.on('will-attach-webview', (event) => event.preventDefault());

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    logErr(`did-fail-load ${validatedURL}: ${errorDescription} (${errorCode})`);
  });
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    writeLog(level >= 2 ? 'ERROR' : 'INFO', `[Renderer] ${message} (${sourceId}:${line})`);
  });
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    logErr('render-process-gone:', JSON.stringify(details));
    try {
      dialog.showMessageBoxSync(mainWindow, {
        type: 'error', title: 'تعطل العرض',
        message: 'تعطلت صفحة العرض. سيُعاد تحميلها.',
        detail: `reason=${details.reason}. راجع: ${logFilePath || ''}`,
      });
    } catch {}
    try { mainWindow.webContents.reload(); } catch {}
  });
  mainWindow.webContents.on('unresponsive', () => {
    logErr('window unresponsive');
  });

  const showNow = (why) => {
    try {
      if (mainWindow && !mainWindow.isVisible()) {
        mainWindow.show();
        log('Window shown via', why);
      }
    } catch {}
  };
  mainWindow.once('ready-to-show', () => {
    showNow('ready-to-show');
    setTimeout(() => checkForUpdates(), 2000);
    // تشخيص الشاشة السوداء: حالة الـ DOM + سكرين شوت في logs/
    setTimeout(() => runDiagnostics('auto'), 6000);
  });
  // ضمان: لو ready-to-show لم يُطلق (صفحة معلقة) نظهر النافذة خلال 8 ثوانٍ بدل الشاشة السوداء
  setTimeout(() => showNow('fallback-timeout'), 8000);

  if (app.isPackaged) {
    const indexPath = resolveIndexHtml();
    mainWindow.loadFile(indexPath).catch(err => logErr('loadFile error:', err && err.message));
    if (process.argv.includes('--devtools')) {
      mainWindow.webContents.openDevTools();
    }
  } else {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  startBackend();
  // انتظر الباك إند (backend.exe يأخذ ~10-20 ثانية أول مرة) قبل إظهار النافذة
  const ok = await waitForBackend(45000);
  if (!ok) logErr('Continuing without confirmed backend — login may retry');
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { stopBackend(); if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { stopBackend(); });

ipcMain.handle('get-backend-status', () => backendReady);
ipcMain.handle('get-external-path', () => externalDataDir);
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('check-updates', () => { checkForUpdates(); return true; });
ipcMain.handle('run-diagnostics', () => runDiagnostics('manual'));
ipcMain.handle('open-external-data', async () => {
  if (externalDataDir && fs.existsSync(externalDataDir)) await shell.openPath(externalDataDir);
  return externalDataDir;
});
ipcMain.on('open-external', (event, url) => {
  if (!isSafeExternalUrl(url)) return;
  shell.openExternal(url);
});
