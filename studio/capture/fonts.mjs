// Downloads a brand's Google Fonts once into public/<product>/fonts/, so renders never depend on the network.
//   node capture/fonts.mjs payroll "Archivo:wdth,wght@62..125,400..900&family=IBM+Plex+Sans:wght@400;600"
// Then set brand.fontCss = "<product>/fonts/fonts.css" in the product file.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const [id, query] = process.argv.slice(2);
if (!id || !query) { console.error('usage: node capture/fonts.mjs <product> "<css2 query>"'); process.exit(1); }
const dir = `public/${id}/fonts`;
mkdirSync(dir, { recursive: true });
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"; // asks for woff2
const curl = (url, out) => execFileSync("curl", ["-sSfL", "-A", UA, url, ...(out ? ["-o", out] : [])], { encoding: out ? undefined : "utf8" });
let css = curl(`https://fonts.googleapis.com/css2?family=${query}&display=block`);
// keep latin and latin-ext only: the blocks are commented with their subset
css = css.split(/(?=\/\* )/).filter((b) => /^\/\* latin(-ext)? \*\//.test(b)).join("");
let n = 0;
css = css.replace(/url\((https:[^)]+)\)/g, (_, url) => {
  const name = `f${String(++n).padStart(2, "0")}.woff2`;
  curl(url, `${dir}/${name}`);
  return `url(${name})`;
});
writeFileSync(`${dir}/fonts.css`, css);
console.log(`✓ ${n} font files -> ${dir}/fonts.css`);
