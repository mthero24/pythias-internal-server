import fs from "fs";
import path from 'node:path';
import os from "os";
import { app } from "electron";

const settingsDir = os.homedir() + "/Documents/pythias/";
const settingsPath = settingsDir + "settings.json";

const defaultSettings = { shipping: { scales: {}, printers: {} }, emb: {}, dtf: {}, roq: {}, labelPrinters: {}, picklistPrinters: {}, sublimation: {}, dtgPrinters: {}, gtx: { host: "localhost" }, synergy: { host: "localhost", port: "8001" }, tajima: { spoolerPort: 9050, ftpPort: 2121, machines: ["default"], ipMap: {} } };

fs.mkdirSync(settingsDir, { recursive: true });

// On first install, migrate data from legacy locations used by older versions
if (!fs.existsSync(settingsPath)) {
  const legacyPaths = [
    path.join(app.getPath('userData'), 'settings.json'),
    path.join(path.dirname(app.getPath('exe')), 'settings.json'),
  ];
  for (const legacy of legacyPaths) {
    try {
      const data = fs.readFileSync(legacy, 'utf8');
      if (data && data.trim()) {
        fs.writeFileSync(settingsPath, data, { encoding: 'utf8', flag: 'w' });
        fs.renameSync(legacy, legacy + '.migrated');
        break;
      }
    } catch { /* not found at this path, try next */ }
  }
}

let rawSettings;
try {
  rawSettings = fs.readFileSync(settingsPath, "utf8");
} catch {
  fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings), { encoding: "utf8", flag: "w" });
  rawSettings = JSON.stringify(defaultSettings);
}

let useSettings = JSON.parse(rawSettings);

export const updateSettings = async (set) => {
  try {
    useSettings = { ...set };
    fs.writeFileSync(settingsPath, JSON.stringify(set), { encoding: "utf8", flag: "w" });
    return { error: false, msg: "json updated", useSettings };
  } catch (e) {
    return { error: true, msg: e };
  }
};

export function getSettings() {
  return useSettings;
}
