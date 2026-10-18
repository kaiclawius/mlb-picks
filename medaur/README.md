# Medaur: agency site

Static page (no build step). Open `index.html` through any web server, or deploy the folder on Vercel / Netlify as is.

**Idea:** *縁 (en), the bond between people, becomes the page.* Japanese ink on washi paper, an ensō that paints itself, and a live engine that turns into the visitor's own trade: homepage, enquiry automation and lead list.

## Before going live
Edit `window.MEDAUR` at the top of `index.html`:
| Key | What |
|---|---|
| `EMAIL` | real contact address (placeholder: `hallo@medaur.de`) |
| `CALENDAR` | optional booking link (not used yet) |
| `IMPRESSUM`, `PRIVACY` | links to the legal pages. **These are required in Germany.** Not written yet. |

Also check:
- The work plates (`img/work/`) are our own studio projects (Payroll.exe, Mission S, Nemo Mucron, Grok Dog). Swap or remove any you don't want to show next to the agency.
- The demo uses **sample data**, labelled on the page. Its business names are invented.
- `og:image` is relative. Make it absolute once the domain is known.
- The contact form only opens the visitor's mail app. Nothing is sent to a server.

## Structure
- 一 Demo: six trades (dental, trades, real estate, restaurant, tax, fitness) plus a city field. The same data fills the pinned customer file in 二.
- 二 Pinned path: found → convinced → answered → booked (予約 stamp).
- 三 Services as hanging scrolls: 顔 website, 流 automation, 招 lead engine.
- 四 What AI-native means here. Every claim is real tooling: the browser check, films from code, local TTS, code review.
- 五 Work, 六 process (道), 話 contact.

## Assets
- `img/washi.jpg`, `img/sumi.jpg`, `img/enso*.png`, `img/stroke*.png` were painted in code by us (a script in the session scratchpad, so no licence is needed).
- Fonts: Shippori Mincho B1 and Yuji Syuku (SIL OFL) from Google Fonts. Yuji is subset to the characters we use.
- Motion: `kit/` (GSAP Standard licence, Lenis MIT), plus soft ink reveals in the page.

Japanese used: 縁を結ぶ (en o musubu, "to tie bonds"), 試 try, 技 craft, 作 work, 道 way, 話 talk, 済 done, 予約 reservation, メダウル Medaur in katakana (the seal).
