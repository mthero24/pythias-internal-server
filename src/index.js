import { app, BrowserWindow, ipcMain, Tray, Menu, autoUpdater } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { fileURLToPath } from "url";
import { dirname } from "path";
import os from "os";
import pkg from "pdf-to-printer";

let {print} = pkg
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}
import express from "express";
import bodyParser from "body-parser";
import apiRoutes from "./routes/api.js"
import uiRoutes from "./routes/ui.js"
import setupUpdates from "./functions/update.cjs"
const desktopPath = os.homedir() + "/Documents/hotfolder/";
const publicDirectoryPath = path.join(__dirname, "public");
let lastFileWritten = "Waiting for file to write";
const exp = express();
exp.set('view engine', 'ejs');
exp.set("views", __dirname + "/views/");
exp.use(express.static(process.cwd() + "/views"));
exp.use(express.static(publicDirectoryPath));
exp.use(
  bodyParser.urlencoded({
    limit: "1000000gb",
    parameterLimit: 1000000000000,
    extended: true,
  })
);
exp.use(bodyParser.json({ limit: "1000000gb" }));
exp.use("/api", apiRoutes)
exp.use("/", uiRoutes)


exp.listen(3005, async function () {
  console.log("writer listening on port 3005");
});

let mainWindow = null;
let tray = null;

const createTray = () => {
  const iconPath = path.join(__dirname, '/public/pythias-logo-new-gold-black-bg.ico');
  tray = new Tray(iconPath);
  tray.setToolTip('Pythias Internal Server');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuiting = true; app.quit(); } },
  ]));
  tray.on('click', () => { mainWindow.show(); mainWindow.focus(); });
};

const createWindow = async () => {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 1500,
    fullscreen: true,
    kiosk: true,
    icon: path.join(__dirname, '/public/logoPythias-400.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.loadURL('http://localhost:3005');

  mainWindow.on('minimize', (event) => {
    event.preventDefault();
    mainWindow.hide();
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
};

ipcMain.on('print-document', (event, options) => {
  print(path.join(__dirname, `/assets/${options.file}`), { printer: options.printer });
});

ipcMain.on('minimize-to-tray', () => mainWindow.hide());

ipcMain.on('install-update', () => autoUpdater.quitAndInstall());

app.whenReady().then(async () => {
  app.setLoginItemSettings({ openAtLogin: true, name: 'Pythias Internal Server' });
  createWindow();
  createTray();
  setupUpdates(mainWindow);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  app.isQuiting = true;
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
