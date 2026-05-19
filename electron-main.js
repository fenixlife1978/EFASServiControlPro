const { app, BrowserWindow } = require("electron");

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Carga la aplicación directamente desde Vercel
  mainWindow.loadURL("https://efas-control.vercel.app");

  // Opcional: abre las herramientas de desarrollo si quieres depurar (comentar en producción)
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});