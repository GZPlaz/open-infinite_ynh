/** Solving trigonometric equations on [0, 2π) or [0°, 360°): linear, multiple-angle, factorable and quadratic types. */
import { Frac, gcdAll } from '../../fraction';
import { attempt, defineTopic, distinctDistractors, strOpt } from '../../generator';
import type { Rng } from '../../rng';
import { m, sum, type Term } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { degTex, piTex, radFrac } from './exact';

type F = 'sin' | 'cos' | 'tan';
type Unit = 'deg' | 'rad';

/** A special value n·√q / d with sign. */
interface Spec {
  sign: number;
  n: number;
  q: number;
  d: number;
}
const sv = (sign: number, n: number, q: number, d: number): Spec => ({ sign, n, q, d });
const specValue = (s: Spec) => (s.sign * s.n * Math.sqrt(s.q)) / s.d;

const VALUES: Record<F, Spec[]> = {
  sin: [sv(1, 1, 1, 2), sv(-1, 1, 1, 2), sv(1, 1, 2, 2), sv(-1, 1, 2, 2), sv(1, 1, 3, 2), sv(-1, 1, 3, 2), sv(1, 1, 1, 1), sv(-1, 1, 1, 1), sv(1, 0, 1, 1)],
  cos: [sv(1, 1, 1, 2), sv(-1, 1, 1, 2), sv(1, 1, 2, 2), sv(-1, 1, 2, 2), sv(1, 1, 3, 2), sv(-1, 1, 3, 2), sv(1, 1, 1, 1), sv(-1, 1, 1, 1), sv(1, 0, 1, 1)],
  tan: [sv(1, 1, 1, 1), sv(-1, 1, 1, 1), sv(1, 1, 3, 1), sv(-1, 1, 3, 1), sv(1, 1, 3, 3), sv(-1, 1, 3, 3), sv(1, 0, 1, 1)],
};

interface Atom {
  fn: F;
  k: number;
  v: number;
}

const FN: Record<F, (x: number) => number> = { sin: Math.sin, cos: Math.cos, tan: Math.tan };
const rad = (d: number) => (d * Math.PI) / 180;

/** Solutions in [0, 360) degrees of fn(k·x) = v (v special or out of range). */
function solveAtom(a: Atom): number[] {
  const base: number[] = [];
  for (let t = 0; t < 360; t += 15) {
    if (a.fn === 'tan' && t % 180 === 90) continue;
    if (Math.abs(FN[a.fn](rad(t)) - a.v) < 1e-9) base.push(t);
  }
  const out: number[] = [];
  for (const t of base) for (let j = 0; j < a.k; j++) out.push((t + 360 * j) / a.k);
  return out;
}

function solveAll(atoms: Atom[]): number[] {
  const set = new Set<number>();
  for (const a of atoms) for (const x of solveAtom(a)) set.add(Math.round(x * 1000) / 1000);
  return [...set].sort((x, y) => x - y);
}

const argTex = (k: number) => (k === 1 ? 'x' : `${k}x`);
const fx = (fn: F, k = 1, pow = 1) => `\\${fn}${pow === 2 ? '^{2}' : ''} ${argTex(k)}`;

/** Coefficient TeX for n√q ('' for 1). */
function coefTex(n: number, q: number): string {
  if (q === 1) return n === 1 ? '' : String(n);
  return `${n === 1 ? '' : n}\\sqrt{${q}}`;
}
const valueTex = (n: number, q: number) => (q === 1 ? String(n) : `${n === 1 ? '' : n}\\sqrt{${q}}`);

interface Eq {
  tex: string;
  atoms: Atom[];
  steps: string[];
}

/** d·fn(kx) = sign·n√q, written in one of several equivalent forms. */
function linearEq(rng: Rng, d: Difficulty, k: number, fns: F[]): Eq {
  const fn = rng.pick(fns);
  const none = d === 'hard' && fn !== 'tan' && rng.bool(0.15);
  const s = none ? sv(rng.sign(), rng.int(3, 5), 1, 2) : rng.pick(VALUES[fn]);
  const v = specValue(s);
  const lhs = `${coefTex(s.d, 1)}${fx(fn, k)}`;
  let tex: string;
  if (s.n === 0) tex = rng.bool() ? `${lhs} = 0` : `${rng.int(2, 5)}${fx(fn, k)} = 0`;
  else if (fn === 'tan' && s.q === 3 && s.d === 3) tex = `\\sqrt{3}${fx(fn, k)} ${s.sign > 0 ? '-' : '+'} 1 = 0`;
  else {
    const form = d === 'easy' ? rng.int(0, 1) : rng.int(0, 2);
    const r = valueTex(s.n, s.q);
    if (form === 0) tex = `${lhs} ${s.sign > 0 ? '-' : '+'} ${r} = 0`;
    else if (form === 1 || s.q !== 1) tex = `${lhs} = ${s.sign < 0 ? '-' : ''}${r}`;
    else {
      const e = rng.int(1, 9) * rng.sign();
      tex = `${sum([{ coef: s.d, sym: fx(fn, k) }, { coef: e }])} = ${e + s.sign * s.n}`;
    }
  }
  const vTex = s.n === 0 ? '0' : s.q === 1 ? new Frac(s.sign * s.n, s.d).toTex() : `${s.sign < 0 ? '-' : ''}${s.d === 1 ? valueTex(s.n, s.q) : `\\frac{${valueTex(s.n, s.q)}}{${s.d}}`}`;
  return { tex, atoms: [{ fn, k, v }], steps: [m(`${fx(fn, k)} = ${vTex}`)] };
}

