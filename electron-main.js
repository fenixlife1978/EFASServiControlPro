const { app, BrowserWindow } = require("electron");
const path = require("path");
const express = require("express");
const fs = require("fs");

let server = null;
let mainWindow = null;

function startServer() {
  const appServer = express();
  const staticPath = path.join(__dirname, "out");
  
  appServer.use((req, res, next) => {
    console.log("Solicitud:", req.url);
    next();
  });
  
  if (!fs.existsSync(staticPath)) {
    console.error("ERROR: La carpeta out no existe en:", staticPath);
    return null;
  }
  
  console.log("Sirviendo archivos desde:", staticPath);
  appServer.use(express.static(staticPath));
  
  // Manejar todas las rutas (SPA)
  appServer.get("*", (req, res) => {
    const indexPath = path.join(staticPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send("index.html no encontrado");
    }
  });
  
  server = appServer.listen(3000, () => {
    console.log("Servidor Express iniciado en http://localhost:3000");
  });
  
  return server;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  
  mainWindow.loadURL("http://localhost:3000");
}

app.whenReady().then(() => {
  startServer();
  // Esperar un poco a que el servidor esté listo
  setTimeout(() => {
    createWindow();
  }, 2000);
});

app.on("window-all-closed", () => {
  if (server) server.close();
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
