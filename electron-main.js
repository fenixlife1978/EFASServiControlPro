const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");

let serverProcess = null;

function startServer() {
  const serverPath = path.join(__dirname, ".next", "standalone", "server.js");
  
  if (!fs.existsSync(serverPath)) {
    console.error("Server not found:", serverPath);
    return null;
  }
  
  const server = spawn("node", [serverPath], {
    env: { ...process.env, PORT: 3000 },
    stdio: "pipe"
  });
  
  server.stdout.on("data", (data) => console.log(`Server: ${data}`));
  server.stderr.on("data", (data) => console.error(`Server error: ${data}`));
  
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
  serverProcess = startServer();
  
  // Esperar 2 segundos a que el servidor arranque
  setTimeout(() => {
    createWindow();
  }, 2000);
});

app.on("window-all-closed", () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== "darwin") app.quit();
});
