// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  printDocument:   (options)  => ipcRenderer.send("print-document", options),
  minimizeToTray:  ()         => ipcRenderer.send("minimize-to-tray"),
  installUpdate:   ()         => ipcRenderer.send("install-update"),
  onUpdateStatus:  (callback) => ipcRenderer.on("update-status", (_e, data) => callback(data)),
});