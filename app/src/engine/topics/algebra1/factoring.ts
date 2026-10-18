/** Factoring trinomials, GCFs and differences of squares. */
import { gcd, gcdAll } from '../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, strOpt } from '../../generator';
import { isPerfectSquare } from '../../radical';
import type { Rng } from '../../rng';
import { m, sum } from '../../tex';
import type { ProblemContent } from '../../types';

/** Binomial factor m·x + p·y (y = '' for one variable). */
interface Factor {
  m: number;
  p: number;
}

function factorTex(f: Factor, x: string, y: string): string {
  return `(${sum([
    { coef: f.m, sym: x },
    { coef: f.p, sym: y },
  ])})`;
}

/** Product with repeated factors collapsed to a square, larger leading coefficient first. */
function productTex(k: number, f1: Factor, f2: Factor, x: string, y: string): string {
  const [a, b] = f1.m > f2.m || (f1.m === f2.m && f1.p > f2.p) ? [f1, f2] : [f2, f1];
  const lead = k === 1 ? '' : k === -1 ? '-' : String(k);
  if (a.m === b.m && a.p === b.p) return `${lead}${factorTex(a, x, y)}^{2}`;
  return `${lead}${factorTex(a, x, y)}${factorTex(b, x, y)}`;
}

function trinomialTex(A: number, B: number, C: number, x: string, y: string): string {
  return sum([
    { coef: A, sym: `${x}^{2}` },
    { coef: B, sym: `${x}${y}` },
    { coef: C, sym: y ? `${y}^{2}` : '' },
  ]);
}

type Kind = 'monic' | 'nonmonic' | 'dos' | 'prime';

interface Built {
  kind: Kind;
  k: number;
  f1: Factor;
  f2: Factor;
  /** For prime polynomials. */
  coeffs?: [number, number, number];
}

function buildFactors(rng: Rng, kind: Kind, hard: boolean, negatives: boolean): Built {
  return attempt('factoring', () => {
    const k = hard && rng.bool(0.6) ? rng.int(2, 5) * (negatives && rng.bool(0.25) ? -1 : 1) : 1;
    const sgn = () => (negatives ? rng.sign() : 1);
    if (kind === 'prime') {
      const A = rng.int(1, hard ? 6 : 3);
      const B = rng.int(1, 12) * sgn();
      const C = rng.int(1, 15) * sgn();
      if (isPerfectSquare(B * B - 4 * A * C) || gcdAll([A, B, C]) !== 1) return null;
      return { kind, k: 1, f1: { m: 1, p: 0 }, f2: { m: 1, p: 0 }, coeffs: [A, B, C] };
    }
    if (kind === 'dos') {
      const a = rng.int(1, hard ? 6 : 4);
      const b = rng.int(1, 10);
      if (gcd(a, b) !== 1 || (a === 1 && b === 1)) return null;
      return { kind, k, f1: { m: a, p: b }, f2: { m: a, p: -b } };
    }
    if (kind === 'monic') {
      const p = rng.int(1, 10) * sgn();
      const q = rng.int(1, 10) * sgn();
      if (Math.abs(p * q) > 60) return null;
      return { kind, k, f1: { m: 1, p }, f2: { m: 1, p: q } };
    }
    const m1 = rng.int(1, 5);
    const m2 = rng.int(1, 4);
    if (m1 * m2 === 1) return null;
    const p = rng.int(1, 9) * sgn();
    const q = rng.int(1, 9) * sgn();
    if (gcd(m1, p) !== 1 || gcd(m2, q) !== 1) return null;
    if (m1 * m2 > 15 || Math.abs(p * q) > 50) return null;
    return { kind, k, f1: { m: m1, p }, f2: { m: m2, p: q } };
  });
}

