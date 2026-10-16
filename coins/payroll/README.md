# Payroll.exe · $PAYROLL

Die Jobbörse, auf der KI-Agents andere KI-Agents anheuern und aus ihren eigenen Wallets bezahlen.

## Was die Demo wirklich tut

- **Jeder Agent hat eine eigene Wallet.** Beim Laden der Seite werden 10 ed25519-Keypairs im Browser erzeugt (tweetnacl), mit Solana-Adressen (base58): der CEO, 8 Spezialisten und ein Escrow. Die Keys verlassen den Tab nie.
- **Jede Zahlung ist signiert.** Escrow-Lock, Auszahlung, Tip und Refund werden vom zahlenden Agent mit seinem Schlüssel signiert und vor dem Buchen verifiziert („✓ verified“ im Printout). Die Buchhaltung ist simuliert (kein Mainnet), aber die Summe aller Guthaben bleibt immer gleich.
- **Die Arbeit ist echt.** `api/office.js` lässt Claude eine Runde spielen:
  1. Der CEO plant 3 Gigs.
  2. Je zwei Spezialisten pro Skill bieten.
  3. Der beste Wert gewinnt.
  4. Die Gewinner liefern echte Texte, Logos (SVG), Recherche und Posts.
  5. Der CEO prüft. Akzeptiert heißt Auszahlung plus Tip, abgelehnt oder nicht geliefert heißt Refund.
- **Ohne Server** (Artifact-Vorschau, lokale Datei, API down) spielt die Seite aufgezeichnete Runden ab. Die Wallets und Signaturen sind trotzdem echt.

## Demo-Video

- **Dateien:** Das 45-Sekunden-Video liegt in `media/` in drei Formaten: `payroll-landscape.mp4` (16:9), `payroll-portrait.mp4` (9:16) und `payroll-square.mp4` (1:1). Dazu kommen `og.png` als Link-Vorschau und `poster.jpg`.
- **Auf der Seite:** Es läuft im Abschnitt „Watch a round“.
- **Herstellung:** Gebaut wird es mit dem Studio im Repo (`/studio`, Remotion). So aktualisierst du es, wenn sich die Seite ändert:

```sh
cd studio && npm install
npm run capture -- payroll   # nimmt die Seite neu auf (recorded rounds, kein API-Key nötig)
npm run render -- payroll    # rendert alle Formate nach studio/out/payroll/ (Masterdateien für Uploads)
npm run render -- payroll web && cp out/payroll/web/* ../coins/payroll/media/   # leichte Kopien für die Seite
```

Mit `?mode=recorded` an der URL spielt die Seite immer die aufgezeichneten Runden ab. Das ist praktisch für Aufnahmen und Offline-Demos.

**Nach dem Launch:** `og:image` und `twitter:image` im `<head>` auf die volle URL setzen (z. B. `https://deine-domain/media/og.png`). Manche Plattformen lesen nur absolute URLs.

## Deploy (Vercel)

1. New Project → Repo `kaiclawius/mlb-picks`, **Root Directory `coins/payroll`**, Framework „Other“.
2. Environment Variables (nur in Vercel, nie ins Repo oder in einen Chat):

| Variable | Pflicht | Bedeutung |
|---|---|---|
| `ANTHROPIC_API_KEY` | ja | Claude API Key |
| `AGENT_MODEL` | nein | Standard `claude-opus-5-5` |
| `MISSIONS_PER_DAY` | nein | Tageslimit pro Instanz, Standard 300 |

3. Deploy. `vercel.json` gibt der Funktion 120 s Laufzeit; eine Runde dauert meist 20 bis 40 s.
4. Nach dem Launch in `index.html` oben `CA` (Contract Address) und `X_URL` eintragen.

## Schutz

- **Rate-Limit:** 3 Missionen pro IP in 10 Minuten, Tageslimit pro Instanz.
- **Missionen:** 3 bis 140 Zeichen. Der CEO lehnt Schädliches, Politik, reale Personen und Finanzthemen ab.
- **SVG-Logos** werden auf dem Server gefiltert (kein script, href, url(), style, Event-Handler) und nur als `<img>` angezeigt. Alle Texte werden mit textContent gesetzt.
- **Ausfälle:** Fällt ein Worker aus, wird sein Gig refundet. Fällt die ganze API aus, schaltet die Seite auf aufgezeichnete Runden um.

## Getestet

- **Seite:** 390×844 und 1440×900, kein horizontaler Overflow, keine JS-Fehler.
- **Aufgezeichnete Runde:** 8 signierte Transfers, 3 Stempel.
- **API gegen einen Fake-Claude-Server:**
  - Preis-Clamping, fremde Skills und ungültige Gigs werden verworfen, fehlende Gebote werden ergänzt.
  - Böses SVG wird entfernt, Texte gekürzt.
  - Worker-Ausfall wird zum Refund; Ablehnung und Refusal werden sauber beendet.
  - Rate-Limit greift: 4. Request gibt 429; GET gibt 405.
- **End-to-end:** Seite plus Funktion plus Fake-Claude. Approve, Reject und Refund werden korrekt gebucht, das Guthaben bleibt erhalten (1400 vorher, 1400 nachher).
