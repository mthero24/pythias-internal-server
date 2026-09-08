/**
 * tajimaSpooler.js
 *
 * Two free-standing servers for Tajima embroidery machines:
 *
 *  1. Design Spooler (TCP port 9050) — machine-initiated pull protocol.
 *     Protocol is not publicly documented; this server logs every raw byte
 *     (hex + ASCII) to enable reverse-engineering via the Activity Log.
 *     Attempts common industrial-spooler patterns (Barudan DFS, ZSK SCOS, Happy LAN).
 *
 *  2. FTP Server (TCP port 2121) — RFC-959 subset. Most Tajima models can
 *     pull DST files over FTP. Uses PASV mode. Anonymous login only.
 *
 * Per-machine queues: each machine has its own named queue so designs are
 * routed to the correct head. Queue names are arbitrary strings (e.g. "machine1",
 * "tajima-left"). Use the `machine` field in POST /tajima/send to target a queue.
 * If omitted, the design goes to the "default" queue.
 *
 * FTP/TCP connections identify themselves via the IP the machine connects from.
 * Map an IP to a queue name with setMachineIPMap() so the server knows which
 * queue to serve each physical machine.
 */

import net from "net";
import { addOutput } from "./output.js";

// ── Per-machine queues ────────────────────────────────────────────────────────
// { [machineName]: [{ id, name, buffer }] }

const _queues = {};   // machineName → queue array
let _idSeq = 1;

// Maps connecting IP → machine name (e.g. { "192.168.1.42": "machine2" })
let _ipMap = {};

export function setMachineIPMap(map) {
    _ipMap = { ...map };
}

function _getQueue(machine = "default") {
    if (!_queues[machine]) _queues[machine] = [];
    return _queues[machine];
}

function _queueForIP(ip) {
    // strip ::ffff: prefix from IPv6-mapped IPv4
    const plain = (ip || "").replace(/^::ffff:/, "");
    return _ipMap[plain] || "default";
}

export function queueDesign(name, buffer, machine = "default") {
    const q = _getQueue(machine);
    const id = _idSeq++;
    q.push({ id, name: name.replace(/\.dst$/i, "") + ".dst", buffer });
    addOutput(`[tajima] Queued design "${name}" (${buffer.length} bytes) → queue "${machine}"  id=${id}`);
    return id;
}

export function getQueue(machine) {
    if (machine) {
        return _getQueue(machine).map(d => ({ id: d.id, name: d.name, size: d.buffer.length, machine }));
    }
    // return all queues as flat list with machine label
    return Object.entries(_queues).flatMap(([m, q]) =>
        q.map(d => ({ id: d.id, name: d.name, size: d.buffer.length, machine: m }))
    );
}

export function getMachineNames() {
    return Object.keys(_queues);
}

export function removeFromQueue(id, machine) {
    if (machine) {
        const q = _getQueue(machine);
        const idx = q.findIndex(d => d.id === id);
        if (idx !== -1) q.splice(idx, 1);
        return;
    }
    // search all queues
    for (const q of Object.values(_queues)) {
        const idx = q.findIndex(d => d.id === id);
        if (idx !== -1) { q.splice(idx, 1); return; }
    }
}

export function clearQueue(machine) {
    if (machine) {
        if (_queues[machine]) _queues[machine].length = 0;
        return;
    }
    for (const q of Object.values(_queues)) q.length = 0;
}

// ── TCP Design Spooler (port 9050) ───────────────────────────────────────────

let _spoolerServer = null;

export function startSpooler(port = 9050) {
    if (_spoolerServer) return;
    _spoolerServer = net.createServer(handleSpoolerConnection);
    _spoolerServer.listen(port, "0.0.0.0", () =>
        addOutput(`[tajima] Design Spooler listening on port ${port}`)
    );
    _spoolerServer.on("error", e =>
        addOutput(`[tajima] Spooler error: ${e.message}`)
    );
}

export function stopSpooler() {
    if (_spoolerServer) { _spoolerServer.close(); _spoolerServer = null; }
    if (_ftpServer)     { _ftpServer.close();     _ftpServer     = null; }
}

