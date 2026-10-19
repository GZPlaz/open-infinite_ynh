/** Solving quadratic equations by factoring and the zero product property. */
import { Frac } from '../../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, opt, pickVar } from '../../../generator';
import { Poly } from '../../../polynomial';
import type { Rng } from '../../../rng';
import { linear, m, num, setTex } from '../../../tex';
import type { Difficulty, ProblemContent } from '../../../types';
import { CATEGORY_QUAD, rearranged } from './common';

interface Built {
  k: number;
  r: [Frac, Frac];
  rearrange: boolean;
}

function build(rng: Rng, d: Difficulty, negatives: boolean): Built {
  return attempt('solve-factoring', () => {
    const monic = d === 'easy' || (d === 'medium' && rng.bool(0.5));
    const root = (den: number) => new Frac(rng.signedInt(0, 9 * den, negatives) * (rng.bool(0.1) ? 0 : 1), den);
    const den1 = monic ? 1 : rng.pick([1, 2, 3, 4, 5]);
    const den2 = monic ? 1 : d === 'hard' ? rng.pick([1, 2, 3, 5]) : 1;
    const r1 = root(den1);
    const r2 = rng.bool(0.08) ? r1 : root(den2);
    if (Math.abs(r1.value) > 9 || Math.abs(r2.value) > 9) return null;
    if (!monic && r1.isInt() && r2.isInt()) return null;
    if (r1.isZero() && r2.isZero()) return null;
    const k = d === 'hard' && rng.bool(0.3) ? rng.int(2, 4) * (rng.bool(0.3) ? -1 : 1) : 1;
    const p = poly(k, [r1, r2]);
    if (p.c.some((c) => Math.abs(c.value) > 99)) return null;
    const rearrange = d === 'hard' || (d === 'medium' && monic);
    return { k, r: [r1, r2], rearrange };
  });
}

/** k·(d1·x − n1)(d2·x − n2) with integer coefficients. */
function poly(k: number, r: readonly Frac[]): Poly {
  return r.reduce((acc, x) => acc.mul(Poly.linear(x.d, -x.n)), Poly.of(k));
}

function factorTex(x: Frac, v: string): string {
  return x.isZero() ? v : `(${linear(x.d, -x.n, v)})`;
}

function productTex(k: number, r: [Frac, Frac], v: string): string {
  const lead = k === 1 ? '' : k === -1 ? '-' : String(k);
  const [a, b] = r[0].isZero() ? r : r[1].isZero() ? [r[1], r[0]] : r;
  if (a.eq(b)) return `${lead}${a.isZero() ? `${v}^{2}` : `${factorTex(a, v)}^{2}`}`;
  return `${lead}${factorTex(a, v)}${factorTex(b, v)}`;
}

export const solveByFactoring = defineTopic({
  id: 'alg2.quad.solve-factoring',
  subject: 'algebra2',
  category: CATEGORY_QUAD,
  title: 'Solving Equations by Factoring',
  description: 'Write in standard form, factor, and use the zero product property.',
  instruction: 'Solve each equation by factoring.',
  multipleChoice: true,
  defaultCount: 10,
  options: [opt.negatives(true), opt.variedVariables(true)],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const v = pickVar(rng, boolOpt(ctx, 'variedVars'));
    const { k, r, rearrange } = build(rng, difficulty, boolOpt(ctx, 'negatives'));
    const p = poly(k, r);
    const std = p.toTex(v);
    const question = rearrange ? rearranged(rng, p, v) : `${std} = 0`;
    const steps: string[] = [];
    if (rearrange) steps.push(`Write in standard form: $${std} = 0$`);
    steps.push(`Factor: $${productTex(k, r, v)} = 0$`);
    const distinct = r[0].eq(r[1]) ? [r[0]] : r;
    const eqs = distinct.map((x) => `$${x.isZero() ? v : linear(x.d, -x.n, v)} = 0$`);
    if (eqs.length === 2) steps.push(`Set each factor equal to zero: ${eqs.join(' or ')}`);
    else steps.push(`Set the factor equal to zero: ${eqs[0]}`);
    const set = (xs: readonly Frac[]) => {
      const uniq = xs.filter((x, i) => xs.findIndex((y) => y.eq(x)) === i);
      return m(setTex(uniq.map((x) => num(x))));
    };
    const answer = set(distinct);
    steps.push(`Solutions: ${answer}`);
    const distractors = distinctDistractors(
      answer,
      [
        set(distinct.map((x) => x.neg())),
        distinct.some((x) => !x.isInt()) ? set(distinct.map((x) => new Frac(x.n))) : null,
        distinct.some((x) => !x.isInt() && !x.isZero()) ? set(distinct.map((x) => (x.isZero() ? x : x.inv().neg()))) : null,
        set([distinct[0]!.neg(), ...distinct.slice(1)]),
      ],
      (n) => set(distinct.map((x, i) => (i === 0 ? x.add(n) : x.sub(n)))),
    );
    return {
      question: m(question),
      answer,
      steps,
      distractors,
      check: { kind: 'roots', variable: v, solutions: distinct.map((x) => x.value) },
    };
  },
});
