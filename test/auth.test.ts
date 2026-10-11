import { test } from 'node:test';
import assert from 'node:assert/strict';
import nacl from 'tweetnacl';
import { buildMessage, createChallenge, readSession, signSession, verifySignIn, AuthError } from '../src/auth.js';
import { openDb } from '../src/db.js';
import { loadConfig } from '../src/config.js';
import { kp } from './helpers.js';

const cfg = loadConfig({ PUBLIC_URL: 'https://launch.example.com', SESSION_SECRET: 's'.repeat(40) });
const sign = (wallet: ReturnType<typeof kp>, message: string) =>
  Buffer.from(nacl.sign.detached(new TextEncoder().encode(message), wallet.secretKey)).toString('base64');

test('gültige Anmeldung', () => {
  const db = openDb(':memory:');
  const w = kp();
  const address = w.publicKey.toBase58();
  const { message } = createChallenge(db, cfg, address);
  assert.match(message, /^launch\.example\.com wants you to sign in with your Solana account:\n/);
  verifySignIn(db, cfg, { address, message, signature: sign(w, message) });
});

test('Nonce ist nur einmal verwendbar (Replay)', () => {
  const db = openDb(':memory:');
  const w = kp();
  const address = w.publicKey.toBase58();
  const { message } = createChallenge(db, cfg, address);
  const signature = sign(w, message);
  verifySignIn(db, cfg, { address, message, signature });
  assert.throws(() => verifySignIn(db, cfg, { address, message, signature }), AuthError);
});

test('fremde Signatur wird abgelehnt und verbraucht die Nonce', () => {
  const db = openDb(':memory:');
  const victim = kp(), attacker = kp();
  const address = victim.publicKey.toBase58();
  const { message } = createChallenge(db, cfg, address);
  assert.throws(() => verifySignIn(db, cfg, { address, message, signature: sign(attacker, message) }), /Signatur ungültig/);
  assert.throws(() => verifySignIn(db, cfg, { address, message, signature: sign(victim, message) }), /Nonce/);
});

test('Nonce einer anderen Adresse ist unbrauchbar', () => {
  const db = openDb(':memory:');
  const a = kp(), b = kp();
  const { message } = createChallenge(db, cfg, a.publicKey.toBase58());
  assert.throws(() => verifySignIn(db, cfg, { address: b.publicKey.toBase58(), message, signature: sign(b, message) }), AuthError);
});

test('veränderte Nachricht (andere Domain, Zeit) wird abgelehnt', () => {
  const db = openDb(':memory:');
  const w = kp();
  const address = w.publicKey.toBase58();
  const { message } = createChallenge(db, cfg, address);
  const evil = message.replace('launch.example.com', 'evil.example.com');
  assert.throws(() => verifySignIn(db, cfg, { address, message: evil, signature: sign(w, evil) }), /stimmt nicht überein/);
});

test('abgelaufene Nonce wird abgelehnt', () => {
  const db = openDb(':memory:');
  const w = kp();
  const address = w.publicKey.toBase58();
  const past = Date.now() - 10 * 60 * 1000;
  db.saveNonce('a'.repeat(32), address, past, past + 1000);
  const message = buildMessage(cfg, address, 'a'.repeat(32), past, past + 1000);
  assert.throws(() => verifySignIn(db, cfg, { address, message, signature: sign(w, message) }), /abgelaufen/);
});

test('Session: gültig, manipuliert, abgelaufen, falsches Geheimnis', () => {
  const address = kp().publicKey.toBase58();
  const token = signSession(cfg, address);
  assert.equal(readSession(cfg, token), address);
  const [p, s] = token.split('.');
  const other = Buffer.from(JSON.stringify({ a: kp().publicKey.toBase58(), e: 9999999999 })).toString('base64url');
  assert.equal(readSession(cfg, `${other}.${s}`), null);
  assert.equal(readSession(cfg, `${p}.${s.slice(0, -2)}xx`), null);
  assert.equal(readSession(cfg, token, Date.now() + 8 * 24 * 3600 * 1000), null);
  assert.equal(readSession(loadConfig({ SESSION_SECRET: 'z'.repeat(40) }), token), null);
  assert.equal(readSession(cfg, undefined), null);
  assert.equal(readSession(cfg, 'müll'), null);
});