function handleSpoolerConnection(socket) {
    const addr    = `${socket.remoteAddress}:${socket.remotePort}`;
    const machine = _queueForIP(socket.remoteAddress);
    addOutput(`[tajima] Machine connected: ${addr}  (queue: "${machine}")`);

    let rxBuf = Buffer.alloc(0);

    socket.on("data", data => {
        const hex   = data.toString("hex").match(/.{1,2}/g).join(" ");
        const ascii = data.toString("ascii").replace(/[^\x20-\x7e]/g, ".");
        addOutput(`[tajima] RX from ${addr}:  hex=[${hex}]  ascii=[${ascii}]`);

        rxBuf = Buffer.concat([rxBuf, data]);
        const response = _trySpoolerProtocol(rxBuf, machine);
        if (response !== null) {
            addOutput(`[tajima] TX to ${addr}: ${response.length} bytes`);
            socket.write(response);
            rxBuf = Buffer.alloc(0);
        }
    });

    socket.on("close", () => addOutput(`[tajima] Machine disconnected: ${addr}`));
    socket.on("error", e  => addOutput(`[tajima] Socket error (${addr}): ${e.message}`));

    socket.write(Buffer.from("READY\r\n"));
}

function _trySpoolerProtocol(rx, machine) {
    const q   = _getQueue(machine);
    const str = rx.toString("ascii").toUpperCase().trim();

    if (
        str === "LIST" || str === "LS" || str === "DIR" ||
        str.startsWith("DESIGNS") ||
        rx.length === 1 && (rx[0] === 0x04 || rx[0] === 0x05 || rx[0] === 0x06)
    ) {
        if (q.length === 0) return Buffer.from("0\r\n");
        const list = q.map(d => d.name).join("\r\n");
        return Buffer.from(`${q.length}\r\n${list}\r\n`);
    }

    const fetchMatch = str.match(/^(?:GET|SEND|LOAD|READ|FETCH)\s+(.+)$/);
    if (fetchMatch) {
        const requested = fetchMatch[1].trim();
        const design = q.find(d =>
            d.name.toLowerCase() === requested.toLowerCase() ||
            d.name.toLowerCase().replace(".dst", "") === requested.toLowerCase()
        ) || q[0];
        if (!design) return Buffer.from("ERROR NO DESIGN\r\n");
        addOutput(`[tajima] Sending design "${design.name}" (${design.buffer.length} bytes) from queue "${machine}"`);
        const hdr = Buffer.from(`LENGTH=${design.buffer.length}\r\n`);
        const result = Buffer.concat([hdr, design.buffer]);
        removeFromQueue(design.id, machine);
        return result;
    }

    if (rx.length === 1 && rx[0] >= 0x01 && rx[0] <= 0x7f) {
        const idx = rx[0] - 1;
        const design = q[idx] || q[0];
        if (design) {
            addOutput(`[tajima] Sending design[${idx}] "${design.name}" by index byte from queue "${machine}"`);
            removeFromQueue(design.id, machine);
            return design.buffer;
        }
    }

    if (str === "ACK" || str === "OK" || rx.length === 1 && rx[0] === 0x06) {
        return Buffer.from("OK\r\n");
    }

    return null;
}


// ── Minimal FTP Server (port 2121) ───────────────────────────────────────────

let _ftpServer = null;

export function startFtpServer(port = 2121) {
    if (_ftpServer) return;
    _ftpServer = net.createServer(handleFtpConnection);
    _ftpServer.listen(port, "0.0.0.0", () =>
        addOutput(`[tajima] FTP server listening on port ${port}`)
    );
    _ftpServer.on("error", e =>
        addOutput(`[tajima] FTP error: ${e.message}`)
    );
}

