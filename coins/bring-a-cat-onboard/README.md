# Bring a cat onboard · $BRINGACAT

Ein Referral-Board für die Referral-Saison auf pump.fun, als Spin-off von catonboard. Jeder macht sich in 10 Sekunden seinen Link, Freunde kaufen direkt auf der Seite (allein oder 50/50 zusammen mit catonboard), und ein Leaderboard zählt jeden Kauf, den der Server auf Solana selbst nachgeprüft hat.

## Was die Seite tut

1. **Link:** Wallet verbinden (Phantom, Solflare, Backpack), Namen wählen, eine Nachricht signieren. Dabei gibt es keine Transaktion und es kostet nichts. Der Link heißt `/@name`. Vor dem Claim funktioniert schon `/?r=<wallet>`.
2. **Share-Karte:** Ein Bild 1200×675 mit Name und Link, zum Download oder als fertiger X-Post.
3. **Kaufen:** Ein SOL-Swap über die Jupiter-API, signiert und gesendet von der eigenen Wallet des Käufers. Die Seite hält nie Geld oder Schlüssel. „Pair it“ teilt den Betrag 50/50 auf $BRINGACAT und catonboard auf, das sind zwei Freigaben in der Wallet.
4. **Zählen:** Nach dem Swap schickt die Seite die Transaktions-Signatur an `/api/record`. Der Server liest die Transaktion selbst von Solana und zählt sie nur, wenn alle Regeln erfüllt sind:
   - Die Transaktion war erfolgreich und ist höchstens 1 Stunde alt.
   - Der Käufer hat danach mehr vom Coin oder von catonboard.
   - Der Kauf ist mindestens `MIN_SOL` (0,05) wert.
   - Jede Transaktion zählt nur einmal.
   - Es gibt keine Selbst-Referrals.
   - Ein Käufer bleibt beim ersten Link, der ihn gebracht hat.
5. **Netzwerk (wie der Graph in Obsidian):** Ein Kraft-Graph auf Canvas (`graph.js`) mit zwei Kernen, $BRINGACAT und catonboard. Werber sind Knoten, jeder Käufer ist ein Punkt an seinem Werber, gepairte Käufer hängen zusätzlich an catonboard. Hover hebt die Nachbarn hervor, Knoten lassen sich ziehen, Zoom geht mit Ctrl/Cmd + Scroll oder den Buttons, ein Klick öffnet ein Profil mit Cats, SOL und Link, dazu Suche nach @name und „me“. Neue Käufer fliegen live mit einem Puls ein. Die Daten kommen aus `/api/graph` (die letzten 800 Referrals). Läuft mit 60 fps, pausiert außerhalb des Bildschirms und ist bei „reduzierter Bewegung“ statisch.
6. **Board:** Top-Werber nach eingebrachtem SOL, dazu „Cats“ (neue Käufer), Ränge (Kitten, Cat, Big Cat, Cat on Board für die Top 3), Live-Feed und Statistik. Der Hero zeigt ein Live-Netz: Jeder neue Käufer fliegt als Punkt zu seinem Werber.
7. **Ohne API** (lokale Datei, Vorschau) zeigt die Seite Beispieldaten und markiert sie deutlich als „preview · sample data“.

## Launch

1. **Coin auf pump.fun erstellen.**
2. **In `index.html` unten** `window.CAT_CONFIG` ausfüllen: `CA` (unser Coin). `PAIR_CA` ist schon gesetzt: catonboard (`$ONBOARD`, `5ubruMYpgKqw9ip5J1qrXbVGmMdn2VCsMg421B4bpump`). Jupiter routet SOL → catonboard; geprüft: Quote und gebaute Swap-Transaktion sind gültig.
3. **Vercel:**
   - New Project → Repo `kaiclawius/mlb-picks`, **Root Directory `coins/bring-a-cat-onboard`**, Framework „Other“.
   - **Storage:** Upstash Redis aus dem Vercel Marketplace verbinden. Damit werden die Variablen `KV_REST_API_URL` und `KV_REST_API_TOKEN` automatisch gesetzt. Ohne Redis vergisst der Server das Board bei jedem Neustart.
   - **Environment Variables:**

| Variable | Pflicht | Bedeutung |
|---|---|---|
| `MINT` | ja | dieselbe Adresse wie `CA` |
| `PAIR_MINT` | für „Pair it“ | `5ubruMYpgKqw9ip5J1qrXbVGmMdn2VCsMg421B4bpump` (catonboard) |
| `RPC_URL` | empfohlen | eigener Solana-RPC, z. B. Helius (der öffentliche ist stark limitiert) |
| `MIN_SOL` | nein | Mindestkauf, Standard 0.05 |

4. **`og:image`** auf die volle URL setzen (`https://deine-domain/img/og.png`).

## Rewards

Laut Seite gibt es wöchentliche Rewards für die Top Cats aus den Creator-Fees des Coins, öffentlich und on chain. Die Auszahlung macht ihr selbst aus dem Creator-Wallet. Das Leaderboard (`/api/board`) liefert dafür die Wallets und Zahlen. Die Seite verspricht keine Beträge. Bleibt dabei, das ist auch rechtlich sicherer.

## Grenzen

- **Neue Wallets:** Jemand kann mit einer frischen zweiten Wallet über den eigenen Link kaufen. Das kostet ihn echtes SOL und Gebühren, und der Mindestkauf bremst es. Vor der Auszahlung lohnt ein Blick auf auffällige Muster, etwa viele Käufe aus frisch finanzierten Wallets.
- **Käufe außerhalb der Seite** (direkt auf pump.fun) werden keinem Link zugeordnet.
- **pump.funs eigenes Referral-Programm** ist davon getrennt. Die Seite ist nicht mit pump.fun, Jupiter oder catonboard verbunden.

## Lokal testen

```sh
npm install
# statische Vorschau: npx http-server -p 4850 .
```
Die API-Tests (Claim, Kauf zählen, doppelt, Selbst-Referral, zu klein, fehlgeschlagen, zu alt, falscher Coin, Sticky-Regel, Board) liefen mit simulierten Solana-Transaktionen: 20/20 bestanden.
