/** Partial fraction decomposition: distinct and repeated linear factors, irreducible quadratics. */
import { attempt, defineTopic, distinctDistractors, offset, strOpt } from '../../generator';
import { Poly } from '../../polynomial';
import type { Rng } from '../../rng';
import { linear, m, sum } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';

interface Part {
  /** numerator (constant, or linear over a quadratic) */
  num: Poly;
  /** the base factor and its power */
  base: Poly;
  power: number;
}

const factorTex = (base: Poly, power: number): string => {
  const t = base.toTex();
  if (power === 1) return t;
  return base.degree === 1 && base.coef(0).isZero() && base.coef(1).eq(1) ? `x^{${power}}` : `(${t})^{${power}}`;
};

function partsTex(parts: readonly Part[]): string {
  let out = '';
  for (const pt of parts) {
    const den = factorTex(pt.base, pt.power);
    const neg = pt.num.degree === 0 && pt.num.coef(0).sign < 0;
    const numTex = neg ? pt.num.scale(-1).toTex() : pt.num.toTex();
    const body = `\\frac{${numTex}}{${den}}`;
    out += out ? ` ${neg ? '-' : '+'} ${body}` : `${neg ? '-' : ''}${body}`;
  }
  return out;
}

const denOf = (pt: Part) => pt.base.powInt(pt.power);

function combine(parts: readonly Part[]): { N: Poly; D: Poly } {
  // common denominator: product of the highest power of each base
  const bases: Array<{ base: Poly; power: number }> = [];
  for (const pt of parts) {
    const b = bases.find((x) => x.base.eq(pt.base));
    if (b) b.power = Math.max(b.power, pt.power);
    else bases.push({ base: pt.base, power: pt.power });
  }
  const D = bases.reduce((acc, b) => acc.mul(b.base.powInt(b.power)), Poly.of(1));
  let N = Poly.of(0);
  for (const pt of parts) {
    let rest = Poly.of(1);
    for (const b of bases) rest = rest.mul(b.base.powInt(b.base.eq(pt.base) ? b.power - pt.power : b.power));
    N = N.add(pt.num.mul(rest));
  }
  return { N, D };
}

function factoredDen(parts: readonly Part[]): string {
  const bases: Array<{ base: Poly; power: number }> = [];
  for (const pt of parts) {
    const b = bases.find((x) => x.base.eq(pt.base));
    if (b) b.power = Math.max(b.power, pt.power);
    else bases.push({ base: pt.base, power: pt.power });
  }
  if (bases.length === 1 && bases[0]!.power > 1) return factorTex(bases[0]!.base, bases[0]!.power);
  return bases.map((b) => (b.power > 1 ? factorTex(b.base, b.power) : b.base.degree === 1 && b.base.toTex() === 'x' ? 'x' : `(${b.base.toTex()})`)).join('');
}

type Form = 'distinct2' | 'scaled' | 'repeated' | 'repeated3' | 'quadratic' | 'distinct3';
const FORMS: Record<Difficulty, Form[]> = {
  easy: ['distinct2'],
  medium: ['scaled', 'repeated', 'distinct2'],
  hard: ['repeated3', 'quadratic', 'distinct3'],
};

function build(rng: Rng, form: Form): Part[] {
  const c = () => Poly.of(rng.signedInt(1, 6, true));
  const roots = rng.sample([-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5], 3);
  const lin = (r: number) => Poly.linear(1, -r);
  switch (form) {
    case 'distinct2':
      return [{ num: c(), base: lin(roots[0]!), power: 1 }, { num: c(), base: lin(roots[1]!), power: 1 }];
    case 'scaled': {
      const k = rng.pick([2, 3]);
      const d = rng.pick([1, -1, 5, -5].filter((x) => x % k !== 0));
      return [{ num: c(), base: Poly.linear(k, d), power: 1 }, { num: c(), base: lin(roots[0]!), power: 1 }];
    }
    case 'repeated':
      return [{ num: c(), base: lin(roots[0]!), power: 1 }, { num: c(), base: lin(roots[0]!), power: 2 }];
    case 'repeated3':
      return [{ num: c(), base: lin(roots[0]!), power: 1 }, { num: c(), base: lin(roots[0]!), power: 2 }, { num: c(), base: lin(roots[1]!), power: 1 }];
    case 'quadratic': {
      const q = Poly.of(rng.pick([1, 2, 3, 4, 5, 9]), 0, 1);
      return [{ num: c(), base: lin(roots[0]!), power: 1 }, { num: Poly.of(rng.int(-6, 6), rng.signedInt(1, 5, true)), base: q, power: 1 }];
    }
    case 'distinct3':
    default:
      return roots.map((r) => ({ num: c(), base: lin(r), power: 1 }));
  }
}

