/** Factoring quadratic expressions: general trinomials (variant of Algebra 1) and special cases. */
import { gcd } from '../../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, strOpt, variant } from '../../../generator';
import type { Rng } from '../../../rng';
import { m, sum } from '../../../tex';
import type { Difficulty, ProblemContent } from '../../../types';
import { factoringTrinomials } from '../../algebra1/factoring';
import { CATEGORY_QUAD } from './common';

export const factoringQuadratics = variant(factoringTrinomials, {
  id: 'alg2.quad.factor',
  title: 'Factoring Quadratic Expressions',
  subject: 'algebra2',
  category: CATEGORY_QUAD,
  description: 'Factor ax² + bx + c, including leading coefficients other than 1 and common factors.',
  defaultCount: 12,
  fixed: { type: 'trinomials' },
});

type Kind = 'dos' | 'pst' | 'dos4';

interface Special {
  kind: Kind;
  /** GCF */
  k: number;
  /** a·x + b·y (y = '' for a constant) */
  a: number;
  b: number;
  /** sign of the middle term for perfect squares */
  s: 1 | -1;
  y: string;
}

const coefTex = (k: number) => (k === 1 ? '' : k === -1 ? '-' : String(k));

function build(rng: Rng, d: Difficulty, type: string, twoVars: boolean): Special {
  return attempt('special-factoring', () => {
    let kind: Kind = type === 'dos' ? 'dos' : type === 'pst' ? 'pst' : rng.pick<Kind>(['dos', 'pst']);
    if (kind === 'dos' && d === 'hard' && rng.bool(0.25)) kind = 'dos4';
    const y = twoVars && d !== 'easy' && kind !== 'dos4' && rng.bool(0.45) ? 'y' : '';
    const k = d === 'hard' && rng.bool(0.45) ? rng.int(2, 5) : 1;
    let a: number;
    let b: number;
    if (kind === 'dos4') {
      a = rng.pick([1, 1, 2, 3]);
      b = rng.int(1, a === 1 ? 3 : 2);
    } else if (d === 'easy') {
      a = rng.pick([1, 1, 1, 2, 3]);
      b = rng.int(1, kind === 'dos' ? 15 : 12);
    } else {
      a = rng.int(1, d === 'medium' ? 6 : 8);
      b = rng.int(1, d === 'medium' ? 10 : 12);
    }
    if (gcd(a, b) !== 1) return null;
    const s = rng.sign();
    return { kind, k, a, b, s, y };
  });
}

/** (m·x + n·y), with n carrying its sign. */
function bin(mm: number, n: number, x: string, y: string): string {
  return `(${sum([
    { coef: mm, sym: x },
    { coef: n, sym: y },
  ])})`;
}

