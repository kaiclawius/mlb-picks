import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { keypairIdentity, type Umi } from '@metaplex-foundation/umi';
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { mplToolbox } from '@metaplex-foundation/mpl-toolbox';

export type Cluster = 'devnet' | 'mainnet-beta';

export interface TokenConfig {
  name: string;
  symbol: string;
  description: string;
  decimals: number;
  supply: string;
  metadataUri: string;
  links: Record<string, string>;
}

export interface Deployment {
  cluster: Cluster;
  mint: string;
  owner: string;
  signature: string;
  createdAt: string;
  mintAuthorityRevoked?: boolean;
  freezeAuthorityRevoked?: boolean;
  metadataImmutable?: boolean;
}

const RPC: Record<Cluster, string> = {
  devnet: 'https://api.devnet.solana.com',
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
};

export function loadConfig(): TokenConfig {
  return JSON.parse(readFileSync('token.config.json', 'utf8'));
}

export function getCluster(): Cluster {
  const cluster = process.env.CLUSTER ?? 'devnet';
  if (cluster !== 'devnet' && cluster !== 'mainnet-beta') {
    throw new Error(`Unbekannter CLUSTER "${cluster}" (erlaubt: devnet, mainnet-beta)`);
  }
  return cluster;
}

export function connect(cluster: Cluster): Umi {
  const umi = createUmi(process.env.RPC_URL ?? RPC[cluster]).use(mplTokenMetadata()).use(mplToolbox());
  const keypairPath = process.env.SOLANA_KEYPAIR ?? join(homedir(), '.config', 'solana', 'id.json');
  if (!existsSync(keypairPath)) {
    throw new Error(`Kein Keypair unter ${keypairPath}. Erstelle eins mit "solana-keygen new" oder setze SOLANA_KEYPAIR.`);
  }
  const secret = new Uint8Array(JSON.parse(readFileSync(keypairPath, 'utf8')));
  umi.use(keypairIdentity(umi.eddsa.createKeypairFromSecretKey(secret)));
  return umi;
}

const deploymentPath = (cluster: Cluster) => join('deployments', `${cluster}.json`);

export function loadDeployment(cluster: Cluster): Deployment {
  const path = deploymentPath(cluster);
  if (!existsSync(path)) throw new Error(`Kein Deployment für ${cluster} gefunden. Erst "npm run create" ausführen.`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function saveDeployment(deployment: Deployment) {
  mkdirSync('deployments', { recursive: true });
  writeFileSync(deploymentPath(deployment.cluster), JSON.stringify(deployment, null, 2) + '\n');
}

export function explorerUrl(address: string, cluster: Cluster) {
  const suffix = cluster === 'devnet' ? '?cluster=devnet' : '';
  return `https://explorer.solana.com/address/${address}${suffix}`;
}
