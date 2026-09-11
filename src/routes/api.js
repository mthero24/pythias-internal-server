import express from "express";
const router = express.Router();
import {getSettings}from "../functions/settings.js"
import { print } from "../functions/printLabel.js";
import { getWeight } from "../functions/getWeight.js";
import { addOutput } from "../functions/output.js";
import { getKeys } from "../functions/user.js";
import axios from "axios"
import { hostFor, proxyPost, describeError } from "../functions/proxy.js";
import { createRequire } from 'module';
import {
    startSpooler, startFtpServer,
    queueDesign, getQueue, getMachineNames, removeFromQueue, clearQueue, setMachineIPMap,
} from "../functions/tajimaSpooler.js";

// Start Tajima servers immediately when the internal server loads
startSpooler(9050);
startFtpServer(2121);
// Apply any saved IP→machine map from settings
const _initSettings = getSettings();
if (_initSettings?.tajima?.ipMap) setMachineIPMap(_initSettings.tajima.ipMap);

const require = createRequire(import.meta.url);

const checkKeys = (req,res,next)=>{
  let key = req.headers["authorization"];
  console.log(key, typeof key, req.headers)
  key = key.split("Bearer")[1].trim()
  console.log(key)
  let keys = getKeys();
  if(key == keys.key){
    addOutput(`good key: ${key}`)
    next()
  }else{
    addOutput(`bad key: ${key}`)
    res.send({error:true, msg: "invalid key"})
  }
}
router.post("/dtf", checkKeys, async (req,res)=>{
    const settings = getSettings();
    let data = req.body
    addOutput(`Sent image to DTF Printer PieceID: ${data.sku}`)
    try {
      const host = hostFor(settings.dtf, data.printer, "DTF printer");
      addOutput(`http://${host}:3500/`)
      return res.send(await proxyPost(host, "/", { ...data }, { label: `DTF printer "${data.printer}"` }));
    } catch (e) {
      // Used to read "Could not reach file writer!" for every possible cause. Worse, the old catch
      // did e.response.data with no guard, so a timeout (which has no response) threw inside the
      // error handler and took the request down with it.
      addOutput(`Error on DTF Printer PieceID: ${data.sku} - ${e.message}`)
      return res.send({ error: true, msg: e.message });
    }
})
router.post("/embroidery", checkKeys, async (req,res)=>{
  const settings = getSettings();
  let data = req.body
  console.log(data)
  addOutput(`Sent image to embroidery Printer PieceID: ${data.sku}`)
  try {
    const host = hostFor(settings.emb, data.printer, "embroidery printer");
    addOutput(`http://${host}:3500/embroidery`)
    return res.send(await proxyPost(host, "/embroidery", { ...data }, { label: `Embroidery printer "${data.printer}"` }));
  } catch (e) {
    addOutput(`Error on embroidery Printer PieceID: ${data.sku} - ${e.message}`)
    return res.send({ error: true, msg: e.message });
  }
})
router.post("/roq-folder", checkKeys, async (req, res) => {
  const settings = getSettings();
  let data = req.body;
  addOutput(`Sent image to roq folder PieceID: ${data.sku}`)
  console.log(settings["roq"])
  console.log(settings["printer1"])
  try {
    const host = hostFor(settings["roq"], "printer1", "ROQ folder");
    addOutput(`http://${host}:3500/roq`)
    return res.send(await proxyPost(host, "/roq", { ...data }, { label: "ROQ folder" }));
  } catch (e) {
    addOutput(`Error on ROQ PieceID: ${data.sku} - ${e.message}`)
    return res.send({ error: true, msg: e.message });
  }
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
router.post("/shipping/cpu", checkKeys, async (req, res) => {
  const settings = getSettings();
  let data = req.body;
  console.log(data.type, "type route");
  try{
    addOutput(`print label : ${data.station} ${data.type}`)
    const host = hostFor(settings.shipping?.printers, data.station, "shipping station");
    return res.send(await proxyPost(host, "/print-shipping", data, { label: `Shipping station "${data.station}"` }));
  }catch(e){
    addOutput(`error printing label : ${data.station} ${data.type} - ${e.message}`)
    return res.send({ error: true, msg: e.message })
  }
});
router.get("/shipping/scales", checkKeys, async (req, res) => {
  const settings = getSettings();
  const station = req.query.station ?? "station1";
  const ip = settings.shipping.scales?.[station];
  if (!ip) {
    addOutput(`scale error: no IP configured for ${station}`);
    return res.send({ error: true, msg: `No scale IP configured for station "${station}"` });
  }
  try {
    // Try file writer first (port 3500) with a short timeout, fall back to Raspberry Pi (port 3003)
    let resp;
    try {
      const r = await axios.get(`http://${ip}:3500/getweight?station=${station}`, {
        headers: { "Content-Type": "text/json; charset=utf-8" },
        timeout: 2000,
      });
      resp = r.data;
    } catch {
      resp = await getWeight({ url: `http://${ip}:3003/getweight` });
    }
    addOutput(`${station} weight: ${resp.value} ${resp.system}`);
    return res.send({ ...resp });
  } catch (e) {
    addOutput(`scale error ${station}: ${e.message}`);
    return res.send({ error: true, msg: e.message });
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
router.post("/print-labels-pdf", checkKeys, async (req,res)=>{
  const settings = getSettings();
  let data = req.body;
  console.log(data.type, "type route");
  try{
    addOutput(`print label : ${data.printer} ${data.type}`)
    const host = hostFor(settings.labelPrinters, data.printer, "label printer");
    return res.send(await proxyPost(host, "/print-labels", data, { label: `Label printer "${data.printer}"` }));
  }catch(e){
    // The old message here reported data.station, which this route never sets — so every failure
    // on a label printer said "undefined".
    addOutput(`error printing label : ${data.printer} ${data.type} - ${e.message}`)
    return res.send({ error: true, msg: e.message })
  }
});

router.post("/print-picklist", checkKeys, async (req, res) => {
  const settings = getSettings();
  const data = req.body;
  const printerHost = settings.picklistPrinters?.[data.printer];
  if (!printerHost) {
    addOutput(`print-picklist: unknown printer "${data.printer}" — check Picklist Printers in settings`);
    return res.send({ error: true, msg: `Picklist printer "${data.printer}" not found — add its IP in Settings → Picklist Printers` });
  }
  try {
    addOutput(`print picklist → printer: ${data.printer} (${printerHost})`);
    const resp = await axios.post(`http://${printerHost}:3500/print-picklist`, data);
    return res.send(resp.data);
  } catch (e) {
    addOutput(`error printing picklist: ${data.printer} — ${e.message}`);
    return res.send({ error: true, msg: e.message });
  }
});
router.post("/sublimation", checkKeys, async (req, res) => {
  const settings = getSettings();
  let data = req.body;
  console.log(data);
  addOutput(`Sent image to sublimation Printer PieceID: ${data.pieceId}`);
  try {
    const host = hostFor(settings.sublimation, data.printer, "sublimation printer");
    return res.send(await proxyPost(host, "/sublimation", { ...data }, { label: `Sublimation printer "${data.printer}"` }));
  } catch (e) {
    addOutput(`Error on sublimation Printer PieceID: ${data.pieceId} - ${e.message}`);
    return res.send({ error: true, msg: e.message });
  }
});

router.post("/print-image", checkKeys, async (req, res) => {
  const settings = getSettings();
  const { imageUrl, pieceId, folder, printer } = req.body;
  const host = settings.sublimation?.[printer] || "localhost";
  addOutput(`Fetching image for ${pieceId} → ${folder}`);
  try {
    const imgResp = await axios.get(imageUrl, { responseType: "arraybuffer" });
    const base64 = Buffer.from(imgResp.data).toString("base64");
    const resp = await axios.post(`http://${host}:3500/sublimation`, {
      folder, base64, pieceId, print: true,
    });
    addOutput(`Image sent to file-writer: ${pieceId}`);
    return res.send(resp.data);
  } catch (e) {
    addOutput(`Error printing image ${pieceId}: ${e}`);
    return res.send({ error: true, msg: String(e) });
  }
});

router.post("/create-poster", checkKeys, async (req, res) => {
  const settings = getSettings();
  const data = req.body;
  const host = settings.sublimation?.[data.printer] || "localhost";
  addOutput(`Creating poster: ${data.sku}`);
  try {
    const resp = await axios.post(`http://${host}:4001/create-poster`, data);
    addOutput(`Poster sent to file-writer: ${data.sku}`);
    return res.send(resp.data);
  } catch (e) {
    addOutput(`Error creating poster ${data.sku}: ${e}`);
    return res.send({ error: true, msg: String(e) });
  }
});

router.post("/create-buttons", checkKeys, async (req, res) => {
  const settings = getSettings();
  const data = req.body;
  const host = settings.sublimation?.[data.printer] || "localhost";
  addOutput(`Queuing buttons for PO: ${data.poNumber}`);
  try {
    const resp = await axios.post(`http://${host}:4001/create-buttons`, data);
    addOutput(`Buttons queued for PO: ${data.poNumber}`);
    return res.send(resp.data);
  } catch (e) {
    addOutput(`Error creating buttons ${data.poNumber}: ${e}`);
    return res.send({ error: true, msg: String(e) });
  }
});

router.post("/gtx/send", checkKeys, async (req, res) => {
  const settings = getSettings();
  const host = settings.gtx?.host || "localhost";
  addOutput(`GTX send-to-printer: ${req.body.que?.pieceID}`);
  try {
    const resp = await axios.post(`http://${host}:3004/send-to-printer`, req.body);
    return res.send(resp.data);
  } catch (e) {
    addOutput(`GTX error: ${e.message}`);
    return res.send({ error: true, msg: String(e) });
  }
});

router.post("/gtx/delete", checkKeys, async (req, res) => {
  const settings = getSettings();
  const host = settings.gtx?.host || "localhost";
  try {
    const resp = await axios.post(`http://${host}:3004/delete-files`, req.body);
    return res.send(resp.data);
  } catch (e) {
    return res.send({ error: true, msg: String(e) });
  }
});

// ── Tajima design spooler routes ──────────────────────────────────────────────

// POST /tajima/send — queue a DST file
// Body: { name: string, dstBase64: string, machine?: string }
// machine defaults to "default" — use a named machine (e.g. "machine1") to route
// designs to a specific per-machine queue.
router.post("/tajima/send", checkKeys, (req, res) => {
    const { name, dstBase64, machine = "default" } = req.body;
    if (!dstBase64) return res.send({ error: true, msg: "dstBase64 required" });
    const buf = Buffer.from(dstBase64, "base64");
    const id = queueDesign(name || "design.dst", buf, machine);
    addOutput(`[tajima] Design queued via API: "${name}" → "${machine}"  id=${id}`);
    return res.send({ error: false, id, name, machine, size: buf.length, queue: getQueue() });
});

// GET /tajima/queue?machine=X — list queued designs (all machines if no param)
router.get("/tajima/queue", checkKeys, (req, res) => {
    const { machine } = req.query;
    return res.send({ error: false, queue: getQueue(machine), machines: getMachineNames() });
});

// DELETE /tajima/queue/:id?machine=X — remove a specific design
router.delete("/tajima/queue/:id", checkKeys, (req, res) => {
    const { machine } = req.query;
    removeFromQueue(Number(req.params.id), machine);
    return res.send({ error: false, queue: getQueue(machine) });
});

// DELETE /tajima/queue?machine=X — clear a machine's queue (or all if no param)
router.delete("/tajima/queue", checkKeys, (req, res) => {
    const { machine } = req.query;
    clearQueue(machine);
    return res.send({ error: false, queue: [] });
});

// POST /tajima/ip-map — set IP → machine name mapping
// Body: { map: { "192.168.1.42": "machine2", ... } }
router.post("/tajima/ip-map", checkKeys, (req, res) => {
    const { map } = req.body;
    if (!map || typeof map !== "object") return res.send({ error: true, msg: "map required" });
    setMachineIPMap(map);
    addOutput(`[tajima] IP→machine map updated: ${JSON.stringify(map)}`);
    return res.send({ error: false, map });
});

router.post("/synergy/add-to-queue", checkKeys, async (req, res) => {
  const settings = getSettings();
  const host = settings.synergy?.host || "localhost";
  const port = settings.synergy?.port || "8001";
  const { xml } = req.body;
  if (!xml) return res.send({ error: true, msg: "xml required" });
  addOutput(`[synergy] Queuing item on digital line at ${host}:${port}`);
  try {
    const resp = await axios.post(
      `http://${host}:${port}/AddToQueue`,
      xml,
      {
        headers: { "Content-Type": "text/xml; charset=utf-16" },
        timeout: 10000,
      }
    );
    addOutput(`[synergy] Item queued on digital line`);
    return res.send({ error: false, data: String(resp.data) });
  } catch (e) {
    addOutput(`[synergy] Queue error: ${e.message}`);
    return res.send({ error: true, msg: String(e) });
  }
});

// ── ColDesi hot-folder ────────────────────────────────────────────────────────
// Body: { pieceId, preset, imageBase64? | imageUrl? }
// `preset` must match a key in settings.coldesi.hotFolders on the file-writer machine
router.post("/coldesi", checkKeys, async (req, res) => {
  const settings = getSettings();
  const host = settings.coldesi?.host || "localhost";
  addOutput(`ColDesi → hot folder (preset: ${req.body.preset ?? "standard"}) pieceId: ${req.body.pieceId}`);
  try {
    const resp = await axios.post(`http://${host}:3500/coldesi`, req.body);
    return res.send(resp.data);
  } catch (e) {
    addOutput(`ColDesi error: ${e.message}`);
    return res.send({ error: true, msg: String(e) });
  }
});

router.get("/gtx/state", checkKeys, async (req, res) => {
  const settings = getSettings();
  const host = settings.gtx?.host || "localhost";
  try {
    const resp = await axios.get(`http://${host}:3004/state`);
    return res.send(resp.data);
  } catch (e) {
    return res.send({ error: true, msg: String(e) });
  }
});

export default router;
