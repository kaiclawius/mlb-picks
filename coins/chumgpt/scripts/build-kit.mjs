// Writes the open-character kit from the canon in api/_canon.js and the face in kit/face.js:
//   CHARACTER.md, kit/canon.json, kit/chumgpt.svg, kit/chumgpt-<mood>.svg, kit/chumgpt/SKILL.md, kit/chumgpt-skill.zip
// Run after changing the canon:  node scripts/build-kit.mjs   (needs python3 for the zip)
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { CANON, canonMarkdown, loreMarkdown } from "../api/_canon.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = (p, s) => { fs.mkdirSync(path.dirname(path.join(root, p)), { recursive: true }); fs.writeFileSync(path.join(root, p), s); };

new Function(fs.readFileSync(path.join(root, "kit/face.js"), "utf8"))();
const face = globalThis.chumFace;
out("kit/chumgpt.svg", face("smug") + "\n");
for (const m of face.moods) out(`kit/chumgpt-${m}.svg`, face(m) + "\n");
out("kit/canon.json", JSON.stringify(CANON, null, 2) + "\n");

const tools = `## Tools
- MCP server (read-only, no key): \`https://<the ChumGPT site>/api/mcp\`
  Claude Code: \`claude mcp add --transport http chumgpt https://<the ChumGPT site>/api/mcp\`
  Tools: chumgpt_canon, chumgpt_lore, chumgpt_moods, chumgpt_image_prompt, chumgpt_check_post
- His face in every mood: \`kit/chumgpt-<mood>.svg\``;

out("CHARACTER.md", `${canonMarkdown()}\n\n# Lore\n\n${loreMarkdown()}\n\n${tools}\n`);

out("kit/chumgpt/SKILL.md", `---
name: chumgpt
description: Write, draw or animate ChumGPT, the tiny evil AI in a CRT monitor (the CHUM·TRONIX 3000) that Plankton built to steal the Krabby Patty formula. Use when asked to make posts, stories, images, videos or games with ChumGPT or for the $CHUMGPT Chum Army.
---

# ChumGPT

ChumGPT is an open character: anyone may use him, commercial or not. Before you write or draw him, read the canon below and keep the never-list.

${canonMarkdown().replace(/^# .*\n/, "")}

# Lore

${loreMarkdown()}

# How to write him
- Pick one mood first, then write 1 to 4 sentences in that mood.
- End plans with a flaw he doesn't notice. Let him blame someone else.
- Posts stay under 260 characters, with no links, no hashtags, no addresses.

# How to draw him
Draw him as his own design, the CHUM·TRONIX 3000, never as a character from the show:
${CANON.look.map((l) => `- ${l}`).join("\n")}

${tools}
`);

const zip = path.join(root, "kit/chumgpt-skill.zip");
fs.rmSync(zip, { force: true });
execFileSync("python3", ["-I", "-m", "zipfile", "-c", zip, "chumgpt/"], { cwd: path.join(root, "kit") });
console.log("kit written");
