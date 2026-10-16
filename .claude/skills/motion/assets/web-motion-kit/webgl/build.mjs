// One minified ES module with only the parts of three.js the scenes use. Run after changing src/: npm run build
import { build } from "esbuild";
import { statSync, readdirSync, rmSync } from "node:fs";
rmSync("dist", { recursive: true, force: true });
await build({
  entryPoints: { "motion-webgl": "src/index.js" }, bundle: true, splitting: true, format: "esm", minify: true, target: "es2020", outdir: "dist", chunkNames: "chunks/[name]-[hash]",
  legalComments: "eof", banner: { js: "// motion kit WebGL layer · three.js r186 (MIT, © three.js authors) · built from src/ with build.mjs" },
  alias: { "three/addons": "three/examples/jsm" },
});
for (const f of ["motion-webgl.js", ...readdirSync("dist/chunks").map((c) => "chunks/" + c)]) console.log(`dist/${f} ${(statSync("dist/" + f).size / 1024).toFixed(1)} KB`);
