import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getConnInfo } from '@hono/node-server/conninfo';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { AuthError, createChallenge, isAddress, readSession, signSession, verifySignIn } from './auth.js';
import type { Config } from './config.js';
import type { Db, SiteRow } from './db.js';
import type { GenerateInput } from './generate.js';
import { getAccess } from './gate.js';
import { IMAGE_FILE, MIME_BY_EXT, sniffImage } from './images.js';
import { isSignature, LaunchError, NotConfirmedYet, prepareLaunch, verifyLaunch } from './launch.js';
import { ModerationUnavailable, type Moderate } from './moderation.js';
import { RateLimiter } from './ratelimit.js';
import { renderSite, WIDGET_HASH } from './render.js';
import type { Rpc } from './rpc.js';
import type { SiteSpec } from './spec.js';
import { analyze, fetchMintFacts, isMintAddress, type Check } from './transparency.js';

export interface Deps {
  cfg: Config;
  db: Db;
  rpc: Rpc;
  generate: (input: GenerateInput) => Promise<SiteSpec>;
  moderate: Moderate;
}

const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const DAY_MS = 24 * 60 * 60 * 1000;
const SITE_ID = /^[0-9a-f]{16}$/;

export function createApp({ cfg, db, rpc, generate, moderate }: Deps) {
  const app = new Hono();
  const origin = new URL(cfg.publicUrl).origin;
  const cookieName = cfg.secureCookies ? '__Host-session' : 'session';
  const proto = new URL(cfg.publicUrl).protocol;

  const authLimit = new RateLimiter(30, 10 * 60 * 1000);
  const draftIpLimit = new RateLimiter(20, 60 * 60 * 1000);
  const prepareLimit = new RateLimiter(10, 60 * 60 * 1000);
  const checkLimit = new RateLimiter(30, 60 * 1000);
  const checkCache = new Map<string, { at: number; checks: Check[] }>();

  const clientIp = (c: Context): string => {
    if (cfg.trustProxy) return c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    try {
      return getConnInfo(c).remote.address ?? 'local';
    } catch {
      return 'local';
    }
  };
  const siteUrl = (id: string) => (cfg.sitesDomain ? `${proto}//${id}.${cfg.sitesDomain}` : `${cfg.publicUrl}/s/${id}`);
  const pathImages = (site: SiteRow) => site.images.map((f) => `/s/${site.id}/${f}`);
  const rootImages = (site: SiteRow) => site.images.map((f) => `/${f}`);
  const sessionAddress = (c: Context) => readSession(cfg, getCookie(c, cookieName));

  const siteCsp = `default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; script-src ${WIDGET_HASH}; connect-src ${origin}; base-uri 'none'; form-action 'none'; frame-ancestors ${origin}`;
  const previewCsp = "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'";
  const appCsp = "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";

  // --- Coin-Seiten auf eigener Origin (<id>.<sitesDomain>), ohne Cookies der App ---
  const serveImage = async (id: string, file: string) => {
    const site = SITE_ID.test(id) ? db.getSite(id) : null;
    const ext = IMAGE_FILE.exec(file)?.[1];
    if (!site || !ext || !site.images.includes(file)) return new Response('Not found', { status: 404 });
    const data = await readFile(join(cfg.dataDir, 'sites', id, file)).catch(() => null);
    if (!data) return new Response('Not found', { status: 404 });
    return new Response(data, {
      headers: { 'content-type': MIME_BY_EXT[ext], 'x-content-type-options': 'nosniff', 'cache-control': 'public, max-age=3600', 'cross-origin-resource-policy': 'cross-origin' },
    });
  };
  const servePublished = (id: string, rooted: boolean) => {
    const site = SITE_ID.test(id) ? db.getSite(id) : null;
    if (!site || site.status !== 'launched') return new Response('Not found', { status: 404 });
    const html = renderSite(site.spec, { images: rooted ? rootImages(site) : pathImages(site), mint: site.mint, apiBase: origin });
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': siteCsp, 'cache-control': 'no-cache' } });
  };

  app.use('*', async (c, next) => {
    const host = (c.req.header('host') ?? '').toLowerCase().split(':')[0];
    if (cfg.sitesDomain && host.endsWith(`.${cfg.sitesDomain}`)) {
      if (c.req.method !== 'GET' && c.req.method !== 'HEAD') return c.text('Method not allowed', 405);
      const id = host.slice(0, -(cfg.sitesDomain.length + 1));
      const path = new URL(c.req.url).pathname;
      return path === '/' ? servePublished(id, true) : serveImage(id, path.slice(1));
    }
    await next();
  });

  // Sicherheits-Header und CSRF-Schutz (zusätzlich zu SameSite=Strict)
  app.use('*', async (c, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
      const o = c.req.header('origin');
      if (o && o !== origin) return c.json({ error: 'Anfrage von fremder Origin abgelehnt.' }, 403);
    }
    await next();
    c.res.headers.set('x-content-type-options', 'nosniff');
    c.res.headers.set('referrer-policy', 'no-referrer');
    if (!c.res.headers.has('content-security-policy')) c.res.headers.set('content-security-policy', appCsp);
  });

  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: 'Interner Fehler.' }, 500);
  });

  // --- Statische Dateien der App ---
  const staticFile = (name: string, type: string) => async (c: Context) => {
    const body = await readFile(join(process.cwd(), 'public', name)).catch(() => null);
    return body ? c.body(body, 200, { 'content-type': type, 'cache-control': 'no-cache' }) : c.notFound();
  };
  app.get('/', staticFile('index.html', 'text/html; charset=utf-8'));
  app.get('/app.js', staticFile('app.js', 'text/javascript; charset=utf-8'));
  app.get('/favicon.ico', (c) => c.body(null, 204));

  app.get('/api/config', (c) =>
    c.json({
      publicUrl: cfg.publicUrl,
      gateMint: cfg.gateMint ?? null,
      gateTiers: cfg.gateTiers,
      feeLamports: cfg.feeLamports,
      feeWallet: cfg.feeLamports > 0 ? cfg.feeWallet ?? null : null,
      maxImages: MAX_IMAGES,
    }),
  );

  // --- Login per Wallet-Signatur ---
  const json = async (c: Context): Promise<Record<string, unknown>> => {
    const body = await c.req.json().catch(() => null);
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  };
  const jsonLimit = bodyLimit({ maxSize: 16 * 1024, onError: (c) => c.json({ error: 'Anfrage zu groß.' }, 413) });

  app.post('/api/auth/nonce', jsonLimit, async (c) => {
    if (!authLimit.take(clientIp(c))) return c.json({ error: 'Zu viele Anfragen.' }, 429);
    const { address } = await json(c);
    if (!isAddress(address)) return c.json({ error: 'Ungültige Adresse.' }, 400);
    return c.json(createChallenge(db, cfg, address));
  });

  const me = async (address: string, fresh = false) => {
    const access = await getAccess(cfg, db, rpc, address, { fresh });
    return {
      address,
      access,
      sites: db.listSites(address).map((s) => ({
        id: s.id, status: s.status, name: s.spec.name, symbol: s.spec.symbol, mint: s.mint, url: s.status === 'launched' ? siteUrl(s.id) : null,
      })),
    };
  };

  app.post('/api/auth/verify', jsonLimit, async (c) => {
    if (!authLimit.take(clientIp(c))) return c.json({ error: 'Zu viele Anfragen.' }, 429);
    const { address, message, signature } = await json(c);
    if (typeof address !== 'string' || typeof message !== 'string' || typeof signature !== 'string') return c.json({ error: 'Unvollständige Anfrage.' }, 400);
    try {
      verifySignIn(db, cfg, { address, message, signature });
    } catch (e) {
      if (e instanceof AuthError) return c.json({ error: e.message }, 401);
      throw e;
    }
    setCookie(c, cookieName, signSession(cfg, address), { httpOnly: true, sameSite: 'Strict', secure: cfg.secureCookies, path: '/', maxAge: 7 * 24 * 60 * 60 });
    return c.json(await me(address));
  });

  app.post('/api/auth/logout', (c) => {
    deleteCookie(c, cookieName, { path: '/', secure: cfg.secureCookies });
    return c.json({ ok: true });
  });

  app.get('/api/me', async (c) => {
    const address = sessionAddress(c);
    return address ? c.json(await me(address)) : c.json({ address: null });
  });

  // --- Entwürfe ---
  app.post('/api/sites', bodyLimit({ maxSize: MAX_IMAGES * MAX_IMAGE_BYTES + 128 * 1024, onError: (c) => c.json({ error: 'Anfrage zu groß.' }, 413) }), async (c) => {
    const address = sessionAddress(c);
    if (!address) return c.json({ error: 'Bitte zuerst anmelden.' }, 401);
    const access = await getAccess(cfg, db, rpc, address);
    if (!access.allowed) return c.json({ error: access.reason ?? 'Kein Zugang.' }, 403);
    if (!draftIpLimit.take(clientIp(c)) || db.countEvents(address, 'draft', DAY_MS) >= 10) {
      return c.json({ error: 'Du hast heute genug Entwürfe erstellt. Versuche es morgen wieder.' }, 429);
    }

    const body = await c.req.parseBody({ all: true });
    const idea = String(body.idea ?? '').trim();
    if (idea.length < 10 || idea.length > 1000) return c.json({ error: 'Die Idee braucht 10 bis 1000 Zeichen.' }, 400);
    if (body.rights !== 'true') return c.json({ error: 'Bitte bestätige die Rechte an den Bildern.' }, 400);

    const files = ([] as unknown[]).concat(body.images ?? []).filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length > MAX_IMAGES) return c.json({ error: `Höchstens ${MAX_IMAGES} Bilder.` }, 400);
    const images: { mime: string; ext: string; data: Buffer }[] = [];
    for (const f of files) {
      if (f.size > MAX_IMAGE_BYTES) return c.json({ error: 'Ein Bild ist größer als 2 MB.' }, 400);
      const data = Buffer.from(await f.arrayBuffer());
      const type = sniffImage(data);
      if (!type) return c.json({ error: 'Nur echte PNG-, JPG-, WebP- oder GIF-Dateien sind erlaubt.' }, 400);
      images.push({ ...type, data });
    }

    db.logEvent(address, 'draft'); // zählt auch bei Ablehnung, damit das Limit nicht durch Probieren umgangen wird
    let spec: SiteSpec;
    try {
      spec = await generate({ idea, name: String(body.name ?? ''), symbol: String(body.symbol ?? ''), imageCount: images.length });
      const verdict = await moderate({ idea, spec, images });
      if (!verdict.allowed) return c.json({ error: `Abgelehnt: ${verdict.reasons.join(' ')}` }, 422);
    } catch (e) {
      if (e instanceof ModerationUnavailable) return c.json({ error: e.message }, 503);
      return c.json({ error: e instanceof Error ? e.message : 'Generierung fehlgeschlagen.' }, 502);
    }

    const id = randomBytes(8).toString('hex');
    const dir = join(cfg.dataDir, 'sites', id);
    await mkdir(dir, { recursive: true });
    const files2: string[] = [];
    for (const [i, img] of images.entries()) {
      const name = `img-${i}.${img.ext}`;
      await writeFile(join(dir, name), img.data);
      files2.push(name);
    }
    db.insertSite({ id, owner: address, spec, images: files2 });
    return c.json({ id, status: 'draft', spec, preview: `/api/sites/${id}/preview` });
  });

  const ownedSite = (c: Context): { site: SiteRow } | { error: Response } => {
    const address = sessionAddress(c);
    if (!address) return { error: c.json({ error: 'Bitte zuerst anmelden.' }, 401) };
    const id = c.req.param('id') ?? '';
    const site = SITE_ID.test(id) ? db.getSite(id) : null;
    // Fremde Seiten sehen genauso aus wie nicht vorhandene
    if (!site || site.owner !== address) return { error: c.json({ error: 'Nicht gefunden.' }, 404) };
    return { site };
  };

  app.get('/api/sites/:id/preview', (c) => {
    const r = ownedSite(c);
    if ('error' in r) return r.error;
    const html = renderSite(r.site.spec, { images: pathImages(r.site), mint: r.site.mint, apiBase: origin, interactive: false });
    return c.html(html, 200, { 'content-security-policy': previewCsp });
  });

  // --- Launch ---
  app.post('/api/sites/:id/launch/prepare', jsonLimit, async (c) => {
    const r = ownedSite(c);
    if ('error' in r) return r.error;
    const { site } = r;
    if (site.status === 'launched') return c.json({ error: 'Dieser Coin ist schon gestartet.' }, 409);
    if (!prepareLimit.take(site.owner)) return c.json({ error: 'Zu viele Versuche. Bitte warte etwas.' }, 429);

    // Frisch prüfen, ohne Cache: ein kurz geliehener Bestand soll nicht für den Launch reichen
    const access = await getAccess(cfg, db, rpc, site.owner, { fresh: true });
    if (!access.allowed) return c.json({ error: access.reason ?? 'Kein Zugang.' }, 403);
    if (access.remaining < 1) return c.json({ error: 'Dein Tageskontingent für Launches ist aufgebraucht.' }, 429);

    try {
      const uri = `${cfg.publicUrl}/m/${site.id}.json`;
      const prepared = await prepareLaunch(cfg, rpc, { owner: site.owner, name: site.spec.name, symbol: site.spec.symbol, uri });
      db.setPending(site.id, prepared.mint);
      return c.json({
        ...prepared,
        name: site.spec.name,
        symbol: site.spec.symbol,
        feeLamports: cfg.feeLamports,
        feeWallet: cfg.feeLamports > 0 ? cfg.feeWallet ?? null : null,
      });
    } catch (e) {
      if (e instanceof LaunchError) return c.json({ error: e.message }, 400);
      console.error(e);
      return c.json({ error: 'Die Transaktion konnte nicht vorbereitet werden (RPC nicht erreichbar?).' }, 502);
    }
  });

  app.post('/api/sites/:id/launch/confirm', jsonLimit, async (c) => {
    const r = ownedSite(c);
    if ('error' in r) return r.error;
    const { site } = r;
    if (site.status === 'launched') return c.json({ error: 'Dieser Coin ist schon gestartet.' }, 409);
    const { signature } = await json(c);
    if (!isSignature(signature)) return c.json({ error: 'Ungültige Signatur.' }, 400);
    if (!site.pendingMint) return c.json({ error: 'Es wurde noch kein Launch vorbereitet.' }, 409);

    try {
      await verifyLaunch(rpc, { owner: site.owner, mint: site.pendingMint, signature });
    } catch (e) {
      if (e instanceof NotConfirmedYet) return c.json({ pending: true, error: e.message }, 202);
      if (e instanceof LaunchError) return c.json({ error: e.message }, 422);
      console.error(e);
      return c.json({ error: 'Die Transaktion konnte nicht geprüft werden (RPC nicht erreichbar?).' }, 502);
    }
    try {
      db.markLaunched(site.id, site.pendingMint, signature);
    } catch {
      return c.json({ error: 'Diese Transaktion wurde schon verwendet.' }, 409);
    }
    db.logEvent(site.owner, 'launch');
    return c.json({ mint: site.pendingMint, siteUrl: siteUrl(site.id), pumpUrl: `https://pump.fun/coin/${site.pendingMint}` });
  });

  // --- Öffentlich: Seite (Pfad-Modus für die Entwicklung), Bilder, Metadaten, Live-Check ---
  app.get('/s/:id', (c) => servePublished(c.req.param('id'), false));
  app.get('/s/:id/:file', (c) => serveImage(c.req.param('id'), c.req.param('file')));

  app.get('/m/:file', (c) => {
    const id = c.req.param('file').replace(/\.json$/, '');
    const site = SITE_ID.test(id) ? db.getSite(id) : null;
    if (!site || site.status === 'draft') return c.notFound();
    return c.json(
      {
        name: site.spec.name,
        symbol: site.spec.symbol,
        description: site.spec.about,
        image: site.images[0] ? `${cfg.publicUrl}/s/${id}/${site.images[0]}` : undefined,
        showName: true,
        createdOn: 'https://pump.fun',
        website: siteUrl(id),
      },
      200,
      { 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=300' },
    );
  });

  app.get('/api/check/:mint', async (c) => {
    const mint = c.req.param('mint');
    if (!isMintAddress(mint)) return c.json({ error: 'Ungültige Adresse.' }, 400);
    const cors = { 'access-control-allow-origin': '*' };
    const hit = checkCache.get(mint);
    if (hit && Date.now() - hit.at < 30_000) return c.json({ mint, checks: hit.checks }, 200, cors);
    if (!checkLimit.take(clientIp(c))) return c.json({ error: 'Zu viele Anfragen.' }, 429, cors);
    try {
      const checks = analyze(await fetchMintFacts(rpc, mint));
      checkCache.set(mint, { at: Date.now(), checks });
      if (checkCache.size > 1000) checkCache.clear();
      return c.json({ mint, checks }, 200, cors);
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : 'Abfrage fehlgeschlagen.' }, 502, cors);
    }
  });

  return app;
}
