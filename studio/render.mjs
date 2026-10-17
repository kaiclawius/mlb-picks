// Renders a product's videos and preview image into out/<id>/.
//   npm run render -- payroll                 all formats + og image
//   npm run render -- payroll landscape       one format
//   npm run render -- payroll stills          one frame every 3 s (quick visual check)
//   npm run render -- payroll web             small copies for a website + poster.jpg (after rendering)
//   npm run render -- payroll film            the kinetic film in all three formats
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const [id, what] = process.argv.slice(2);
if (!id) { console.error("usage: npm run render -- <product> [landscape|portrait|square|og|stills|web]"); process.exit(1); }
mkdirSync(`out/${id}`, { recursive: true });
const run = (...a) => execFileSync("npx", ["remotion", ...a, "--log=error"], { stdio: "inherit" });

if (what === "stills") {
  const fmt = process.argv[4] || "landscape";
  const frames = process.argv[5] ? process.argv[5].split(",").map(Number) : null;
  for (const f of frames || Array.from({ length: 20 }, (_, i) => i * 90)) {
    try { run("still", `${id}-${fmt}`, `out/${id}/still-${fmt}-${String(f).padStart(4, "0")}.png`, `--frame=${f}`); } catch { break; }
  }
} else if (what === "web") {
  // master files are for uploads (X, YouTube, TikTok); the web copies are light enough to self-host
  mkdirSync(`out/${id}/web`, { recursive: true });
  const ff = (...a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...a], { stdio: "inherit" });
  for (const fmt of ["landscape", "portrait", "square"]) {
    ff("-i", `out/${id}/${id}-${fmt}.mp4`, "-c:v", "libx264", "-preset", "slow", "-crf", "27", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", `out/${id}/web/${id}-${fmt}.mp4`);
  }
  ff("-ss", "2.5", "-i", `out/${id}/${id}-landscape.mp4`, "-frames:v", "1", "-q:v", "3", `out/${id}/web/poster.jpg`);
  ff("-i", `out/${id}/og.png`, `out/${id}/web/og.png`);
  console.log(`✓ out/${id}/web/`);
} else if (what === "film") {
  // the kinetic film: products/<id>.ts → film (see README, "Kinetischer Film")
  for (const fmt of ["landscape", "portrait", "square"]) run("render", `${id}-film-${fmt}`, `out/${id}/${id}-film-${fmt}.mp4`);
} else {
  for (const fmt of what ? [what] : ["landscape", "portrait", "square", "og"]) {
    if (fmt === "og") run("still", `${id}-og`, `out/${id}/og.png`, "--frame=75");
    else run("render", `${id}-${fmt}`, `out/${id}/${id}-${fmt}.mp4`);
  }
}
