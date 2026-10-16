# Besser als Loom: was Leute an Loom stört und was Klipp anders macht

Recherche vom Oktober 2026: Review-Seiten (Capterra, G2), Vergleichsartikel zu Loom-Alternativen und die Preisänderungen nach der Übernahme durch Atlassian. Viele Quellen sind Blogs von Konkurrenten, deshalb zählen hier nur Punkte, die mehrfach auftauchen.

## Die häufigsten Beschwerden und Klipps Antwort

| Schmerzpunkt bei Loom | Was Klipp macht |
|---|---|
| **Langsame Uploads, Videos hängen im „Processing“** (das häufigste Thema bei Capterra; laut deren Auswertung rund 70 % negativ) | Hochgeladen wird *während* der Aufnahme, Sekunde für Sekunde. Danach wird nur neu verpackt, nicht neu kodiert. Der Link ist nach Sekunden fertig. |
| **Verlorene Aufnahmen** bei Abstürzen oder Sync-Fehlern | Jede Sekunde liegt sofort auf der Festplatte. Nach einem Absturz stellt Klipp die Aufnahme beim Start automatisch wieder her. |
| **Preise pro Nutzer** (Business ca. 15–18 $, mit KI ca. 24 $ pro Person und Monat) | Kostenlos im Eigenbetrieb. KI kostet nur, was Claude pro Video verbraucht, meist ein paar Cent. |
| **KI nur im teuersten Tarif** | Transkripte sind lokal und gratis. Zusammenfassung, Kapitel, Fragen und Anleitungen gibt es für alle. |
| **Gratis-Tarif: 5 Minuten, 25 Videos, 720p, kein Download** | Keine Limits, bis 4K, Download jederzeit (Original, MP4, mit Untertiteln, Demo-Film). |
| **Kaum Bearbeitung** | Schneiden im Transkript, Füllwörter und Pausen mit einem Klick, Bubble nachträglich ändern, Rückgängig. |
| **Bugs und Abstürze in der Desktop-App** | Läuft im Browser, den du sowieso offen hast. Eine kleine App, keine Hintergrunddienste. |
| **Datenschutz:** Videos und Ton liegen bei Atlassian | Alles bleibt auf deinem Rechner. An Claude geht nur der Text des Transkripts und nur, wenn KI eingeschaltet ist. |

## Was Klipp zusätzlich kann (Ideen, die Loom nicht oder nur teuer hat)

1. **„Frag das Video“:** Wer keine Zeit hat zu schauen, stellt eine Frage und springt direkt zur Stelle.
2. **Video wird Anleitung:** Aus einer Bildschirmaufnahme wird eine schriftliche Schritt-für-Schritt-Anleitung mit Screenshots, wie bei Scribe oder Tango, aber aus dem Video, das du sowieso aufnimmst.
3. **Demo-Film per Knopfdruck:** aus einer Rohaufnahme ein poliertes Produktvideo (Remotion). Der gleiche Stil wie beim Payroll-Video.
4. **Lesen statt Schauen:** Zusammenfassung, Kernpunkte, To-dos und „Text für Slack/E-Mail kopieren“. Damit kommt die Botschaft auch bei Leuten an, die nicht auf Play drücken.
5. **Getrennte Spuren:** Die Bubble ist nicht eingebrannt. Wenn sie etwas verdeckt, schiebst du sie nachträglich weg.
6. **Untertitel in jeder Sprache:** übersetzt von Claude.

## Nächste Schritte (Vorschlag)

**Für den Eigengebrauch**
- **Cloudflare R2:** fertige Ordner automatisch hochladen und öffentliche Links über eine kleine Worker-Seite. Dann funktionieren Links auch außerhalb deines Rechners. Die Struktur ist schon so gebaut, dass `store.js` nur gespiegelt werden muss.
- **Auto-Zoom:** dorthin zoomen, wo sich auf dem Bildschirm etwas ändert (Bewegungserkennung mit ffmpeg). Das ist das Markenzeichen von Screen Studio, ohne native App.
- **Passwortschutz und Ablaufdatum** für Links.
- **Desktop-App** (Tauri) für Systemton auf dem Mac, globale Tastenkürzel und Mauszeiger-Hervorhebung.

**Zum Verkaufen**
- **Accounts und Teams:** Login, Workspaces, Rechte (wer darf sehen, kommentieren, bearbeiten).
- **Hosting:** R2 für Videos, eine Datenbank für die Metadaten (z. B. Postgres oder D1), Zahlung über Stripe.
- **Statistiken:** wer hat wie weit geschaut, wo wird abgebrochen.
- **Integrationen:** Slack-Vorschau mit Zusammenfassung, Notion- oder Confluence-Export der Anleitungen, Einbetten auf Websites.
- **Lizenzen klären:** LGPL-ffmpeg, Remotion-Firmenlizenz, Datenschutzerklärung und AV-Vertrag, wenn Kundendaten an Claude gehen.

## Quellen

- [Capterra: Loom Reviews](https://capterra.com/p/191187/Loom/reviews/)
- [G2: Loom vs. Screendesk](https://www.g2.com/compare/atlassian-loom-vs-screen-recordings-by-screendesk)
- [Supademo: Loom Alternatives 2026](https://supademo.com/blog/loom-alternatives)
- [Carly: Loom Alternatives (After Atlassian)](https://www.usecarly.com/blog/loom-alternatives/)
- [Techpresso: Loom Review 2026](https://techpresso.co/reviews/loom-review)
- [Clipy: Loom Price Increase After Atlassian](https://clipy.online/blogs/loom-pricing-after-atlassian-free-alternatives/)
- [Cap (Open-Source-Loom-Alternative, AGPL)](https://github.com/cap-so/cap)
- [openalternative.co: Loom-Alternativen](https://openalternative.co/alternatives/loom)
