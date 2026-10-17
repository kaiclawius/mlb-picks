# Evals

## 1. Elbbohne (coffee roastery, Hamburg) — October 2026
Brief: a two-person roastery in a former boat-repair workshop, a 1962 Probat named Erna, 6 single origins, a Saturday cupping for 8. The goals are cupping bookings and webshop orders.
Two agents got the same brief: one with this skill, one without any skill. Both pages were checked with `check.mjs`.

| | Without skill | With skill |
|---|---|---|
| `check.mjs` default | 6 FAIL, 7 WARN | 0 FAIL, 0 WARN |
| `check.mjs` strict | 12 FAIL, 8 WARN | 0 FAIL, 0 WARN |
| Real pictures | 0 (an illustration and placeholders) | real, licensed (Commons) with credits |
| Idea | generic: cream and copper, an accent word in the headline, tagged product cards | "the workshop becomes the page": a walk from door to drum to shelf to table to back gate |
| Live thing | a seat picker and a bag | 8 chairs at the Saturday table, plus a bag with the real cutoff and roast date |
| Sample content | invented, not marked | marked "Sample" on the page |
| Self-critique | — | 7.8 (Idea 8, Craft 8, Content 7, Motion 8); held back by stand-in photos |

What we learned:
- The dealt direction, the inventory and the competitor test produced a specific idea. Without them the agent chose the category default.
- The skill page reads calmer and plainer than the colourful baseline. Specific is not the same as striking. The critique pass has to push on visual punch (scale, contrast, one bold move), not only on correctness.
- An agent can optimise for the check. The contact-sheet critique is required, not optional.
- The check found the baseline's real issues: a 4-line headline, text covered by a sticky element, motion ignoring reduced motion.
- Fixed in the tools: `check.mjs --help` (an early run took `--help` as the folder), and results now go next to the checked folder.
