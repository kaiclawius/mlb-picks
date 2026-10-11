import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { loadConfig, type Deployment } from './lib.js';

// Schreibt Config + Mint-Adresse in die Landingpage und die Token-Metadaten.
export function syncSite() {
  const config = loadConfig();
  // Mainnet hat Vorrang, sonst zeigt die Seite die Devnet-Adresse
  const deployment: Deployment | undefined = ['mainnet-beta', 'devnet']
    .map((c) => `deployments/${c}.json`)
    .filter(existsSync)
    .map((p) => JSON.parse(readFileSync(p, 'utf8')))[0];

  const siteData = {
    name: config.name,
    symbol: config.symbol,
    description: config.description,
    supply: config.supply,
    links: config.links,
    mint: deployment?.mint ?? null,
    cluster: deployment?.cluster ?? null,
  };
  writeFileSync('site/token.js', `window.TOKEN = ${JSON.stringify(siteData, null, 2)};\n`);

  const imageUrl = new URL('logo.png', config.metadataUri).toString();
  const metadata = { name: config.name, symbol: config.symbol, description: config.description, image: imageUrl };
  writeFileSync('site/metadata.json', JSON.stringify(metadata, null, 2) + '\n');
  console.log('site/token.js und site/metadata.json aktualisiert.');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) syncSite();
