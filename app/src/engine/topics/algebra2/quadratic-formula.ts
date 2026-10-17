/**
 * Solving quadratic equations with the quadratic formula.
 *
 * Roots are given in exact simplest form: reduced fractions, simplified
 * radicals with common factors cancelled, or complex numbers a ± bi.
 */
import { Frac, gcd, gcdAll } from '../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, opt, pickVar, strOpt } from '../../generator';
import { Poly } from '../../polynomial';
import { isPerfectSquare, simplifySqrt } from '../../radical';
import type { Rng } from '../../rng';
import { m, num, paren, setTex } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';

type RootKind = 'rational' | 'irrational' | 'complex';

interface Quad {
  a: number;
  b: number;
  c: number;
}

const LIMITS: Record<Difficulty, { a: number; b: number; c: number; den: number; root: number }> = {
  easy: { a: 1, b: 10, c: 12, den: 1, root: 9 },
  medium: { a: 5, b: 12, c: 15, den: 3, root: 7 },
  hard: { a: 8, b: 16, c: 20, den: 5, root: 8 },
};

function primitive(q: Quad): Quad {
  const g = gcdAll([q.a, q.b, q.c]) || 1;
  const s = q.a < 0 ? -1 : 1;
  return { a: (s * q.a) / g, b: (s * q.b) / g, c: (s * q.c) / g };
}

const disc = (q: Quad) => q.b * q.b - 4 * q.a * q.c;

function pickQuad(rng: Rng, kind: RootKind, d: Difficulty): Quad {
  const L = LIMITS[d];
  return attempt('quadratic', () => {
    if (kind === 'rational') {
      const root = () => {
        const den = rng.int(1, L.den);
        return new Frac(rng.signedInt(1, L.root * den, true), den);
      };
      const r1 = root();
      const r2 = rng.bool(0.08) ? r1 : root();
      if (Math.abs(r1.value) > L.root || Math.abs(r2.value) > L.root) return null;
      // (q1·x − p1)(q2·x − p2)
      const q = primitive({
        a: r1.d * r2.d,
        b: -(r1.n * r2.d + r2.n * r1.d),
        c: r1.n * r2.n,
      });
      if (q.a > Math.max(L.a, 1) * 4 || Math.abs(q.b) > L.b * 2.5 || Math.abs(q.c) > L.c * 3) return null;
      if (d !== 'easy' && q.a === 1 && rng.bool(0.6)) return null;
      return q;
    }
    const q = primitive({
      a: rng.int(1, Math.max(L.a, 2)),
      b: rng.int(-L.b, L.b),
      c: rng.signedInt(1, L.c, true),
    });
    const D = disc(q);
    if (kind === 'irrational' && (D <= 0 || isPerfectSquare(D))) return null;
    if (kind === 'complex' && D >= 0) return null;
    if (Math.abs(D) > 400) return null;
    return q;
  });
}

/** Roots (negB ± √D) / den in simplest form, as LaTeX. */
export function formatRoots(negB: number, D: number, den: number): string[] {
  if (den < 0) return formatRoots(-negB, D, -den);
  if (D >= 0 && isPerfectSquare(D)) {
    const s = Math.round(Math.sqrt(D));
    const r1 = new Frac(negB + s, den);
    const r2 = new Frac(negB - s, den);
    return r1.eq(r2) ? [num(r1)] : [num(r1), num(r2)];
  }
  const { out: s, inside } = simplifySqrt(Math.abs(D));
  const g = gcdAll([negB, s, den]);
  const nb = negB / g;
  const k = s / g;
  const dd = den / g;
  const coef = k === 1 ? '' : String(k);
  const rad = D < 0 ? (inside === 1 ? `${coef}i` : `${coef}i\\sqrt{${inside}}`) : `${coef}\\sqrt{${inside}}`;
  const numer = (sign: 1 | -1) => (nb === 0 ? (sign > 0 ? rad : `-${rad}`) : `${nb} ${sign > 0 ? '+' : '-'} ${rad}`);
  if (dd === 1) return [numer(1), numer(-1)];
  if (nb === 0) return [`\\frac{${rad}}{${dd}}`, `-\\frac{${rad}}{${dd}}`];
  return [`\\frac{${numer(1)}}{${dd}}`, `\\frac{${numer(-1)}}{${dd}}`];
}

