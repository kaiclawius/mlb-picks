# Coin-Launchpad

Idee aufschreiben, Bilder hochladen, **Deploy** klicken. Daraus entstehen eine Webseite für den Coin und der Coin selbst
auf pump.fun, mit der Seite verlinkt. Anmelden können sich nur Halter des Plattform-Tokens oder Wallets auf einer Allowlist.
Plan, Entscheidungen und Bedrohungsmodell stehen in [docs/PLAN.md](docs/PLAN.md).

**Was den Nutzern etwas bringt:** Jede Seite zeigt einen Live-Check aus der Blockchain (Mint-/Freeze-Authority, gefährliche
Token-2022-Erweiterungen, Verteilung ohne Bonding Curve), und jeder Entwurf läuft vor der Veröffentlichung durch eine
Inhaltsprüfung (reale Personen, fremde Marken, Gewinnversprechen, Anstößiges).

## Landingpage

Die öffentliche Webseite liegt in [`landing/`](landing/) und ist reines HTML, CSS und JavaScript ohne Build-Schritt. Schriften sind selbst gehostet (OFL-Lizenzen
liegen in `landing/fonts/`), die Seite lädt nichts von Drittanbietern.

- **Vorschau lokal:** `landing/index.html` im Browser öffnen oder `npx serve landing`.
- **Einstellungen:** Alles Veränderliche steht in `landing/config.js` (Adresse des Launchpads, Contract-Adresse des Plattform-Tokens, X- und Telegram-Link).
  Leere Werte blenden den jeweiligen Bereich aus. Die Seite ist bis zum Token-Launch bewusst als „Noch nicht gestartet" beschriftet.
- **Einzeldatei:** `node landing/build-single.mjs seite.html` bettet Schriften, CSS und Skripte in eine Datei ein, praktisch für einfaches Hosting.
- **Vor der Veröffentlichung:** `impressum.html` und `datenschutz.html` sind Platzhalter und müssen echt befüllt werden. In `index.html` und `og.html` steckt der Arbeitsname
  „Slop Mop". Beim Umbenennen `og.html` anpassen und `og.png` neu erzeugen (Screenshot mit 1200 x 630). Für Social-Media-Vorschauen muss die `og:image`-URL absolut sein.
- **Beispieldaten:** Das Prüfprotokoll und die Stufen auf der Seite sind ausdrücklich als Beispiel gekennzeichnet. Es gibt keine erfundenen Zahlen, Partner oder Zitate.
- **Barrierefreiheit:** Der Wisch-Effekt im Titel wird bei „reduzierte Bewegung" und ohne JavaScript ausgelassen, dann steht der Titel sauber da.

## Wie es funktioniert

1. Wallet verbinden und eine Nachricht signieren (Sign-In with Solana). Es wird kein Geld bewegt.
2. Server prüft den Bestand am Plattform-Token (`GATE_MINT`) oder die Allowlist und vergibt ein Tageskontingent.
3. Idee und Bilder → Bildprüfung → KI-Seitentext → KI-Moderation → Vorschau.
4. **Deploy:** Der Server baut mit dem offiziellen pump.fun-SDK die `create_v2`-Transaktion und signiert sie nur mit einem
   frischen Mint-Schlüssel. Die Wallet des Nutzers zeigt sie an, signiert und sendet sie. **Der Server hält nie einen Nutzerschlüssel.**
5. Der Server liest die Transaktion selbst von der Chain, prüft Signer, Mint, Programm und Bonding Curve und veröffentlicht erst dann die Seite.

## Starten (lokal)

```bash
npm install
cp .env.example .env     # lokal reichen: GATE_OPEN=1, ALLOW_UNMODERATED=1, ggf. ANTHROPIC_API_KEY
set -a; . ./.env; set +a
npm run dev              # http://localhost:3000
```

Node 22 oder neuer (nutzt `node:sqlite`). Die Daten liegen in `./data` (SQLite und Bilder).

## Tests

```bash
npm test          # 53 Unit- und API-Tests, kein Netzwerk nötig (Fake-Blockchain)
npm run e2e       # Browser-Durchlauf mit Mock-Wallet, schreibt Screenshots nach ./data/e2e
npm run typecheck
```

## Konfiguration

