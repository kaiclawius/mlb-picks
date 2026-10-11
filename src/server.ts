import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { generateSpec } from './generate.js';
import { renderSite } from './render.js';
import { analyze, fetchMintFacts, isMintAddress } from './transparency.js';

const RPC_URL = process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
const DATA_DIR = join(process.cwd(), 'data', 'sites');
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
// SVG ist bewusst nicht erlaubt (kann Skripte enthalten)
const IMAGE_TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

const app = new Hono();

// Einfaches Limit pro IP, damit die KI-Kosten nicht missbraucht werden können
const hits = new Map<string, number[]>();
function rateLimited(ip: string, max = 5, windowMs = 60 * 60 * 1000): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) return true;
  hits.set(ip, [...recent, now]);
  return false;
}

app.get('/', async (c) => c.html(await readFile(join(process.cwd(), 'public', 'index.html'), 'utf8')));

app.post('/api/generate', async (c) => {
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (rateLimited(ip)) return c.json({ error: 'Zu viele Anfragen. Versuche es später erneut.' }, 429);

  const body = await c.req.parseBody({ all: true });
  const idea = String(body.idea ?? '').trim();
  if (idea.length < 10 || idea.length > 1000) return c.json({ error: 'Die Idee braucht 10 bis 1000 Zeichen.' }, 400);
  if (body.rights !== 'true') return c.json({ error: 'Bitte bestätige, dass du die Rechte an den Bildern hast.' }, 400);

  const files = ([] as unknown[]).concat(body.images ?? []).filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > MAX_IMAGES) return c.json({ error: `Höchstens ${MAX_IMAGES} Bilder.` }, 400);
  for (const f of files) {
    if (!IMAGE_TYPES[f.type]) return c.json({ error: 'Nur PNG, JPG, WebP oder GIF erlaubt.' }, 400);
    if (f.size > MAX_IMAGE_BYTES) return c.json({ error: 'Ein Bild ist größer als 2 MB.' }, 400);
  }

  let spec;
  try {
    spec = await generateSpec({
      idea,
      name: String(body.name ?? ''),
      symbol: String(body.symbol ?? ''),
      imageCount: files.length,
    });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Generierung fehlgeschlagen.' }, 502);
  }

  const id = randomBytes(5).toString('hex');
  const dir = join(DATA_DIR, id);
  await mkdir(dir, { recursive: true });
  const images: string[] = [];
  for (const [i, f] of files.entries()) {
    const name = `img-${i}.${IMAGE_TYPES[f.type]}`;
    await writeFile(join(dir, name), Buffer.from(await f.arrayBuffer()));
    images.push(`/s/${id}/${name}`);
  }
  await writeFile(join(dir, 'spec.json'), JSON.stringify({ spec, images }, null, 2));
  return c.json({ id, url: `/s/${id}`, spec });
});

const SITE_CSP =
  "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'";

app.get('/s/:id', async (c) => {
  const id = c.req.param('id');
  if (!/^[0-9a-f]{10}$/.test(id)) return c.notFound();
  try {
    const { spec, images } = JSON.parse(await readFile(join(DATA_DIR, id, 'spec.json'), 'utf8'));
    const mint = c.req.query('mint');
    return c.html(renderSite(spec, { images, mint: mint && isMintAddress(mint) ? mint : null }), 200, {
      'content-security-policy': SITE_CSP,
    });
  } catch {
    return c.notFound();
  }
});

app.get('/s/:id/:file', async (c) => {
  const { id, file } = c.req.param();
  const ext = /^img-\d\.(png|jpg|webp|gif)$/.exec(file)?.[1];
  if (!/^[0-9a-f]{10}$/.test(id) || !ext) return c.notFound();
  try {
    const type = Object.entries(IMAGE_TYPES).find(([, e]) => e === ext)![0];
    return c.body(await readFile(join(DATA_DIR, id, file)), 200, { 'content-type': type, 'x-content-type-options': 'nosniff' });
  } catch {
    return c.notFound();
  }
});

app.get('/api/check/:mint', async (c) => {
  const mint = c.req.param('mint');
  if (!isMintAddress(mint)) return c.json({ error: 'Ungültige Adresse.' }, 400);
  try {
    return c.json({ mint, checks: analyze(await fetchMintFacts(RPC_URL, mint)) });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Abfrage fehlgeschlagen.' }, 502);
  }
});

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port }, () => console.log(`http://localhost:${port}`));
