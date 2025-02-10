import { app, BrowserWindow, ipcMain } from 'electron';
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
import update from "./functions/update.cjs"
update();
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

//electron functions
const createWindow = async () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 1500,
    fullscreen: true,
    //autoHideMenuBar: true,
    kiosk: true,
    //skipTaskbar: true,
    icon: path.join(__dirname, '/public/logo-dark-400-greenbg.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  mainWindow.maximize();

  // and load the index.html of the app.
  mainWindow.loadURL("http://localhost:3005");
  
  mainWindow.on("minimize", function (event) {
    event.preventDefault();
    mainWindow.hide();
  });
  
  mainWindow.on("close", function (event) {
    if (!application.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }

    return false;
  });
  // Open the DevTools.
  //mainWindow.webContents.openDevTools();
  // const printers = await mainWindow.webContents.getPrintersAsync();
  // console.log(printers);
  // print(path.join(__dirname, "/assets/DecisionLetter20250129082714.pdf"), {printer:"HP OfficeJet Pro 8020 series [63D443]"});
};

ipcMain.on("print-document", (event, options) => {
  // Use a printing library (like `pdf-to-printer`) to print the received HTML
  // ... handle printing logic here
  print(path.join(__dirname, `/assets/${options.file}`), {
    printer: options.printer,
  });
});
// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
