/**
 * Translating between words and algebra: verbal phrases ↔ expressions, and
 * sentences → equations. Phrases are built from a small grammar chosen so that
 * every phrase has exactly one reading (no "twice a number decreased by six").
 */
import { attempt, defineTopic, distinctDistractors, strOpt } from '../../generator';
import type { Rng } from '../../rng';
import { m } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { CAT } from './common';

type Cls = 'atom' | 'add' | 'mul' | 'sq' | 'quot';

interface Inner {
  kind: string;
  cls: Cls;
  phrase: (a: string) => string;
  tex: (a: number, v: string) => string;
  f: (n: number, a: number) => number;
}

const INNERS: Inner[] = [
  { kind: 'n', cls: 'atom', phrase: () => 'a number', tex: (_a, v) => v, f: (n) => n },
  { kind: 'sum', cls: 'add', phrase: (a) => `the sum of a number and ${a}`, tex: (a, v) => `${v} + ${a}`, f: (n, a) => n + a },
  { kind: 'diff', cls: 'add', phrase: (a) => `the difference of a number and ${a}`, tex: (a, v) => `${v} - ${a}`, f: (n, a) => n - a },
  { kind: 'prod', cls: 'mul', phrase: (a) => `the product of ${a} and a number`, tex: (a, v) => `${a}${v}`, f: (n, a) => a * n },
  { kind: 'quot', cls: 'quot', phrase: (a) => `the quotient of a number and ${a}`, tex: (a, v) => `\\frac{${v}}{${a}}`, f: (n, a) => n / a },
  { kind: 'twice', cls: 'mul', phrase: () => 'twice a number', tex: (_a, v) => `2${v}`, f: (n) => 2 * n },
  { kind: 'square', cls: 'sq', phrase: () => 'the square of a number', tex: (_a, v) => `${v}^{2}`, f: (n) => n * n },
];

interface Outer {
  kind: string;
  allowed: Cls[];
  phrase: (x: string, b: string) => string;
  tex: (x: string, cls: Cls, b: number, v: string) => string;
  f: (x: number, b: number) => number;
}

/** B·X with parentheses around sums, `Bn^{2}` for squares, `Bn` for the bare variable. */
const timesTex = (b: number | string, x: string, cls: Cls) => (cls === 'add' ? `${b}(${x})` : `${b}${x}`);

const OUTERS: Outer[] = [
  { kind: 'more', allowed: ['atom', 'mul', 'sq', 'quot'], phrase: (x, b) => `${b} more than ${x}`, tex: (x, _c, b) => `${x} + ${b}`, f: (x, b) => x + b },
  { kind: 'less', allowed: ['atom', 'mul', 'sq', 'quot'], phrase: (x, b) => `${b} less than ${x}`, tex: (x, _c, b) => `${x} - ${b}`, f: (x, b) => x - b },
  { kind: 'sum', allowed: ['atom', 'mul', 'sq', 'quot'], phrase: (x, b) => `the sum of ${x} and ${b}`, tex: (x, _c, b) => `${x} + ${b}`, f: (x, b) => x + b },
  { kind: 'diff', allowed: ['atom', 'mul', 'sq', 'quot'], phrase: (x, b) => `the difference of ${x} and ${b}`, tex: (x, _c, b) => `${x} - ${b}`, f: (x, b) => x - b },
  { kind: 'prod', allowed: ['atom', 'add', 'sq'], phrase: (x, b) => `the product of ${b} and ${x}`, tex: (x, c, b) => timesTex(b, x, c), f: (x, b) => b * x },
  { kind: 'times', allowed: ['atom', 'add', 'sq'], phrase: (x, b) => `${b} times ${x}`, tex: (x, c, b) => timesTex(b, x, c), f: (x, b) => b * x },
  { kind: 'quot', allowed: ['atom'], phrase: (x, b) => `the quotient of ${x} and ${b}`, tex: (x, _c, b) => `\\frac{${x}}{${b}}`, f: (x, b) => x / b },
  { kind: 'twice', allowed: ['atom', 'add', 'sq'], phrase: (x) => `twice ${x}`, tex: (x, c) => timesTex(2, x, c), f: (x) => 2 * x },
];

