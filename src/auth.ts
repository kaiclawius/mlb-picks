import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import type { Config } from './config.js';
import type { Db } from './db.js';

const NONCE_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_S = 7 * 24 * 60 * 60;

export function isAddress(s: unknown): s is string {
  if (typeof s !== 'string' || s.length < 32 || s.length > 44) return false;
  try {
    return bs58.decode(s).length === 32;
  } catch {
    return false;
  }
}

/** Nachrichtenformat nach Sign-In with Solana (phantom/sign-in-with-solana) */
export function buildMessage(cfg: Config, address: string, nonce: string, issuedAt: number, expiresAt: number): string {
  return [
    `${cfg.appHost} wants you to sign in with your Solana account:`,
    address,
    '',
    'Anmeldung beim Coin-Launchpad. Es wird keine Transaktion ausgelöst und kein Geld bewegt.',
    '',
    `URI: ${cfg.publicUrl}`,
    'Version: 1',
    'Chain ID: mainnet',
    `Nonce: ${nonce}`,
    `Issued At: ${new Date(issuedAt).toISOString()}`,
    `Expiration Time: ${new Date(expiresAt).toISOString()}`,
  ].join('\n');
}

export function createChallenge(db: Db, cfg: Config, address: string): { message: string } {
  const nonce = randomBytes(16).toString('hex');
  const issuedAt = Date.now();
  const expiresAt = issuedAt + NONCE_TTL_MS;
  db.saveNonce(nonce, address, issuedAt, expiresAt);
  return { message: buildMessage(cfg, address, nonce, issuedAt, expiresAt) };
}

export class AuthError extends Error {}

/**
 * Prüft die signierte Nachricht. Der Server baut die erwartete Nachricht aus der gespeicherten Nonce selbst nach und
 * vergleicht sie exakt, damit Domain, URI, Zeiten und Adresse nicht vom Client bestimmt werden können.
 */
export function verifySignIn(db: Db, cfg: Config, input: { address: string; message: string; signature: string }): void {
  const { address, message, signature } = input;
  if (!isAddress(address)) throw new AuthError('Ungültige Adresse.');
  const nonce = /^Nonce: ([0-9a-f]{32})$/m.exec(message)?.[1];
  if (!nonce) throw new AuthError('Nachricht ohne gültige Nonce.');

  const row = db.takeNonce(nonce, address);
  if (!row) throw new AuthError('Nonce unbekannt oder schon benutzt. Bitte neu anmelden.');
  if (Date.now() > row.expiresAt) throw new AuthError('Anmeldung abgelaufen. Bitte neu anmelden.');
  if (message !== buildMessage(cfg, address, nonce, row.issuedAt, row.expiresAt)) throw new AuthError('Nachricht stimmt nicht überein.');

  let sig: Uint8Array;
  try {
    sig = Uint8Array.from(Buffer.from(signature, 'base64'));
  } catch {
    throw new AuthError('Ungültige Signatur.');
  }
  if (sig.length !== 64 || !nacl.sign.detached.verify(new TextEncoder().encode(message), sig, bs58.decode(address))) {
    throw new AuthError('Signatur ungültig.');
  }
}

const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64url');
const mac = (cfg: Config, data: string) => createHmac('sha256', cfg.sessionSecret).update(data).digest();

export function signSession(cfg: Config, address: string, nowMs = Date.now()): string {
  const payload = b64u(JSON.stringify({ a: address, e: Math.floor(nowMs / 1000) + SESSION_TTL_S }));
  return `${payload}.${b64u(mac(cfg, payload))}`;
}

export function readSession(cfg: Config, token: string | undefined, nowMs = Date.now()): string | null {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = mac(cfg, payload);
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const { a, e } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return isAddress(a) && typeof e === 'number' && e > nowMs / 1000 ? a : null;
  } catch {
    return null;
  }
}
