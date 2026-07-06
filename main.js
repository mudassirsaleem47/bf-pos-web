const { app, BrowserWindow } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const fs = require('fs');

let mainWindow;
let backendProcess;

function startBackend() {
  const userDataPath = app.getPath('userData');
  const dbDestPath = path.join(userDataPath, 'local.db');
  
  // Template db source path
  const dbSrcPath = path.join(__dirname, 'server/prisma/dev.db');

  // Copy template SQLite DB to userData if it doesn't exist yet
  if (!fs.existsSync(dbDestPath)) {
    console.log(`[Electron] Copying database template to: ${dbDestPath}`);
    try {
      fs.mkdirSync(userDataPath, { recursive: true });
      if (fs.existsSync(dbSrcPath)) {
        fs.copyFileSync(dbSrcPath, dbDestPath);
      } else {
        console.warn(`[Electron] Template database not found at: ${dbSrcPath}. A new database will be initialized by Prisma.`);
      }
    } catch (err) {
      console.error("[Electron] Failed to copy template database:", err);
    }
  }

  // Determine database URL for Prisma
  const dbUrl = `file:${dbDestPath}`;
  console.log(`[Electron] Using Local SQLite DB URL: ${dbUrl}`);

  // In development, the concurrently script runs the backend.
  // In production (or packaged app), Electron spawns the backend.
  if (app.isPackaged || process.env.NODE_ENV === 'production') {
    const backendPath = path.join(__dirname, 'server/src/index.js');
    console.log(`[Electron] Spawning backend process: ${backendPath}`);
    
    backendProcess = fork(backendPath, [], {
      env: {
        ...process.env,
        IS_ELECTRON: 'true',
        NODE_ENV: 'production',
        PORT: '5000',
        DATABASE_URL: dbUrl
      },
      stdio: 'inherit'
    });
  } else {
    // In dev mode, we still want local Express backend to use the SQLite DB URL
    // So we expose the environment variables
    process.env.IS_ELECTRON = 'true';
    process.env.DATABASE_URL = `file:${path.resolve('server/prisma/dev.db')}`;
    console.log(`[Electron Dev] Exposing DB URL: ${process.env.DATABASE_URL}`);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Inventory Management System",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  if (app.isPackaged || process.env.NODE_ENV === 'production') {
    mainWindow.loadFile(path.join(__dirname, 'client/dist/index.html'));
  } else {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', () => {
  startBackend();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', () => {
  if (backendProcess) {
    console.log('[Electron] Killing backend child process...');
    backendProcess.kill();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
