# Netzwerk-Graph (wie die Graph-Ansicht in Obsidian)

Ein Kraft-Graph auf Canvas, ohne Abhängigkeiten. Entstanden für das Referral-Board von „Bring a cat onboard“, nutzbar für alles mit Knoten und Kanten: Referrals, Kunden, Wissen, Abhängigkeiten.

```js
import { createGraph } from "./graph.js";
const g = createGraph(document.querySelector("canvas"), { mode: "full", max: 800, onSelect: (n) => console.log(n) });
g.add({ ref: "@alice", buyer: "Ab12…cd34", sol: 0.2, pair: false, t: Date.now() });   // eine Kante: Werber → Käufer
g.focus("@alice"); g.fit(); g.zoom(1.3); g.setMe("@alice");
```

- **Modi:** `full` mit Ziehen, Verschieben, Zoom (Ctrl/Cmd + Scroll oder Buttons), Hover-Nachbarschaft und Auswahl. `ambient` nur mit Hover, gedacht für Hero-Bereiche.
- **Darstellung:** Zwei feste Kerne (`CORE`, `PAIR`). Neue Knoten fliegen mit einem Puls ein.
- **Leistung:** pausiert außerhalb des Bildschirms und im versteckten Tab, und hört auf zu rechnen, wenn das Netz zur Ruhe gekommen ist. 60 fps bei etwa 800 Knoten.
- **Reduzierte Bewegung:** Bei „reduzierter Bewegung“ wird der Graph einmal berechnet und dann still gezeigt.
- **Anpassen:** Die Datenform (`ref`, `buyer`, `pair`) und die Farben stehen oben in `graph.js`.
