import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAccess } from '../src/gate.js';
import { parseTiers, loadConfig } from '../src/config.js';
import { kp, makeEnv } from './helpers.js';

test('Tiers werden geparst und absteigend sortiert', () => {
  assert.deepEqual(parseTiers('100:1, 1000:5'), [{ min: 1000, perDay: 5 }, { min: 100, perDay: 1 }]);
  assert.throws(() => parseTiers('abc'));
  assert.throws(() => parseTiers('100:0'));
});

test('Zugang nach Bestand: keiner, Stufe 1, Stufe 2', async () => {
  const env = makeEnv();
  const w = kp().publicKey.toBase58();
  assert.equal((await getAccess(env.cfg, env.db, env.chain.rpc, w, { fresh: true })).allowed, false);
  env.chain.balances.set(w, 150);
  assert.equal((await getAccess(env.cfg, env.db, env.chain.rpc, w, { fresh: true })).perDay, 1);
  env.chain.balances.set(w, 5000);
  assert.equal((await getAccess(env.cfg, env.db, env.chain.rpc, w, { fresh: true })).perDay, 5);
});

test('Cache: zweiter Aufruf fragt die Chain nicht, fresh schon', async () => {
  const env = makeEnv();
  const w = kp().publicKey.toBase58();
  env.chain.balances.set(w, 150);
  await getAccess(env.cfg, env.db, env.chain.rpc, w);
  const n = env.chain.calls.length;
  await getAccess(env.cfg, env.db, env.chain.rpc, w);
  assert.equal(env.chain.calls.length, n);
  env.chain.balances.set(w, 0); // Bestand verkauft
  assert.equal((await getAccess(env.cfg, env.db, env.chain.rpc, w)).allowed, true, 'Cache zeigt noch den alten Stand');
  assert.equal((await getAccess(env.cfg, env.db, env.chain.rpc, w, { fresh: true })).allowed, false, 'frische Prüfung sieht den Verkauf');
});

test('Allowlist gilt ohne Bestand', async () => {
  const w = kp().publicKey.toBase58();
  const env = makeEnv({ ALLOWLIST: w, ALLOWLIST_PER_DAY: '2' });
  const a = await getAccess(env.cfg, env.db, env.chain.rpc, w);
  assert.deepEqual([a.allowed, a.perDay, a.viaAllowlist], [true, 2, true]);
});

test('RPC-Ausfall: kein Zugang (fail closed), Allowlist bleibt nutzbar', async () => {
  const env = makeEnv();
  env.chain.failBalance = true;
  const w = kp().publicKey.toBase58();
  const a = await getAccess(env.cfg, env.db, env.chain.rpc, w, { fresh: true });
  assert.equal(a.allowed, false);
  assert.match(a.reason!, /nicht geprüft/);

  const listed = kp().publicKey.toBase58();
  const env2 = makeEnv({ ALLOWLIST: listed });
  env2.chain.failBalance = true;
  assert.equal((await getAccess(env2.cfg, env2.db, env2.chain.rpc, listed, { fresh: true })).allowed, true);
});

test('Tageskontingent wird nach Launches abgezogen', async () => {
  const env = makeEnv();
  const w = kp().publicKey.toBase58();
  env.chain.balances.set(w, 150);
  assert.equal((await getAccess(env.cfg, env.db, env.chain.rpc, w, { fresh: true })).remaining, 1);
  env.db.logEvent(w, 'launch');
  assert.equal((await getAccess(env.cfg, env.db, env.chain.rpc, w, { fresh: true })).remaining, 0);
});

test('Produktivbetrieb verlangt Geheimnis, Sites-Domain und verbietet Dev-Schalter', () => {
  const base = { NODE_ENV: 'production', SESSION_SECRET: 'x'.repeat(40), SITES_DOMAIN: 'coins.example.com' };
  assert.doesNotThrow(() => loadConfig(base));
  assert.throws(() => loadConfig({ ...base, SESSION_SECRET: '' }), /SESSION_SECRET/);
  assert.throws(() => loadConfig({ ...base, SITES_DOMAIN: '' }), /SITES_DOMAIN/);
  assert.throws(() => loadConfig({ ...base, GATE_OPEN: '1' }), /GATE_OPEN/);
  assert.throws(() => loadConfig({ ...base, ALLOW_UNMODERATED: '1' }), /ALLOW_UNMODERATED/);
  assert.throws(() => loadConfig({ SESSION_SECRET: 'kurz' }), /zu kurz/);
  assert.throws(() => loadConfig({ SESSION_SECRET: 'x'.repeat(40), FEE_LAMPORTS: '5' }), /FEE_WALLET/);
});