function squaredEq(rng: Rng, fns: F[]): Eq {
  const fn = rng.pick(fns);
  const opts: Array<[number, number]> = fn === 'tan' ? [[1, 3], [3, 1], [1, 1]] : [[4, 1], [2, 1], [4, 3], [1, 1]];
  const [dd, nn] = rng.pick(opts); // dd·fn² = nn
  const v = Math.sqrt(nn / dd);
  const tex = rng.bool() ? `${sum([{ coef: dd, sym: fx(fn, 1, 2) }, { coef: -nn }])} = 0` : `${coefTex(dd, 1)}${fx(fn, 1, 2)} = ${nn}`;
  return { tex, atoms: [{ fn, k: 1, v }, { fn, k: 1, v: -v }], steps: [m(`${fx(fn, 1, 2)} = ${new Frac(nn, dd).toTex()}`), m(`${fx(fn)} = \\pm\\sqrt{${new Frac(nn, dd).toTex()}}`)] };
}

function factorEq(rng: Rng): Eq {
  const f1 = rng.pick<F>(['sin', 'cos']);
  const f2 = rng.pick<F>(['sin', 'cos']);
  const s = rng.pick(VALUES[f2].filter((x) => x.n !== 0 && x.d === 2));
  // f1·(2·f2 − sign·n√q) = 0
  const c = valueTex(s.n, s.q);
  const first = f1 === f2 ? `2${fx(f1, 1, 2)}` : `2${fx(f2)}${fx(f1)}`;
  const second = `${s.sign > 0 ? '-' : '+'} ${s.q === 1 ? '' : c}${fx(f1)}`;
  const tex = `${first} ${second} = 0`;
  const factored = `${fx(f1)}\\left(2${fx(f2)} ${s.sign > 0 ? '-' : '+'} ${c}\\right) = 0`;
  return {
    tex,
    atoms: [
      { fn: f1, k: 1, v: 0 },
      { fn: f2, k: 1, v: specValue(s) },
    ],
    steps: [m(factored), m(`${fx(f1)} = 0 \\text{ or } ${fx(f2)} = ${s.sign < 0 ? '-' : ''}\\frac{${c}}{2}`)],
  };
}

function quadraticEq(rng: Rng, d: Difficulty): Eq {
  return attempt('trig quadratic', () => {
    const fn = rng.pick<F>(['sin', 'cos']);
    const roots = [new Frac(1, 2), new Frac(-1, 2), new Frac(1), new Frac(-1), new Frac(0), new Frac(2), new Frac(-2), new Frac(3, 2)];
    const r1 = rng.pick(roots.slice(0, d === 'hard' ? 8 : 5));
    const r2 = rng.pick(roots.slice(0, 5));
    if (r1.eq(r2)) return null;
    // (r1.d·f − r1.n)(r2.d·f − r2.n)
    let A = r1.d * r2.d;
    let B = -(r1.d * r2.n + r2.d * r1.n);
    let C = r1.n * r2.n;
    const g = gcdAll([A, B, C]);
    [A, B, C] = [A / g, B / g, C / g];
    const pyth = d === 'hard' && rng.bool(0.5);
    let tex: string;
    const other: F = fn === 'sin' ? 'cos' : 'sin';
    const steps: string[] = [];
    if (pyth) {
      // A·f² = A(1 − g²): −A·g² + B·f + (A + C) = 0, made leading-positive
      const terms: Term[] = [
        { coef: A, sym: fx(other, 1, 2) },
        { coef: -B, sym: fx(fn) },
        { coef: -(A + C) },
      ];
      tex = `${sum(terms)} = 0`;
      steps.push(m(`${A === 1 ? '' : A}\\left(1 - ${fx(fn, 1, 2)}\\right) ${-B > 0 ? '+' : '-'} ${Math.abs(B) === 1 ? '' : Math.abs(B)}${fx(fn)} ${-(A + C) > 0 ? '+' : '-'} ${Math.abs(A + C)} = 0`.replace(/ [+-] 0 = 0$/, ' = 0')));
      if (B === 0) return null;
    } else {
      tex = `${sum([{ coef: A, sym: fx(fn, 1, 2) }, { coef: B, sym: fx(fn) }, { coef: C }])} = 0`;
    }
    const fac = (r: Frac) => (r.isZero() ? fx(fn) : `\\left(${sum([{ coef: r.d, sym: fx(fn) }, { coef: -r.n }])}\\right)`);
    steps.push(m(`${sum([{ coef: A, sym: fx(fn, 1, 2) }, { coef: B, sym: fx(fn) }, { coef: C }])} = 0`), m(`${fac(r1)}${fac(r2)} = 0`), m(`${fx(fn)} = ${r1.toTex()} \\text{ or } ${fx(fn)} = ${r2.toTex()}`));
    return {
      tex,
      atoms: [
        { fn, k: 1, v: r1.value },
        { fn, k: 1, v: r2.value },
      ],
      steps,
    };
  });
}

