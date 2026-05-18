const { app, BrowserWindow } = require("electron");
const path = require("path");
const express = require("express");
const fs = require("fs");

let server = null;

function startServer() {
  const appServer = express();
  const staticPath = path.join(__dirname, "out");
  
  // Log para ver qué archivos se solicitan
  appServer.use((req, res, next) => {
    console.log("Solicitud:", req.url);
    next();
  });
  
  // Verificar si la carpeta out existe
  if (!fs.existsSync(staticPath)) {
    console.error("ERROR: La carpeta out no existe en:", staticPath);
    return null;
  }
  
  console.log("Sirviendo archivos desde:", staticPath);
  console.log("Archivos en out:", fs.readdirSync(staticPath));
  
  appServer.use(express.static(staticPath));
  
  appServer.get("*", (req, res) => {
    const indexPath = path.join(staticPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      console.error("ERROR: index.html no encontrado en:", indexPath);
      res.status(404).send("index.html no encontrado");
    }
  });
  
  server = appServer.listen(3000, () => {
    console.log("Servidor Express iniciado en http://localhost:3000");
  });
  
  return server;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  
  win.loadURL("http://localhost:3000");
}

app.whenReady().then(() => {
  startServer();
  createWindow();
});

app.on("window-all-closed", () => {
  if (server) server.close();
  if (process.platform !== "darwin") app.quit();
});
