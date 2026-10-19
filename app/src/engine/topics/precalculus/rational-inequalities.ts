/** Polynomial and rational inequalities by sign analysis. */
import { Frac } from '../../fraction';
import { attempt, defineTopic, distinctDistractors, strOpt } from '../../generator';
import { Poly } from '../../polynomial';
import type { Rng } from '../../rng';
import { linear, m, num } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { INF, NINF, end, intervalTex, iv, type Interval } from './common';

type Rel = '<' | '>' | '\\le' | '\\ge';
const OPP: Record<Rel, Rel> = { '<': '\\ge', '>': '\\le', '\\le': '>', '\\ge': '<' };
const strict = (r: Rel) => r === '<' || r === '>';
const holds = (v: number, r: Rel) => (r === '<' ? v < 0 : r === '>' ? v > 0 : r === '\\le' ? v <= 0 : v >= 0);

interface Ineq {
  /** displayed left side; right side is `rhs` */
  lhs: string;
  rhs: string;
  /** f(x) rel 0 after rearranging */
  numer: Poly;
  denom: Poly;
  numRoots: Frac[];
  denRoots: Frac[];
  rel: Rel;
  rearranged?: string;
}

/** Solution set of numer/denom rel 0 (roots supplied exactly). */
function solve(q: Pick<Ineq, 'numer' | 'denom' | 'numRoots' | 'denRoots'>, rel: Rel, treatPolesAsRoots = false): Interval[] {
  const all = [...q.numRoots, ...q.denRoots].sort((a, b) => a.cmp(b)).filter((x, i, arr) => i === 0 || !x.eq(arr[i - 1]!));
  const f = (x: number) => q.numer.evalNum(x) / q.denom.evalNum(x);
  const isPole = (x: Frac) => !treatPolesAsRoots && q.denRoots.some((d) => d.eq(x));
  const segIn: boolean[] = [];
  for (let i = 0; i <= all.length; i++) {
    const lo = i === 0 ? all[0]!.value - 1 : all[i - 1]!.value;
    const hi = i === all.length ? all[all.length - 1]!.value + 1 : all[i]!.value;
    segIn.push(holds(f((lo + hi) / 2), rel));
  }
  const ptIn = all.map((x) => !isPole(x) && !strict(rel));
  const out: Interval[] = [];
  let start: { e: ReturnType<typeof end>; closed: boolean } | null = segIn[0] ? { e: NINF, closed: false } : null;
  for (let i = 0; i < all.length; i++) {
    const x = all[i]!;
    const next = segIn[i + 1]!;
    if (start) {
      if (ptIn[i] && next) continue;
      out.push(iv(start.e, end(x), start.closed, ptIn[i]));
      start = next ? { e: end(x), closed: false } : null;
    } else if (next) start = { e: end(x), closed: ptIn[i]! };
    else if (ptIn[i]) out.push(iv(end(x), end(x), true, true));
  }
  if (start) out.push(iv(start.e, INF, start.closed));
  return out;
}

function inequalityTex(list: Interval[]): string {
  if (list.length === 1 && list[0]!.lo.v === -Infinity && list[0]!.hi.v === Infinity) return 'All real numbers';
  if (list.length === 0) return 'No solution';
  const part = (i: Interval) => {
    if (i.lo.v === i.hi.v) return `x = ${i.lo.tex}`;
    if (i.lo.v === -Infinity) return `x ${i.hiC ? '\\le' : '<'} ${i.hi.tex}`;
    if (i.hi.v === Infinity) return `x ${i.loC ? '\\ge' : '>'} ${i.lo.tex}`;
    return `${i.lo.tex} ${i.loC ? '\\le' : '<'} x ${i.hiC ? '\\le' : '<'} ${i.hi.tex}`;
  };
  return m(list.map(part).join(' \\text{ or } '));
}

const factorTex = (r: Frac, k = 1) => {
  const base = r.isInt() ? linear(1, r.neg()) : linear(r.d, -r.n);
  return k === 1 ? `(${base})` : `(${base})^{${k}}`;
};

type Form = 'quad' | 'quadLead' | 'cubic' | 'ratLin' | 'ratQuad' | 'repeated' | 'ratK';
const FORMS: Record<Difficulty, Form[]> = {
  easy: ['quad'],
  medium: ['quadLead', 'cubic', 'ratLin'],
  hard: ['ratQuad', 'repeated', 'ratK', 'cubic'],
};

