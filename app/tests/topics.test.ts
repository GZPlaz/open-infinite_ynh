/**
 * Fuzz every topic: all difficulties × option variations × many seeds.
 * Checks structure, KaTeX validity, formatting hygiene, distractors and —
 * through tests/verify.ts — the mathematical correctness of every answer.
 */
import katex from 'katex';
import { describe, expect, it } from 'vitest';
import { resolveOptions } from '../src/engine/generator';
import { Rng } from '../src/engine/rng';
import { DIFFICULTIES, type OptionValues, type TopicGenerator } from '../src/engine/types';
import { mathSegments } from './evaluator';
import { registerVerifiers, verify, type Verifier } from './verify';

const SEEDS = Number(process.env.FUZZ_SEEDS ?? 120);
/** PACK=<name> fuzzes one pack (src/engine/topics/packs/<name>.ts); TOPIC=<id prefix> narrows further. */
const PACK = process.env.PACK;
const ONLY = process.env.TOPIC;

const packs = import.meta.glob<{ default: TopicGenerator[] }>('../src/engine/topics/packs/*.ts');
const verifierModules = import.meta.glob<{ VERIFIERS: Record<string, Verifier> }>('./verifiers/*.ts');
for (const [path, load] of Object.entries(verifierModules)) {
  if (!PACK || path.endsWith(`/${PACK}.ts`)) registerVerifiers((await load()).VERIFIERS);
}
let TOPICS: readonly TopicGenerator[];
if (PACK) {
  const load = packs[`../src/engine/topics/packs/${PACK}.ts`];
  if (!load) throw new Error(`no pack ${PACK}`);
  TOPICS = (await load()).default;
} else TOPICS = (await import('../src/engine/topics')).TOPICS;
if (ONLY) TOPICS = TOPICS.filter((t) => t.id.startsWith(ONLY));

/** Defaults, plus each option flipped / each choice selected one at a time. */
function optionVariants(t: TopicGenerator): OptionValues[] {
  const base = resolveOptions(t.options, {});
  const out: OptionValues[] = [base];
  for (const o of t.options) {
    if (o.type === 'boolean') out.push({ ...base, [o.id]: !o.default });
    else for (const c of o.choices) if (c.value !== o.default) out.push({ ...base, [o.id]: c.value });
  }
  // everything "on" at once
  const allOn: OptionValues = { ...base };
  for (const o of t.options) if (o.type === 'boolean') allOn[o.id] = true;
  out.push(allOn);
  return out;
}

const SMELLS: Array<[RegExp, string]> = [
  [/\+\s*-/, '"+ -"'],
  [/-\s*-(?!\\infty)/, '"- -"'],
  [/(?<![\d.{^_])1(?=[a-z(]|\\sqrt)/i, 'coefficient 1'],
  [/[a-zA-Z)]\^\{1\}/, 'exponent 1'],
  [/(?<![\d.])0[a-z]/, 'zero coefficient'],
  [/\$\$/, 'empty math'],
  [/\\(cdot|times|div)\s*-/, 'operator followed by a bare negative'],
  [/undefined|NaN|Infinity|null/, 'leaked JS value'],
];

function checkTex(tex: string, where: string): void {
  expect(() => katex.renderToString(tex, { throwOnError: true }), `${where}: ${tex}`).not.toThrow();
  for (const [re, what] of SMELLS) expect(re.test(tex), `${what} in ${where}: ${tex}`).toBe(false);
}

function checkRich(rich: string, where: string): void {
  expect(typeof rich).toBe('string');
  expect(rich.trim().length, `${where} empty`).toBeGreaterThan(0);
  const dollars = (rich.match(/(?<!\\)\$/g) ?? []).length;
  expect(dollars % 2, `${where} unbalanced $: ${rich}`).toBe(0);
  mathSegments(rich).forEach((s) => checkTex(s, where));
  const textOnly = rich.replace(/(?<!\\)\$[^$]*\$/g, '');
  expect(/undefined|NaN|null|\[object/.test(textOnly), `${where} leaked value: ${rich}`).toBe(false);
}

describe.each(TOPICS.map((t) => [t.id, t] as const))('%s', (_id, topic) => {
  it('has sane metadata', () => {
    expect(topic.title.length).toBeGreaterThan(3);
    expect(topic.category?.length, 'category').toBeGreaterThan(2);
    expect(topic.defaultCount).toBeGreaterThan(0);
  });

  for (const difficulty of DIFFICULTIES) {
    it(`generates verified problems (${difficulty})`, () => {
      for (const options of optionVariants(topic)) {
        const seen = new Set<string>();
        for (let s = 0; s < SEEDS; s++) {
          const seed = s * 2654435761;
          const p = topic.generate({ rng: new Rng(seed), difficulty, options });
          const ctx = `${topic.id} ${difficulty} ${JSON.stringify(options)} seed=${seed}`;
          checkRich(p.question, `question (${ctx})`);
          checkRich(p.answer, `answer (${ctx})`);
          p.steps?.forEach((st, i) => checkRich(st, `step ${i} (${ctx})`));
          if (topic.multipleChoice) {
            expect(p.distractors?.length, `distractors (${ctx})`).toBeGreaterThanOrEqual(3);
            const norm = (x: string) => x.replace(/\s+/g, '');
            const all = [p.answer, ...p.distractors!.slice(0, 3)].map(norm);
            expect(new Set(all).size, `distinct choices (${ctx}): ${all.join(' | ')}`).toBe(4);
            p.distractors!.forEach((d, i) => checkRich(d, `distractor ${i} (${ctx})`));
          }
          try {
            verify(p);
          } catch (e) {
            throw new Error(`${ctx}\nQ: ${p.question}\nA: ${p.answer}\n${(e as Error).message}`);
          }
          seen.add(`${p.question}|${p.answer}`);
        }
        // a topic should not collapse to a handful of problems
        expect(seen.size, `variety for ${JSON.stringify(options)}`).toBeGreaterThan(Math.min(SEEDS / 4, 20));
      }
    });
  }
});
