// MoveFast-owned: writes catalog.json (id, layer, duration, textLimits) so Python can check text before rendering.
// Component declarations live in .tsx (not importable by node); their limits live in the plain *-contract.ts / *-state.ts files.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), src = path.join(root, 'src');
const values = {};
for (const f of fs.readdirSync(src).filter((f) => /-(contract|state)\.ts$/.test(f) || f === 'contract.ts')) {
  try { Object.assign(values, await import(pathToFileURL(path.join(src, f)))); } catch { /* a module that needs the browser */ }
}
const out = {};
for (const f of fs.readdirSync(src).filter((f) => f.endsWith('.tsx'))) {
  const text = fs.readFileSync(path.join(src, f), 'utf8');
  // Durations declared inside the .tsx itself (grid flash).
  for (const d of text.matchAll(/export const (\w+Duration) = \{minSeconds: ([\d./ ]+), maxSeconds: ([\d./ ]+)\}/g))
    values[d[1]] ??= {minSeconds: Function(`return ${d[2]}`)(), maxSeconds: Function(`return ${d[3]}`)()};
  for (const m of text.matchAll(/=\s*\{\s*id:\s*'([^']+)',\s*layer:\s*'([^']+)',\s*duration:\s*(\w+),\s*textLimits:\s*(\w+|\{[^}]*\})/g))
    out[m[1]] = {file: f, layer: m[2], duration: values[m[3]] ?? null, textLimits: m[4] === '{}' ? {} : values[m[4]] ?? values[m[1].replace(/-(\w)/g, (_, c) => c.toUpperCase()) + 'TextLimits'] ?? null};
}
fs.writeFileSync(path.join(root, 'catalog.json'), JSON.stringify(out, null, 1));
console.log(Object.keys(out).length, 'edits;', Object.values(out).filter((v) => !v.duration).map((v) => v.file).join(' ') || 'all with durations');
