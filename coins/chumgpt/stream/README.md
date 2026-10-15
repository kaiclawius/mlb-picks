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
