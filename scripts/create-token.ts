import { generateSigner, percentAmount, sol } from '@metaplex-foundation/umi';
import { createAndMint, TokenStandard } from '@metaplex-foundation/mpl-token-metadata';
import { base58 } from '@metaplex-foundation/umi/serializers';
import { connect, explorerUrl, getCluster, loadConfig, saveDeployment } from './lib.js';
import { syncSite } from './sync-site.js';

const config = loadConfig();
const cluster = getCluster();
const umi = connect(cluster);
const owner = umi.identity.publicKey;

console.log(`Cluster: ${cluster}`);
console.log(`Wallet:  ${owner}`);

const balance = await umi.rpc.getBalance(owner);
if (balance.basisPoints < sol(0.05).basisPoints) {
  if (cluster !== 'devnet') {
    throw new Error('Zu wenig SOL in der Wallet (mind. ~0.05 SOL für Gebühren und Rent).');
  }
  console.log('Wenig SOL, hole Devnet-Airdrop...');
  await umi.rpc.airdrop(owner, sol(1));
}

const mint = generateSigner(umi);
const amount = BigInt(config.supply) * 10n ** BigInt(config.decimals);

console.log(`Erstelle ${config.name} ($${config.symbol}) mit ${config.supply} Tokens...`);
const { signature } = await createAndMint(umi, {
  mint,
  authority: umi.identity,
  name: config.name,
  symbol: config.symbol,
  uri: config.metadataUri,
  sellerFeeBasisPoints: percentAmount(0),
  decimals: config.decimals,
  amount,
  tokenOwner: owner,
  tokenStandard: TokenStandard.Fungible,
}).sendAndConfirm(umi);

saveDeployment({
  cluster,
  mint: mint.publicKey.toString(),
  owner: owner.toString(),
  signature: base58.deserialize(signature)[0],
  createdAt: new Date().toISOString(),
});
syncSite();

console.log(`\nFertig! Mint-Adresse: ${mint.publicKey}`);
console.log(explorerUrl(mint.publicKey.toString(), cluster));
console.log('\nNächster Schritt: "npm run revoke", damit niemand neue Tokens minten kann.');
