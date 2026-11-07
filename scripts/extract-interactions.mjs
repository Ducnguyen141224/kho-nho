import { readFile, writeFile } from 'node:fs/promises';

const source = await readFile(new URL('../evidence/javascript/webflow.js', import.meta.url), 'utf8');
const marker = [...source.matchAll(/\.require\(['"]ix2['"]\)\.init\(\s*(?=\{)/g)].at(-1);
if (!marker) throw new Error('The captured bundle has no IX2 initialization');
const interactions = JSON.parse(source.slice(marker.index + marker[0].length).trim().replace(/\);\s*$/, ''));
await writeFile(new URL('../evidence/interactions.json', import.meta.url), JSON.stringify(interactions, null, 2));
console.log(JSON.stringify({
  events: Object.keys(interactions.events).length,
  actionLists: Object.entries(interactions.actionLists).map(([id, value]) => ({ id, title: value.title })),
}, null, 2));
