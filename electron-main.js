const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");

let serverProcess = null;
let mainWindow = null;

function startServer() {
  // Ruta al servidor generado por Next.js en modo standalone
  const serverPath = path.join(__dirname, ".next", "standalone", "server.js");
  
  if (!fs.existsSync(serverPath)) {
    console.error("ERROR: No se encontró el servidor standalone en:", serverPath);
    console.error("Asegúrate de haber ejecutado 'next build' con IS_DESKTOP_BUILD=true");
    return null;
  }

  console.log("🚀 Iniciando servidor standalone de Next.js...");
  console.log("Ruta:", serverPath);
  
  // Lanzamos el servidor como un proceso hijo
  serverProcess = spawn("node", [serverPath], {
    env: { ...process.env, PORT: "3000", NODE_ENV: "production" },
    stdio: "inherit"
  });

  serverProcess.on("error", (err) => {
    console.error("❌ Error al iniciar el servidor:", err);
  });

  // Opcional: esperar señal de que el servidor está listo
  return serverProcess;
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

  // Cargar la URL del servidor local
  mainWindow.loadURL("http://localhost:3000");

  // Opcional: abrir DevTools en desarrollo (comentar para producción)
  // mainWindow.webContents.openDevTools();

  // Manejar redirecciones dentro de la app (evitar popups externos)
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith("http://localhost:3000")) {
      return; // permitir navegación local
    }
    event.preventDefault();
  });
}

app.whenReady().then(() => {
  startServer();
  
  // Esperar 2 segundos para que el servidor arranque
  setTimeout(() => {
    createWindow();
  }, 2000);
});

app.on("window-all-closed", () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
