import output from "../logs.json" with {type: "json"}
import fs from "fs"
import path from 'node:path';
import { fileURLToPath } from "url";
import { dirname } from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let useOutput = output
let addOutput = async (out)=>{
    useOutput.push({
        output: out,
        time: new Date(Date.now())
    })
    if(useOutput.length > 500) useOutput.pop()
     await fs.writeFileSync(path.join(__dirname, '../logs.json'), JSON.stringify(useOutput), {encoding:'utf8',flag:'w'})
    
}

let getOutput = ()=>{
    return useOutput
}

export {getOutput, addOutput}