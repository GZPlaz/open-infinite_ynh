/**
 * Print the README topic list (subject → category → topics) from the
 * registry: `npx vite-node build/topic-table.ts`.
 */
import { categoriesFor, TOPICS } from '../src/engine/topics';
import { SUBJECTS } from '../src/engine/types';

const lines: string[] = [];
for (const s of SUBJECTS) {
  const groups = categoriesFor(s.id);
  if (!groups.length) continue;
  const n = groups.reduce((k, g) => k + g.topics.length, 0);
  lines.push(`<details><summary><b>${s.title}</b> — ${n} topics</summary>`, '');
  for (const g of groups) lines.push(`- **${g.category}:** ${g.topics.map((t) => t.title).join(' · ')}`);
  lines.push('', '</details>', '');
}
lines.push(`<!-- ${TOPICS.length} topics in total -->`);
console.log(lines.join('\n'));
