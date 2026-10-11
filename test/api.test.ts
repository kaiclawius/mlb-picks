import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clearGateCache } from '../src/gate.js';
import { ModerationUnavailable } from '../src/moderation.js';
import { bondingCurveOf, PUMP_MINT_AUTHORITY, TOKEN_2022_PROGRAM } from '../src/transparency.js';
import { draftForm, jsonInit, kp, makeEnv, PNG, signIn, url, type Env } from './helpers.js';

const withTokens = (env: Env, w: ReturnType<typeof kp>, n = 150) => env.chain.balances.set(w.publicKey.toBase58(), n);
const draft = async (env: Env, cookie: string, form = draftForm({}, [PNG])) =>
  env.app.request(url('/api/sites'), { method: 'POST', body: form, headers: { cookie } });

test('ohne Anmeldung: kein Entwurf, kein Launch, /api/me leer', async () => {
  const env = makeEnv();
  assert.equal((await env.app.request(url('/api/sites'), { method: 'POST', body: draftForm() })).status, 401);
  assert.equal((await env.app.request(url('/api/sites/abc/launch/prepare'), jsonInit({}))).status, 401);
  assert.deepEqual(await (await env.app.request(url('/api/me'))).json(), { address: null });
});

test('Login setzt ein gehärtetes Cookie; Logout löscht es', async () => {
  const env = makeEnv();
  const w = kp();
  const address = w.publicKey.toBase58();
  const ch = await (await env.app.request(url('/api/auth/nonce'), jsonInit({ address }))).json();
  const nacl = (await import('tweetnacl')).default;
  const signature = Buffer.from(nacl.sign.detached(new TextEncoder().encode(ch.message), w.secretKey)).toString('base64');
  const res = await env.app.request(url('/api/auth/verify'), jsonInit({ address, message: ch.message, signature }));
  const cookie = res.headers.get('set-cookie')!;
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Strict/i);
  assert.doesNotMatch(cookie, /Secure/i, 'http-Entwicklung');
  const me = await (await env.app.request(url('/api/me'), { headers: { cookie: cookie.split(';')[0] } })).json();
  assert.equal(me.address, address);

  const prod = makeEnv({ PUBLIC_URL: 'https://launch.example.com' });
  const res2 = await prod.app.request('https://launch.example.com/api/auth/nonce', jsonInit({ address }));
  assert.equal(res2.status, 200);
});

test('Entwurf: ohne Zugang 403, mit Bestand 200', async () => {
  const env = makeEnv();
  const w = kp();
  const cookie = await signIn(env, w);
  assert.equal((await draft(env, cookie)).status, 403);
  withTokens(env, w);
  clearGateCache();
  const cookie2 = await signIn(env, w);
  const res = await draft(env, cookie2);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'draft');
  assert.match(body.id, /^[0-9a-f]{16}$/);
});

test('Entwurf: Validierung (Idee, Rechte-Checkbox, SVG, zu große und zu viele Bilder)', async () => {
  const env = makeEnv({ GATE_OPEN: '1' });
  const cookie = await signIn(env, kp());
  assert.equal((await draft(env, cookie, draftForm({ idea: 'kurz' }))).status, 400);
  assert.equal((await draft(env, cookie, draftForm({ rights: 'no' }))).status, 400);
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  assert.equal((await draft(env, cookie, draftForm({}, [svg], ['image/png']))).status, 400, 'SVG mit PNG-Typ wird per Bytes erkannt');
  const big = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]);
  assert.equal((await draft(env, cookie, draftForm({}, [big]))).status, 400);
  assert.equal((await draft(env, cookie, draftForm({}, [PNG, PNG, PNG, PNG, PNG]))).status, 400);
});

test('Moderation: Ablehnung = 422 und nichts gespeichert; Ausfall = 503 (fail closed)', async () => {
  const env = makeEnv({ GATE_OPEN: '1' });
  const w = kp();
  const cookie = await signIn(env, w);
  env.setModerate(async () => ({ allowed: false, reasons: ['Enthält eine reale Person.'] }));
  const res = await draft(env, cookie);
  assert.equal(res.status, 422);
  assert.match((await res.json()).error, /reale Person/);
  assert.equal((await (await env.app.request(url('/api/me'), { headers: { cookie } })).json()).sites.length, 0);

  env.setModerate(async () => { throw new ModerationUnavailable('Prüfung nicht eingerichtet'); });
  assert.equal((await draft(env, cookie)).status, 503);
});

