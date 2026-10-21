/** Sigma notation: evaluating sums with summation formulas, writing series in sigma notation. */
import { attempt, boolOpt, defineTopic, distinctDistractors, offset, strOpt } from '../../generator';
import { Poly } from '../../polynomial';
import type { Rng } from '../../rng';
import { m, num, sum } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';

const S1 = (n: number) => (n * (n + 1)) / 2;
const S2 = (n: number) => (n * (n + 1) * (2 * n + 1)) / 6;
const S3 = (n: number) => S1(n) ** 2;
const sigma = (v: string, lo: number, hi: number, body: string) => `\\displaystyle\\sum_{${v}=${lo}}^{${hi}} ${body}`;

function bodyTex(p: Poly, v: string): string {
  const t = p.toTex(v);
  return p.c.filter((c) => !c.isZero()).length > 1 ? `(${t})` : t;
}

function evaluateTask(rng: Rng, d: Difficulty, v: string): ProblemContent {
  const { p, lo, hi } = attempt('sigma-eval', () => {
    const deg = d === 'easy' ? 1 : d === 'medium' ? rng.pick([1, 2, 2]) : rng.pick([2, 3]);
    const coeffs = [rng.int(-9, 9), rng.signedInt(1, 6, true)];
    if (deg >= 2) coeffs.push(rng.signedInt(1, 4, true));
    if (deg === 3) {
      coeffs[1] = rng.int(-3, 3);
      coeffs[2] = rng.int(-3, 3);
      coeffs.push(rng.signedInt(1, 2, true));
    }
    const p = new Poly(coeffs);
    const lo = d === 'hard' ? rng.int(2, 6) : 1;
    const hi = deg === 3 ? rng.int(lo + 5, 12) : rng.int(lo + 6, d === 'easy' ? 20 : 25);
    return p.degree === deg ? { p, lo, hi } : null;
  });
  const S = (n: number) => p.coef(0).value * n + p.coef(1).value * S1(n) + p.coef(2).value * S2(n) + p.coef(3).value * S3(n);
  const total = S(hi) - S(lo - 1);
  const steps: string[] = [];
  const formula = (n: number) =>
    sum([
      ...[3, 2, 1].filter((i) => !p.coef(i).isZero()).map((i) => ({ coef: p.coef(i), sym: `(${[n, S1(n), S2(n), S3(n)][i]})` })),
      { coef: p.coef(0).mul(n) },
    ]);
  steps.push(`Use ${m(`\\sum 1 = n`)}, ${m('\\sum k = \\frac{n(n + 1)}{2}')}, ${m('\\sum k^{2} = \\frac{n(n + 1)(2n + 1)}{6}')}${p.degree === 3 ? `, ${m('\\sum k^{3} = \\left(\\frac{n(n + 1)}{2}\\right)^{2}')}` : ''}.`);
  if (lo === 1) steps.push(m(`${formula(hi)} = ${total}`));
  else {
    steps.push(`Sum from ${m(`${v} = 1`)} to ${hi} minus the sum from ${m(`${v} = 1`)} to ${lo - 1}.`);
    steps.push(m(`${S(hi)} - ${S(lo - 1) < 0 ? `(${S(lo - 1)})` : S(lo - 1)} = ${total}`));
  }
  const answer = m(num(total));
  const wrongs = [S(hi - 1) - S(lo - 1), S(hi) - S(lo), lo === 1 ? S(hi) - p.coef(0).value * (hi - 1) : S(hi), S(hi + 1) - S(lo - 1)].map((x) => m(num(x)));
  return {
    question: m(sigma(v, lo, hi, bodyTex(p, v))),
    answer,
    steps,
    distractors: distinctDistractors(answer, wrongs, (k) => m(num(total + offset(k) * (hi - lo + 1)))),
    check: { kind: 'precalculus.sigma', task: 'evaluate' },
  };
}

interface Series {
  terms: (k: number) => number;
  body: string;
  lo: number;
  hi: number;
  wrongBodies: string[];
}

