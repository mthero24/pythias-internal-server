import axios from "axios";

// Talking to a File Writer on a station machine.
//
// Every print route here proxies to port 3500 on some station's IP, and when that fails the floor
// used to get a raw axios error — "ETIMEDOUT 192.168.6.183" and nothing else. That cost a day once
// (TK-0088): a station machine came back on the Public network profile, Windows stopped letting the
// traffic through, and the message said nothing about which station it was, what was configured for
// it, or that a timeout means the address rather than the service.
//
// So: name the station, name the IP, and say what the failure actually means.

// Print jobs can carry a big payload, but nothing here should hang for the OS default of ~2 minutes.
const DEFAULT_TIMEOUT = 20000;

/** Look up a station's IP and fail clearly when it is not configured. */
export function hostFor(map, key, label) {
    const host = map?.[key];
    if (!host) {
        const known = Object.keys(map ?? {}).join(", ") || "none";
        throw new Error(`No IP is set for ${label} "${key}". Add it under Settings on this server. Configured: ${known}.`);
    }
    return host;
}

/** Turn an axios failure into a sentence someone on the floor can act on. */
export function describeError(e, { label, host, port = 3500 }) {
    const where = `${label} at ${host}:${port}`;

    // The File Writer answered and said no — its own message is the useful one.
    if (e?.response) {
        const body = e.response.data;
        const detail = typeof body === "string" ? body : (body?.msg ?? JSON.stringify(body ?? {}));
        return `${where} rejected the job (HTTP ${e.response.status}): ${detail}`;
    }

    switch (e?.code) {
        case "ETIMEDOUT":
        case "ECONNABORTED":
            return `${where} never answered. Nothing is listening on that address, or something is dropping the traffic — `
                 + `most often the station machine has picked up a different IP, or Windows has come back on the Public `
                 + `network profile so its firewall rules no longer apply. Check ipconfig on that machine, and that the IP `
                 + `configured here still matches it.`;
        case "ECONNREFUSED":
            return `${where} refused the connection. The machine is reachable, so the address is right — the File Writer `
                 + `itself is not running on it. Start Pythias File Writer on that machine.`;
        case "ECONNRESET":
        case "EPIPE":
            return `${where} dropped the connection part-way through. The address is right and something is listening, `
                 + `so this is the File Writer stopping mid-job — check it is still running on that machine, and that `
                 + `it did not restart or update while the job was going.`;
        case "EHOSTUNREACH":
        case "ENETUNREACH":
            return `${where} cannot be reached at all — this server has no route to that address. Check they are on the same network.`;
        case "ENOTFOUND":
            return `${where} could not be resolved. The value configured for ${label} is not a usable address.`;
        default:
            return `${where} failed: ${e?.code ?? ""} ${e?.message ?? String(e)}`.trim();
    }
}

/**
 * POST to a File Writer. Resolves with its response body, or throws an Error whose message is
 * already fit to show someone.
 */
export async function proxyPost(host, path, data, { label, timeout = DEFAULT_TIMEOUT, port = 3500 } = {}) {
    try {
        const res = await axios.post(`http://${host}:${port}${path}`, data, { timeout });
        return res.data;
    } catch (e) {
        // A File Writer that answers with its own error body is not a transport failure — pass it
        // straight back, the way these routes always have.
        if (e?.response?.data && typeof e.response.data === "object") return e.response.data;
        throw new Error(describeError(e, { label, host, port }));
    }
}
