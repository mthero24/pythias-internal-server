
import fs from "fs"
import path from 'node:path';
import os from "os";
const desktopPath = os.homedir() + "/Documents/pythias/";
fs.access(desktopPath, fs.constants.F_OK, (err) => {
  if (err) {
    // Directory doesn't exist, create it
    fs.mkdir(desktopPath, { recursive: true }, (err) => {
      if (err) {
        console.error('Error creating directory:', err);
      } else {
        console.log('Directory created successfully');
      }
    });
  } else {
    console.log('Directory already exists');
  }
});
import { fileURLToPath } from "url";
import { dirname } from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let settings = {'shipping':{'scales':{},'printers':{}},'emb': {}, 'dtf':{},'roq':{},'labelPrinters':{},'sublimation':{},'dtgPrinters':{}}
try{
  settings = await fs.readFileSync(os.homedir() + "/Documents/pythias/settings.json")
}catch(e){
    console.log(e)
    await fs.writeFileSync(os.homedir() + '/Documents/pythias/settings.json', JSON.stringify(settings), {encoding:'utf8',flag:'w'})
}
let useSettings = JSON.parse(settings)
try {
  fs.readFile(path.join(os.homedir() + "/Documents/pythias/settings.json"), "utf8", (err, data) => {
    if (err) {
      console.error("Error reading file:", err);
    } else {
      console.log("File content:", data);
      useSettings = JSON.parse(data);
    }
  });
} catch (e) {
  console.log("no settings");
}
console.log(useSettings, "useSettings")
export const updateSettings = async (set)=>{
    try{
        useSettings = {...set}
        await fs.writeFileSync(os.homedir() + "/Documents/pythias/settings.json", JSON.stringify(set), {encoding:'utf8',flag:'w'})
        return {error: false, msg: "json updated", useSettings}
    }catch(e){
        return {error: true, msg: e}
    }
}

export function getSettings(){
    return useSettings
}