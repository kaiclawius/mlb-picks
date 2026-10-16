# Klipp

Deine eigene Loom-Alternative: Bildschirm und Kamera aufnehmen, sofort teilen, im Text schneiden, und die KI macht aus jedem Video eine Zusammenfassung, Kapitel, Antworten auf Fragen und eine schriftliche Anleitung.
Alles läuft auf deinem Rechner. Es gibt kein Zeitlimit, kein Video-Limit und kein Wasserzeichen.

## Start in 2 Minuten

Voraussetzung: [Node.js](https://nodejs.org) ab Version 20, außerdem Chrome oder Edge. Firefox geht auch, dort aber ohne die schwebende Bubble.

```sh
cd klipp
npm install
cp .env.example .env      # optional: ANTHROPIC_API_KEY eintragen für die KI-Funktionen
npm start                 # öffnet http://localhost:4747
```

- **ffmpeg:** ist eingebaut, du musst nichts extra installieren.
- **Erstes Transkript:** lädt einmal das Whisper-Modell herunter (etwa 150 MB). Danach läuft Klipp offline.
- **Als App:** Klipp lässt sich in Chrome oder Edge als App installieren (Adressleiste → „App installieren“). Dann hat es ein eigenes Fenster und ein Dock-Symbol.

## Für Agents (MCP) und mit Stimme

Agents können Klipp ohne Mühe benutzen: Videos suchen, lesen, als Bilder ansehen, kommentieren, schneiden, exportieren und **selbst Videos aufnehmen, mit gesprochener Erklärung**. Die Stimme kommt aus [Stimme](../stimme), unserer eigenen Text-zu-Sprache-App mit deutschen und englischen Stimmen und Stimm-Klonen.

```sh
claude mcp add klipp -- node /pfad/zu/klipp/server/mcp.js
```

Alles Weitere steht in [docs/agents.md](docs/agents.md).

## Was Klipp kann

**Aufnehmen**
- **Was aufgenommen wird:** Bildschirm, Fenster oder Tab, plus Kamera und Mikro, mit Systemton, wenn der Browser ihn anbietet. Qualität bis 4K, 30 oder 60 fps.
- **Schwebende Kamera-Bubble:** bleibt mit Pause- und Stopp-Knopf über allen anderen Fenstern (Chrome/Edge, Document Picture-in-Picture).
- **Drei getrennte Spuren:** Bildschirm, Kamera und Mikro werden einzeln in voller Qualität gespeichert. Die Bubble lässt sich deshalb nachträglich verschieben, vergrößern, abrunden oder ausblenden.
- **Absturzsicher:** Jede Sekunde wird sofort zum Klipp-Server geschickt. Stürzt der Browser ab, wird die Aufnahme beim nächsten Start automatisch wiederhergestellt.
- **Steuerung:** Countdown, Pause, „Neu“ (verwerfen) und Tastenkürzel (`Alt+Shift+S` stoppt, `Alt+Shift+P` pausiert).

**Teilen und Ansehen**
- **Sofort teilbar:** Der Link funktioniert Sekunden nach dem Stopp. Es gibt kein „Processing“, weil das Video nicht neu kodiert wird.
- **Player:** Kapitel und Kommentare erscheinen auf der Zeitleiste. Dazu kommen Untertitel (`C`), Geschwindigkeit bis 2×, Tastatursteuerung (`Leertaste`, `J`/`K`/`L`, `F`) und Links ab einer bestimmten Sekunde (`?t=90`).
- **Kommentare und Reaktionen:** Sie hängen an der Stelle im Video, an der man gerade ist.
- **Suche:** Die Bibliothek durchsucht Titel, Zusammenfassungen, Kommentare und jedes gesprochene Wort.
- **„Text für Slack/E-Mail kopieren“:** kopiert Titel, Zusammenfassung, Kernpunkte und Link für alle, die kein Video schauen.

**Bearbeiten**
- **Schneiden wie im Textdokument:** Wörter im Transkript markieren und mit `Entf` löschen. Ein Klick auf durchgestrichene Wörter holt sie zurück.
- **Automatisch aufräumen:** „Füllwörter entfernen“ (äh, ähm, uh, um …) und „Pausen kürzen“ mit einem Klick.
- **Weitere Werkzeuge:** Anfang und Ende auf der Zeitleiste ziehen, „Hier schneiden“, Rückgängig.
- **Sofortige Vorschau:** Schnitte werden beim Abspielen übersprungen, ohne dass etwas gerendert werden muss.

**Exportieren**
- **MP4 (H.264):** mit Schnitten und eingebrannter Bubble, läuft überall.
- **MP4 mit Untertiteln:** fest im Bild, für Social Media.
- **Demo-Film:** wird mit Remotion gerendert. Er hat ein Intro mit Titel und Zusammenfassung, zeigt die Aufnahme in einem schwebenden Fenster, blendet Kapitel ein, hat Untertitel und schließt mit einem Outro mit den Kernpunkten. So sieht das Video aus wie ein Produktvideo.
- **Untertitel:** als VTT-Datei, auch übersetzt.

**KI**
- **Transkript (lokal, kostenlos, privat):** Whisper läuft auf deinem Rechner mit Wort-Zeitstempeln. Der Ton verlässt den Computer nicht.
- **Mit Claude** (braucht `ANTHROPIC_API_KEY`):
  - **Titel, Zusammenfassung, Kernpunkte, To-dos und Kapitel:** werden automatisch nach jeder Aufnahme erstellt.
  - **„Frag das Video“:** Man stellt eine Frage und bekommt eine Antwort mit klickbaren Stellen im Video.
  - **Anleitung:** Aus der Aufnahme wird eine schriftliche Schritt-für-Schritt-Anleitung mit Screenshots. Man kann sie als Seite teilen (`/g/<id>`), drucken oder als HTML oder Markdown laden.
  - **Untertitel übersetzen:** in jede Sprache.

## Kosten

- **Transkripte:** 0 €, weil sie lokal entstehen.
- **Claude:** pro Aufnahme ein paar Cent für Titel, Zusammenfassung und Kapitel. Fragen, Anleitungen und Übersetzungen kosten nur, wenn du sie startest.
- **Modell:** Standard ist `claude-opus-5-5`. Ändern geht mit `KLIPP_CLAUDE_MODEL` in `.env`.

## Einstellungen (`.env`)

| Variable | Standard | Bedeutung |
|---|---|---|
| `ANTHROPIC_API_KEY` | (leer) | schaltet die Claude-Funktionen ein |
| `KLIPP_LIBRARY` | `~/Klipp` | Ordner für alle Aufnahmen |
| `KLIPP_WHISPER_MODEL` | `onnx-community/whisper-base_timestamped` | `small_…` ist genauer, `large-v3-turbo_…` am genauesten |
| `KLIPP_PORT` / `KLIPP_HOST` | `4747` / `127.0.0.1` | `0.0.0.0` macht Links im ganzen WLAN erreichbar (Achtung: ohne Login) |
| `KLIPP_OPEN` | `0` | `1` öffnet den Browser beim Start |
| `KLIPP_TRANSCRIBE` | an | `off` schaltet Transkripte ab |
| `STIMME_URL` / `STIMME_DIR` | `http://127.0.0.1:4848` / `../stimme` | wo Klipp die Stimme-App findet |
| `REMOTION_BROWSER` | (leer) | eigenes Chrome für den Demo-Film. Sonst lädt Remotion beim ersten Mal sein eigenes. |

## Wie es gebaut ist

```
web/            Oberfläche (HTML + JavaScript-Module, kein Build-Schritt)
  record.html   Recorder: MediaRecorder pro Spur, Upload in 1-Sekunden-Stücken, schwebende Bubble
  watch.html    Player, Überblick, Transkript, Frag das Video, Anleitung, Editor, Kommentare
server/         Node.js, keine Web-Frameworks
  index.js      HTTP-API, Medien mit Range-Support, Live-Updates (Server-Sent Events)
  store.js      Bibliothek: ein Ordner pro Aufnahme mit meta.json
  media.js      ffmpeg: fertigstellen ohne Neukodierung, Export, Bubble-Maske, Untertitel
  transcribe.js Whisper lokal (transformers.js / ONNX)
  ai.js         Claude: Zusammenfassung, Fragen, Anleitung, Übersetzung (strukturierte JSON-Antworten)
  demo.js       Remotion-Render des Demo-Films (remotion/Demo.jsx)
  mcp.js        MCP-Server für Agents (startet Klipp und Stimme bei Bedarf selbst)
  agent-record.js  Agent-Aufnahmen: Browser + sichtbarer Mauszeiger + Stimme
  voice.js      Verbindung zu Stimme (laufender Server oder Stimme-Ordner daneben)
```

Jede Aufnahme ist ein Ordner: `~/Klipp/<id>/` mit `main.webm` (Bildschirm und Ton), `cam.webm`, `transcript.json`, `captions.vtt`, `meta.json` und den Exporten. Du kannst ihn sichern, kopieren oder später nach Cloudflare R2 spiegeln.

## Tests

```sh
npm test                                       # Unit-Tests (Schnitte, Zeiten, Untertitel, Whisper-Schleifen)
npm start & npm run e2e -- speech.wav 12 both  # echte Aufnahme im Browser mit Fake-Kamera/-Bildschirm
node test/fake-claude.mjs 4800                 # Claude-Ersatz zum Testen ohne Key und ohne Kosten
node test/mcp-e2e.mjs http://localhost:3000/   # MCP wie ein Agent: vertonte Aufnahme, lesen, Bilder, Kommentar
```

## Lizenzen (wichtig, falls du Klipp verkaufst)

- **Dein Code:** gehört dir. Es wurde kein Code von Loom oder Cap übernommen. Cap steht unter AGPL; davon haben wir nur gelernt, nichts kopiert.
- **ffmpeg (`ffmpeg-static`):** GPL-Build. Für den Eigengebrauch ist das kein Problem. Beim Verkauf einer Desktop-App die ffmpeg-Lizenz beilegen oder einen LGPL-Build nutzen.
- **Remotion:** kostenlos für Einzelpersonen und Firmen bis 3 Mitarbeiter. Größere Firmen brauchen eine Firmenlizenz (remotion.dev/license). Das gilt nur für den Demo-Film-Export.
- **Whisper-Modelle (MIT), transformers.js (Apache 2.0), Anthropic SDK (MIT):** unproblematisch.

Mehr dazu und wie es weitergeht: [docs/besser-als-loom.md](docs/besser-als-loom.md).
