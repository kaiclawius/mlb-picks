import { none, publicKey } from '@metaplex-foundation/umi';
import { AuthorityType, fetchMint, setAuthority } from '@metaplex-foundation/mpl-toolbox';
import { updateV1 } from '@metaplex-foundation/mpl-token-metadata';
import { connect, explorerUrl, getCluster, loadDeployment, saveDeployment } from './lib.js';

// Achtung: Das ist endgültig. Danach kann niemand mehr Tokens nachminten,
// Wallets einfrieren oder Name/Logo ändern.
const cluster = getCluster();
const umi = connect(cluster);
const deployment = loadDeployment(cluster);
const mint = publicKey(deployment.mint);

const account = await fetchMint(umi, mint);

if (account.mintAuthority.__option === 'Some') {
  console.log('Gebe Mint-Authority ab...');
  await setAuthority(umi, { owned: mint, owner: umi.identity, authorityType: AuthorityType.MintTokens, newAuthority: none() })
    .sendAndConfirm(umi);
}
deployment.mintAuthorityRevoked = true;

if (account.freezeAuthority.__option === 'Some') {
  console.log('Gebe Freeze-Authority ab...');
  await setAuthority(umi, { owned: mint, owner: umi.identity, authorityType: AuthorityType.FreezeAccount, newAuthority: none() })
    .sendAndConfirm(umi);
}
deployment.freezeAuthorityRevoked = true;

if (process.env.LOCK_METADATA === '1') {
  console.log('Sperre Metadaten (Name, Symbol, Logo)...');
  await updateV1(umi, { mint, authority: umi.identity, isMutable: false }).sendAndConfirm(umi);
  deployment.metadataImmutable = true;
}

saveDeployment(deployment);
console.log('Fertig.', explorerUrl(deployment.mint, cluster));
