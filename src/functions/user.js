import users from "../users.json" with {type: "json"};
import apiKey from "../apiKeys.json" with { type: "json" };
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "node:path";
import { fileURLToPath } from "url";
import { dirname } from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let useUsers = users
let useApiKey = apiKey
function generateRandomCharacter() {
   const characters ="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@!#$%^&*";
    return characters.charAt(Math.floor(Math.random() * characters.length));
}
let random = (number)=>{
    let ran = ""
    for(let i = 0; i < number; i++){
        ran += generateRandomCharacter()
    }
    return ran
}
export const newUser = async (username, password)=>{
    var salt = bcrypt.genSaltSync(10);
    console.log(username, password)
    useUsers.push({username, password: await bcrypt.hash(password, salt)})
    await fs.writeFileSync(path.join(__dirname, '../users.json'), JSON.stringify(useUsers), {encoding:'utf8',flag:'w'})
    return {error: false, msg: "user created"}
}

export const login = async (username, password)=>{
    let user = useUsers.filter(u=> u.username == username)[0]
    if(user){
        if(bcrypt.compareSync(password, user.password)){
            return {error: false, msg: "logged in", key: await genKey()}
        }else return {error: true, msg: "message username or password do not match!"}
    }else{
        return {error: true, msg:"message username or password do not match!"}
    }
}
export const generateApiKey = async ()=>{
    var salt = bcrypt.genSaltSync(10);
    let apiKey = await bcrypt.hash(random(10), salt);
    await fs.writeFileSync(path.join(__dirname, "../apikeys.json"),JSON.stringify({key: apiKey}),{ encoding: "utf8", flag: "w" });
    useApiKey = {key: apiKey};
    return {error: false, apiKey: {key: apiKey}}
}
const genKey = async () =>{
    var salt = bcrypt.genSaltSync(10);
    return await bcrypt.hash(random(10), salt);
} 
export const getKeys = ()=>{
    return useApiKey
}
export const checkIfUsers = ()=>{
    console.log(useUsers.length)
    return useUsers.length > 0
} 