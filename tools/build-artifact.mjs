// Packs the whole game into one self-contained HTML fragment (dist/powderline.html) that can be
// published as a single page. The game itself needs no build; this is only for sharing.
//   node tools/build-artifact.mjs      (uses esbuild through npx)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const js = execFileSync('npx', ['--yes', 'esbuild', 'src/main.js', '--bundle', '--minify', '--format=iife', '--target=es2020',
  '--alias:three/addons=./vendor/three/addons', '--alias:three=./vendor/three/build/three.module.js'], { maxBuffer: 1 << 28 }).toString();
const css = readFileSync('src/style.css', 'utf8');
const html = readFileSync('index.html', 'utf8');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script type="module"'));
mkdirSync('dist', { recursive: true });
writeFileSync('dist/powderline.html', `<title>Powderline</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<style>:root { color-scheme: dark; }\n${css}</style>
${body}<script>${js.replace(/<\/script/g, '<\\/script')}</script>
`);
console.log(`dist/powderline.html  ${(js.length / 1024 | 0)} KB of script`);
