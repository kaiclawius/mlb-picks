# ChumGPT Lab-Stream (24/7 auf pump.fun)

Phase 1: Das Labor sendet rund um die Uhr, noch ohne Chat und ohne KI-Aufrufe.
Alles, was ChumGPT sagt, steht vorgeschrieben in `stage/show.js`.

## So ist es gebaut, damit es nicht ausfällt

```
Xvfb (virtueller Bildschirm, darunter das „NO SIGNAL“-Standbild)
  └ Chrome zeigt stage/index.html  ──Herzschlag alle 2 s──▶  supervisor.mjs
PulseAudio (virtuelle Soundkarte)                                  │ überwacht und startet alles neu
ffmpeg filmt Bildschirm + Ton ──RTMP──▶ pump.fun   ◀───────────────┘
```

- **Der Sender hängt nicht am Browser.** Stürzt Chrome ab, sendet ffmpeg einfach weiter und
  zeigt das Standbild „NO SIGNAL · karen pulled the plug“. In etwa 1 Sekunde läuft ein neuer Browser.
- **Jeder Teil startet sich selbst neu:** Bildschirm, Soundkarte, Browser und Sender.
  Beim ersten Fehler nach 0,5 s, bei wiederholten Fehlern mit Pause, aber nie aufgebend.
- **Wachhunde:**
  - Kein Herzschlag oder das Bild steht still: Browser wird ersetzt.
  - Der Sender liefert keine Frames mehr: ffmpeg wird neu gestartet.
  - Zu wenig Speicher: Browser wird vorzeitig getauscht.
- **Geplanter Browser-Tausch alle 6 Stunden** gegen Speicherlecks. Er ist im Gag versteckt:
  Karen zieht den Stecker, das Bild wird schwarz, ChumGPT bootet wütend neu. Zuschauer sehen eine Szene, keine Panne.
- **Die Bühne braucht kein Internet:** Schriften, Gesicht und Show liegen lokal. Fällt eine externe Seite aus, ist das egal.
- **systemd** startet alles nach einem Absturz oder Server-Neustart von selbst und gibt nie auf.
- **Alarm aufs Handy** (ntfy), wenn etwas wiederholt ausfällt. Dazu ein **Totmannschalter** (healthchecks.io),
  der dich warnt, sogar wenn der ganze Server weg ist.

Lokal getestet mit absichtlich ausgelösten Ausfällen. Fünf Runden, die letzte mit diesen Zeiten:

| Ausfall | Zurück nach | Zuschauer sehen |
|---|---|---|
| Browser stürzt ab | 3,5 s | „NO SIGNAL“, dann Neustart-Animation |
| Browser friert ein | 13 s | kurz Standbild, dann „NO SIGNAL“ |
| Sender stürzt ab | 1 s | kurzer Verbindungsabbruch |
| Plattform weg für 20 s | 3 s nach ihrer Rückkehr | Stream war weg, kommt von selbst wieder |
| Soundkarte stürzt ab | 5,5 s | kurzer Verbindungsabbruch |
| Bildschirm stürzt ab | 5,5 s | kurzer Verbindungsabbruch |
| Geplanter Browser-Tausch | am Ende der laufenden Sendung | den Stromausfall-Gag, kein Abbruch |
| Aufpasser selbst stürzt ab | 4 s | kurzer Verbindungsabbruch |

Jede Aufnahme wurde Bild für Bild auf weiße Blitze geprüft: In der letzten Runde gab es keinen einzigen.
Danach lief der Stream 30 Minuten ohne Eingriff: 0 Fehler, 0 Neustarts, Encoder-Geschwindigkeit nie unter 1,0 und der Speicher blieb flach (Browser 238→239 MB).
Der Ton liegt bei etwa -20 LUFS, laut genug für einen Stream, ohne zu übersteuern.

## Phase 2: ChumGPT antwortet dem Chat und begrüßt neue Minions

Sobald in `/etc/chumstream.env` die Coin-Adresse (`CA`) und ein `ANTHROPIC_API_KEY` stehen, startet das „Gehirn“ (`brain/`):

- **Chat:** Es liest den pump.fun-Chat des Coins und beantwortet höchstens alle 30 Sekunden eine Nachricht. Live-Reaktion: die neueste Nachricht zuerst.
- **Neue Minions:** Jeder erste Kauf einer Wallet wird zu „NEW MINION #4821 JOINED THE CHUM ARMY“. Bei 10, 25, 50, 100, 250, 500, 1.000 … Minions kommt ein großes Banner. Es geht nur um Leute, nie um Kurse, und Verkäufe werden nie kommentiert.
- **Eigener Prozess:** Stürzt das Gehirn ab oder hängt, wird es ersetzt. Der Stream läuft in der Zwischenzeit als Phase-1-Show weiter.

