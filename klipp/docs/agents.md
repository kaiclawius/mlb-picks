# Klipp für Agents

Klipp ist ein MCP-Server. Damit kann jeder Agent (Claude Code, Claude Desktop, Cursor, eigene Agents mit dem MCP-SDK) Videos finden, „ansehen“, kommentieren, bearbeiten und **selbst aufnehmen, mit Stimme**. Man muss nichts weiter einrichten: Läuft Klipp oder Stimme nicht, starten sie automatisch im selben Prozess.

## Einrichten (einmal)

**Claude Code:**

```sh
claude mcp add klipp -- node /pfad/zu/mlb-picks/klipp/server/mcp.js
```

**Claude Desktop, Cursor & Co.** (`mcp.json` / `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "klipp": { "command": "node", "args": ["/pfad/zu/mlb-picks/klipp/server/mcp.js"] }
  }
}
```

**Voraussetzungen:**
- `npm install` in `klipp/` und `stimme/`.
- Für Agent-Aufnahmen einmal `npx playwright install chromium`. Alternativ nutzt Klipp ein installiertes Chrome oder Edge.

## Die Werkzeuge

| Werkzeug | Was es macht |
|---|---|
| `klipp_search` | Videos finden, auch über alles Gesagte |
| `klipp_get` | Ein Video als Text: Zusammenfassung, Kapitel, Kommentare (Feedback) und Transkript mit Zeitstempeln |
| `klipp_frames` | Standbilder an bestimmten Sekunden, damit der Agent den Bildschirm *sieht* |
| `klipp_comment` | Kommentar an eine Stelle setzen |
| `klipp_ask` | „Frag das Video“ (Claude) |
| `klipp_record_website` | **Agent nimmt selbst auf:** Browser, Schritte, sichtbarer Mauszeiger, Stimme spricht |
| `klipp_import_video` | Eigene Videodatei (z. B. von Computer-Use) zu einem Klipp-Video machen |
| `klipp_guide` | Schritt-für-Schritt-Anleitung mit Screenshots als Markdown |
| `klipp_edit` | Titel, Schnitte, Füllwörter und Pausen entfernen |
| `klipp_export` | MP4, MP4 mit Untertiteln oder Demo-Film |
| `stimme_voices` / `stimme_speak` | Stimmen auflisten / Text sprechen (auch geklonte Stimmen) |

## Der Kreislauf: Agent zeigt, Mensch kommentiert, Agent bessert nach

1. **Der Agent erledigt eine Aufgabe**, zum Beispiel ein neues Feature in deiner App.
2. **Er nimmt auf**, was er gemacht hat:

   ```json
   {
     "url": "http://localhost:3000",
     "title": "Neu: Rechnungen als PDF exportieren",
     "voice": "thorsten",
     "steps": [
       { "action": "wait", "value": 300, "say": "Hallo! Ich zeige dir kurz das neue Export-Feature.", "chapter": "Start" },
       { "action": "type", "target": "#suche", "value": "Rechnung März", "say": "Zuerst suche ich die Rechnung." },
       { "action": "click", "target": "text=Exportieren", "say": "Ein Klick auf Exportieren …", "chapter": "Export" },
       { "action": "highlight", "target": "#fertig", "say": "… und das PDF ist fertig." }
     ]
   }
   ```

3. **Du bekommst einen Link,** schaust 30 Sekunden und kommentierst an der Stelle: „Hier fehlt das Datum.“
4. **Der Agent liest das Feedback** mit `klipp_get`. Die Kommentare stehen dort mit Zeitstelle. Mit `klipp_frames` sieht er sich genau diese Stelle an, bessert nach, nimmt eine neue Version auf und antwortet mit `klipp_comment`.

## Wie eine Agent-Aufnahme entsteht

1. **Erst die Stimme:** Stimme spricht alle Texte. So weiß Klipp, wie lange jeder Schritt dauern muss.
2. **Dann der Browser:** Ein echtes Chromium (Playwright) führt die Schritte aus. Die Maus gleitet sichtbar zum Ziel, bei Klicks erscheint ein Kreis, beim Tippen ist es menschliches Tempo, und jeder Schritt wartet, bis der Satz gesprochen ist.
3. **Zusammensetzen:** Bild und Stimme werden zu einem MP4 kombiniert.
4. **Ab da wie jede Aufnahme:** Link, Transkript, Untertitel, Kapitel aus den Schritten, Zusammenfassung (mit Claude-Key), Kommentare und Exporte.

## Grenzen (ehrlich)

- **Websites:** Aufnahmen funktionieren nur für Websites und Web-Apps. Desktop-Programme nimmt der Agent selbst auf (Computer-Use) und importiert die Datei mit `klipp_import_video`.
- **Sichtbarkeit:** Links sind nur auf deinem Rechner erreichbar, solange Klipp nicht im Netz läuft. Für Links nach außen ist der nächste Schritt Cloudflare R2.
- **Wartezeiten:** Eine Aufnahme mit Stimme dauert ungefähr so lange wie das Video plus ein paar Sekunden. Mit geklonter Stimme kommen auf der CPU 3–4 Sekunden pro Sekunde Sprache dazu.
