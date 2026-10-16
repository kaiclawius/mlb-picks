# Stimme

Deine eigene Text-zu-Sprache-App, die gleiche Idee wie ElevenLabs, aber lokal auf deinem Rechner: Text eintippen, Stimme wählen, anhören, als MP3 laden. Dazu kannst du Stimmen aus einer 15–30-Sekunden-Probe klonen.
Klipp nutzt Stimme für vertonte Agent-Videos. Beide Apps sind eigenständig und arbeiten automatisch zusammen.

## Start

```sh
cd stimme
npm install
npm start                # http://localhost:4848
```

- **Fertige Stimmen:** funktionieren sofort. Jede Stimme lädt beim ersten Benutzen einmal ihr Modell herunter (60–340 MB).
- **Klonen:** braucht eine einmalige Einrichtung mit Python. Es lädt etwa 2 GB Software und beim ersten Klonen das Modell (~3 GB):

```sh
npm run setup-clone
```

## Stimmen

| Stimme | Sprache | Engine | Lizenz der Stimmdaten |
|---|---|---|---|
| Thorsten (neutral, fröhlich, flüsternd, überrascht) | Deutsch | Piper (VITS) | CC0 |
| Kerstin | Deutsch | Piper | CC0 |
| Anna, Jonas (MLS) | Deutsch | Piper | CC-BY 4.0 (Namensnennung) |
| Heart, Bella, Nicole, Sarah, Michael, Adam, Puck (US); Emma, George, Daniel (UK) | Englisch | Kokoro-82M | Apache 2.0 |
| Deine geklonten Stimmen | Deutsch + Englisch | Chatterbox Multilingual (Resemble AI) | MIT |

- **Geschwindigkeit:** Fertige Stimmen laufen auf jeder CPU schneller als Echtzeit (Sätze in 1–2 Sekunden).
- **Klonen:**

  | Hardware | Tempo |
  |---|---|
  | NVIDIA-Grafikkarte | fast Echtzeit |
  | Apple-Chip | gut |
  | nur CPU | ca. 3–4 Sekunden pro Sekunde Sprache |

- **Hinweis zu Anna und Jonas:** Das sind zwei von 236 Sprechern des MLS-Datensatzes. Namen und Geschlecht habe ich nicht geprüft. Hör sie dir an und benenne sie in `server/catalog.js` um oder nimm andere Sprecher-IDs (`sid` 0–235).

## Stimmen klonen: Regeln

- **Einwilligung:** Klonen geht nur mit bestätigter Einwilligung („Ich bin diese Person oder habe ihre ausdrückliche Erlaubnis“) und dem Namen der Person. Beides wird mit der Stimme gespeichert.
- **Wasserzeichen:** Jede geklonte Ausgabe enthält das unhörbare Perth-Wasserzeichen von Resemble AI. So bleibt nachweisbar, dass sie künstlich ist.
- **Was nicht erlaubt ist:** fremde Stimmen ohne Erlaubnis klonen, und Menschen täuschen, zum Beispiel mit Anrufen oder gefälschten Aussagen.

## API für Programme und Agents

```sh
# sprechen → JSON mit Link, Dauer und Satz-Zeiten
curl -X POST localhost:4848/api/speak -H 'Content-Type: application/json' \
  -d '{"text":"Hallo Welt","voice":"thorsten","speed":1}'

# direkt die Audiodatei
curl -X POST 'localhost:4848/api/speak?raw=1' -H 'Content-Type: application/json' \
  -d '{"text":"Hello world","voice":"heart","format":"wav"}' -o hallo.wav

curl localhost:4848/api/voices                       # alle Stimmen
curl -X POST 'localhost:4848/api/voices/clone?name=Rafa&lang=de&consent=1&person=Rafa%20M.' \
  --data-binary @probe.m4a                           # Stimme klonen
```

- **Agents (MCP):** Für Agents ist Stimme in den Klipp-MCP-Server eingebaut: die Werkzeuge `stimme_voices` und `stimme_speak`, siehe `klipp/docs/agents.md`.
- **Wiederholte Anfragen:** Gleicher Text mit gleicher Stimme kommt aus dem Verlauf, sofort und ohne neue Rechenzeit.

## Einstellungen (`.env`)

| Variable | Standard | Bedeutung |
|---|---|---|
| `STIMME_HOME` | `~/Stimme` | Modelle, geklonte Stimmen, Verlauf |
| `STIMME_PORT` / `STIMME_HOST` | `4848` / `127.0.0.1` | Server |
| `STIMME_DEVICE` | `auto` | Klonen auf `cuda`, `mps` oder `cpu` erzwingen |
| `STIMME_THREADS` | Kerne − 1 (max. 4) | CPU-Threads für die fertigen Stimmen |

## Wie es gebaut ist

- **`server/builtin.js`:** fertige Stimmen über [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) (Apache 2.0), direkt in Node, ohne Python.
- **`server/clone.js` + `sidecar/chatterbox_server.py`:** Klonen mit [Chatterbox](https://github.com/resemble-ai/chatterbox) (MIT). Läuft als kleiner Python-Prozess, der nur bei Bedarf startet.
- **`server/speak.js`:** teilt Texte in Sätze, setzt natürliche Pausen, gleicht die Lautstärke an (-16 LUFS) und merkt sich die Satz-Zeiten.

**Eigenständig gebaut:** Kein Code von ElevenLabs. Stimme verwendet offene Modelle und eigenen Code („Clean Room“). Für einen Verkauf ist das die sichere Grundlage.