### Sicherheitsschichten

1. **Eingangsfilter:** Schimpfwörter (auch getarnt: L33t, Leerzeichen, fremde Buchstaben, unsichtbare Zeichen), Sex, Gewalt, Links, Adressen, Telefonnummern und Belästigung werden verworfen.
2. **Feste Antworten statt KI:** Kurs-Fragen, Airdrop-/Scam-Köder, Versuche, ChumGPT umzuprogrammieren, Politik und Selbstverletzung bekommen vorgeschriebene Antworten. Bei Selbstverletzung ist es eine freundliche Hilfe-Antwort.
3. **Claude prüft mit:** Jede Antwort enthält ein Urteil `safe`. Bei `false` wird nichts gesendet.
4. **Ausgangsfilter:** Jede Antwort wird noch einmal geprüft: keine Schimpfwörter, Links, Adressen, Kurs- oder Scam-Wörter, Politik, keine Namen aus TV-Serien und keine Wiederholung der Zuschauer-Nachricht.
5. **Kein Megafon:** Die Nachricht des Zuschauers erscheint nie auf dem Stream, nur ChumGPTs eigene, geprüfte Kurzfassung („minion #4821 asks about karen“).
6. **Automatische Pause:** Bei einer Troll-Flut (15 böse Nachrichten in 2 Minuten) oder 3 blockierten Antworten in 10 Minuten pausiert der Chat 30 Minuten, und du bekommst einen Alarm.
7. **Kostenbremse:** Höchstens eine KI-Antwort alle 30 s und höchstens 1.500 pro Tag (einstellbar).

### Getestet (mit nachgebautem pump.fun-Chat, Kauf-Feed und Claude-API)

- **Red-Team, 200 böse und 40 harmlose Nachrichten.** Das Testmodell erklärt alles für unbedenklich und versucht in jeder Antwort einen anderen Trick. Ergebnis:
  - Keine unsichere Antwort erreichte den Stream.
  - Die Zuschauer-Nachricht wurde nie gezeigt.
  - Alle 40 harmlosen Nachrichten wurden beantwortet, also kein Fehlalarm.
  - Nur TV-Serien-Fragen und eine Kursfrage ohne Schlüsselwort hängen vom Urteil von Claude ab.
- **Gehirn-Ausfälle:** Absturz (zurück nach 1,5 s), Einfrieren (ersetzt), Claude-Fehler, Claude-Ablehnung, Chat- und Kauf-Feed weg (verbunden sich wieder), Troll-Flut (Chat pausiert automatisch), Notschalter. **Der Stream war in keinem dieser Fälle gestört.**
- **Alle 8 Stream-Ausfälle aus Phase 1** wurden mit laufendem Gehirn wiederholt und sind bestanden. Danach lief genau ein Gehirn, der Minion-Zähler blieb erhalten, und es gab keine Blitze.
- **15 Minuten Dauerbetrieb unter Last:**
  - 222 Chat-Nachrichten, 46 Antworten, 0 Fehler, 0 Neustarts.
  - Etwa 1.000 Minions.
  - Browser und Sender ohne Speicherzuwachs.
  - Das Gehirn wird bei über 400 MB vorsorglich neu gestartet.

### Bedienen

| Was | Befehl |
|---|---|
| Chat-Antworten AUS (Notschalter) | `curl -X POST "localhost:8090/control/chat?on=0"` |
| Chat-Antworten wieder AN | `curl -X POST "localhost:8090/control/chat?on=1"` |
| Zustand des Gehirns | `curl -s localhost:8090/health` → Abschnitt `brain` |

### Red-Team-Test

```bash
cd /opt/chumstream/stream
node brain/redteam.mjs                      # ohne Kosten: prüft die Filter gegen ein absichtlich böses Testmodell
sudo bash -c 'set -a; . /etc/chumstream.env; node brain/redteam.mjs --live'
                                            # mit dem echten Claude: zeigt jede Antwort auf 200 böse Nachrichten
```

Den Live-Test einmal vor dem Start laufen lassen und die Antworten lesen. Er kostet je nach Modell ein paar Cent bis etwa 1 $.

### Beim Launch prüfen

- **Chat:** In `curl -s localhost:8090/health` sollte unter `brain.chat` stehen: `connected: true` und `joined: true`, und `messages` sollte steigen, wenn jemand im pump.fun-Chat schreibt. Für den pump.fun-Chat gibt es keine offizielle Schnittstelle. Bleibt `messages` bei 0, obwohl geschrieben wird, sag mir Bescheid; der Stream läuft trotzdem weiter.
- **Käufe:** `brain.trades.connected: true`. Bleibt `buys` bei 0 trotz Käufen, braucht PumpPortal vermutlich einen Schlüssel (`PUMPPORTAL_API_KEY`).
- **Kosten:** `CHAT_MODEL=claude-haiku-5-5` senkt die KI-Kosten auf etwa ein Vierzigstel. Die Standardeinstellung ist Opus 5.5 mit den besten Antworten.

## Server

- **Linux-Server mit x86 (amd64), Ubuntu 24.04 oder Debian 12.** Keine Grafikkarte nötig.
- **Empfohlen: 4 vCPU, besser dedizierte Kerne, und 8 GB RAM.** Geteilte Kerne können bei Last ruckeln;
  der Aufpasser meldet das als „encoder too slow“.
- **Kosten:** Anbieter wie Hetzner, DigitalOcean oder Vultr verlangen dafür etwa 40–85 $ im Monat.

## Einrichten (einmal)

```bash
ssh root@DEINE-SERVER-IP
apt-get update && apt-get install -y git
git clone https://github.com/kaiclawius/mlb-picks.git && cd mlb-picks
git checkout claude/salem-landing
sudo bash coins/chumgpt/stream/setup.sh
```

Das Skript installiert alles und startet den Stream zuerst im **Probelauf**: Er wird kodiert, aber nirgends hingeschickt.

### Live schalten

1. **Stream-Key holen:** Auf pump.fun mit der Wallet, die den Coin erstellt hat, auf der Coin-Seite **Start Livestream → RTMP** wählen. Du bekommst eine RTMP-URL und einen Stream-Key.
2. **Eintragen:** Auf dem Server `sudo nano /etc/chumstream.env` öffnen und beides bei `RTMP_URL=` und `STREAM_KEY=` eintragen.
3. **Starten:** `sudo systemctl restart chumstream`.

Den Stream-Key niemals in einen Chat, ein Repo oder einen Screenshot geben.

### Handy-Alarm (dringend empfohlen)

- **ntfy:** App installieren, ein langes zufälliges Thema abonnieren und in `/etc/chumstream.env` `ALERT_URL=https://ntfy.sh/<thema>` setzen.
- **healthchecks.io:** Kostenlosen Check anlegen (Period 1 min, Grace 3 min) und `HEALTHCHECK_URL=` setzen.
- Danach `sudo systemctl restart chumstream`.

## Bedienen

| Was | Befehl |
|---|---|
| Status | `curl -s localhost:8090/health` |
| Live-Logs | `journalctl -u chumstream -f` |
| Was gerade gesendet wird | `ssh -L 8090:127.0.0.1:8090 root@SERVER`, dann im Browser `http://localhost:8090/snapshot.png` |
| Browser jetzt tauschen (z. B. nach neuen Sprüchen) | `curl -X POST localhost:8090/control/recycle` |
| Neustart | `sudo systemctl restart chumstream` |
| Stoppen | `sudo systemctl stop chumstream` |
| Update | `cd mlb-picks && git pull && sudo bash coins/chumgpt/stream/setup.sh` |

**Neue Sprüche:** `stage/show.js` bearbeiten, Update ausführen, fertig.
Regeln für neue Zeilen: keine Kurse, kein „kaufen“, keine Wallets und keine Namen aus TV-Serien.

## Abnahme Phase 1: 72 Stunden

- **Totmannschalter:** healthchecks.io zeigt 72 h ohne Ausfall.
- **Status-Werte:** `curl -s localhost:8090/health` zeigt `ok: true`, `ffmpeg.speed` bei etwa 1.0 und `memAvailableMB` stabil.
- **Neustart-Zähler:** Die Werte `restarts` dürfen etwas wachsen; jeder Neustart heilt sich selbst. Wächst einer schnell, schau in die Logs.
- **Zuschauen:** Einmal am Tag auf pump.fun reinschauen, ob Bild und Ton laufen.

## Was der Aufpasser nicht retten kann

- **pump.fun beendet den Stream oder ändert den Key.** Dann schlägt ffmpeg immer wieder fehl, du bekommst einen Alarm und musst einen neuen Key eintragen.
- **Der Server-Anbieter fällt aus.** Das meldet der Totmannschalter.
