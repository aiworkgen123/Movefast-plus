// MoveFast-owned: runs each edit's own repair() on props built in Python. stdin [{id, props}] -> stdout [repaired | null].
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), src = path.join(root, 'src');
const repairs = {};
for (const f of fs.readdirSync(src).filter((f) => f.endsWith('.tsx'))) {
  const text = fs.readFileSync(path.join(src, f), 'utf8');
  for (const m of text.matchAll(/id:\s*'([^']+)'(?:\{\}|[^}])*?repair:\s*(\w+)/gs)) repairs[m[1]] = m[2];
}
const values = {};
for (const f of fs.readdirSync(src).filter((f) => /-contract\.ts$/.test(f))) {
  try { Object.assign(values, await import(pathToFileURL(path.join(src, f)))); } catch { /* browser-only module */ }
}
const items = JSON.parse(fs.readFileSync(0, 'utf8'));
process.stdout.write(JSON.stringify(items.map(({id, props}) => {
  const fn = values[repairs[id]];
  return typeof fn === 'function' ? fn(props) ?? null : null;
})));
