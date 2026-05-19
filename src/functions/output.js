import fs from "fs";
import path from "node:path";
import os from "os";
import { app } from "electron";

const logsDir = os.homedir() + "/Documents/pythias/";
const logsPath = logsDir + "logs.json";

fs.mkdirSync(logsDir, { recursive: true });

// On first install, migrate logs from legacy locations used by older versions
if (!fs.existsSync(logsPath)) {
  const legacyPaths = [
    path.join(app.getPath('userData'), 'logs.json'),
    path.join(app.getPath('userData'), 'output.json'),
    path.join(path.dirname(app.getPath('exe')), 'logs.json'),
    path.join(path.dirname(app.getPath('exe')), 'output.json'),
  ];
  for (const legacy of legacyPaths) {
    try {
      const data = fs.readFileSync(legacy, 'utf8');
      if (data && data.trim()) {
        fs.writeFileSync(logsPath, data, { encoding: 'utf8', flag: 'w' });
        fs.renameSync(legacy, legacy + '.migrated');
        break;
      }
    } catch { /* not found at this path, try next */ }
  }
}

let useOutput = [];
try {
  const raw = fs.readFileSync(logsPath, "utf8");
  useOutput = raw ? JSON.parse(raw) : [];
} catch {
  fs.writeFileSync(logsPath, "[]", { encoding: "utf8", flag: "w" });
}

export const addOutput = (out) => {
  useOutput.push({ output: out, time: new Date() });
  if (useOutput.length > 500) useOutput.shift();
  fs.writeFileSync(logsPath, JSON.stringify(useOutput), { encoding: "utf8", flag: "w" });
};

export const getOutput = () => useOutput;
