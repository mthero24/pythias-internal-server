import bcrypt from "bcryptjs";
import fs from "fs";
import path from "node:path";
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
let users =[]
let apiKeys={}
try{
  users = await fs.readFileSync(os.homedir() + "/Documents/pythias/users.json")
}catch(e){
  console.log(e)
  await fs.writeFileSync(os.homedir() + '/Documents/pythias/users.json', JSON.stringify(users), {encoding:'utf8',flag:'w'})
}
try{
  apiKeys = await fs.readFileSync(os.homedir() + "/Documents/pythias/apiKeys.json")
}catch(e){
  console.log(e)
  await fs.writeFileSync(os.homedir() + '/Documents/pythias/apiKeys.json', JSON.stringify(apiKeys), {encoding:'utf8',flag:'w'})
}
let useUsers = JSON.parse(users)
let useApiKey = JSON.parse(apiKeys)

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
    await fs.writeFileSync(os.homedir() + '/Documents/pythias/users.json', JSON.stringify(useUsers), {encoding:'utf8',flag:'w'})
    return {error: false, msg: "user created"}
}

export const login = async (username, password)=>{
  console.log("+++++ login +++++")
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
    await fs.writeFileSync(os.homedir() + '/Documents/pythias/apiKeys.json',JSON.stringify({key: apiKey}),{ encoding: "utf8", flag: "w" });
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