export const factoringSpecialCases = defineTopic({
  id: 'alg2.quad.factor-special',
  subject: 'algebra2',
  category: CATEGORY_QUAD,
  title: 'Factoring Special Case Quadratic Expressions',
  description: 'Differences of squares and perfect square trinomials, with common factors at the hard level.',
  instruction: 'Factor each completely.',
  multipleChoice: true,
  defaultCount: 12,
  options: [
    {
      type: 'select',
      id: 'type',
      label: 'Type',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'Mixed' },
        { value: 'dos', label: 'Difference of squares' },
        { value: 'pst', label: 'Perfect square trinomials' },
      ],
    },
    { type: 'boolean', id: 'twoVars', label: 'Include two-variable expressions (medium/hard)', default: false },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const sp = build(rng, difficulty, strOpt(ctx, 'type'), boolOpt(ctx, 'twoVars'));
    const { kind, k, a, b, s, y } = sp;
    const x = 'x';
    const K = coefTex(k);
    const steps: string[] = [];
    const sqTex = (n: number, v: string, p = 1) => (n === 1 ? (p === 1 ? v : `${v}^{${p}}`) : `${n}${p === 1 ? v : `${v}^{${p}}`}`);
    let question: string;
    let answer: string;
    let candidates: string[];
    let fallback: (n: number) => string;

    if (kind === 'dos4') {
      // a²x⁴ − b⁴ = (a x²)² − (b²)²
      const A = a * a;
      const B = b * b;
      const inner = sum([
        { coef: A, sym: `${x}^{4}` },
        { coef: -B * B },
      ]);
      question = sum([
        { coef: k * A, sym: `${x}^{4}` },
        { coef: -k * B * B },
      ]);
      if (k !== 1) steps.push(`Factor out the GCF: $${k}(${inner})$`);
      steps.push(`Difference of squares: $(${sqTex(a, x, 2)})^{2} - (${B})^{2} = ${bin(a, B, `${x}^{2}`, '')}${bin(a, -B, `${x}^{2}`, '')}$`);
      const r = Math.round(Math.sqrt(a));
      if (r * r === a) {
        answer = `${K}${bin(a, B, `${x}^{2}`, '')}${bin(r, b, x, '')}${bin(r, -b, x, '')}`;
        steps.push(`Factor $${sum([{ coef: a, sym: `${x}^{2}` }, { coef: -B }])}$ again: $${bin(r, b, x, '')}${bin(r, -b, x, '')}$`);
        candidates = [
          `${K}${bin(a, B, `${x}^{2}`, '')}${bin(a, -B, `${x}^{2}`, '')}`,
          `${K}${bin(r, b, x, '')}^{2}${bin(r, -b, x, '')}^{2}`,
          `${K}${bin(a, -B, `${x}^{2}`, '')}^{2}`,
        ];
      } else {
        answer = `${K}${bin(a, B, `${x}^{2}`, '')}${bin(a, -B, `${x}^{2}`, '')}`;
        steps.push(`$${sum([{ coef: a, sym: `${x}^{2}` }, { coef: -B }])}$ is not a difference of squares, so the factoring is complete.`);
        candidates = [`${K}${bin(a, -B, `${x}^{2}`, '')}^{2}`, `${K}${bin(a, B, `${x}^{2}`, '')}^{2}`, `${K}${bin(a, B, x, '')}${bin(a, -B, x, '')}`];
      }
      fallback = (n) => `${K}${bin(a, B + n, `${x}^{2}`, '')}${bin(a, -B - n, `${x}^{2}`, '')}`;
    } else if (kind === 'dos') {
      const inner = sum([
        { coef: a * a, sym: `${x}^{2}` },
        { coef: -b * b, sym: y ? `${y}^{2}` : '' },
      ]);
      question = sum([
        { coef: k * a * a, sym: `${x}^{2}` },
        { coef: -k * b * b, sym: y ? `${y}^{2}` : '' },
      ]);
      if (k !== 1) steps.push(`Factor out the GCF: $${k}(${inner})$`);
      steps.push(`Write as a difference of squares: $(${sqTex(a, x)})^{2} - (${y ? sqTex(b, y) : b})^{2}$`);
      steps.push(`Use $A^{2} - B^{2} = (A + B)(A - B)$.`);
      answer = `${K}${bin(a, b, x, y)}${bin(a, -b, x, y)}`;
      candidates = [
        `${K}${bin(a, -b, x, y)}^{2}`,
        `${K}${bin(a, b, x, y)}^{2}`,
        a !== b ? `${K}${bin(b, a, x, y)}${bin(b, -a, x, y)}` : '',
        k !== 1 ? `${bin(a, b, x, y)}${bin(a, -b, x, y)}` : '',
      ];
      fallback = (n) => `${K}${bin(a, b + n, x, y)}${bin(a, -b - n, x, y)}`;
    } else {
      const inner = sum([
        { coef: a * a, sym: `${x}^{2}` },
        { coef: 2 * s * a * b, sym: `${x}${y}` },
        { coef: b * b, sym: y ? `${y}^{2}` : '' },
      ]);
      question = sum([
        { coef: k * a * a, sym: `${x}^{2}` },
        { coef: 2 * k * s * a * b, sym: `${x}${y}` },
        { coef: k * b * b, sym: y ? `${y}^{2}` : '' },
      ]);
      if (k !== 1) steps.push(`Factor out the GCF: $${k}(${inner})$`);
      const A = sqTex(a, x);
      const B = y ? sqTex(b, y) : String(b);
      steps.push(`First and last terms are squares: $(${A})^{2}$ and $(${B})^{2}$; the middle term is $${s < 0 ? '-' : ''}2(${A})(${B})$.`);
      steps.push(`Use $A^{2} ${s < 0 ? '-' : '+'} 2AB + B^{2} = (A ${s < 0 ? '-' : '+'} B)^{2}$.`);
      answer = `${K}${bin(a, s * b, x, y)}^{2}`;
      candidates = [
        `${K}${bin(a, -s * b, x, y)}^{2}`,
        `${K}${bin(a, b, x, y)}${bin(a, -b, x, y)}`,
        a !== b ? `${K}${bin(b, s * a, x, y)}^{2}` : '',
        k !== 1 ? `${bin(a, s * b, x, y)}^{2}` : '',
      ];
      fallback = (n) => `${K}${bin(a, s * (b + n), x, y)}^{2}`;
    }
    steps.push(`$= ${answer}$`);
    const ans = m(answer);
    return {
      question: m(question),
      answer: ans,
      steps,
      distractors: distinctDistractors(ans, candidates.map((c) => (c ? m(c) : null)), (n) => m(fallback(n))),
      check: { kind: 'factor', prime: false, twoVars: Boolean(y) },
    };
  },
});
