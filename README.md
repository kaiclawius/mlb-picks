# Coin-Seiten-Generator

Schritt 1 des Launchpad-Plans: Aus einer Idee und ein paar Bildern entsteht eine Landingpage für einen Memecoin,
inklusive Live-Transparenz-Check aus der Solana-Blockchain. **Es wird noch kein Token erstellt** und nichts bei pump.fun veröffentlicht.

## Starten

```bash
npm install
cp .env.example .env     # ANTHROPIC_API_KEY eintragen (ohne Key gibt es nur eine einfache Vorlage)
export $(grep -v '^#' .env | xargs) && npm run dev
```

Dann `http://localhost:3000` öffnen.

## Aufbau

| Datei | Aufgabe |
| --- | --- |
| `src/generate.ts` | Idee → Seiteninhalt per Claude (strukturierte Ausgabe), mit Regeln gegen Gewinnversprechen und erfundene Fakten |
| `src/spec.ts` | Schema und Begrenzung der KI-Ausgabe (Längen, Farbe, Symbol) |
| `src/render.ts` | Erzeugt die statische HTML-Seite, alle Inhalte werden escaped |
| `src/transparency.ts` | Liest Mint-/Freeze-Authority und größte Konten per RPC und bewertet sie |
| `src/server.ts` | Upload, Generierung, Vorschau (`/s/<id>`) und `/api/check/<mint>` |

## Schutzmaßnahmen

- Pflicht-Checkbox für die Bildrechte, nur PNG/JPG/WebP/GIF bis 2 MB (kein SVG), höchstens 4 Bilder.
- 5 Generierungen pro Stunde und IP, damit die KI-Kosten nicht missbraucht werden. Das Limit liegt im Speicher und reicht nur für lokale Tests.
- Vorschauseiten laufen mit strenger Content-Security-Policy.

## Noch offen

- **Moderation:** keine automatische Prüfung der Bilder oder auf fremde Marken/Personen.
- **Konzentrationscheck:** zählt Liquiditätspools und Bonding Curves als Halter mit, daher nur "info" bzw. "warn".
- **Nächste Schritte:** Token-Erstellung über pump.fun mit Signatur durch den Nutzer, danach Wallet-Login für Token-Halter.
