/** Solving quadratic equations by taking square roots: v² = k, a·v² + c = d, a(v − h)² + c = d. */
import { Frac } from '../../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, opt, pickVar } from '../../../generator';
import { isPerfectSquare } from '../../../radical';
import type { Rng } from '../../../rng';
import { m, num, setTex, sum } from '../../../tex';
import type { Difficulty, ProblemContent } from '../../../types';
import { formatRoots } from '../quadratic-formula';
import { CATEGORY_QUAD, shiftTex, sqrtFracTex, type Cx } from './common';

type Form = 'v2=K' | 'av2=c' | 'v2+c=d' | 'av2+c=d' | 'shift' | 'a-shift';

const FORMS: Record<Difficulty, Form[]> = {
  easy: ['v2=K', 'av2=c', 'v2+c=d'],
  medium: ['av2+c=d', 'shift', 'av2=c', 'v2+c=d'],
  hard: ['a-shift', 'av2+c=d', 'shift', 'a-shift'],
};

interface Built {
  form: Form;
  a: number;
  h: number;
  c: number;
  /** a·(v − h)² = N */
  N: number;
  K: Frac;
}

function build(rng: Rng, d: Difficulty, complex: boolean): Built {
  const form = rng.pick(FORMS[d]);
  const wantComplex = complex && rng.bool(0.3);
  return attempt('square-roots', () => {
    const hasA = form === 'av2=c' || form === 'av2+c=d' || form === 'a-shift';
    const hasC = form === 'v2+c=d' || form === 'av2+c=d' || (form === 'a-shift' && rng.bool(0.85));
    const hasH = form === 'shift' || form === 'a-shift';
    const a = hasA ? rng.int(2, d === 'hard' ? 9 : 6) * (d === 'hard' && rng.bool(0.25) ? -1 : 1) : 1;
    const h = hasH ? rng.signedInt(1, d === 'hard' ? 9 : 7, true) : 0;
    const c = hasC ? rng.signedInt(1, d === 'easy' ? 20 : 30, true) : 0;
    let N: number;
    if (d === 'hard' && !wantComplex) {
      N = a * rng.int(1, 12) + (rng.bool(0.7) ? rng.int(-3, 3) : 0);
      if (N <= 0) return null;
    } else if (d === 'medium' && hasA && rng.bool(0.5)) {
      // a = q²·t-style: K = (n/q)², N = a·K must be an integer
      const r = new Frac(rng.int(1, 9), rng.pick([2, 3]));
      N = r.mul(r).mul(a).value;
      if (!Number.isInteger(N)) return null;
    } else {
      N = a * rng.int(1, d === 'easy' ? 12 : 10) ** 2;
    }
    if (wantComplex) N = -Math.abs(N);
    const K = new Frac(N, a);
    const square = isPerfectSquare(Math.abs(K.n)) && isPerfectSquare(K.d);
    if (d !== 'hard' && !square) return null;
    if (d === 'hard' && !wantComplex && square && rng.bool(0.8)) return null;
    if (Math.abs(N) > 300 || Math.abs(N + c) > 400) return null;
    return { form, a, h, c, N, K };
  });
}

/** The roots h ± √K, simplified. */
function roots(h: number, K: Frac): string[] {
  return formatRoots(h * K.d, K.n * K.d, K.d);
}

function values(h: number, K: Frac): Cx[] {
  const s = Math.sqrt(Math.abs(K.value));
  if (K.isZero()) return [{ re: h, im: 0 }];
  return K.sign > 0 ? [{ re: h + s, im: 0 }, { re: h - s, im: 0 }] : [{ re: h, im: s }, { re: h, im: -s }];
}

export const squareRootSolving = defineTopic({
  id: 'alg2.quad.square-roots',
  subject: 'algebra2',
  category: CATEGORY_QUAD,
  title: 'Solving Equations by Taking Square Roots',
  description: 'Isolate the square, then take square roots: x² = k, ax² + c = d, a(x − h)² + c = d.',
  instruction: (o) => (o.complex ? 'Solve each equation by taking square roots. Include non-real solutions.' : 'Solve each equation by taking square roots.'),
  multipleChoice: true,
  defaultCount: 10,
  options: [{ type: 'boolean', id: 'complex', label: 'Include complex (non-real) solutions', default: false }, opt.variedVariables(true)],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const complex = boolOpt(ctx, 'complex');
    const v = pickVar(rng, boolOpt(ctx, 'variedVars'));
    const { a, h, c, N, K } = build(rng, difficulty, complex);
    const hF = new Frac(h);
    const sq = h === 0 ? `${v}^{2}` : `${shiftTex(v, hF)}^{2}`;
    const lead = a === 1 ? '' : a === -1 ? '-' : String(a);
    const lhs = `${lead}${sq}${c === 0 ? '' : ` ${c > 0 ? '+' : '-'} ${Math.abs(c)}`}`;
    const d = N + c;
    const question = difficulty === 'hard' && rng.bool(0.3) ? `${d} = ${lhs}` : `${lhs} = ${d}`;

    const steps: string[] = [];
    if (c !== 0) steps.push(`${c > 0 ? 'Subtract' : 'Add'} $${Math.abs(c)}$ ${c > 0 ? 'from' : 'to'} both sides: $${lead}${sq} = ${N}$`);
    if (a !== 1) steps.push(`Divide both sides by $${a}$: $${sq} = ${num(K)}$`);
    const inner = h === 0 ? v : sum([{ coef: 1, sym: v }, { coef: -h }]);
    steps.push(`Take the square root of both sides: $${inner} = \\pm\\sqrt{${num(K)}}$`);
    const mag = sqrtFracTex(K);
    if (mag !== `\\sqrt{${num(K)}}`) steps.push(`Simplify: $${inner} = \\pm ${mag}$`);
    if (h !== 0) steps.push(`${h > 0 ? 'Add' : 'Subtract'} $${Math.abs(h)}$: $${v} = ${h} \\pm ${mag}$`);
    const rs = roots(h, K);
    const answer = m(setTex(rs));

    const wrong = (hh: number, KK: Frac | null) => (KK === null || KK.isZero() || (KK.sign < 0 && K.sign > 0 && !complex) ? null : m(setTex(roots(hh, KK))));
    const distractors = distinctDistractors(
      answer,
      [
        rs.length === 2 ? m(setTex([rs[0]!])) : null,
        h !== 0 ? wrong(-h, K) : wrong(h, K.neg()),
        a !== 1 ? wrong(h, new Frac(N)) : null,
        c !== 0 ? wrong(h, new Frac(N + 2 * c, a)) : null,
      ],
      (k) => wrong(h, K.add(k)),
    );
    return {
      question: m(question),
      answer,
      steps,
      distractors,
      check: { kind: 'roots', variable: v, solutions: values(h, K) },
    };
  },
});
