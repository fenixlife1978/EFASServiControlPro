const { app, BrowserWindow } = require('electron');
const path = require('path');
const serve = require('electron-serve');

// Configuramos 'electron-serve' para que apunte a la carpeta 'out'
const loadURL = serve({ directory: 'out' });

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    // Esto asegura que el título de tu app se vea bien desde el inicio
    title: "EDUControlPro - Sistema de Monitoreo"
  });

  // Verificamos si la app está empaquetada (producción) o en desarrollo
  if (app.isPackaged) {
    // En el .exe, usamos el servidor de archivos estáticos
    loadURL(win);
  } else {
    // En tu PC mientras programas
    win.loadURL('http://localhost:3000');
    // Opcional: abre las herramientas de desarrollador en modo dev
    // win.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
