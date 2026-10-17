# Critique: look at the contact sheets, then score

Do this after `check.mjs` passes, with the sheets open (`.art-direction/check/sheet-1440.jpg`, `-768`, `-390`). Judge what you see, not what you meant to build. Write the scores down; they go into the report.

## Passes (one question each, answer in a line)
1. **First screen, 3 seconds.** Can a stranger say what this is and who it's for? Is the idea visible without scrolling?
2. **The idea.** Is the idea sentence visible on the page, or only in your notes?
3. **Competitor swap.** Cover the logo. Could this be the nearest competitor's site? If yes, what is generic?
4. **Hierarchy.** On each screen, is there exactly one thing the eye lands on first?
5. **Rhythm.** Do screens vary in density and scale, or is it the same block repeated? Count the near-identical screens.
6. **Type.** How many families and sizes can you see? Any widows, stacked one-word lines, or headlines over two lines?
7. **Colour.** Is the accent used for one thing per screen? Any muddy greys on colour?
8. **Pictures.** Are they specific to this client? Same light, same treatment? Any stock clichés?
9. **The live thing.** Is it findable, does it work, does it use real content?
10. **Copy.** Read every headline aloud. Any slop words or vague claims? Every button names an action?
11. **Proof.** Is every number, quote or logo real? Is sample content marked?
12. **Phone.** Look at the 390 sheet alone. Does it hold up as its own design, or as a squeezed desktop?
13. **Motion (after the motion layer).** One signature move? Does anything move just to move? Is reduced motion still?
14. **Ending.** Does the last screen land, with one action and the name, or does the page just stop?

## Score (0–10 each, weighted)
| Area | Weight | 10 means |
|---|---|---|
| Idea | 40% | A specific idea you can state in a sentence. It fails the competitor swap and shows on the first screen. |
| Craft | 30% | Type, colour, spacing and pictures are consistent and deliberate at all three widths. No FAIL or unexplained WARN. |
| Content | 20% | Real, specific copy and proof, an action in every button, nothing invented. |
| Motion and life | 10% | One signature move, a working live thing, feedback on every control, reduced motion respected. |

**Caps.** They stop a polished but empty page from scoring high:
- If the competitor swap works, Idea is at most 4.
- Any FAIL left in `check.mjs` means Craft is at most 5.
- Any invented proof means Content is at most 3.
- No live thing means Motion and life is at most 5.
- If the 390 sheet looks broken, the total is at most 6.

**Bar:** 8.0 total or more before you call it done. Below that, fix the three biggest problems named in the passes, check again, look again. Stop after three rounds and report what's left.