function writeTask(rng: Rng, d: Difficulty, v: string): ProblemContent {
  const kind = rng.pick(d === 'easy' ? ['arith', 'arith', 'power'] : d === 'medium' ? ['arith', 'geom', 'power'] : ['geom', 'alt', 'power', 'arith']);
  const s: Series = attempt('sigma-write', (): Series | null => {
    if (kind === 'arith') {
      const dd = rng.signedInt(2, 7, true);
      const a1 = rng.int(-9, 12);
      const N = rng.int(8, 20);
      const p = new Poly([a1 - dd, dd]);
      return { terms: (k) => a1 + (k - 1) * dd, body: bodyTex(p, v), lo: 1, hi: N, wrongBodies: [bodyTex(new Poly([a1, dd]), v), bodyTex(new Poly([dd, a1]), v)] };
    }
    if (kind === 'power') {
      const e = rng.pick([2, 2, 3]);
      const lo = rng.int(1, 3);
      const hi = rng.int(lo + 5, e === 2 ? 15 : 9);
      return { terms: (k) => k ** e, body: `${v}^{${e}}`, lo, hi, wrongBodies: [`${e}${v}`, `${v}^{${e + 1}}`] };
    }
    if (kind === 'geom') {
      const r = rng.pick([2, 3, -2]);
      const a = rng.int(1, 5);
      const N = rng.int(5, r === 3 ? 6 : 8);
      const base = r < 0 ? `(${r})` : String(r);
      const body = a === 1 ? `${base}^{${v} - 1}` : `${a} \\cdot ${base}^{${v} - 1}`;
      return { terms: (k) => a * r ** (k - 1), body, lo: 1, hi: N, wrongBodies: [a === 1 ? `${base}^{${v}}` : `${a} \\cdot ${base}^{${v}}`, `${a * r} \\cdot ${base}^{${v} - 1}`] };
    }
    const c = rng.int(1, 4);
    const N = rng.int(6, 12);
    const body = c === 1 ? `(-1)^{${v}}${v}` : `(-1)^{${v}}(${c}${v})`;
    return { terms: (k) => (-1) ** k * c * k, body, lo: 1, hi: N, wrongBodies: [c === 1 ? `(-1)^{${v} + 1}${v}` : `(-1)^{${v} + 1}(${c}${v})`, c === 1 ? v : `${c}${v}`] };
  });
  const shown = [s.lo, s.lo + 1, s.lo + 2].map(s.terms);
  const last = s.terms(s.hi);
  const signed = (x: number, first: boolean) => (first ? String(x) : x < 0 ? `- ${-x}` : `+ ${x}`);
  const list = `${shown.map((x, i) => signed(x, i === 0)).join(' ')} + \\cdots ${signed(last, false)}`;
  const answer = m(sigma(v, s.lo, s.hi, s.body));
  const steps = [`The terms follow ${m(`a_{${v}} = ${s.body.replace(/^\(|\)$/g, '')}`)}.`, `The first term has ${m(`${v} = ${s.lo}`)} and the last term ${m(`${last}`)} has ${m(`${v} = ${s.hi}`)}.`, answer];
  const wrongs = [sigma(v, s.lo, s.hi + 1, s.body), sigma(v, s.lo, s.hi - 1, s.body), ...s.wrongBodies.map((b) => sigma(v, s.lo, s.hi, b)), sigma(v, 0, s.hi, s.body)].map(m);
  return {
    question: `Write ${m(list)} in sigma notation.`,
    answer,
    steps,
    distractors: distinctDistractors(answer, wrongs, (k) => m(sigma(v, s.lo, s.hi + k + 1, s.body))),
    check: { kind: 'precalculus.sigma', task: 'write' },
  };
}

export const sigmaNotation = defineTopic({
  id: 'precalc.series.sigma',
  subject: 'precalculus',
  category: 'Sequences and Series',
  title: 'Sigma Notation and Summation Formulas',
  description: 'Evaluate sums with the formulas for Σk, Σk², Σk³, and write series in sigma notation.',
  instruction: (o) => (o.task === 'write' ? 'Write each series in sigma notation.' : o.task === 'evaluate' ? 'Evaluate each sum.' : 'Evaluate each sum or write it in sigma notation.'),
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Task',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'Mixed' },
        { value: 'evaluate', label: 'Evaluate sums' },
        { value: 'write', label: 'Write in sigma notation' },
      ],
    },
    { type: 'boolean', id: 'variedVars', label: 'Vary the index letter', default: false },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const v = boolOpt(ctx, 'variedVars') ? rng.pick(['k', 'n', 'j', 'm']) : 'k';
    const tOpt = strOpt(ctx, 'task');
    const task = tOpt === 'mixed' ? rng.pick(['evaluate', 'write']) : tOpt;
    return task === 'evaluate' ? evaluateTask(rng, difficulty, v) : writeTask(rng, difficulty, v);
  },
});
