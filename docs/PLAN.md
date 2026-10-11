# Plan: Launchpad mit Mehrwert und Sicherheit

Ziel: Jemand hat eine Idee, schreibt sie auf, lädt Bilder hoch und klickt auf **Deploy**. Daraus entstehen eine
Webseite für den Coin und der Coin selbst auf pump.fun, mit der Seite verlinkt. Anmelden können sich nur Halter
unseres Plattform-Tokens (`$MOP`) oder Wallets auf einer Allowlist. Der Mehrwert gegenüber einem normalen Launch:
jede Seite zeigt einen Live-Check aus der Blockchain, und jeder Launch läuft durch eine Inhalts-Prüfung.

## Ablauf

1. **Login:** Wallet verbinden, Nachricht signieren (Sign-In with Solana). Server prüft Signatur, Nonce, Domain, Ablaufzeit.
2. **Zugang:** Server liest per RPC den Bestand an `GATE_MINT` oder prüft die Allowlist. Daraus folgt ein Tageskontingent.
3. **Entwurf:** Idee, Name, Symbol, Bilder → Bildprüfung → KI-Moderation → KI-Seitentext → Vorschau.
4. **Launch (Prepare):** Server hostet Metadaten, erzeugt einen frischen Mint-Schlüssel, baut die `create_v2`-Transaktion
   mit dem offiziellen pump.fun-SDK, signiert nur mit dem Mint-Schlüssel und gibt sie unsigniert für den Nutzer zurück.
5. **Signieren:** Die Wallet des Nutzers zeigt die Transaktion, signiert und sendet sie. Der Server hält nie einen Nutzerschlüssel.
6. **Launch (Confirm):** Server prüft die Transaktion on-chain (kein Fehler, Fee-Payer ist der Nutzer, richtiger Mint, pump-Programm,
   Bonding-Curve existiert) und veröffentlicht die Seite mit Contract-Adresse und Link.

## Genutzte Repos und Quellen

| Quelle | Wofür |
| --- | --- |
| [`pump-fun/pump-sdk`](https://github.com/pump-fun/pump-sdk) (npm `@pump-fun/pump-sdk` 4.0.0) | `createV2Instruction`, PDAs, Programm-ID. Baut die Transaktion lokal, keine Drittanbieter-API nötig |
| [`pump-fun/pump-public-docs`](https://github.com/pump-fun/pump-public-docs) | `COIN_CREATION.md`: Argumente, 16 Konten, Limits (Name 32, Symbol 13, URI 200 Zeichen) |
| [`phantom/sign-in-with-solana`](https://github.com/phantom/sign-in-with-solana) | Nachrichtenformat und Prüfregeln für den Login |
| [`wallet-standard`](https://github.com/anza-xyz/wallet-standard) | Wallet-Anbindung im Browser ohne eigenes Wallet-UI-Framework |
| `tweetnacl`, `bs58` | Ed25519-Prüfung und Adress-Kodierung |
| Hono, Anthropic SDK, zod | Server, KI-Aufrufe, Schemas |

Bewusst **nicht** genutzt: PumpPortal/PumpDev-APIs. Sie sind Drittanbieter mit Gebühren und API-Schlüsseln, die Konten
und Argumente ändern sich schneller als beim offiziellen SDK, und der Server würde zusätzlich zu einem Vermittler.

## Bedrohungsmodell

| Risiko | Gegenmaßnahme |
| --- | --- |
| Fremde melden sich an, um KI-Kosten zu verbrennen | Login per Signatur, Zugang nur mit Token/Allowlist, Kontingent pro Wallet, IP-Limit |
| Replay des Logins | Einmal-Nonce in der DB, kurze Gültigkeit, Server baut die Nachricht selbst nach und vergleicht exakt |
| Session-Diebstahl, CSRF | HttpOnly-Cookie, `SameSite=Strict`, Origin-Prüfung bei jedem POST, HMAC-signiertes Token |
| Schädliche Uploads (SVG, getarnte Dateien) | Nur PNG/JPG/WebP/GIF, Dateityp per Magic Bytes, Größenlimit, `nosniff` |
| XSS auf generierten Seiten | Alles escaped, strenge CSP mit Skript-Hash, Seiten auf eigener Subdomain ohne Cookies |
| Marken, Prominente, Scam-Versprechen, Anstößiges | KI-Moderation von Text und Bildern, **fail closed**: ohne Prüfung wird nichts veröffentlicht |
| Der Betreiber verwahrt Nutzer-Gelder | Nutzer signiert selbst, der Mint-Schlüssel wird nie gespeichert, Fee ist Teil der signierten Transaktion |
| Manipulierte Bestätigung („ich habe gelauncht") | Server liest die Transaktion selbst von der Chain und gleicht Mint, Signer und Programm ab |
| Kurzzeit-Kauf nur für den Zugang | Bestand wird beim Launch frisch geprüft (nicht aus dem Cache) |
| Geheimnisse im Repo | `.env` ignoriert, im Produktivbetrieb Pflicht für `SESSION_SECRET`, Start bricht sonst ab |

## Wert für Nutzer

- **Live-Transparenz-Check** auf jeder Seite: Mint-/Freeze-Authority, gefährliche Token-2022-Erweiterungen, Verteilung.
- **Prüfung vor Launch** schützt vor Rechtsärger durch fremde Marken und Gewinnversprechen.
- **Ein Klick** statt vier Werkzeuge: Seite, Metadaten, Token, Verlinkung.

## Nicht Teil dieser Version (bewusst)

- Dev-Buy beim Launch (kann der Ersteller danach auf pump.fun kaufen).
- IPFS-Pinning der Metadaten (Standard ist eigenes Hosting, siehe README).
- Automatisches Wildcard-DNS/TLS (Infrastruktur, steht im Runbook).
- Rechtsberatung: MiCA, Steuern, Plattformhaftung muss vor einem öffentlichen Start geklärt werden.
