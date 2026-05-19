const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");

let serverProcess = null;

function startServer() {
  const serverPath = path.join(__dirname, ".next", "standalone", "server.js");
  if (!fs.existsSync(serverPath)) {
    console.error("ERROR: No se encontró el servidor standalone en:", serverPath);
    console.error("Asegúrate de haber ejecutado 'next build' con IS_DESKTOP_BUILD=true");
    return null;
  }
  console.log("🚀 Iniciando servidor standalone de Next.js...");
  serverProcess = spawn("node", [serverPath], {
    env: { ...process.env, PORT: "3000", NODE_ENV: "production" },
    stdio: "inherit"
  });
  serverProcess.on("error", (err) => console.error("❌ Error al iniciar el servidor:", err));
  return serverProcess;
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  mainWindow.loadURL("http://localhost:3000");
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith("http://localhost:3000")) return;
    event.preventDefault();
  });
}

app.whenReady().then(() => {
  startServer();
  setTimeout(() => {
    createWindow();
  }, 2000);
});

app.on("window-all-closed", () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== "darwin") app.quit();
});