function handleFtpConnection(ctrl) {
    const addr    = `${ctrl.remoteAddress}:${ctrl.remotePort}`;
    const machine = _queueForIP(ctrl.remoteAddress);
    addOutput(`[tajima] FTP client connected: ${addr}  (queue: "${machine}")`);

    let pasvSrv   = null;
    let transferBuf = null;
    let lineBuf   = "";

    ctrl.write("220 Pythias Tajima Design Server\r\n");

    ctrl.on("data", chunk => {
        lineBuf += chunk.toString("ascii");
        let nl;
        while ((nl = lineBuf.indexOf("\r\n")) !== -1) {
            const line = lineBuf.slice(0, nl).trim();
            lineBuf = lineBuf.slice(nl + 2);
            handleFtpCommand(line);
        }
    });

    ctrl.on("close", () => {
        if (pasvSrv) pasvSrv.close();
        addOutput(`[tajima] FTP client disconnected: ${addr}`);
    });

    ctrl.on("error", () => { if (pasvSrv) pasvSrv.close(); });

    function send(code, msg) { ctrl.write(`${code} ${msg}\r\n`); }

    function handleFtpCommand(line) {
        const [cmd, ...rest] = line.split(" ");
        const arg = rest.join(" ");
        addOutput(`[tajima] FTP CMD (${machine}): ${line}`);
        const q = _getQueue(machine);

        switch (cmd.toUpperCase()) {
            case "USER": send(331, "Password required"); break;
            case "PASS": send(230, "Logged in"); break;
            case "SYST": send(215, "UNIX Type: L8"); break;
            case "TYPE": send(200, "Type set"); break;
            case "PWD":  send(257, '"/designs" is current directory'); break;
            case "CWD":  send(250, "Directory changed"); break;
            case "PASV": {
                if (pasvSrv) { try { pasvSrv.close(); } catch {} }
                pasvSrv = net.createServer();
                pasvSrv.listen(0, "0.0.0.0", () => {
                    const pasvPort = pasvSrv.address().port;
                    const ip = ctrl.localAddress.replace(/::ffff:/, "").split(".").join(",");
                    const p1 = Math.floor(pasvPort / 256);
                    const p2 = pasvPort % 256;
                    send(227, `Entering Passive Mode (${ip},${p1},${p2})`);
                });
                pasvSrv.on("connection", dataConn => { transferBuf = dataConn; });
                break;
            }
            case "LIST": {
                send(150, "Opening data connection");
                const listing = q.map(d =>
                    `-rw-r--r-- 1 tajima tajima ${d.buffer.length} Jan 01 00:00 ${d.name}`
                ).join("\r\n");
                waitForDataConn(() => {
                    transferBuf.write(listing ? listing + "\r\n" : "\r\n");
                    transferBuf.end();
                    transferBuf = null;
                    send(226, "Transfer complete");
                });
                break;
            }
            case "RETR": {
                const design = q.find(d =>
                    d.name.toLowerCase() === arg.toLowerCase() ||
                    d.name.toLowerCase().replace(".dst", "") === arg.toLowerCase()
                ) || q[0];
                if (!design) { send(550, "File not found"); break; }
                send(150, `Opening binary data connection for ${design.name}`);
                waitForDataConn(() => {
                    addOutput(`[tajima] FTP: sending "${design.name}" (${design.buffer.length} bytes) from queue "${machine}"`);
                    transferBuf.write(design.buffer);
                    transferBuf.end();
                    transferBuf = null;
                    removeFromQueue(design.id, machine);
                    send(226, "Transfer complete");
                });
                break;
            }
            case "DELE": {
                const d = q.find(item => item.name.toLowerCase() === arg.toLowerCase());
                if (d) removeFromQueue(d.id, machine);
                send(250, "File deleted");
                break;
            }
            case "QUIT":
                send(221, "Goodbye");
                ctrl.end();
                break;
            default:
                send(502, "Command not implemented");
        }
    }

    function waitForDataConn(cb) {
        if (transferBuf) { cb(); return; }
        const start = Date.now();
        const poll = setInterval(() => {
            if (transferBuf) { clearInterval(poll); cb(); return; }
            if (Date.now() - start > 5000) {
                clearInterval(poll);
                send(425, "Cannot open data connection");
            }
        }, 50);
    }
}