interface Expr {
  phrase: string;
  tex: string;
  f: (n: number) => number;
  key: string;
}

function build(inner: Inner, outer: Outer | null, a: number, b: number, v: string): Expr {
  const ip = inner.phrase(m(String(a)));
  const it = inner.tex(a, v);
  if (!outer) return { phrase: ip, tex: it, f: (n) => inner.f(n, a), key: inner.kind };
  return {
    phrase: outer.phrase(ip, m(String(b))),
    tex: outer.tex(it, inner.cls, b, v),
    f: (n) => outer.f(inner.f(n, a), b),
    key: `${outer.kind}/${inner.kind}`,
  };
}

const PROBES = [1.7, 2.9, -3.3];
const same = (f: (n: number) => number, g: (n: number) => number) => PROBES.every((n) => Math.abs(f(n) - g(n)) < 1e-9);

function pickExpr(rng: Rng, d: Difficulty, v: string): { e: Expr; inner: Inner; outer: Outer | null; a: number; b: number } {
  return attempt('verbal', () => {
    const hi = d === 'easy' ? 9 : d === 'medium' ? 12 : 20;
    let a = rng.int(2, hi);
    const b = rng.int(2, hi);
    if (d === 'easy') {
      // a single operation on "a number" (or a single inner phrase)
      if (rng.bool(0.4)) {
        const inner = rng.pick(INNERS.filter((i) => i.kind !== 'n'));
        if (inner.kind === 'twice' || inner.kind === 'square') a = 2;
        return { e: build(inner, null, a, b, v), inner, outer: null, a, b };
      }
      const outer = rng.pick(OUTERS);
      return { e: build(INNERS[0]!, outer, a, b, v), inner: INNERS[0]!, outer, a, b };
    }
    const outer = rng.pick(OUTERS.filter((o) => o.kind !== 'quot'));
    const inner = rng.pick(INNERS.filter((i) => i.kind !== 'n' && outer.allowed.includes(i.cls)));
    // inner phrases without a number of their own: neighbouring wrong readings use 2
    if (inner.kind === 'twice' || inner.kind === 'square') a = 2;
    if (a === b) return null;
    return { e: build(inner, outer, a, b, v), inner, outer, a, b };
  });
}

