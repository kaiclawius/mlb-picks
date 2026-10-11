// Builds a single HTML file from the page (fonts, CSS and scripts embedded).
// Usage: node build-single.mjs output.html [--fragment]
//   no flag: full document, ready to upload to any web host
//   --fragment: content only, without <html>/<head>, for environments that bring their own shell
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const read = (f) => readFileSync(root + f, 'utf8');
const [out, flag] = process.argv.slice(2);
if (!out) { console.error('Usage: node build-single.mjs output.html [--fragment]'); process.exit(1); }

const fonts = read('fonts.css').replace(/url\((fonts\/[^)]+)\)/g, (_, p) => `url(data:font/woff2;base64,${readFileSync(root + p).toString('base64')})`);
const html = read('index.html');
const title = /<title>(.*?)<\/title>/.exec(html)[1];
let body = /<body>([\s\S]*?)<script src="config.js">/.exec(html)[1];
const scripts = `<script>${read('config.js')}</script>\n<script>${read('main.js')}</script>`;

if (flag === '--fragment') {
  body = body.replace(/href="(legal|privacy)\.html"/g, 'href="#"');
  writeFileSync(out, `<title>${title}</title>\n<style>${fonts}\n${read('style.css')}</style>\n${body}${scripts}\n`);
} else {
  const head = /<head>([\s\S]*?)<link rel="icon"/.exec(html)[1];
  writeFileSync(out, `<!doctype html>\n<html lang="de">\n<head>${head}<link rel="icon" href="data:image/svg+xml;base64,${readFileSync(root + 'favicon.svg').toString('base64')}" type="image/svg+xml">\n<style>${fonts}\n${read('style.css')}</style>\n</head>\n<body>${body}${scripts}\n</body>\n</html>\n`);
}
console.log(`${out} written (${(readFileSync(out).length / 1024).toFixed(0)} KB)`);
