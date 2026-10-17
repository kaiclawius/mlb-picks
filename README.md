# Tools

Die Werkzeuge der Agentur, getrennt von den Memecoin-Seiten (die liegen auf dem Branch `claude/salem-landing` unter `coins/`).

| Tool | Ordner | Was es kann | Start |
|---|---|---|---|
| **Klipp** | `klipp/` | Bildschirm-Aufnahmen wie Loom: lokales Transkript, Titel, Zusammenfassung und Kapitel von Claude, „Frag das Video“, Anleitungen, Editor, Export. MCP-Server für Agents, inklusive automatischer Webseiten-Aufnahme mit Sprecherstimme. | `klipp/README.md` |
| **Stimme** | `stimme/` | Text zu Sprache, lokal (Piper DE, Kokoro EN), Voice-Cloning über Chatterbox | `stimme/README.md` |
| **Studio** | `studio/` | Produkt-Videos als Code (Remotion): Seite aufnehmen, dann 16:9, 9:16 und 1:1 rendern | `studio/README.md` |
| **Motion-Skill** | `.claude/skills/motion/` | Motion-Design für Videos und Webseiten: Remotion-Starter, Web-Motion-Kit (GSAP, Lenis, WebGL), Prüf-Skripte (study-site, audit-ui, lint-motion, qa-video, captions, loudnorm, sfx, beats, frames) und Messdaten von Award-Seiten | `.claude/skills/motion/SKILL.md` |
| **Art Direction** | `.claude/skills/art-direction/` | Gegen den generischen KI-Look: Inventar und Ideen-Satz mit Wettbewerber-Test, eine per Zufall gezogene Direction (14 Directions, 18 Paletten, 15 Schrift-Paare, 20 Motion-Moves), Bilder aus offenen Sammlungen mit Lizenzfilter und Credits, Browser-Check bei 3 Breiten mit Kontaktbögen, Kritik-Schema mit Obergrenzen | `.claude/skills/art-direction/SKILL.md` |
| **Netzwerk-Graph** | `tools/network-graph/` | Live-Graph wie in Obsidian, für Referrals und andere Netze | `tools/network-graph/README.md` |
| **Upscale + Retusche** | `tools/upscale/` | Fotos ×4 hochskalieren (Real-ESRGAN), kleine Logos entfernen | `tools/upscale/README.md` |

Hinweise:
- **Studio-Beispiel:** Das Beispielprodukt `payroll` nimmt die Seite `../coins/payroll` auf, die auf diesem Branch fehlt. Rendern geht trotzdem, weil die Aufnahmen schon in `studio/public/payroll/` liegen. Für eine neue Aufnahme den Pfad `serve` in `studio/products/payroll.capture.mjs` auf eine eigene Seite setzen.
- **Remotion-Lizenz:** Für Studio und den Motion-Skill ist Remotion nur für Firmen mit bis zu 3 Mitarbeitern kostenlos, danach braucht ihr eine Company License.
