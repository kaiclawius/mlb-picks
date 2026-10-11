# Memecoin

Ein SPL-Token auf Solana (mit Metaplex-Metadaten, damit Name und Logo in Wallets erscheinen) plus Landingpage.

## Aufbau

| Pfad | Inhalt |
| --- | --- |
| `token.config.json` | **Hier alles einstellen:** Name, Symbol, Beschreibung, Supply, Links |
| `scripts/create-token.ts` | Erstellt den Token und mintet den gesamten Supply in deine Wallet |
| `scripts/revoke-authorities.ts` | Gibt Mint- und Freeze-Authority ab (endgültig!) |
| `scripts/sync-site.ts` | Überträgt Config und Mint-Adresse in die Landingpage |
| `site/` | Landingpage, Logo und `metadata.json` (per GitHub Pages gehostet) |
| `deployments/` | Mint-Adressen pro Netzwerk (wird von den Skripten geschrieben) |

## Setup

```bash
npm install
# Solana CLI installieren: https://docs.solanalabs.com/cli/install
solana-keygen new          # legt ~/.config/solana/id.json an (Seed-Phrase sicher aufbewahren!)
```

Einen anderen Keypair-Pfad kannst du mit `SOLANA_KEYPAIR=/pfad/zur/wallet.json` angeben. Keypairs **nie** committen.

## 1. Name und Logo festlegen

1. `token.config.json` anpassen.
2. `site/logo.svg` und `site/logo.png` ersetzen (PNG, quadratisch, ca. 512×512).
3. `npm run sync-site` ausführen und `site/` auf `main` pushen. Der Workflow deployt die Seite auf GitHub Pages.
   Einmalig in den Repo-Einstellungen unter *Settings → Pages → Source* „GitHub Actions“ wählen.
4. Prüfen, dass `metadataUri` aus der Config im Browser die JSON-Datei liefert.
   Die Metadaten werden beim Erstellen gelesen, die URL muss also vorher erreichbar sein.

## 2. Auf dem Devnet testen (kostenlos)

```bash
npm run create             # CLUSTER=devnet ist der Standard, holt bei Bedarf einen Airdrop
npm run revoke
```

Danach den Token im Explorer-Link aus der Ausgabe prüfen.

## 3. Mainnet-Launch

Die Wallet braucht echtes SOL (ca. 0,05 SOL für Gebühren und Rent).

```bash
CLUSTER=mainnet-beta npm run create
CLUSTER=mainnet-beta npm run revoke                  # Mint + Freeze abgeben
CLUSTER=mainnet-beta LOCK_METADATA=1 npm run revoke  # optional zusätzlich: Name/Logo für immer sperren
```

Für das Mainnet einen eigenen RPC (z. B. Helius) per `RPC_URL=...` angeben, der öffentliche ist stark rate-limited.

**Warum Revoke?** Käufer und Tools wie RugCheck prüfen das als Erstes. Solange die Mint-Authority aktiv ist,
könntest du beliebig nachminten, und eine aktive Freeze-Authority kann Wallets einfrieren. Beides gilt als Red Flag.

## 4. Handelbar machen

Erst mit einem Liquiditätspool kann man den Token kaufen, z. B. auf [Raydium](https://raydium.io/liquidity/create-pool/)
oder [Meteora](https://app.meteora.ag/): Token + SOL einzahlen und danach die LP-Tokens burnen oder locken.
Den Kauf-Link trägst du anschließend unter `links.buy` in der Config ein.

> Hinweis: Je nach Land kann die Ausgabe eines Tokens regulatorische und steuerliche Folgen haben (in der EU z. B. MiCA).
