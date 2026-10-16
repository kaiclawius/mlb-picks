// Protects the local Stimme server from other websites in your browser.
// 1. DNS rebinding: a page can point its own domain at 127.0.0.1 and then talk to Stimme. Only known host names pass.
// 2. CSRF: any page can send simple POST/PUT/DELETE requests to localhost. Changes are only accepted from Stimme's own pages
//    (or from programs that send no browser Origin header, like Klipp, the MCP server or curl).
import { config } from "./config.js";

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const extra = new Set((process.env.STIMME_ALLOWED_HOSTS || "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean));
const exposed = !LOOPBACK.has(config.host) ; // STIMME_HOST=0.0.0.0 or a LAN address: other devices are meant to reach Stimme

const hostOf = (h) => String(h || "").toLowerCase().replace(/:\d+$/, "");

export function allowedHost(hostHeader) {
  const h = hostOf(hostHeader);
  if (!h) return false;
  if (LOOPBACK.has(h) || extra.has(h) || h.endsWith(".localhost")) return true;
  if (exposed && /^(\d{1,3}\.){3}\d{1,3}$|^\[[0-9a-f:]+\]$/.test(h)) return true; // plain IP addresses in the local network
  return false;
}

/** Returns an error message, or null when the request may proceed. */
export function check(req) {
  if (!allowedHost(req.headers.host)) return "Unbekannter Host. Öffne Stimme über http://localhost:" + config.port + " (oder trage den Namen in STIMME_ALLOWED_HOSTS ein).";
  if (req.method === "GET" || req.method === "HEAD") return null;
  const origin = req.headers.origin;
  const site = req.headers["sec-fetch-site"];
  if (origin && origin !== "null") {
    try { if (new URL(origin).host === req.headers.host) return null; } catch {}
    return "Anfrage von einer fremden Website blockiert.";
  }
  if (origin === "null" || site === "cross-site" || site === "same-site") return "Anfrage von einer fremden Website blockiert.";
  return null;
}