Alle Variablen mit Erklärung stehen in [.env.example](.env.example). Im Produktivbetrieb (`NODE_ENV=production`) bricht der Start
ab, wenn `SESSION_SECRET` oder `SITES_DOMAIN` fehlen oder die Entwicklungs-Schalter `GATE_OPEN` / `ALLOW_UNMODERATED` gesetzt sind.

## Runbook: erster Betrieb und der Plattform-Token

1. **Server aufsetzen:** HTTPS für `PUBLIC_URL` und ein Wildcard-DNS-Eintrag samt Wildcard-Zertifikat für `*.SITES_DOMAIN`, beide auf den Server.
   Hinter einem Reverse-Proxy `TRUST_PROXY=1` setzen und `X-Forwarded-For` nur vom Proxy annehmen.
2. **Bootstrap:** `ALLOWLIST` mit deiner Wallet setzen, `GATE_MINT` noch leer lassen.
3. **Plattform-Token launchen:** Mit der Allowlist-Wallet den eigenen Coin (z. B. Slop Mop `$MOP`) **über das Launchpad selbst** erstellen.
   Das beweist, dass es funktioniert, und die Seite zeigt den eigenen Live-Check.
4. **Zugang auf den Token umstellen:** Mint-Adresse als `GATE_MINT` eintragen, `GATE_TIERS` an den Preis anpassen, Server neu starten.
   Die Allowlist kann für Team-Wallets bleiben.
5. **Kosten im Blick behalten:** Jeder Entwurf kostet zwei KI-Aufrufe (Text und Moderation). Die Limits (10 Entwürfe pro Wallet und Tag, 20 pro IP und Stunde)
   sind in `src/app.ts`.

## Sicherheit

| Thema | Umsetzung |
| --- | --- |
| Login | Signatur über eine serverseitig gebaute Nachricht, Einmal-Nonce, 5 Minuten gültig, exakter Vergleich |
| Sitzung | HMAC-signiert, HttpOnly, `SameSite=Strict`, `__Host-`-Cookie unter HTTPS, Origin-Prüfung bei POST |
| Zugang | Frische Bestandsprüfung (ohne Cache) vor jedem Launch, bei RPC-Ausfall kein Zugang |
| Uploads | Typ per Magic Bytes, nur PNG/JPG/WebP/GIF, 2 MB, 4 Bilder, `nosniff`, kein SVG |
| Coin-Seiten | Alles escaped, CSP mit Skript-Hash, eigene Subdomain ohne App-Cookies, Vorschau in Sandbox ohne Skripte |
| Inhalte | KI-Moderation von Text und Bildern, **fail closed**: ohne Prüfung wird nichts veröffentlicht |
| Launch | Nutzer signiert selbst, Mint-Schlüssel wird verworfen, Gebühr liegt in der signierten Nachricht, Bestätigung wird on-chain verifiziert |

## Bekannte Grenzen (ehrlich)

- **Nicht gegen die echte Blockchain getestet.** Die Umgebung, in der das gebaut wurde, erreicht Solana nicht. Transaktion und Bestätigung sind gegen die offizielle
  Doku und das SDK geprüft und mit einer Fake-Blockchain getestet, aber ein erster Launch mit sehr wenig SOL ist Pflicht, bevor andere Nutzer darauf kommen.
- **Die KI-Aufrufe sind ungetestet** (kein API-Key zur Hand). Prüfe Textqualität und Moderationsurteile mit echten Beispielen.
- **Metadaten und Bilder liegen auf diesem Server.** Fällt er aus, verschwinden Bild und Beschreibung der Coins in pump.fun. Für Dauerhaftigkeit gehört ein IPFS-Pinning dazu.
- **Kein Dev-Buy** beim Launch. Wer sofort nach dem Start kaufen will, kann von anderen überholt werden.
- **Limits im Speicher:** Bei mehreren Server-Instanzen müssten die IP-Limits in eine gemeinsame Datenbank. Entwürfe werden nicht automatisch aufgeräumt.
- **Bestand zählt nur zum Zeitpunkt der Prüfung.** Wer kurz leiht oder kauft und danach verkauft, kommt durch. Eine Mindest-Haltedauer ist nicht eingebaut.
- **Recht:** Plattformen, die beim Herausgeben von Tokens helfen, können in der EU unter MiCA fallen. Das muss vor einem öffentlichen Start geklärt werden.