/** `ax² + bx + c` rearranged so terms sit on both sides, e.g. `3x² + 5 = -7x`. */
function rearranged(rng: Rng, q: Quad, v: string): string {
  return attempt('quadratic-rearrange', () => {
    const shift = Poly.of(rng.int(-8, 8) * (rng.bool(0.6) ? 1 : 0), rng.int(-6, 6), rng.bool(0.3) ? rng.int(-3, 3) : 0);
    const std = Poly.of(q.c, q.b, q.a);
    const left = std.add(shift);
    const right = shift;
    const leftTerms = left.c.filter((x) => !x.isZero()).length;
    const rightTerms = right.c.filter((x) => !x.isZero()).length;
    if (rightTerms === 0 || leftTerms === 0 || leftTerms + rightTerms < 3) return null;
    return rng.bool() ? `${left.toTex(v)} = ${right.toTex(v)}` : `${right.toTex(v)} = ${left.toTex(v)}`;
  });
}

export const quadraticFormula = defineTopic({
  id: 'alg2.quadratic.formula',
  subject: 'algebra2',
  title: 'Using the Quadratic Formula',
  description: 'Solve ax² + bx + c = 0 exactly: rational, irrational or complex roots.',
  instruction: (o) =>
    o.complex ? 'Solve each equation with the quadratic formula. Include non-real solutions.' : 'Solve each equation with the quadratic formula.',
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'roots',
      label: 'Kind of real roots',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'Mixed' },
        { value: 'rational', label: 'Rational only (factorable)' },
        { value: 'irrational', label: 'Irrational only' },
      ],
    },
    { type: 'boolean', id: 'complex', label: 'Include complex (non-real) roots', default: false },
    opt.variedVariables(true),
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const v = pickVar(rng, boolOpt(ctx, 'variedVars'));
    const rootsOpt = strOpt(ctx, 'roots');
    const complex = boolOpt(ctx, 'complex');
    const kinds: Array<[RootKind, number]> =
      rootsOpt === 'rational'
        ? [['rational', 1]]
        : rootsOpt === 'irrational'
          ? [['irrational', 1]]
          : [
              ['rational', 0.45],
              ['irrational', 0.55],
            ];
    if (complex) kinds.push(['complex', 0.3]);
    const kind = rng.weighted(kinds);
    const q = pickQuad(rng, kind, difficulty);
    const { a, b, c } = q;
    const D = disc(q);
    const std = Poly.of(c, b, a).toTex(v);
    const question = difficulty === 'hard' ? rearranged(rng, q, v) : `${std} = 0`;

    const steps: string[] = [];
    if (difficulty === 'hard') steps.push(`Standard form: $${std} = 0$`);
    steps.push(`$a = ${a},\\ b = ${b},\\ c = ${c}$`);
    const negBRaw = b < 0 ? `-(${b})` : b === 0 ? '0' : `-${b}`;
    steps.push(`$${v} = \\frac{${negBRaw} \\pm \\sqrt{${paren(b)}^{2} - 4${paren(a)}${paren(c)}}}{2${paren(a)}}$`);
    steps.push(`$${v} = \\frac{${-b} \\pm \\sqrt{${D}}}{${2 * a}}$`);
    const roots = formatRoots(-b, D, 2 * a);
    if (D >= 0 && isPerfectSquare(D)) {
      const s = Math.round(Math.sqrt(D));
      if (s !== 0) steps.push(`$${v} = \\frac{${-b} + ${s}}{${2 * a}}$ or $${v} = \\frac{${-b} - ${s}}{${2 * a}}$`);
      steps.push(roots.map((r) => `$${v} = ${r}$`).join(' or '));
    } else {
      const { out: s, inside } = simplifySqrt(Math.abs(D));
      if (D < 0 || s > 1) {
        const coef = s === 1 ? '' : String(s);
        const rad = D < 0 ? (inside === 1 ? `${coef}i` : `${coef}i\\sqrt{${inside}}`) : `${coef}\\sqrt{${inside}}`;
        steps.push(`$${v} = \\frac{${-b} \\pm ${rad}}{${2 * a}}$`);
      }
      if (gcd(gcd(b, s), 2 * a) > 1) steps.push(`Simplify: $${v} = ${roots.join(',\\ ')}$`);
    }
    const answer = m(setTex(roots));

    // A non-real distractor would give the game away on a real-roots worksheet.
    const wrong = (negB: number, Dw: number, den: number) =>
      den === 0 || (Dw < 0 && D >= 0 && !complex) ? null : m(setTex(formatRoots(negB, Dw, den)));
    const distractors = distinctDistractors(
      answer,
      [wrong(b, D, 2 * a), a !== 1 ? wrong(-b, D, a) : null, a * c !== 0 ? wrong(-b, b * b + 4 * a * c, 2 * a) : null],
      (k) => wrong(-b + k, D, 2 * a),
    );

    return {
      question: m(question),
      answer,
      steps,
      distractors,
      check: { kind: 'quadratic', a, b, c, variable: v, rootKind: kind },
    };
  },
});
