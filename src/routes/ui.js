'use strict'
import express from "express";
const router = express.Router();
import {getOutput} from "../functions/output.js"
import {getSettings, updateSettings} from "../functions/settings.js"
import { getKeys, login, newUser, checkIfUsers, generateApiKey } from "../functions/user.js";
/* 
    {
        key: encripted string
        lastUsed: Date.now()
    }
*/
let activeKeys = []

setInterval(()=>{
    activeKeys = activeKeys.filter(k=> k.lastUsed > Date.now() - (30 * 60 * 1000))
}, 1000)

// get routes


router.get("/", async (req,res)=>{
    res.render("index", { output: getOutput(), key: req.query.key });
      
})
router.get("/settings", async (req,res)=>{ 
    if (!req.query.key || !activeKeys.filter(k=> k.key == req.query.key)[0]) return res.redirect("/login");
    let key = activeKeys.filter((k) => k.key == req.query.key)[0];
    key.lastUsed = Date.now()
    res.render("settings", {settings: getSettings(), key: req.query.key});
      
})
router.get("/account", (req,res)=>{
    if (!req.query.key || !activeKeys.filter((k) => k.key == req.query.key)[0]) return res.redirect("/login");
    let key = activeKeys.filter((k) => k.key == req.query.key)[0];
    key.lastUsed = Date.now();
    res.render("account", {key: req.query.key, apiKey: getKeys()})
})
// auth routes

router.get("/login", async (req,res)=>{
    let register = !checkIfUsers()
    res.render("login", { key: req.query.key, register });
})
router.get("/logout", (req,res)=>{
    activeKeys.filter((k) => k.key !== req.query.key);
    res.redirect("/")
})

// post routes

router.post("/update-settings", async (req,res)=>{
    if (!req.body.key || !activeKeys.filter((k) => k.key == req.body.key)[0]) return res.send({ error: true, msg: "invalid key" });
    let key = activeKeys.filter((k) => k.key == req.body.key)[0];
    key.lastUsed = Date.now();
    let newSettings = await updateSettings(req.body.settings)
    res.send({error: false})
})
router.post("/login", async (req, res) => {
    // verify user
    let resp = await login(req.body.userName, req.body.password)
    if(!resp.error) activeKeys.push({key: resp.key, lastUsed: Date.now()})
    //login
    res.send(resp);
});
router.post("/register", async (req, res) => {
  // verify user
  let resp = newUser(req.body.userName, req.body.password);
  if (!resp.error) activeKeys.push({ key: res.key, lastUsed: Date.now() });
  //login
  res.send(resp);
});

router.post("/generate-api-key", async (req,res)=>{
    if (!req.body.key || !activeKeys.filter((k) => k.key == req.body.key)[0]) return res.send({ error: true, msg: "invalid key" });
    let key = activeKeys.filter((k) => k.key == req.body.key)[0];
    key.lastUsed = Date.now();
    let apiKey = await generateApiKey();
    return res.send(apiKey);
})

// auto data pulls
router.get("/output", (req, res) => {
  res.send(getOutput());
});
export default router