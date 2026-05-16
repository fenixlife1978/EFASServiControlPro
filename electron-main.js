const { app, BrowserWindow } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: "EDUControlPro - Sistema de Monitoreo"
  });

  // Intentamos la carga nativa con file:// apuntando al index.html
  win.loadURL(`file://${path.join(__dirname, "out", "index.html")}`);

  // ACTIVA LAS DEVTOOLS: Esto te abrirá la consola de errores a la derecha en el .exe
  win.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
