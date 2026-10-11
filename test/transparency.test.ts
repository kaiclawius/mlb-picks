import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { PublicKey } from '@solana/web3.js';
import { analyze, bondingCurveOf, fetchMintFacts, isMintAddress, PUMP_MINT_AUTHORITY, PUMP_PROGRAM, TOKEN_2022_PROGRAM, type MintFacts } from '../src/transparency.js';
import { kp, MockChain } from './helpers.js';

const require = createRequire(import.meta.url);
const sdk = require('@pump-fun/pump-sdk') as typeof import('@pump-fun/pump-sdk');

const mint = kp().publicKey.toBase58();
const base: MintFacts = { mint, mintAuthority: null, freezeAuthority: null, supply: 1000, decimals: 6, tokenProgram: 'Tokenkeg', extensions: [], largest: [] };
const status = (f: Partial<MintFacts>, id: string) => analyze({ ...base, ...f }).find((c) => c.id === id)?.status;

test('Konstanten stimmen mit dem offiziellen SDK überein', () => {
  assert.equal(PUMP_PROGRAM, sdk.PUMP_PROGRAM_ID.toBase58());
  assert.equal(bondingCurveOf(mint), sdk.bondingCurvePda(new PublicKey(mint)).toBase58());
  assert.equal(PUMP_MINT_AUTHORITY, PublicKey.findProgramAddressSync([Buffer.from('mint-authority')], sdk.PUMP_PROGRAM_ID)[0].toBase58());
});

test('Authorities: abgegeben und pump-PDA sind pass, fremde Wallet ist fail', () => {
  assert.equal(status({}, 'mint'), 'pass');
  assert.equal(status({ mintAuthority: PUMP_MINT_AUTHORITY }, 'mint'), 'pass');
  assert.equal(status({ mintAuthority: kp().publicKey.toBase58() }, 'mint'), 'fail');
  assert.equal(status({ freezeAuthority: kp().publicKey.toBase58() }, 'freeze'), 'fail');
});

test('Token-2022: gefährliche Erweiterungen sind fail, harmlose pass', () => {
  const t22 = { tokenProgram: TOKEN_2022_PROGRAM };
  assert.equal(status({ ...t22, extensions: ['metadataPointer', 'tokenMetadata'] }, 'extensions'), 'pass');
  assert.equal(status({ ...t22, extensions: ['permanentDelegate'] }, 'extensions'), 'fail');
  assert.equal(status({ ...t22, extensions: ['transferHook'] }, 'extensions'), 'fail');
  assert.equal(status({ ...t22, extensions: ['transferFeeConfig'] }, 'extensions'), 'warn');
  assert.equal(status({ extensions: ['permanentDelegate'] }, 'extensions'), undefined, 'klassische Tokens haben keine Erweiterungen');
});

test('Verteilung: Bonding Curve zählt nicht als Halter', () => {
  const curve = bondingCurveOf(mint);
  // 900 von 1000 liegen in der Curve, ein Halter hat 100 (= 100 % der umlaufenden Tokens)
  const checks = analyze({ ...base, largest: [{ address: 'a', amount: 900, owner: curve }, { address: 'b', amount: 100, owner: 'wallet1' }] });
  const holders = checks.find((c) => c.id === 'holders')!;
  assert.equal(holders.status, 'warn');
  assert.match(holders.detail, /100\.0 %/);
  assert.match(holders.detail, /90\.0 %/);

  // Ein einziger Halter besitzt den gesamten Umlauf: konzentriert
  const single = analyze({ ...base, largest: [{ address: 'a', amount: 900, owner: curve }, { address: 'b', amount: 100, owner: 'w0' }] });
  assert.equal(single.find((c) => c.id === 'holders')!.status, 'warn');

  // Ein kleiner Halter (10 von 100 im Umlauf) ist unauffällig
  const small = analyze({ ...base, largest: [{ address: 'a', amount: 900, owner: curve }, { address: 'b', amount: 10, owner: 'w0' }] });
  assert.equal(small.find((c) => c.id === 'holders')!.status, 'info');

  const wide = analyze({ ...base, supply: 1000, largest: Array.from({ length: 20 }, (_, i) => ({ address: `h${i}`, amount: 50, owner: `w${i}` })) });
  assert.equal(wide.find((c) => c.id === 'holders')!.status, 'info');
});

test('Alles in der Curve: keine Halter, kein Fehler', () => {
  const curve = bondingCurveOf(mint);
  const c = analyze({ ...base, largest: [{ address: 'a', amount: 1000, owner: curve }] }).find((x) => x.id === 'holders')!;
  assert.equal(c.status, 'info');
  assert.match(c.detail, /Bonding Curve/);
});

test('fetchMintFacts liest Mint, Erweiterungen und Eigentümer der größten Konten', async () => {
  const chain = new MockChain();
  chain.accounts.set(mint, {
    owner: TOKEN_2022_PROGRAM,
    data: { parsed: { type: 'mint', info: { mintAuthority: PUMP_MINT_AUTHORITY, freezeAuthority: null, supply: '1000', decimals: 6, extensions: [{ extension: 'metadataPointer' }] } } },
  });
  chain.largest = [{ address: 'acc1', amount: '900' }];
  chain.accounts.set('acc1', { data: { parsed: { info: { owner: bondingCurveOf(mint) } } } });
  const facts = await fetchMintFacts(chain.rpc, mint);
  assert.deepEqual([facts.tokenProgram, facts.extensions, facts.largest[0].owner], [TOKEN_2022_PROGRAM, ['metadataPointer'], bondingCurveOf(mint)]);
  const checks = analyze(facts);
  assert.deepEqual(checks.map((c) => c.status), ['pass', 'pass', 'pass', 'info']);
});

test('fetchMintFacts lehnt Nicht-Mints ab', async () => {
  const chain = new MockChain();
  await assert.rejects(fetchMintFacts(chain.rpc, mint), /kein Token-Mint/);
  chain.accounts.set(mint, { owner: 'x', data: { parsed: { type: 'account', info: {} } } });
  await assert.rejects(fetchMintFacts(chain.rpc, mint), /kein Token-Mint/);
});

test('Adressprüfung', () => {
  assert.ok(isMintAddress('So11111111111111111111111111111111111111112'));
  assert.ok(!isMintAddress('../etc/passwd'));
  assert.ok(!isMintAddress('0OIl'));
});
