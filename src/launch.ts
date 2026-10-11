import { createRequire } from 'node:module';
import { ComputeBudgetProgram, Keypair, PublicKey, SystemProgram, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import type { Config } from './config.js';
import type { Rpc } from './rpc.js';
import { bondingCurveOf, PUMP_PROGRAM } from './transparency.js';

// Der ESM-Build des pump.fun-SDK lässt sich in Node nicht importieren (CJS-Interop einer Abhängigkeit), der CJS-Build schon.
const require = createRequire(import.meta.url);
const { PUMP_SDK } = require('@pump-fun/pump-sdk') as typeof import('@pump-fun/pump-sdk');

// Grenzen aus pump-public-docs: docs/instructions/COIN_CREATION.md
export const LIMITS = { name: 32, symbol: 13, uri: 200 };

export class LaunchError extends Error {}
/** Die Transaktion ist (noch) nicht auf der Chain zu sehen. Der Client darf es erneut versuchen. */
export class NotConfirmedYet extends LaunchError {}

export interface PreparedLaunch {
  /** Base64 der Transaktion, vom Mint-Schlüssel signiert, vom Nutzer noch zu signieren */
  transaction: string;
  mint: string;
  lastValidBlockHeight: number;
}

export async function prepareLaunch(
  cfg: Config,
  rpc: Rpc,
  input: { owner: string; name: string; symbol: string; uri: string },
): Promise<PreparedLaunch> {
  const { owner, name, symbol, uri } = input;
  if (name.length === 0 || name.length > LIMITS.name) throw new LaunchError(`Der Name darf höchstens ${LIMITS.name} Zeichen haben.`);
  if (symbol.length < 2 || symbol.length > LIMITS.symbol) throw new LaunchError(`Das Symbol braucht 2 bis ${LIMITS.symbol} Zeichen.`);
  if (uri.length > LIMITS.uri) throw new LaunchError(`Die Metadaten-URL ist länger als ${LIMITS.uri} Zeichen.`);

  const user = new PublicKey(owner);
  const mintKeypair = Keypair.generate();

  const create = await PUMP_SDK.createV2Instruction({
    mint: mintKeypair.publicKey,
    name,
    symbol,
    uri,
    creator: user,
    user,
    mayhemMode: false,
    holderReward: false,
  });

  const instructions = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: cfg.priorityMicroLamports }),
  ];
  // Die Plattform-Gebühr steckt in derselben Transaktion. Der Mint-Schlüssel signiert die ganze Nachricht,
  // sie lässt sich also nicht herauslösen, ohne die Transaktion ungültig zu machen.
  if (cfg.feeLamports > 0 && cfg.feeWallet) {
    instructions.push(SystemProgram.transfer({ fromPubkey: user, toPubkey: new PublicKey(cfg.feeWallet), lamports: cfg.feeLamports }));
  }
  instructions.push(create);

  const { value } = await rpc<{ value: { blockhash: string; lastValidBlockHeight: number } }>('getLatestBlockhash', [{ commitment: 'confirmed' }]);
  const message = new TransactionMessage({ payerKey: user, recentBlockhash: value.blockhash, instructions }).compileToV0Message();
  const tx = new VersionedTransaction(message);
  tx.sign([mintKeypair]); // Der Schlüssel wird danach verworfen und nirgends gespeichert

  return {
    transaction: Buffer.from(tx.serialize()).toString('base64'),
    mint: mintKeypair.publicKey.toBase58(),
    lastValidBlockHeight: value.lastValidBlockHeight,
  };
}

interface TxResult {
  meta: { err: unknown } | null;
  transaction: {
    signatures: string[];
    message: {
      accountKeys: string[];
      header: { numRequiredSignatures: number };
      instructions: { programIdIndex: number }[];
    };
  };
}

export const isSignature = (s: unknown): s is string => typeof s === 'string' && /^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(s);

/** Prüft selbst auf der Chain, ob der Coin wirklich vom Nutzer erstellt wurde. Der Client-Behauptung wird nicht geglaubt. */
export async function verifyLaunch(rpc: Rpc, input: { owner: string; mint: string; signature: string }): Promise<void> {
  const { owner, mint, signature } = input;
  const tx = await rpc<TxResult | null>('getTransaction', [signature, { encoding: 'json', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }]);
  if (!tx) throw new NotConfirmedYet('Die Transaktion ist noch nicht bestätigt.');
  if (tx.meta?.err) throw new LaunchError('Die Transaktion ist fehlgeschlagen. Es wurde kein Coin erstellt.');

  const { accountKeys, header, instructions } = tx.transaction.message;
  if (accountKeys[0] !== owner) throw new LaunchError('Die Transaktion stammt nicht von deiner Wallet.');
  const signers = accountKeys.slice(0, header.numRequiredSignatures);
  if (!signers.includes(mint)) throw new LaunchError('Die Transaktion gehört nicht zu diesem Coin.');
  const pumpIndex = accountKeys.indexOf(PUMP_PROGRAM);
  if (pumpIndex < 0 || !instructions.some((i) => i.programIdIndex === pumpIndex)) throw new LaunchError('Die Transaktion ruft pump.fun nicht auf.');

  const curve = await rpc<{ value: { owner: string } | null }>('getAccountInfo', [bondingCurveOf(mint), { encoding: 'base64' }]);
  if (!curve.value || curve.value.owner !== PUMP_PROGRAM) throw new LaunchError('Zu diesem Mint existiert keine pump.fun-Bonding-Curve.');
}
