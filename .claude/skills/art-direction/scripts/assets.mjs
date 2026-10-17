#!/usr/bin/env node
// Find real pictures in open collections (no API keys), filtered by licence, and download them with credits.
//   node assets.mjs search "<subject>" [--src openverse,commons,met,aic,nasa] [--license safe|cc0|any] [--min 1000] [--n 24]
//   node assets.mjs get "<subject>" --n 6 [--to assets] [--pick 1,4,7]     downloads and appends to <to>/credits.json
//   node assets.mjs credits [--to assets]                                   prints footer HTML for the credits
// Licences: "cc0" = public domain only; "safe" (default) adds CC BY and CC BY-SA (credit required, BY-SA shares alike);
// "any" also shows NC/ND, which are never fine for a commercial site. Always check the landing page before use.
import fs from "node:fs"; import path from "node:path";

const args = process.argv.slice(2), cmd = args[0], q = args[1] && !args[1].startsWith("--") ? args[1] : "";
const opt = (k, d) => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1] : d; };
const SRC = opt("src", "openverse,commons,met,aic,nasa").split(","), LIC = opt("license", "safe"), MIN = Number(opt("min", 1000)), N = Number(opt("n", 24));
const TO = path.resolve(opt("to", "assets")), UA = "art-direction-skill/1.0 (asset search for a website build)";
const get = async (url, as = "json") => { const r = await fetch(url, { headers: { "User-Agent": UA, Accept: as === "json" ? "application/json" : "*/*" }, signal: AbortSignal.timeout(20000) }); if (!r.ok) throw new Error(r.status + " " + url.slice(0, 60)); return as === "json" ? r.json() : Buffer.from(await r.arrayBuffer()); };
const norm = (l) => { l = String(l || "").toLowerCase().replace(/[\s_-]+/g, ""); return /^(cc0|pdm|pdmark|publicdomain|pd|nokncownrestrictions)/.test(l) ? "cc0" : /bysa/.test(l) ? "by-sa" : /bync|nc/.test(l) ? "nc" : /bynd|nd/.test(l) ? "nd" : /^(ccby|by)\b|^ccby\d|^by\d/.test(l) ? "by" : l || "unknown"; };
const okLicence = (l) => LIC === "any" ? true : LIC === "cc0" ? l === "cc0" : ["cc0", "by", "by-sa"].includes(l);
const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
const onSubject = (t) => !words.length || words.some((w) => String(t).toLowerCase().includes(w));

/* ---------- sources: each returns [{ src, title, author, licence, url, page, w, h }] ---------- */
const SOURCES = {
  async openverse() {
    const j = await get(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&license=${LIC === "cc0" ? "cc0,pdm" : "cc0,pdm,by,by-sa"}&page_size=20`); // anonymous limit: 20 per page
    return (j.results || []).map((r) => ({ src: "openverse", title: r.title, author: r.creator, licence: norm(r.license), url: r.url, page: r.foreign_landing_url, w: r.width, h: r.height }));
  },
  async commons() {
    const j = await get(`https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=30&gsrsearch=${encodeURIComponent(q + " filetype:bitmap")}&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=2000`);
    return Object.values(j.query?.pages || {}).map((p) => { const i = p.imageinfo?.[0] || {}, m = i.extmetadata || {}; const strip = (s) => String(s?.value || "").replace(/<[^>]+>/g, "").trim();
      return { src: "commons", title: p.title.replace(/^File:/, "").replace(/\.\w+$/, ""), author: strip(m.Artist).slice(0, 80), licence: norm(strip(m.LicenseShortName)), url: i.thumburl || i.url, page: i.descriptionurl, w: i.width, h: i.height }; });
  },
  async met() {
    const s = await get(`https://collectionapi.metmuseum.org/public/collection/v1.1/search?hasImages=true&limit=20&q=${encodeURIComponent(q)}`); // v1 search retired 2026-10-01
    const ids = (s.objectIDs || []).slice(0, 20), out = [];
    for (const id of ids) { try { const o = await get(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`); if (o.isPublicDomain && o.primaryImage && onSubject(o.title + " " + o.objectName + " " + (o.tags || []).map((t) => t.term).join(" "))) out.push({ src: "met", title: o.title, author: o.artistDisplayName || o.culture || "The Met", licence: "cc0", url: o.primaryImage, page: o.objectURL, w: 0, h: 0 }); } catch {} }
    return out;
  },
  async aic() {
    const j = await get(`https://api.artic.edu/api/v1/artworks/search?q=${encodeURIComponent(q)}&fields=id,title,image_id,artist_title,is_public_domain,thumbnail&limit=30`);
    return (j.data || []).filter((a) => a.is_public_domain && a.image_id && onSubject(a.title)).map((a) => ({ src: "aic", title: a.title, author: a.artist_title || "Art Institute of Chicago", licence: "cc0", url: `https://www.artic.edu/iiif/2/${a.image_id}/full/843,/0/default.jpg`, page: `https://www.artic.edu/artworks/${a.id}`, w: a.thumbnail?.width || 0, h: a.thumbnail?.height || 0 }));
  },
  async nasa() {
    const j = await get(`https://images-api.nasa.gov/search?media_type=image&q=${encodeURIComponent(q)}`);
    return (j.collection?.items || []).slice(0, 30).map((it) => { const d = it.data?.[0] || {}; return { src: "nasa", title: d.title, author: d.photographer || d.secondary_creator || "NASA", licence: "cc0", url: (it.links?.[0]?.href || "").replace("~thumb", "~large"), page: `https://images.nasa.gov/details/${d.nasa_id}`, w: 0, h: 0, note: "NASA: no endorsement implied; no NASA logos" }; });
  },
};

// fetch the first bytes and read the real size (JPEG/PNG/WebP), so dead links and tiny files are dropped
async function probe(url) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Range: "bytes=0-65535" }, signal: AbortSignal.timeout(15000) }); if (!r.ok && r.status !== 206) return null;
    const b = Buffer.from(await r.arrayBuffer());
    if (b[0] === 0x89 && b[1] === 0x50) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), type: "png" };
    if (b.slice(0, 4).toString() === "RIFF" && b.slice(8, 12).toString() === "WEBP") { const f = b.slice(12, 16).toString(); if (f === "VP8X") return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3), type: "webp" }; if (f === "VP8 ") return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff, type: "webp" }; return { w: 0, h: 0, type: "webp" }; }
    if (b[0] === 0xff && b[1] === 0xd8) { let i = 2; while (i < b.length - 9) { if (b[i] !== 0xff) { i++; continue; } const m = b[i + 1]; if (m >= 0xc0 && m <= 0xc3) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7), type: "jpg" }; i += 2 + b.readUInt16BE(i + 2); } return { w: 0, h: 0, type: "jpg" }; }
    return null;
  } catch { return null; }
}