export const factoringTrinomials = defineTopic({
  id: 'alg1.factoring',
  subject: 'algebra1',
  category: 'Factoring',
  title: 'Factoring Polynomials',
  description: 'Trinomials with a = 1 and a ≠ 1, greatest common factors, differences of squares.',
  instruction: 'Factor each completely.',
  multipleChoice: true,
  defaultCount: 12,
  options: [
    {
      type: 'select',
      id: 'type',
      label: 'Type',
      default: 'trinomials',
      choices: [
        { value: 'trinomials', label: 'Trinomials' },
        { value: 'dos', label: 'Difference of squares' },
        { value: 'mixed', label: 'Mixed' },
      ],
    },
    { type: 'boolean', id: 'negatives', label: 'Allow negative constants', default: true },
    { type: 'boolean', id: 'prime', label: 'Include prime (not factorable) polynomials', default: false },
    { type: 'boolean', id: 'twoVars', label: 'Two variables (hard only)', default: false },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const type = strOpt(ctx, 'type');
    const hard = difficulty === 'hard';
    const negatives = boolOpt(ctx, 'negatives');
    const x = 'x';
    const y = hard && boolOpt(ctx, 'twoVars') && rng.bool(0.5) ? 'y' : '';
    let kind: Kind;
    if (boolOpt(ctx, 'prime') && rng.bool(0.15)) kind = 'prime';
    else if (type === 'dos') kind = 'dos';
    else {
      const tri: Kind = difficulty === 'easy' ? 'monic' : difficulty === 'medium' ? rng.pick<Kind>(['monic', 'nonmonic', 'nonmonic']) : 'nonmonic';
      kind = type === 'mixed' && rng.bool(0.3) ? 'dos' : tri;
    }
    const built = buildFactors(rng, kind, hard, negatives);
    const steps: string[] = [];

    if (built.kind === 'prime') {
      const [A, B, C] = built.coeffs!;
      const question = trinomialTex(A, B, C, x, y);
      steps.push(`No two integers multiply to $${A * C}$ and add to $${B}$, so the polynomial does not factor.`);
      const answer = 'Prime (not factorable)';
      return {
        question: m(question),
        answer,
        steps,
        distractors: distinctDistractors(
          answer,
          [m(`(${x} + ${Math.abs(C)})(${x} - 1)`), m(`(${A === 1 ? '' : A}${x} + 1)(${x} + ${Math.abs(C)})`), m(`(${x} - 1)(${x} + 1)`)],
          (k) => m(`(${x} + ${k})(${x} - ${k + 1})`),
        ),
        check: { kind: 'factor', prime: true, coeffs: built.coeffs, twoVars: Boolean(y) },
      };
    }

    const { k, f1, f2 } = built;
    // inner = (m1 x + p y)(m2 x + q y) = A x² + B xy + C y²
    const A = f1.m * f2.m;
    const B = f1.m * f2.p + f2.m * f1.p;
    const C = f1.p * f2.p;
    const question = trinomialTex(k * A, k * B, k * C, x, y);
    const answer = m(productTex(k, f1, f2, x, y));
    if (k !== 1) steps.push(`Factor out the GCF: $${k}(${trinomialTex(A, B, C, x, y)})$`);
    if (built.kind === 'dos') {
      const sq = (n: number, s: string) => (n === 1 ? s : `${n}${s}`);
      steps.push(`Difference of squares: $(${sq(f1.m, x)})^{2} - (${sq(Math.abs(f1.p), y)})^{2}$`);
    } else if (A === 1) {
      steps.push(`Find two numbers with product $${C}$ and sum $${B}$: $${f1.p}$ and $${f2.p}$`);
    } else {
      const r = f1.m * f2.p;
      const s = f2.m * f1.p;
      steps.push(`$ac = ${A * C}$; two numbers with product $${A * C}$ and sum $${B}$: $${r}$ and $${s}$`);
      steps.push(
        `Split the middle term: $${sum([
          { coef: A, sym: `${x}^{2}` },
          { coef: r, sym: `${x}${y}` },
          { coef: s, sym: `${x}${y}` },
          { coef: C, sym: y ? `${y}^{2}` : '' },
        ])}$`,
      );
      // group: m1·x(m2 x + q y) + p y(m2 x + q y)
      const common = factorTex(f2, x, y);
      const g1 = sum([{ coef: f1.m, sym: x }]);
      const g2 = `${f1.p < 0 ? '-' : '+'} ${Math.abs(f1.p) === 1 ? '' : Math.abs(f1.p)}${y}`;
      steps.push(`Group: $${g1}${common} ${g2}${common}$`);
    }
    steps.push(`$= ${productTex(k, f1, f2, x, y)}$`);

    const wrong = (a: Factor, b: Factor, kk = k) => m(productTex(kk, a, b, x, y));
    const distractors = distinctDistractors(
      answer,
      [
        wrong({ m: f1.m, p: -f1.p }, { m: f2.m, p: -f2.p }),
        wrong({ m: f1.m, p: f2.p }, { m: f2.m, p: f1.p }),
        wrong(f1, { m: f2.m, p: -f2.p }),
        k !== 1 ? wrong(f1, f2, 1) : null,
      ],
      (n) => wrong({ m: f1.m, p: f1.p + n }, { m: f2.m, p: f2.p - n }),
    );
    return {
      question: m(question),
      answer,
      steps,
      distractors,
      check: { kind: 'factor', prime: false, twoVars: Boolean(y) },
    };
  },
});
