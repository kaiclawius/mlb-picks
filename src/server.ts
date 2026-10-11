import { join } from 'node:path';
import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { openDb } from './db.js';
import { generateSpec } from './generate.js';
import { makeModerator } from './moderation.js';
import { makeRpc } from './rpc.js';

const cfg = loadConfig();
if (!cfg.anthropicKey && !cfg.allowUnmoderated) {
  console.warn('Hinweis: ANTHROPIC_API_KEY fehlt. Ohne Inhaltsprüfung wird nichts veröffentlicht (lokal: ALLOW_UNMODERATED=1).');
}
if (!cfg.gateMint && cfg.allowlist.size === 0 && !cfg.gateOpen) {
  console.warn('Hinweis: Weder GATE_MINT noch ALLOWLIST gesetzt. Niemand kann sich anmelden (lokal: GATE_OPEN=1).');
}

const app = createApp({
  cfg,
  db: openDb(join(cfg.dataDir, 'launchpad.db')),
  rpc: makeRpc(cfg.rpcUrl),
  generate: generateSpec,
  moderate: makeModerator(cfg),
});

serve({ fetch: app.fetch, port: cfg.port }, () => console.log(`Launchpad läuft auf ${cfg.publicUrl}`));