async function search() {
  if (!q) { console.error('usage: assets.mjs search "<subject>"'); process.exit(2); }
  const lists = await Promise.all(SRC.map(async (s) => { try { return await SOURCES[s](); } catch (e) { console.error(`  ${s}: ${e.message}`); return []; } }));
  const seen = new Set(), all = lists.flat().filter((r) => r.url && !seen.has(r.url) && seen.add(r.url) && okLicence(r.licence));
  const out = [];
  for (const r of all) { if (out.length >= N) break; const p = await probe(r.url); if (!p) continue; r.w = p.w || r.w; r.h = p.h || r.h; r.type = p.type; if (Math.max(r.w, r.h) && Math.max(r.w, r.h) < MIN) continue; out.push(r); }
  return out;
}

const slug = (s) => String(s || "image").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "image";
const LABEL = { cc0: "Public domain", by: "CC BY", "by-sa": "CC BY-SA", nc: "CC BY-NC", nd: "CC BY-ND" };

if (cmd === "search") {
  const out = await search();
  out.forEach((r, i) => console.log(`${String(i + 1).padStart(2)}. [${r.src}] ${r.w}×${r.h} ${LABEL[r.licence] || r.licence} · ${String(r.title).slice(0, 60)} — ${String(r.author || "").slice(0, 30)}\n    ${r.url}\n    ${r.page}`));
  console.log(`${out.length} results (licence ${LIC}, min ${MIN}px). Get them: assets.mjs get "${q}" --pick 1,2,3`);
} else if (cmd === "get") {
  const out = await search(), pick = opt("pick", ""), chosen = pick ? pick.split(",").map((n) => out[Number(n) - 1]).filter(Boolean) : out.slice(0, Number(opt("n", 6)));
  fs.mkdirSync(TO, { recursive: true }); const credFile = path.join(TO, "credits.json"); const credits = fs.existsSync(credFile) ? JSON.parse(fs.readFileSync(credFile, "utf8")) : [];
  for (const r of chosen) {
    try { const buf = await get(r.url, "buf"); let name = `${slug(r.title)}.${r.type || "jpg"}`, k = 1; while (fs.existsSync(path.join(TO, name))) name = `${slug(r.title)}-${++k}.${r.type || "jpg"}`;
      fs.writeFileSync(path.join(TO, name), buf); credits.push({ file: name, title: r.title, author: r.author, licence: r.licence, source: r.src, page: r.page, url: r.url, ...(r.note ? { note: r.note } : {}) }); console.log(`  saved ${name} (${Math.round(buf.length / 1024)} KB, ${LABEL[r.licence] || r.licence})`); }
    catch (e) { console.error(`  failed ${r.url}: ${e.message}`); }
  }
  fs.writeFileSync(credFile, JSON.stringify(credits, null, 2)); console.log(`credits: ${path.relative(process.cwd(), credFile)} (${credits.length} images)`);
} else if (cmd === "credits") {
  const credits = JSON.parse(fs.readFileSync(path.join(TO, "credits.json"), "utf8"));
  const esc = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  console.log(`<p class="credits">Images: ${credits.map((c) => `<a href="${esc(c.page)}">${esc(c.title)}</a> by ${esc(c.author || "unknown")} (${LABEL[c.licence] || esc(c.licence)})`).join(" · ")}</p>`);
} else { console.log("usage: assets.mjs search|get|credits \"<subject>\" [options]  (see the header of this file)"); }
