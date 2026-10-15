// Where the brain hears the world. Both sources reconnect forever with backoff and never throw:
// if pump.fun changes something, chat just goes quiet and the stream carries on.
import WebSocket from "ws";

function backoff(n) { return Math.min(60_000, 1000 * 2 ** Math.min(n, 6)); }

// pump.fun coin chat. There is no official API: this speaks the same socket.io (Engine.IO v4) protocol
// as the pump.fun website (see the open-source pump-chat-client). Best effort, verified at launch.
export class PumpChat {
  constructor({ roomId, url = process.env.PUMP_CHAT_URL || "wss://livechat.pump.fun/socket.io/?EIO=4&transport=websocket", onMessage, log }) {
    Object.assign(this, { roomId, url, onMessage, log });
    this.state = { connected: false, joined: false, lastMessageAt: 0, messages: 0, reconnects: 0, lastError: "" };
    this.fails = 0; this.ws = null; this.stopped = false; this.seen = new Set();
  }
  start() { this.connect(); return this; }
  stop() { this.stopped = true; try { this.ws?.terminate(); } catch {} }
  connect() {
    if (this.stopped) return;
    const ws = new WebSocket(this.url, { headers: { Origin: "https://pump.fun", "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/138 Safari/537.36" }, handshakeTimeout: 15_000 });
    this.ws = ws;
    let alive = Date.now();
    const watchdog = setInterval(() => { if (Date.now() - alive > 90_000) { this.state.lastError = "silent connection"; ws.terminate(); } }, 15_000);
    ws.on("open", () => { this.state.connected = true; });
    ws.on("message", (buf) => {
      alive = Date.now();
      const data = buf.toString();
      try { this.handle(ws, data); } catch (e) { this.state.lastError = `parse: ${e.message}`; }
    });
    ws.on("error", (e) => { this.state.lastError = e.message; });
    ws.on("close", () => {
      clearInterval(watchdog);
      Object.assign(this.state, { connected: false, joined: false });
      if (this.stopped) return;
      const wait = backoff(this.fails++);
      this.state.reconnects++;
      setTimeout(() => this.connect(), wait);
    });
  }
  handle(ws, data) {
    if (data === "2") return ws.send("3");                    // server ping -> pong
    if (data.startsWith("0")) {                               // engine open -> socket.io connect
      return ws.send(`40${JSON.stringify({ origin: "https://pump.fun", timestamp: Date.now(), token: null })}`);
    }
    if (data.startsWith("40")) {                              // connected -> join the coin's room
      this.fails = 0;
      return ws.send(`420${JSON.stringify(["joinRoom", { roomId: this.roomId, username: "anonymous" }])}`);
    }
    if (data.startsWith("43")) { this.state.joined = true; return; } // join acknowledged
    if (data.startsWith("42")) {
      const [event, payload] = JSON.parse(data.slice(2));
      if (event !== "newMessage" || !payload) return;
      this.state.joined = true;
      const id = String(payload.id || `${payload.userAddress}:${payload.timestamp}`);
      if (this.seen.has(id)) return;
      this.seen.add(id); if (this.seen.size > 2000) this.seen = new Set([...this.seen].slice(-1000));
      const ts = Date.parse(payload.timestamp) || Date.now();
      if (Date.now() - ts > 120_000) return;                  // old history, not live chat
      this.state.messages++; this.state.lastMessageAt = Date.now();
      this.onMessage({ id, text: String(payload.message || ""), wallet: String(payload.userAddress || payload.username || "anon") });
    }
  }
}

// Live trades of the coin from PumpPortal's data websocket. Only buys matter to the show.
export class Trades {
  constructor({ mint, url = process.env.PUMPPORTAL_URL || "wss://pumpportal.fun/api/data", apiKey = process.env.PUMPPORTAL_API_KEY || "", onBuy, log }) {
    Object.assign(this, { mint, url: apiKey ? `${url}${url.includes("?") ? "&" : "?"}api-key=${encodeURIComponent(apiKey)}` : url, onBuy, log });
    this.state = { connected: false, buys: 0, lastTradeAt: 0, reconnects: 0, lastError: "" };
    this.fails = 0; this.stopped = false; this.ws = null;
  }
  start() { this.connect(); return this; }
  stop() { this.stopped = true; try { this.ws?.terminate(); } catch {} }
  connect() {
    if (this.stopped) return;
    const ws = new WebSocket(this.url, { handshakeTimeout: 15_000 });
    this.ws = ws;
    ws.on("open", () => { this.state.connected = true; this.fails = 0; ws.send(JSON.stringify({ method: "subscribeTokenTrade", keys: [this.mint] })); });
    ws.on("message", (buf) => {
      let m; try { m = JSON.parse(buf.toString()); } catch { return; }
      if (!m || m.mint !== this.mint || !m.txType) return;
      this.state.lastTradeAt = Date.now();
      if (String(m.txType).toLowerCase() === "buy" && m.traderPublicKey) { this.state.buys++; this.onBuy({ wallet: String(m.traderPublicKey) }); }
    });
    ws.on("error", (e) => { this.state.lastError = e.message; });
    ws.on("close", () => {
      this.state.connected = false;
      if (this.stopped) return;
      this.state.reconnects++;
      setTimeout(() => this.connect(), backoff(this.fails++));
    });
  }
}
