# Web-Motion-Kit

Award-Effekte für Webseiten über HTML-Attribute (`data-m="…"`, `data-gl="…"`). Es gibt keinen Build-Schritt. Jeder Effekt hat eine ruhige Variante für „reduzierte Bewegung“, und ohne JavaScript ist die Seite vollständig.

- **Kern:** `motion.css` + `motion.js` + `vendor/`. Darin stecken GSAP 3.15 mit ScrollTrigger und SplitText (kostenlos, auch kommerziell) sowie Lenis 1.3.26 (MIT).
- **WebGL:** `webgl/dist/motion-webgl.js` liefert drei Szenen:
  - Farbverlauf-Hero, etwa 7 KB
  - gebogene Galerie, etwa 8 KB
  - 3D-Produkt; three.js (609 KB) wird nur dafür nachgeladen
- **Demo:** `demo/index.html` zeigt jeden Effekt. Lokal öffnen mit `npx http-server -p 4820 .` und dann <http://127.0.0.1:4820/demo/> aufrufen.
- **Anleitung, alle Optionen und Prüfschritte:** `../../references/web-kit.md`

```html
<h1 data-m="wordmark">Payroll.exe</h1>
<p data-m="highlight">No human in the loop. Just invoices.</p>
<section data-m="pin"> … <li data-m-step>Post</li> … <span data-m="stamp" data-m-on-step="3">PAID</span></section>
<div data-gl="gradient" data-gl-colors="#0f1517,#2447c4,#4fd28a,#f6f9f5"></div>
```
