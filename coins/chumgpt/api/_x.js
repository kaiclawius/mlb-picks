// Minimal X (Twitter) API v2 client with OAuth 1.0a user-context signing.
// Keys come from environment variables set in Vercel, never from the browser.
import crypto from "node:crypto";

const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

function authHeader(method, url, query = {}) {
  const oauth = {
    oauth_consumer_key: process.env.X_API_KEY,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: process.env.X_ACCESS_TOKEN,
    oauth_version: "1.0",
  };
  // JSON bodies are not part of the signature; query parameters are.
  const params = { ...query, ...oauth };
  const paramStr = Object.keys(params).sort().map((k) => `${enc(k)}=${enc(String(params[k]))}`).join("&");
  const base = [method.toUpperCase(), enc(url), enc(paramStr)].join("&");
  const key = `${enc(process.env.X_API_SECRET)}&${enc(process.env.X_ACCESS_SECRET)}`;
  oauth.oauth_signature = crypto.createHmac("sha1", key).update(base).digest("base64");
  return "OAuth " + Object.keys(oauth).sort().map((k) => `${enc(k)}="${enc(oauth[k])}"`).join(", ");
}

export function xConfigured() {
  return ["X_API_KEY", "X_API_SECRET", "X_ACCESS_TOKEN", "X_ACCESS_SECRET"].every((k) => process.env[k]);
}

export async function postTweet(text, replyTo) {
  const url = "https://api.x.com/2/tweets";
  const body = { text };
  if (replyTo) body.reply = { in_reply_to_tweet_id: replyTo };
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: authHeader("POST", url), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`X post failed ${res.status}: ${JSON.stringify(data)}`);
  return data.data;
}

export async function getMentions(userId, sinceIso) {
  const url = `https://api.x.com/2/users/${userId}/mentions`;
  const query = { max_results: "20", start_time: sinceIso, "tweet.fields": "author_id,created_at,conversation_id", expansions: "author_id", "user.fields": "username" };
  const qs = Object.entries(query).map(([k, v]) => `${enc(k)}=${enc(v)}`).join("&");
  const res = await fetch(`${url}?${qs}`, { headers: { Authorization: authHeader("GET", url, query) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`X mentions failed ${res.status}: ${JSON.stringify(data)}`);
  const names = Object.fromEntries((data.includes?.users || []).map((u) => [u.id, u.username]));
  return (data.data || []).map((t) => ({ ...t, username: names[t.author_id] || null }));
}
