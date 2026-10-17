---
name: art-direction
description: Art direction, real assets and a browser check for websites and landing pages, so an agent's page has an idea and taste instead of the generic AI look. Use it whenever you design or redesign a website, landing page, product page, portfolio, coin or launch site, microsite or marketing section, when someone asks for something to "look designed", "less generic", "premium", "award-level", "not like AI made it", or wants a design reviewed or critiqued, even if they never say "art direction". It deals a direction (palette, type, signature motion) instead of picking defaults, finds licensed pictures with credits, and checks the built page in a real browser at three widths with contact sheets for self-critique. Pairs with the motion skill for the motion layer.
---

# Art direction

Models design by default: the category's most common hero, a safe palette, Inter, three cards with icons, "Get started". The page works, and nobody remembers it. This skill moves the choices out of the model's habits and into a process with evidence: a written idea, a dealt direction, real content and pictures, and a browser that measures the result.

## The loop
1. **Inventory (before any design).** List 8–12 things only this client has: their name and what it means, place, numbers, materials, rituals, documents, people, quirks, real screenshots, real data. If you can't list 8, ask or research; design from that list, not from the category.
2. **The argument.** Write each section as *claim → proof*. A section without a claim is cut. This kills the template order (hero, logos, features, pricing, FAQ) unless the brief really needs it.
3. **Deal a direction.** `node scripts/deal.mjs --options 3 [--sector x] [--tone y]` shows three. Pick one and write one sentence on why it fits *this* inventory. Then `node scripts/deal.mjs --direction <id>` deals palette, type and motion. Redraw a part only with a reason (`--redraw palette --why "..."`), and report redraws.
4. **The idea sentence.** "[a thing from the inventory] becomes [the direction's device]", e.g. "the payslip becomes the hero: a printer that prints real signed payments". **Competitor test:** swap in the nearest competitor's name. If the sentence still works, it is not an idea yet.
5. **One live thing.** One element the visitor can use that is built from real content: a demo, a calculator, a generator, a graph, a game. It is usually the screenshot people share.
6. **Copy before markup.** Write every headline, line and button label first. Headlines at most two lines at every width. No invented proof: no fake quotes, logos, user counts or stats. Mark sample content clearly.
7. **Pictures.** Order of preference: the client's own, then real product screenshots or renders, then open collections (`scripts/assets.mjs`), then drawn in code. Keep credits (`assets.mjs credits` prints the footer HTML).
8. **Build static first.** Tokens from the sheet (`direction.json` → `css`, `fontsLink`), hero, sections, pictures, the live thing. No motion yet.
9. **Check.** `node scripts/check.mjs <folder|url>`. Fix every FAIL. Keep a WARN only if you can defend it in one sentence (and add it to `--allow`).
10. **Look.** Open the contact sheets (`.art-direction/check/sheet-*.jpg`) and score the page with `references/critique.md`. Fix the three biggest problems, check again. At most three rounds.
11. **Motion layer.** Use the motion skill's web kit (`.claude/skills/motion/references/web-kit.md`): the dealt signature move, entrances, feedback on every control. Re-run `check.mjs`: motion must not cover text, and reduced motion must stay still.
12. **Report.** The seed and redraws, the idea sentence, the live thing, check results, critique scores, credits, and every piece of sample content the client must replace.

## Scripts
| Script | What it does |
|---|---|
| `scripts/deal.mjs` | Seeded, history-aware deal from `library/` (14 directions, 18 palettes, 15 type pairings, 20 motion moves mapped to the web kit). It prints the CSS tokens and a Google Fonts link, and checks the palette's contrast. Writes `.art-direction/` in the project folder only. |
| `scripts/assets.mjs` | Keyless search across Openverse, Wikimedia Commons, The Met (v1.1 API), Art Institute of Chicago and NASA. It has a licence filter (`cc0`, `safe` = CC0 + BY + BY-SA, `any`), reads the real image size from the first bytes, and drops dead links. `get` downloads the files and writes `credits.json`. The Art Institute's image server can refuse automated downloads; open its page instead. NASA images: no endorsement implied and no NASA logos. |
| `scripts/check.mjs` | Real Chromium at 1440, 768 and 390. It scrolls one screen at a time, records which elements move, and runs a reduced-motion pass. It measures headline lines, fonts actually loaded, WCAG contrast, covered text (two normal-flow layers colliding; sticky headers, pinned stages and curtain footers are excluded), empty screens, pictures, broken images, overflow, tiny text, measure, typefaces and sizes, still pages, slop words, filler and generic buttons. Writes `report.json` and contact sheets. Exit code 1 on FAIL. |

**Profiles:** `--profile default` is what any good site should pass. `--profile strict` raises the bar for award-level work: headlines at most 2 lines, no empty screens, 4+ pictures, 8+ moving elements, no slop words and no generic buttons. Rules are measurements, not taste police. A dark-room site may defend its empty screens, and a printout site its monospace.

## Taste rules
These hold regardless of direction. The full list with reasons is in `references/tells.md`.
- **One idea, one signature move, one bouncy element.** Everything else serves them.
- **Type:** at most two families plus an optional mono for real data, and about five sizes. Body text at least 16px in full ink. Lines of 45–80 characters.
- **Colour:** take it from the sheet. One accent, used for one thing per screen. Check contrast on every surface, including dark chapters.
- **Pictures:** real and specific beat pretty and generic. No stock "team high-five", no laptop on a desk, no glowing brain for AI.
- **Words:** say what the product does in the visitor's words. Button labels name the action ("Run the office", "Get your link"), not "Get started". No unlock, seamless, elevate or supercharge.
- **Proof:** only real numbers, real quotes and real logos, or nothing.
- **Phones:** a design that only works at 1440 is unfinished. The check runs 390 for a reason.

## References
- `references/critique.md`: the scoring sheet (four weighted areas, caps that stop inflated scores) and the passes to run on the contact sheets.
- `references/tells.md`: the patterns that make a page read as machine-made, why, and what to do instead.
- Motion: `.claude/skills/motion/SKILL.md` and `references/web-kit.md`. Award measurements: `.claude/skills/motion/references/award-sites.md`.

Credit: the process (dealt directions, inventory, idea sentence and competitor test, measured browser checks, contact-sheet critique) was learned from TasteSkill v2 by Leon Lin (MIT, github.com/Leonxlnx/taste-skill). It was analysed statically with REA, nothing was executed, and it was rewritten here with our own library, rules and code.