function build(rng: Rng, form: Form): Ineq {
  const rel = rng.pick<Rel>(['<', '>', '\\le', '\\ge']);
  const ints = (k: number) => rng.sample([-7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7], k).map((x) => new Frac(x)).sort((a, b) => a.cmp(b));
  const one = Poly.of(1);
  switch (form) {
    case 'quad': {
      const r = ints(2);
      const s = rng.bool(0.25) ? -1 : 1;
      const p = Poly.fromRoots(r).scale(s);
      return { lhs: p.toTex(), rhs: '0', numer: p, denom: one, numRoots: r, denRoots: [], rel };
    }
    case 'quadLead': {
      const den = rng.pick([2, 3]);
      const r1 = new Frac(rng.signedInt(1, 7, true), den);
      const r2 = ints(1)[0]!;
      if (r1.isInt() || r1.eq(r2)) return build(rng, form);
      const p = Poly.linear(r1.d, -r1.n).mul(Poly.linear(1, r2.neg()));
      return { lhs: p.toTex(), rhs: '0', numer: p, denom: one, numRoots: [r1, r2].sort((a, b) => a.cmp(b)), denRoots: [], rel, rearranged: `${factorTex(r1)}${factorTex(r2)} ${rel} 0` };
    }
    case 'cubic': {
      const r = ints(3);
      const p = Poly.fromRoots(r);
      return { lhs: r.map((x) => factorTex(x)).join('').replace(/\(x\)/g, 'x'), rhs: '0', numer: p, denom: one, numRoots: r, denRoots: [], rel };
    }
    case 'ratLin': {
      const [a, b] = rng.shuffle(ints(2));
      const n = Poly.linear(1, a!.neg());
      const d = Poly.linear(1, b!.neg());
      return { lhs: `\\frac{${n.toTex()}}{${d.toTex()}}`, rhs: '0', numer: n, denom: d, numRoots: [a!], denRoots: [b!], rel };
    }
    case 'ratQuad': {
      const r = ints(3);
      const pole = r.splice(rng.int(0, 2), 1)[0]!;
      const n = Poly.fromRoots(r);
      const d = Poly.linear(1, pole.neg());
      return { lhs: `\\frac{${n.toTex()}}{${d.toTex()}}`, rhs: '0', numer: n, denom: d, numRoots: r, denRoots: [pole], rel, rearranged: `\\frac{${factorTex(r[0]!)}${factorTex(r[1]!)}}{${d.toTex()}} ${rel} 0` };
    }
    case 'repeated': {
      const [a, b] = rng.shuffle(ints(2));
      const p = Poly.fromRoots([a!, a!, b!]);
      return { lhs: `${factorTex(a!, 2)}${factorTex(b!)}`.replace(/\(x\)/g, 'x'), rhs: '0', numer: p, denom: one, numRoots: [a!, b!].sort((x, y) => x.cmp(y)), denRoots: [], rel };
    }
    case 'ratK':
    default: {
      const k = rng.pick([-3, -2, -1, 2, 3, 4]);
      const p = rng.signedInt(1, 6, true);
      const q = rng.int(-6, 6);
      // (x + p)/(x − q) − k = ((1 − k)x + p + kq)/(x − q)
      const n = Poly.linear(1 - k, p + k * q);
      if (n.degree < 1) return build(rng, form);
      const root = new Frac(-(p + k * q), 1 - k);
      if (root.eq(q)) return build(rng, form);
      const d = Poly.linear(1, -q);
      return { lhs: `\\frac{${linear(1, p)}}{${d.toTex()}}`, rhs: String(k), numer: n, denom: d, numRoots: [root], denRoots: [new Frac(q)], rel, rearranged: `\\frac{${n.toTex()}}{${d.toTex()}} ${rel} 0` };
    }
  }
}

export const rationalInequalities = defineTopic({
  id: 'precalc.rational.inequalities',
  subject: 'precalculus',
  category: 'Polynomial and Rational Functions',
  title: 'Polynomial and Rational Inequalities',
  description: 'Solve polynomial and rational inequalities with sign analysis.',
  instruction: (o) => (o.notation === 'inequality' ? 'Solve each inequality.' : 'Solve each inequality. Write the solution in interval notation.'),
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'notation',
      label: 'Answer notation',
      default: 'interval',
      choices: [
        { value: 'interval', label: 'Interval notation' },
        { value: 'inequality', label: 'Inequalities' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const q = attempt('poly-ineq', () => {
      const q = build(rng, rng.pick(FORMS[difficulty]));
      return q.numer.c.every((c) => Math.abs(c.value) <= 120) ? q : null;
    });
    const fmt = strOpt(ctx, 'notation') === 'inequality' ? inequalityTex : (l: Interval[]) => m(intervalTex(l));
    const sol = solve(q, q.rel);
    const answer = fmt(sol);
    const crit = [...q.numRoots, ...q.denRoots].sort((a, b) => a.cmp(b));
    const steps: string[] = [];
    if (q.rearranged) steps.push(`Rewrite: ${m(q.rearranged)}`);
    steps.push(`Critical values: ${m(crit.map((c) => num(c)).join(', '))}${q.denRoots.length ? ` (${m(q.denRoots.map((d) => `x = ${num(d)}`).join(', '))} makes the denominator zero)` : ''}.`);
    steps.push('Test a value in each interval to find where the expression has the required sign.');
    steps.push(answer);
    const negRoots = { numRoots: q.numRoots.map((r) => r.neg()).sort((a, b) => a.cmp(b)), denRoots: q.denRoots.map((r) => r.neg()), numer: reflect(q.numer), denom: reflect(q.denom) };
    const flipped: Rel = { '<': '\\le', '\\le': '<', '>': '\\ge', '\\ge': '>' }[q.rel] as Rel;
    const cands = [fmt(solve(q, OPP[q.rel])), fmt(solve(q, flipped)), q.denRoots.length ? fmt(solve(q, q.rel, true)) : null, fmt(solve(negRoots, q.rel))];
    const distractors = distinctDistractors(answer, cands, (k) => fmt(solve({ ...q, numRoots: q.numRoots.map((r) => r.add(k)), denRoots: q.denRoots.map((r) => r.add(k)), numer: shiftPoly(q.numer, k), denom: shiftPoly(q.denom, k) }, q.rel)));
    return {
      question: m(`${q.lhs} ${q.rel} ${q.rhs}`),
      answer,
      steps,
      distractors,
      check: { kind: 'precalculus.solset', probes: crit.map((c) => c.value) },
    };
  },
});

/** p(−x): every root is negated. */
function reflect(p: Poly): Poly {
  return new Poly(p.c.map((c, i) => (i % 2 ? c.neg() : c)));
}

/** p(x − k): every root moves right by k. */
function shiftPoly(p: Poly, k: number): Poly {
  let out = Poly.of(0);
  const lin = Poly.linear(1, -k);
  p.c.forEach((c, i) => (out = out.add(lin.powInt(i).scale(c))));
  return out;
}
