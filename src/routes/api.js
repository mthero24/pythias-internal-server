import express from "express";
const router = express.Router();
import {getSettings}from "../functions/settings.js"
import { print } from "../functions/printLabel.js";
import { getWeight } from "../functions/getWeight.js";
import { addOutput } from "../functions/output.js";
import { getKeys } from "../functions/user.js";
import axios from "axios"
const checkKeys = (req,res,next)=>{
  let key = req.headers["authorization"];
  console.log(key, typeof key, req.headers)
  key = key.split("Bearer")[1].trim()
  console.log(key)
  //next()
  let keys = getKeys();
  if(key == keys.key){
    next()
  }else{
    res.send({error:true, msg: "invalid key"})
  }
}
router.post("/dtf", checkKeys, async (req,res)=>{
    const settings = getSettings();
    let data = req.body
    let resData
    console.log(data)
    addOutput(`Sent image to DTF Printer PieceID: ${data.sku}`)
    addOutput(`http://${settings.dtf[data.printer]}/`)
    let resp = await axios.post(`http://${settings.dtf[data.printer]}:3500/`, {...data}).catch(e=>{resData = e.response.data})
    if (resp) return res.send(resp.data);
    else if (resData) {
      addOutput(`Error writing image on DTF Printer PieceID: ${data.sku}`)
      return res.send(resData);
    }else
    addOutput(`Error Could Not Reach DTF Printer PieceID: ${data.sku}`)
      return res.send({
        error: true,
        msg: "Could not reach file writer!",
      });
})
router.post("/roq-folder", checkKeys, async (req, res) => {
  const settings = getSettings();
  let data = req.body;
  let resData;
  addOutput(`Sent image to DTF Printer PieceID: ${data.sku}`)
  console.log(settings["roq"]["roq1"])
  addOutput(`http://${settings["roq"]["roq1"]}:3500/roq`)
  let resp = await axios
    .post(`http://${settings["roq"]["roq1"]}:3500/roq`, { ...data })
    .catch((e) => {
      console.log("catch", e)
      resData = e.response?.data;
    });
  if (resp) return res.send(resp?.data);
  else if (resData) {
    console.log(resData)
    addOutput(`Error writing image on ROQ  PieceID: ${data.sku}`)
    return res.send(resData);
  }
  else

    addOutput(`Error writing image on ROQ  PieceID: ${data.sku}`)
    return res.send({
      error: true,
      msg: "Could not reach file writer!",
    });
});
router.post("/shipping/printers", checkKeys, async (req, res) => {
  const settings = getSettings();
  let data = req.body;
  console.log(data.type, "type route");
  try{
    addOutput(`print label : ${data.station} ${data.type}`)
    console.log(`http://${settings.shipping.printers[data.station]}:631/ipp/port1`)
    let resp = await print({
      label: data.label,
      printer: `http://${settings.shipping.printers[data.station]}:631/ipp/port1`,
      type: data.type,
    });
    console.log(resp, "route");
    return res.send(resp);
  }catch(e){
    addOutput(`error printing label : ${data.station} ${data.type} ${JSON.stringify(e)} ${e}`)
    return res.send({error: true, msg: `error printing label : ${data.station} ${data.type} ${JSON.stringify(e)} ${e}`})
  }
});
router.get("/shipping/scales", checkKeys, async (req, res) => {
  const settings = getSettings();
  try {
    let resp = await getWeight({
      url: `http://${settings.shipping.scales[req.query.station]}:3003/getweight`,
    });
    console.log(resp, "resp");
    addOutput(`${req.query.station} -get weight weight: ${resp.value} ${resp.system}`)
    return res.send({ ...resp });
  } catch (e) {
    addOutput(`error ${JSON.stringify(e)}`);
    return res.send({ error: true, msg: JSON.stringify(e) });
  }
});
router.post("/print-labels", checkKeys, async (req,res)=>{
  const settings = getSettings();
  let data = req.body;
  console.log(data.type, "type route");
  try{
    let resp = print({
      label: data.label,
      printer: `http://${settings.labelPrinters[data.printer]}:9100/printer/pstprnt`,
      type: data.type,
    });
    addOutput(`Printed Labels`)
    console.log(resp)
    if(!resp){
      return res.send({ error: false, msg: "printed labels" });
    }
    return res.send(resp);
  }catch(e){
    addOutput(`Error Printing Labels - ${e}`)
    return res.send({ error: true, msg: e });
  }
});
router.post("/sublimation", checkKeys, async (req, res) => {
  const settings = getSettings();
  let data = req.body;
  let resData;
  console.log(data);
  addOutput(`Sent image to sublimation Printer PieceID: ${data.pieceId}`);
  let resp = await axios
    .post(`http://${settings.sublimation[data.printer]}:3500/sublimation`, { ...data })
    .catch((e) => {
      resData = e.response.data;
    });
  if (resp) return res.send(resp.data);
  else if (resData) {
    addOutput(
      `Error writing image on sublimation Printer PieceID: {data.pieceId}`
    );
    return res.send(resData);
  } else addOutput(`Error Could Not Reach sublimation Printer PieceID: {data.pieceId}`);
  return res.send({
    error: true,
    msg: "Could not reach file writer!",
  });
});
export default router