test('Entwürfe pro Tag und Wallet sind begrenzt, auch abgelehnte zählen', async () => {
  const env = makeEnv({ GATE_OPEN: '1' });
  const cookie = await signIn(env, kp());
  env.setModerate(async () => ({ allowed: false, reasons: ['nein'] }));
  for (let i = 0; i < 10; i++) assert.equal((await draft(env, cookie)).status, 422);
  assert.equal((await draft(env, cookie)).status, 429);
});

test('Fremde sehen weder Vorschau noch Launch-Endpunkte (404 wie nicht vorhanden)', async () => {
  const env = makeEnv({ GATE_OPEN: '1' });
  const owner = await signIn(env, kp());
  const other = await signIn(env, kp());
  const { id } = await (await draft(env, owner)).json();
  assert.equal((await env.app.request(url(`/api/sites/${id}/preview`), { headers: { cookie: owner } })).status, 200);
  assert.equal((await env.app.request(url(`/api/sites/${id}/preview`), { headers: { cookie: other } })).status, 404);
  assert.equal((await env.app.request(url(`/api/sites/${id}/launch/prepare`), jsonInit({}, other))).status, 404);
  assert.equal((await env.app.request(url(`/api/sites/${id}/launch/confirm`), jsonInit({ signature: 'x'.repeat(88) }, other))).status, 404);
  assert.equal((await env.app.request(url('/api/sites/..%2f..%2fetc/preview'), { headers: { cookie: owner } })).status, 404);
});

test('Vorschau: sandbox-CSP, kein Skript, Entwurf ist nicht öffentlich', async () => {
  const env = makeEnv({ GATE_OPEN: '1' });
  const cookie = await signIn(env, kp());
  const { id } = await (await draft(env, cookie)).json();
  const res = await env.app.request(url(`/api/sites/${id}/preview`), { headers: { cookie } });
  assert.match(res.headers.get('content-security-policy')!, /^sandbox;/);
  assert.doesNotMatch(await res.text(), /<script/, 'Vorschau enthält kein Skript');
  assert.equal((await env.app.request(url(`/s/${id}`))).status, 404, 'unveröffentlichte Seite');
  assert.equal((await env.app.request(url(`/m/${id}.json`))).status, 404, 'Metadaten erst nach prepare');
});

test('Bilder: öffentlich mit nosniff, Pfad-Tricks scheitern', async () => {
  const env = makeEnv({ GATE_OPEN: '1' });
  const cookie = await signIn(env, kp());
  const { id } = await (await draft(env, cookie)).json();
  const img = await env.app.request(url(`/s/${id}/img-0.png`));
  assert.equal(img.status, 200);
  assert.equal(img.headers.get('content-type'), 'image/png');
  assert.equal(img.headers.get('x-content-type-options'), 'nosniff');
  for (const bad of ['img-9.png', '..%2f..%2fspec.json', 'img-0.svg', 'img-0.png%00.html']) {
    assert.equal((await env.app.request(url(`/s/${id}/${bad}`))).status, 404, bad);
  }
});

async function launched(env: Env, user = kp()) {
  withTokens(env, user);
  const cookie = await signIn(env, user);
  const { id } = await (await draft(env, cookie)).json();
  const prep = await (await env.app.request(url(`/api/sites/${id}/launch/prepare`), jsonInit({}, cookie))).json();
  return { user, cookie, id, prep };
}