function answerTex(sols: number[], unit: Unit): string {
  if (sols.length === 0) return 'No solution';
  return m(`x = ${sols.map((x) => (unit === 'deg' ? degTex(x) : piTex(radFrac(x)))).join(', ')}`);
}

export const trigEquations = defineTopic({
  id: 'trig.identities.equations',
  subject: 'trigonometry',
  title: 'Solving Trigonometric Equations',
  description: 'Solve trig equations on one revolution: linear, multiple-angle, factorable and quadratic types.',
  category: 'Trigonometric Identities and Equations',
  instruction: (o) => (o.units === 'deg' ? 'Solve each equation for 0° ≤ x < 360°.' : 'Solve each equation for 0 ≤ x < 2π.'),
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'form',
      label: 'Equation type',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed (by difficulty)' },
        { value: 'linear', label: 'Linear in one function' },
        { value: 'multiple', label: 'Multiple angles (sin 2x, cos 3x)' },
        { value: 'factor', label: 'Factor out a common function' },
        { value: 'quadratic', label: 'Quadratic in sin or cos' },
      ],
    },
    {
      type: 'select',
      id: 'units',
      label: 'Interval',
      default: 'rad',
      choices: [
        { value: 'rad', label: '0 ≤ x < 2π (radians)' },
        { value: 'deg', label: '0° ≤ x < 360° (degrees)' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const unit: Unit = strOpt(ctx, 'units') === 'deg' ? 'deg' : 'rad';
    const f = strOpt(ctx, 'form');
    const form =
      f === 'linear' || f === 'multiple' || f === 'factor' || f === 'quadratic'
        ? f
        : difficulty === 'easy'
          ? 'linear'
          : difficulty === 'medium'
            ? rng.pick(['linear', 'multiple', 'factor', 'quadratic'] as const)
            : rng.pick(['multiple', 'factor', 'quadratic', 'quadratic'] as const);
    const fns: F[] = difficulty === 'easy' ? ['sin', 'cos'] : ['sin', 'cos', 'tan'];
    let eq: Eq;
    if (form === 'linear') eq = rng.bool(difficulty === 'easy' ? 0 : 0.3) ? squaredEq(rng, fns) : linearEq(rng, difficulty, 1, fns);
    else if (form === 'multiple') eq = linearEq(rng, difficulty === 'easy' ? 'medium' : difficulty, difficulty === 'hard' ? rng.pick([2, 3]) : 2, fns);
    else if (form === 'factor') eq = factorEq(rng);
    else eq = difficulty === 'easy' && rng.bool() ? squaredEq(rng, ['sin', 'cos']) : quadraticEq(rng, difficulty);

    const sols = solveAll(eq.atoms);
    const answer = answerTex(sols, unit);
    const steps = [...eq.steps];
    for (const a of eq.atoms) {
      const s = solveAtom(a);
      steps.push(
        s.length === 0
          ? `${m(`${fx(a.fn, a.k)} = ${new Frac(Math.round(a.v * 2), 2).toTex()}`)} has no solution.`
          : a.k > 1
            ? `${m(`${argTex(a.k)} = ${s.map((x) => (unit === 'deg' ? degTex(x * a.k) : piTex(radFrac(x * a.k)))).join(', ')}`)}, so divide by ${m(String(a.k))}.`
            : `${m(fx(a.fn, a.k))}: ${answerTex(s, unit)}`,
      );
    }
    steps.push(`Solutions: ${answer}`);
    const principal = solveAll(eq.atoms.map((a) => ({ ...a }))).filter((_x, i, arr) => i === 0 || arr.length === 1);
    const signFlip = solveAll(eq.atoms.map((a) => ({ ...a, v: -a.v })));
    const cofn = solveAll(eq.atoms.map((a) => (a.fn === 'tan' ? { ...a, v: a.v === 0 ? 0 : 1 / a.v } : { ...a, fn: a.fn === 'sin' ? ('cos' as F) : ('sin' as F) })));
    const noDivide = solveAll(eq.atoms.map((a) => ({ ...a, k: 1 })));
    const firstTurn = eq.atoms.flatMap((a) => solveAtom({ ...a, k: 1 }).map((t) => t / a.k));
    const cands = [answerTex(principal, unit), answerTex(signFlip, unit), answerTex(cofn, unit), answerTex(noDivide, unit), answerTex([...new Set(firstTurn)].sort((x, y) => x - y), unit)];
    return {
      question: m(eq.tex),
      answer,
      steps,
      distractors: distinctDistractors(answer, cands, (k) => answerTex(sols.length ? sols.map((x) => (x + 15 * k) % 360).sort((x, y) => x - y) : [15 * k, 180 - 15 * k].sort((x, y) => x - y), unit)),
      check: { kind: 'trigonometry.equation', units: unit },
    };
  },
});
