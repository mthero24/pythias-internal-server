let settings 
import fs from "fs"
import path from 'node:path';
import { fileURLToPath } from "url";
import { dirname } from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let useSettings = {}
try {
  fs.readFile(path.join(__dirname, "../settings.json"), "utf8", (err, data) => {
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

export const updateSettings = async (set)=>{
    try{
        useSettings = {...set}
        await fs.writeFileSync(path.join(__dirname, '../settings.json'), JSON.stringify(set), {encoding:'utf8',flag:'w'})
        return {error: false, msg: "json updated", useSettings}
    }catch(e){
        return {error: true, msg: e}
    }
}

export function getSettings(){
    return useSettings
}