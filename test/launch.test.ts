import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ComputeBudgetProgram, PublicKey, SystemProgram, VersionedTransaction } from '@solana/web3.js';
import nacl from 'tweetnacl';
import { LaunchError, LIMITS, NotConfirmedYet, prepareLaunch, verifyLaunch } from '../src/launch.js';
import { PUMP_PROGRAM } from '../src/transparency.js';
import { kp, makeEnv } from './helpers.js';

const input = (owner: string) => ({ owner, name: 'Test', symbol: 'TST', uri: 'https://x.test/m/abc.json' });
const decode = (b64: string) => VersionedTransaction.deserialize(Buffer.from(b64, 'base64'));

test('Transaktion: Nutzer zahlt, Mint-Schlüssel hat bereits signiert, pump-Programm wird aufgerufen', async () => {
  const env = makeEnv();
  const user = kp();
  const prepared = await prepareLaunch(env.cfg, env.chain.rpc, input(user.publicKey.toBase58()));
  const tx = decode(prepared.transaction);
  const keys = tx.message.staticAccountKeys.map((k) => k.toBase58());

  assert.equal(keys[0], user.publicKey.toBase58(), 'Fee-Payer ist der Nutzer');
  assert.equal(tx.message.header.numRequiredSignatures, 2, 'Nutzer und Mint signieren');
  assert.equal(keys[1], prepared.mint, 'zweiter Signer ist der Mint');
  assert.ok(keys.includes(PUMP_PROGRAM));

  // Signatur des Mints ist gültig, die des Nutzers fehlt noch (nur Nullen)
  assert.ok(nacl.sign.detached.verify(tx.message.serialize(), tx.signatures[1], new PublicKey(prepared.mint).toBytes()));
  assert.ok(tx.signatures[0].every((b) => b === 0));
  assert.equal(prepared.lastValidBlockHeight, 1000);
});

test('Transaktion enthält genau: Compute-Budget, create_v2 – und optional die Gebühr', async () => {
  const user = kp(), feeWallet = kp().publicKey.toBase58();
  const env = makeEnv({ FEE_WALLET: feeWallet, FEE_LAMPORTS: '5000000' });
  const tx = decode((await prepareLaunch(env.cfg, env.chain.rpc, input(user.publicKey.toBase58()))).transaction);
  const keys = tx.message.staticAccountKeys;
  const programs = tx.message.compiledInstructions.map((i) => keys[i.programIdIndex].toBase58());
  assert.deepEqual(programs, [ComputeBudgetProgram.programId.toBase58(), ComputeBudgetProgram.programId.toBase58(), SystemProgram.programId.toBase58(), PUMP_PROGRAM]);

  const transfer = tx.message.compiledInstructions[2];
  assert.equal(keys[transfer.accountKeyIndexes[1]].toBase58(), feeWallet);
  assert.equal(Buffer.from(transfer.data).readBigUInt64LE(4), 5_000_000n);

  const plain = decode((await prepareLaunch(makeEnv().cfg, env.chain.rpc, input(user.publicKey.toBase58()))).transaction);
  assert.equal(plain.message.compiledInstructions.length, 3, 'ohne Gebühr keine Überweisung');
});

test('jeder Aufruf erzeugt einen neuen Mint', async () => {
  const env = makeEnv();
  const u = kp().publicKey.toBase58();
  const a = await prepareLaunch(env.cfg, env.chain.rpc, input(u));
  const b = await prepareLaunch(env.cfg, env.chain.rpc, input(u));
  assert.notEqual(a.mint, b.mint);
});

test('Längenlimits von pump.fun werden vor dem Bauen geprüft', async () => {
  const env = makeEnv();
  const o = kp().publicKey.toBase58();
  await assert.rejects(prepareLaunch(env.cfg, env.chain.rpc, { ...input(o), name: 'n'.repeat(LIMITS.name + 1) }), LaunchError);
  await assert.rejects(prepareLaunch(env.cfg, env.chain.rpc, { ...input(o), symbol: 'S'.repeat(LIMITS.symbol + 1) }), LaunchError);
  await assert.rejects(prepareLaunch(env.cfg, env.chain.rpc, { ...input(o), uri: 'https://x/' + 'a'.repeat(LIMITS.uri) }), LaunchError);
});

test('verifyLaunch: gültiger Launch wird akzeptiert', async () => {
  const env = makeEnv();
  const user = kp();
  const p = await prepareLaunch(env.cfg, env.chain.rpc, input(user.publicKey.toBase58()));
  const sig = env.chain.land(p.transaction, user);
  await verifyLaunch(env.chain.rpc, { owner: user.publicKey.toBase58(), mint: p.mint, signature: sig });
});

test('verifyLaunch: unbekannte Transaktion ist "noch nicht bestätigt"', async () => {
  const env = makeEnv();
  await assert.rejects(verifyLaunch(env.chain.rpc, { owner: kp().publicKey.toBase58(), mint: kp().publicKey.toBase58(), signature: 'x' }), NotConfirmedYet);
});

test('verifyLaunch: fehlgeschlagene, fremde und unpassende Transaktionen werden abgelehnt', async () => {
  const env = makeEnv();
  const user = kp(), stranger = kp();
  const p = await prepareLaunch(env.cfg, env.chain.rpc, input(user.publicKey.toBase58()));

  const failed = env.chain.land(p.transaction, user, { err: { InstructionError: [0, 'x'] } });
  await assert.rejects(verifyLaunch(env.chain.rpc, { owner: user.publicKey.toBase58(), mint: p.mint, signature: failed }), /fehlgeschlagen/);

  const ok = env.chain.land(p.transaction, user);
  await assert.rejects(verifyLaunch(env.chain.rpc, { owner: stranger.publicKey.toBase58(), mint: p.mint, signature: ok }), /nicht von deiner Wallet/);
  await assert.rejects(verifyLaunch(env.chain.rpc, { owner: user.publicKey.toBase58(), mint: kp().publicKey.toBase58(), signature: ok }), /nicht zu diesem Coin/);

  const noCurve = await prepareLaunch(env.cfg, env.chain.rpc, input(user.publicKey.toBase58()));
  const sig2 = env.chain.land(noCurve.transaction, user, { withCurve: false });
  await assert.rejects(verifyLaunch(env.chain.rpc, { owner: user.publicKey.toBase58(), mint: noCurve.mint, signature: sig2 }), /Bonding-Curve/);
});