export const partialFractions = defineTopic({
  id: 'precalc.rational.partial-fractions',
  subject: 'precalculus',
  category: 'Polynomial and Rational Functions',
  title: 'Partial Fraction Decomposition',
  description: 'Decompose rational expressions with linear, repeated linear and irreducible quadratic factors.',
  instruction: 'Find the partial fraction decomposition of each rational expression.',
  multipleChoice: true,
  defaultCount: 8,
  options: [
    {
      type: 'select',
      id: 'denominator',
      label: 'Denominator',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'Mixed (by difficulty)' },
        { value: 'factored', label: 'Always factored' },
        { value: 'expanded', label: 'Always expanded' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const form = rng.pick(FORMS[difficulty]);
    const { parts, N, D } = attempt('partial-fractions', () => {
      const parts = build(rng, form);
      const { N, D } = combine(parts);
      if (N.isZero() || N.c.some((x) => Math.abs(x.value) > 80)) return null;
      return { parts, N, D };
    });
    const dOpt = strOpt(ctx, 'denominator');
    const expanded = dOpt === 'expanded' || (dOpt === 'mixed' && difficulty === 'easy');
    const den = expanded ? D.toTex() : factoredDen(parts);
    const question = m(`\\frac{${N.toTex()}}{${den}}`);
    const answer = m(partsTex(parts));
    const steps: string[] = [];
    if (expanded) steps.push(`Factor the denominator: ${m(factoredDen(parts))}`);
    const letters = ['A', 'B', 'C'];
    let li = 0;
    const generic = parts.map((pt) => (pt.num.degree === 1 ? `\\frac{${letters[li++]}x + ${letters[li++]}}{${factorTex(pt.base, pt.power)}}` : `\\frac{${letters[li++]}}{${factorTex(pt.base, pt.power)}}`));
    steps.push(m(`\\frac{${N.toTex()}}{${factoredDen(parts)}} = ${generic.join(' + ')}`));
    steps.push(`Multiply by ${m(factoredDen(parts))} and match coefficients (or substitute the zeros of the factors).`);
    steps.push(answer);
    const swap = parts.length >= 2 ? [{ ...parts[0]!, num: parts[1]!.num.degree === 0 ? parts[1]!.num : parts[0]!.num }, { ...parts[1]!, num: parts[1]!.num.degree === 0 ? parts[0]!.num : parts[1]!.num }, ...parts.slice(2)] : parts;
    const negOne = (i: number) => parts.map((pt, j) => (j === i ? { ...pt, num: pt.num.scale(-1) } : pt));
    const swapDen = parts.length >= 2 ? [{ ...parts[0]!, base: parts[1]!.base, power: parts[1]!.power }, { ...parts[1]!, base: parts[0]!.base, power: parts[0]!.power }, ...parts.slice(2)] : parts;
    const cands = [swap, negOne(0), negOne(1), swapDen].map((ps) => m(partsTex(ps)));
    const distractors = distinctDistractors(answer, cands, (k) => m(partsTex(parts.map((pt, j) => (j === k % parts.length ? { ...pt, num: pt.num.add(Poly.of(offset(k))) } : pt)).filter((pt) => !pt.num.isZero()))));
    return {
      question,
      answer,
      steps,
      distractors,
      check: { kind: 'precalculus.partialFractions' },
    };
  },
});

export { denOf as _denOf, linear as _linear, sum as _sum };