/** Wrong readings: other grammar combinations with the same numbers, plus classic slips. */
function wrongExprs(pick: { e: Expr; inner: Inner; outer: Outer | null; a: number; b: number }, v: string): Expr[] {
  const { e, inner, outer, a, b } = pick;
  const out: Expr[] = [];
  const add = (x: Expr | null) => {
    if (x && !same(x.f, e.f) && !out.some((y) => same(y.f, x.f))) out.push(x);
  };
  // classic slips (tex only — used where the answer is algebra)
  if (outer?.kind === 'less' || outer?.kind === 'diff') add({ phrase: '', tex: `${b} - ${inner.tex(a, v)}`, f: (n) => b - inner.f(n, a), key: 'rev' });
  if (outer?.kind === 'quot') add({ phrase: '', tex: `\\frac{${b}}{${inner.tex(a, v)}}`, f: (n) => b / inner.f(n, a), key: 'rev' });
  if (inner.kind === 'quot') add({ phrase: '', tex: outer ? outer.tex(`\\frac{${a}}{${v}}`, 'quot', b, v) : `\\frac{${a}}{${v}}`, f: (n) => (outer ? outer.f(a / n, b) : a / n), key: 'rev' });
  if (inner.kind === 'diff' && !outer) add({ phrase: '', tex: `${a} - ${v}`, f: (n) => a - n, key: 'rev' });
  if (outer && inner.cls === 'add' && (outer.kind === 'prod' || outer.kind === 'times' || outer.kind === 'twice')) {
    const k = outer.kind === 'twice' ? 2 : b;
    const sign = inner.kind === 'sum' ? 1 : -1;
    add({ phrase: '', tex: `${k}${v} ${sign > 0 ? '+' : '-'} ${a}`, f: (n) => k * n + sign * a, key: 'paren' });
  }
  // grammar neighbours (these have phrases too)
  const outers = outer ? OUTERS.filter((o) => o.allowed.includes(inner.cls)) : [];
  for (const o of outers) add(build(inner, o, a, b, v));
  if (outer && inner.kind !== 'n') for (const i of INNERS) if (i.kind !== 'n' && outer.allowed.includes(i.cls)) add(build(i, outer, a, b, v));
  if (outer) for (const o of outers) add(build(inner, o, b, a, v));
  if (!outer) for (const i of INNERS) if (i.kind !== 'n') add(build(i, null, a, b, v));
  if (!outer) for (const i of INNERS) if (i.kind !== 'n') add(build(i, null, a + 1, b, v));
  return out;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The phrase's intended meaning as (n, value) pairs, so the tests can compare it with the rendered algebra. */
const samples = (f: (n: number) => number): Array<[number, number]> => [2, 3, 5, 8].map((n) => [n, f(n)]);

type VTask = 'toAlgebra' | 'toWords' | 'equation';

export const writingExpressions = defineTopic({
  id: 'prealg.verbal-expressions',
  subject: 'prealgebra',
  category: CAT.equations,
  title: 'Writing Expressions and Equations',
  description: 'Translate verbal phrases into algebraic expressions and equations, and expressions into words.',
  instruction: (o) =>
    o.task === 'toAlgebra'
      ? 'Write each as an algebraic expression. Use n for the number.'
      : o.task === 'toWords'
        ? 'Write each as a verbal expression.'
        : o.task === 'equation'
          ? 'Write each as an equation. Use n for the number.'
          : 'Translate each between words and algebra. Use n for the number.',
  multipleChoice: true,
  defaultCount: 12,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Translate',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'Mixed' },
        { value: 'toAlgebra', label: 'Words → expression' },
        { value: 'toWords', label: 'Expression → words' },
        { value: 'equation', label: 'Sentence → equation' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const t = strOpt(ctx, 'task');
    const task: VTask = t === 'mixed' ? rng.pick(['toAlgebra', 'toWords', 'equation'] as const) : (t as VTask);
    const v = 'n';
    const pick = pickExpr(rng, difficulty, v);
    const { e } = pick;
    const wrong = wrongExprs(pick, v);
    if (task === 'toWords') {
      const answer = cap(e.phrase);
      const distractors = distinctDistractors(
        answer,
        wrong.filter((w) => w.phrase).map((w) => cap(w.phrase)),
        () => null,
      );
      return {
        question: m(e.tex),
        answer,
        steps: [`$${e.tex}$ reads: ${e.phrase}.`],
        distractors,
        check: { kind: 'prealgebra.verbal', task, samples: samples(e.f) },
      };
    }
    if (task === 'toAlgebra') {
      const answer = m(e.tex);
      const distractors = distinctDistractors(answer, wrong.map((w) => m(w.tex)), () => null);
      return { question: cap(e.phrase), answer, steps: [`"A number" is $${v}$: $${e.tex}$`], distractors, check: { kind: 'prealgebra.verbal', task, samples: samples(e.f) } };
    }
    // equation: phrase is C
    const c = attempt('verbal-equation', () => {
      const n0 = rng.int(1, 8) * rng.pick([1, pick.a, pick.b]);
      const val = e.f(n0);
      return Number.isInteger(val) && Math.abs(val) <= 600 && val !== 0 ? val : null;
    });
    const verb = rng.pick(['is', 'is', 'equals', 'is equal to']);
    const answer = m(`${e.tex} = ${c}`);
    const distractors = distinctDistractors(answer, [...wrong.map((w) => m(`${w.tex} = ${c}`)), m(`${e.tex} = ${c + 1}`)], () => null);
    return {
      question: `${cap(e.phrase)} ${verb} ${m(String(c))}.`,
      answer,
      steps: [`"${verb}" means $=$: $${e.tex} = ${c}$`],
      distractors,
      check: { kind: 'prealgebra.verbal', task, samples: samples(e.f), value: c },
    };
  },
});
