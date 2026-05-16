const { app, BrowserWindow } = require('electron');
const path = require('path');
const serve = require('electron-serve');

const loadURL = serve({ directory: 'out' });

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    title: "EDUControlPro - Sistema de Monitoreo"
  });

  if (app.isPackaged) {
    // Forzamos la carga directa del index principal de Next.js
    win.loadURL('app://./index.html');
  } else {
    win.loadURL('http://localhost:3000');
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
