import { readFileSync } from 'node:fs';
const data = JSON.parse(readFileSync(new URL('../public/data/bandra.json', import.meta.url), 'utf8'));
if (!data.nodes.length || !data.edges.length || !data.places.length) throw new Error('Snapshot is empty.');
for (const edge of data.edges) {
  if (!data.nodes[edge.a] || !data.nodes[edge.b] || edge.length <= 0) throw new Error('Invalid graph edge.');
}
for (const p of data.places) if(p.accessVerified) throw new Error('This snapshot contains no field-verified entrances.');
console.log(JSON.stringify({ area: data.area, fetchedAt: data.fetchedAt, ...data.audit }, null, 2));
