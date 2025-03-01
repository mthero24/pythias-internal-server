import fs from "fs"
import path from 'node:path';
import { fileURLToPath } from "url";
import { dirname } from "path";
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
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let output = [];
try{
    output = await fs.readFileSync(os.homedir() + "/Documents/pythias/logs.json")
}catch(e){
    console.log(e)
    await fs.writeFileSync(os.homedir() + '/Documents/pythias/logs.json', JSON.stringify(output), {encoding:'utf8',flag:'w'})
}
let useOutput = JSON.parse(output)
let addOutput = async (out)=>{
    useOutput.push({
        output: out,
        time: new Date(Date.now())
    })
    if(useOutput.length > 500) useOutput.shift()
     await fs.writeFileSync(os.homedir() + '/Documents/pythias/logs.json', JSON.stringify(useOutput), {encoding:'utf8',flag:'w'})
    
}

let getOutput = ()=>{
    return useOutput
}

export {getOutput, addOutput}