# Datenschutz- und Sicherheitsprüfung: Klipp und Stimme

Stand: 16. Oktober 2026 · Geprüft: Klipp 0.2 und Stimme 0.1 (Branch `claude/salem-landing`) · Werkzeuge: [REA](https://github.com/morluto/rea) 6.5.0 (Reverse Engineer Anything), strace, eigene Angriffs-Tests

## Ergebnis in einem Satz

**Klipp und Stimme laufen vollständig lokal.** Im Test mit allen Funktionen (Aufnahme, Transkript, Exporte, Demo-Film, Stimmen, Stimm-Klon, Agent-Aufnahme) hat kein Prozess eine Verbindung ins Internet geöffnet. Ausnahmen sind der einmalige Modell-Download beim allerersten Benutzen und Claude, wenn du einen API-Key einträgst. Die Prüfung hat fünf Sicherheitslücken und ein Datenschutzproblem gefunden; alle sind behoben und mit Tests abgesichert.

## Was geprüft wurde und wie

| Prüfung | Werkzeug | Ergebnis |
|---|---|---|
| Quellcode beider Apps: Module, Netzwerk-Endpunkte, Speicher | REA `analyze-javascript-application` | Keine fest eingebauten externen Adressen. Netzwerk nur zu `/api/…` des eigenen Servers, Speicher nur `localStorage`/`sessionStorage` für Einstellungen |
| Alle Oberflächen im Browser: Bibliothek, Player (alle Tabs), Recorder, Anleitung, Stimme (Sprechen, Klonen, API) | REA `capture-browser-scenario` (Chromium, Netzwerk-Mitschnitt) | **Alle Anfragen** gehen an `127.0.0.1` (eigener Server). Keine Tracker, keine CDNs, keine externen Schriften |
| Jede Netzwerkverbindung der Server-Prozesse während eines kompletten Durchlaufs (inkl. ffmpeg, Whisper, Remotion, Chromium, Python-Sidecar) | `strace -f -e trace=connect` | Klipp: **0 externe Verbindungen**. Stimme: 2 (siehe Befund D, behoben → 0) |
| Angriffe durch fremde Websites und bösartige Kommentare | `test/attack.mjs` (Playwright) + curl | Vorher 5 von 5 erfolgreich, nachher 0 von 5 |

## Befunde

| # | Befund | Schwere | Status |
|---|---|---|---|
| A | **Gespeichertes XSS über Kommentare:** Name und Emoji eines Kommentars landeten ungefiltert im HTML der Zeitleiste. Wer den Link hat, konnte JavaScript einschleusen, das bei jedem Zuschauer läuft und z. B. Aufnahmen löscht. | Hoch | Behoben (`web/js/player.js`: alles wird maskiert) |
| B | **CSRF:** Jede Website, die du im Browser offen hast, konnte im Hintergrund Anfragen an `localhost:4747` schicken: Kommentare schreiben, Exporte starten, Agent-Aufnahmen auslösen, Videos importieren. | Hoch | Behoben (`server/guard.js`: Änderungen nur von Klipps eigenen Seiten oder von Programmen ohne Browser-Herkunft) |
| C | **Stimme: fremde Websites konnten mitlesen:** `Access-Control-Allow-Origin: *` erlaubte jeder Website, den Verlauf (alle Texte, die du hast sprechen lassen), die Stimmenliste und Audiodateien zu lesen. | Hoch | Behoben (CORS entfernt; Klipp spricht Server-zu-Server und braucht es nicht) |
| D | **Datenschutz: Klon-Engine meldete sich bei jedem Start bei Hugging Face**, um nach neuen Modellversionen zu fragen, auch wenn das Modell längst da war. Es wurden keine Inhalte gesendet, aber die Verbindung verrät, dass und wann du klonst. | Mittel | Behoben: nach dem ersten Download läuft die Engine mit `HF_HUB_OFFLINE=1`. Nachgemessen: 0 Verbindungen |
| E | **DNS-Rebinding:** Eine Website kann ihren eigenen Domainnamen auf `127.0.0.1` zeigen lassen und so Klipp und Stimme wie eine eigene Seite benutzen und alles lesen. | Mittel | Behoben: beide Server akzeptieren nur `localhost`/`127.0.0.1` (und Namen aus `KLIPP_ALLOWED_HOSTS` / `STIMME_ALLOWED_HOSTS`) |
| F | **Klon-Sidecar ohne Zugangsschutz:** Der Python-Prozess nahm Befehle von jedem lokalen Programm an, inklusive frei wählbarer Dateipfade zum Lesen und Schreiben. | Mittel | Behoben: geheimer Schlüssel pro Start, Host-Prüfung, Dateien nur innerhalb des Stimme-Ordners |
| G | **Agent-Aufnahme konnte lokale Dateien öffnen:** Ein `goto`-Schritt mit `file:///…` hätte lokale Dateien ins Video gebracht. | Niedrig | Behoben: nur `http(s)` |

### Nachweis vorher/nachher (`node test/attack.mjs`)

```
                              vorher   nachher
CSRF-Kommentar angenommen      ja       nein
Stimme-Verlauf lesbar          ja       nein
Stimme-Stimmen lesbar          ja       nein
DNS-Rebinding Klipp            200      403
DNS-Rebinding Stimme           200      403
XSS ausgeführt                 ja       nein
```

## Wohin Daten gehen (vollständige Liste)

| Wann | Wohin | Was |
|---|---|---|
| Erstes Transkript | `huggingface.co` | Download des Whisper-Modells (~150 MB). Danach nie wieder |
| Erste Benutzung einer fertigen Stimme | `huggingface.co` | Download des Stimm-Modells (60–340 MB). Danach nie wieder |
| Erstes Klonen | `huggingface.co` | Download des Klon-Modells (~3 GB). Danach nie wieder (Befund D) |
| Erster Demo-Film ohne eigenes Chrome | Download-Server für Chrome Headless Shell (über Remotion) | Browser für das Rendern (~100 MB), nur wenn `REMOTION_BROWSER` nicht gesetzt ist |
| **Nur mit `ANTHROPIC_API_KEY`** | `api.anthropic.com` | Der **Text** des Transkripts (nie Ton oder Bild) für Titel, Zusammenfassung, Kapitel, Fragen, Anleitungen, Übersetzungen |
| Alles andere | nirgendwohin | Videos, Ton, Kamera, geklonte Stimmen, Kommentare, Verlauf bleiben in `~/Klipp` und `~/Stimme` |

Ohne API-Key und nach den Erst-Downloads funktionieren Klipp und Stimme auch komplett ohne Internet.

## Bekannte Grenzen (noch offen)

- **Kein Login:** Mit `KLIPP_HOST=0.0.0.0` (Links im WLAN teilen) kann jeder im selben Netzwerk alle Aufnahmen sehen und ändern. Für öffentliche Links kommen Login und signierte Links mit dem Cloudflare-R2-Schritt.
- **Fremde Mediendateien:** Importierte Videos werden mit ffmpeg gelesen. Wie jede Video-App vertraut Klipp damit dem Medien-Parser von ffmpeg; aktuelle ffmpeg-Versionen verwenden.
- **Lizenzen:** Das eingebaute ffmpeg ist ein GPL-Build (für einen Verkauf ersetzen). Remotion braucht ab 4 Mitarbeitern eine Firmenlizenz.
- **Abdeckung:** Die Prüfung deckt den Code dieses Repos und das Laufzeitverhalten unter Linux ab. Die Abhängigkeiten (ffmpeg, ONNX Runtime, PyTorch, Chromium) wurden zur Laufzeit beobachtet, aber nicht selbst auditiert.

## Selbst nachprüfen

```sh
# Angriffs-Test (Klipp und Stimme müssen laufen, dazu eine beliebige andere lokale Seite als "fremde Website")
node test/attack.mjs http://127.0.0.1:4747 http://127.0.0.1:4848 http://127.0.0.1:8000/ <aufnahme-id>

# Netzwerk mitschneiden (Linux): beide Server unter strace starten, alles benutzen, dann auswerten
strace -f -qq -e trace=connect -o klipp.strace npm start
python3 test/egress-parse.py klipp.strace

# REA: statische Analyse und Browser-Mitschnitt
npx rea-agents analyze-javascript-application ./klipp --artifact-format directory
npx rea-agents capture-browser-scenario scenario.json   # siehe REA-Doku, capture.events: ["network"]
```

REA nur aus den offiziellen Quellen beziehen (GitHub `morluto/rea`, npm `rea-agents`): Unter ähnlichen Namen kursieren gefälschte Kopien mit Schadsoftware.