test('kompletter Launch: prepare → Wallet signiert → confirm → Seite ist öffentlich', async () => {
  const env = makeEnv();
  const { user, cookie, id, prep } = await launched(env);
  assert.ok(prep.transaction && prep.mint);

  // Metadaten sind jetzt öffentlich, damit pump.fun sie lesen kann
  const meta = await (await env.app.request(url(`/m/${id}.json`))).json();
  assert.equal(meta.name, 'Test Coin');
  assert.equal(meta.image, `http://localhost:3000/s/${id}/img-0.png`);
  assert.equal(meta.website, `http://localhost:3000/s/${id}`);
  assert.ok(meta.createdOn);

  const signature = env.chain.land(prep.transaction, user);
  const res = await env.app.request(url(`/api/sites/${id}/launch/confirm`), jsonInit({ signature }, cookie));
  assert.equal(res.status, 200);
  const done = await res.json();
  assert.equal(done.mint, prep.mint);
  assert.equal(done.pumpUrl, `https://pump.fun/coin/${prep.mint}`);

  const page = await env.app.request(url(`/s/${id}`));
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.ok(html.includes(prep.mint));
  assert.match(page.headers.get('content-security-policy')!, /script-src 'sha256-/);
  const scriptSrc = page.headers.get('content-security-policy')!.split('; ').find((d) => d.startsWith('script-src'))!;
  assert.doesNotMatch(scriptSrc, /unsafe-inline|unsafe-eval|\*/, 'Skripte nur per Hash erlaubt');

  const me = await (await env.app.request(url('/api/me'), { headers: { cookie } })).json();
  assert.equal(me.sites[0].status, 'launched');
  assert.equal(me.access.remaining, 0, 'Kontingent verbraucht');
});

test('confirm: gleiche Signatur nicht doppelt, falscher Mint, nicht bestätigt, Fake-Signatur', async () => {
  const env = makeEnv();
  const a = await launched(env);
  const confirm = (x: typeof a, signature: string) => env.app.request(url(`/api/sites/${x.id}/launch/confirm`), jsonInit({ signature }, x.cookie));

  assert.equal((await confirm(a, 'kurz')).status, 400);
  const pending = await confirm(a, '1'.repeat(88));
  assert.equal(pending.status, 202, 'unbekannte Transaktion = noch nicht bestätigt');
  assert.equal((await pending.json()).pending, true);

  const sig = env.chain.land(a.prep.transaction, a.user);
  assert.equal((await confirm(a, sig)).status, 200);
  assert.equal((await confirm(a, sig)).status, 409, 'schon gestartet');

  // Ein zweiter Entwurf kann dieselbe Transaktion nicht für sich beanspruchen
  const user2 = a.user;
  const { id: id2 } = await (await draft(env, a.cookie)).json();
  const prep2 = await (await env.app.request(url(`/api/sites/${id2}/launch/prepare`), jsonInit({}, a.cookie))).json().catch(() => null);
  assert.equal(prep2?.transaction, undefined, 'Kontingent ist aufgebraucht');
  void user2;
});

test('confirm: die Signatur eines anderen Nutzers zählt nicht für meinen Coin', async () => {
  const env = makeEnv();
  const a = await launched(env);
  const b = await launched(env); // Ein anderer Nutzer startet seinen eigenen, echten Coin
  const sigOfB = env.chain.land(b.prep.transaction, b.user);
  const res = await env.app.request(url(`/api/sites/${a.id}/launch/confirm`), jsonInit({ signature: sigOfB }, a.cookie));
  assert.equal(res.status, 422);
  assert.match((await res.json()).error, /nicht von deiner Wallet/);
  const me = await (await env.app.request(url('/api/me'), { headers: { cookie: a.cookie } })).json();
  assert.equal(me.sites[0].status, 'prepared', 'Coin von A bleibt unveröffentlicht');
});

test('prepare: frische Bestandsprüfung, Tageskontingent und Rate-Limit', async () => {
  const env = makeEnv();
  const w = kp();
  withTokens(env, w);
  const cookie = await signIn(env, w);
  const { id } = await (await draft(env, cookie)).json();
  env.chain.balances.set(w.publicKey.toBase58(), 0); // Bestand verkauft, Cache würde noch Zugang zeigen
  const res = await env.app.request(url(`/api/sites/${id}/launch/prepare`), jsonInit({}, cookie));
  assert.equal(res.status, 403, 'Cache wird beim Launch umgangen');

  env.chain.balances.set(w.publicKey.toBase58(), 150);
  env.db.logEvent(w.publicKey.toBase58(), 'launch');
  assert.equal((await env.app.request(url(`/api/sites/${id}/launch/prepare`), jsonInit({}, cookie))).status, 429, 'Tageskontingent');
});

test('CSRF: POST von fremder Origin wird abgelehnt', async () => {
  const env = makeEnv();
  const res = await env.app.request(url('/api/auth/nonce'), jsonInit({ address: kp().publicKey.toBase58() }, undefined, { origin: 'https://evil.example' }));
  assert.equal(res.status, 403);
  const ok = await env.app.request(url('/api/auth/nonce'), jsonInit({ address: kp().publicKey.toBase58() }, undefined, { origin: 'http://localhost:3000' }));
  assert.equal(ok.status, 200);
});

test('Subdomain-Hosting: Coin-Seiten liegen auf eigener Origin, die App-API ist dort nicht erreichbar', async () => {
  const env = makeEnv({ SITES_DOMAIN: 'coins.example.com' });
  const a = await launched(env);
  env.chain.land(a.prep.transaction, a.user);
  const sig = env.chain.land(a.prep.transaction, a.user);
  await env.app.request(url(`/api/sites/${a.id}/launch/confirm`), jsonInit({ signature: sig }, a.cookie));

  const host = { host: `${a.id}.coins.example.com` };
  const page = await env.app.request(`http://${host.host}/`, { headers: host });
  assert.equal(page.status, 200);
  assert.match(await page.text(), /src="\/img-0\.png"/);
  assert.equal((await env.app.request(`http://${host.host}/img-0.png`, { headers: host })).status, 200);
  assert.equal((await env.app.request(`http://${host.host}/api/me`, { headers: { ...host, cookie: a.cookie } })).status, 404, 'keine App-Routen auf der Site-Origin');
  assert.equal((await env.app.request(`http://${host.host}/`, { method: 'POST', headers: host })).status, 405);
  assert.equal((await env.app.request('http://unbekannt.coins.example.com/', { headers: { host: 'unbekannt.coins.example.com' } })).status, 404);

  const meta = await (await env.app.request(url(`/m/${a.id}.json`))).json();
  assert.equal(meta.website, `http://${a.id}.coins.example.com`);
});

test('Live-Check: Endpunkt liefert Bewertung, lehnt Müll ab und hat CORS für Coin-Seiten', async () => {
  const env = makeEnv();
  const mint = kp().publicKey.toBase58();
  env.chain.accounts.set(mint, {
    owner: TOKEN_2022_PROGRAM,
    data: { parsed: { type: 'mint', info: { mintAuthority: PUMP_MINT_AUTHORITY, freezeAuthority: null, supply: '1000', decimals: 6, extensions: [] } } },
  });
  env.chain.largest = [{ address: 'acc', amount: '1000' }];
  env.chain.accounts.set('acc', { data: { parsed: { info: { owner: bondingCurveOf(mint) } } } });

  const res = await env.app.request(url(`/api/check/${mint}`));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
  const body = await res.json();
  assert.deepEqual(body.checks.map((c: { id: string; status: string }) => `${c.id}:${c.status}`), ['mint:pass', 'freeze:pass', 'extensions:pass', 'holders:info']);
  assert.equal((await env.app.request(url('/api/check/nicht-gültig'))).status, 400);
  assert.equal((await env.app.request(url(`/api/check/${kp().publicKey.toBase58()}`))).status, 502, 'kein Mint');
});

test('Sicherheits-Header auf App-Seiten', async () => {
  const env = makeEnv();
  const res = await env.app.request(url('/api/config'));
  assert.match(res.headers.get('content-security-policy')!, /frame-ancestors 'none'/);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  const cfg = await res.json();
  assert.equal(cfg.gateMint !== undefined, true);
  assert.equal(JSON.stringify(cfg).includes('allowlist'), false);
});

test('HTTPS: __Host-Cookie mit Secure, Login und Sitzung funktionieren', async () => {
  const env = makeEnv({ PUBLIC_URL: 'https://launch.example.com', GATE_OPEN: '1' });
  const w = kp();
  const address = w.publicKey.toBase58();
  const nacl = (await import('tweetnacl')).default;
  const base = 'https://launch.example.com';
  const ch = await (await env.app.request(`${base}/api/auth/nonce`, jsonInit({ address }))).json();
  const signature = Buffer.from(nacl.sign.detached(new TextEncoder().encode(ch.message), w.secretKey)).toString('base64');
  const res = await env.app.request(`${base}/api/auth/verify`, jsonInit({ address, message: ch.message, signature }));
  assert.equal(res.status, 200);
  const setCookie = res.headers.get('set-cookie')!;
  assert.match(setCookie, /^__Host-session=/);
  assert.match(setCookie, /Secure/i);
  assert.match(setCookie, /Path=\//);
  assert.doesNotMatch(setCookie, /Domain=/i, '__Host- verbietet eine Domain');
  const me = await (await env.app.request(`${base}/api/me`, { headers: { cookie: setCookie.split(';')[0] } })).json();
  assert.equal(me.address, address);
  // Ein Cookie unter dem unsicheren Namen wird nicht akzeptiert
  const plain = await (await env.app.request(`${base}/api/me`, { headers: { cookie: `session=${setCookie.split('=')[1].split(';')[0]}` } })).json();
  assert.equal(plain.address, null);
});
