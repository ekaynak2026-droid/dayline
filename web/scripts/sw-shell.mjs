// Runs after "next build": writes the list of app files into out/sw.js so the app works offline.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const out = 'out';
const files = [];
const walk = (d) => readdirSync(d).forEach((f) => {
  const p = join(d, f);
  if (statSync(p).isDirectory()) return walk(p);
  const r = relative(out, p).split('\\').join('/');
  // The big viewer libraries are saved when first used; source maps and Next's data files are not needed.
  if (r === 'sw.js' || r.startsWith('vendor/') || r.endsWith('.map') || r.endsWith('.txt') || r.startsWith('404') || r.startsWith('_not-found')) return;
  files.push(r);
});
walk(out);
const sw = join(out, 'sw.js');
const build = Date.now().toString(36);
writeFileSync(sw, readFileSync(sw, 'utf8').replace('/*SHELL*/', files.map((f) => `'${f}'`).join(', ')).replace('__BUILD__', build));
console.log(`sw.js: ${files.length} files, cache dayline-next-${build}`);
