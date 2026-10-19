/**
 * Developer helper (skipped by default): print sample problems to eyeball them.
 *   SAMPLE=3 SAMPLE_TOPIC=quadratic npx vitest run tests/sample.test.ts --silent=false
 */
import { it } from 'vitest';
import { Rng } from '../src/engine/rng';
import { TOPICS } from '../src/engine/topics';
import { resolveOptions } from '../src/engine/generator';
import { DIFFICULTIES } from '../src/engine/types';

const only = process.env.SAMPLE_TOPIC;
it.skipIf(!process.env.SAMPLE)('print samples', () => {
  for (const t of TOPICS.filter((t) => !only || t.id.includes(only))) {
    console.log(`\n===== ${t.id}`);
    for (const d of DIFFICULTIES) {
      for (let s = 0; s < Number(process.env.SAMPLE); s++) {
        const p = t.generate({ rng: new Rng(s * 7919 + 13), difficulty: d, options: resolveOptions(t.options, JSON.parse(process.env.SAMPLE_OPTS ?? '{}')) });
        console.log(`[${d}] Q: ${p.question}\n      A: ${p.answer}\n      D: ${(p.distractors ?? []).join(' | ')}\n      S: ${(p.steps ?? []).join('\n         ')}`);
      }
    }
  }
});
