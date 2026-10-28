/** Trig equations with multiple and half angles (sin 2x, cos(x/2), tan 3x) and double-angle substitutions, on [0, 2π). */
import { Frac } from '../../fraction';
import { attempt, defineTopic, distinctDistractors, strOpt } from '../../generator';
import type { Rng } from '../../rng';
import { m, sum } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { piTex } from './exact';

type F = 'sin' | 'cos' | 'tan';
type Unit = 'deg' | 'rad';
const FN: Record<F, (x: number) => number> = { sin: Math.sin, cos: Math.cos, tan: Math.tan };
const rad = (d: number) => (d * Math.PI) / 180;

/** fn(k·x) = v. */
interface Atom {
  fn: F;
  k: Frac;
  v: number;
}

/** Solutions in [0°, 360°) as exact fractions of a degree. */
function solveAtom(a: Atom): Frac[] {
  const out: Frac[] = [];
  for (let t = 0; t < 360; t += 15) {
    if (a.fn === 'tan' && t % 180 === 90) continue;
    if (Math.abs(FN[a.fn](rad(t)) - a.v) > 1e-9) continue;
    for (let j = -10; j <= 20; j++) {
      const x = new Frac(t + 360 * j).div(a.k);
      if (x.sign >= 0 && x.cmp(360) < 0) out.push(x);
    }
  }
  return out;
}

function solveAll(atoms: Atom[]): Frac[] {
  const all = atoms.flatMap(solveAtom);
  return all.filter((x, i) => all.findIndex((y) => y.eq(x)) === i).sort((p, q) => p.cmp(q));
}

const angle = (x: Frac, unit: Unit) => (unit === 'deg' ? `${x.value}^\\circ` : piTex(x.div(180)));
const answerTex = (sols: Frac[], unit: Unit) => (sols.length === 0 ? 'No solution' : m(`x = ${sols.map((x) => angle(x, unit)).join(', ')}`));

/** `2x`, `x`, `\frac{x}{2}`. */
const kxTex = (k: Frac) => (k.eq(1) ? 'x' : k.d === 1 ? `${k.n}x` : `\\frac{x}{${k.d}}`);
const fx = (fn: F, k: Frac, pow = 1) => `\\${fn}${pow === 2 ? '^{2}' : ''} ${kxTex(k)}`;

interface Spec {
  sign: number;
  n: number;
  q: number;
  d: number;
}
const sv = (sign: number, n: number, q: number, d: number): Spec => ({ sign, n, q, d });
const VALUES: Record<F, Spec[]> = {
  sin: [sv(1, 1, 1, 2), sv(-1, 1, 1, 2), sv(1, 1, 2, 2), sv(-1, 1, 2, 2), sv(1, 1, 3, 2), sv(-1, 1, 3, 2), sv(1, 1, 1, 1), sv(-1, 1, 1, 1), sv(1, 0, 1, 1)],
  cos: [sv(1, 1, 1, 2), sv(-1, 1, 1, 2), sv(1, 1, 2, 2), sv(-1, 1, 2, 2), sv(1, 1, 3, 2), sv(-1, 1, 3, 2), sv(1, 1, 1, 1), sv(-1, 1, 1, 1), sv(1, 0, 1, 1)],
  tan: [sv(1, 1, 1, 1), sv(-1, 1, 1, 1), sv(1, 1, 3, 1), sv(-1, 1, 3, 1), sv(1, 1, 3, 3), sv(-1, 1, 3, 3), sv(1, 0, 1, 1)],
};
const val = (s: Spec) => (s.sign * s.n * Math.sqrt(s.q)) / s.d;
const radTex = (n: number, q: number) => (q === 1 ? String(n) : `${n === 1 ? '' : n}\\sqrt{${q}}`);
const specTex = (s: Spec) => (s.n === 0 ? '0' : `${s.sign < 0 ? '-' : ''}${s.d === 1 ? radTex(s.n, s.q) : `\\frac{${radTex(s.n, s.q)}}{${s.d}}`}`);

interface Eq {
  tex: string;
  atoms: Atom[];
  steps: string[];
}

const K: Record<Difficulty, Frac[]> = {
  easy: [new Frac(2), new Frac(1, 2)],
  medium: [new Frac(2), new Frac(3), new Frac(1, 2)],
  hard: [new Frac(3), new Frac(4), new Frac(1, 2), new Frac(1, 3), new Frac(2)],
};

function linearEq(rng: Rng, d: Difficulty): Eq {
  return attempt('multiple-angle linear', () => {
    const fn = rng.pick<F>(d === 'easy' ? ['sin', 'cos'] : ['sin', 'cos', 'tan']);
    const k = rng.pick(K[d]);
    const s = rng.pick(VALUES[fn]);
    // keep exact answers: x = (t + 360j)/k must be a multiple of half a degree in radians form — always true here
    const lhs = `${s.d === 1 ? '' : s.d}${fx(fn, k)}`;
    let tex: string;
    if (s.n === 0) tex = `${lhs} = 0`;
    else if (fn === 'tan' && s.q === 3 && s.d === 3) tex = `\\sqrt{3}${fx(fn, k)} ${s.sign > 0 ? '-' : '+'} 1 = 0`;
    else tex = rng.bool() ? `${lhs} ${s.sign > 0 ? '-' : '+'} ${radTex(s.n, s.q)} = 0` : `${lhs} = ${s.sign < 0 ? '-' : ''}${radTex(s.n, s.q)}`;
    return { tex, atoms: [{ fn, k, v: val(s) }], steps: [m(`${fx(fn, k)} = ${specTex(s)}`)] };
  });
}

function squaredEq(rng: Rng, d: Difficulty): Eq {
  const fn = rng.pick<F>(['sin', 'cos', 'tan']);
  const k = rng.pick(d === 'easy' ? [...K.easy, new Frac(3)] : K[d]);
  const opts: Array<[number, number]> = fn === 'tan' ? [[1, 3], [3, 1], [1, 1]] : [[4, 1], [2, 1], [4, 3]];
  const [dd, nn] = rng.pick(opts);
  const v = Math.sqrt(nn / dd);
  const tex = `${sum([{ coef: dd, sym: fx(fn, k, 2) }, { coef: -nn }])} = 0`;
  return {
    tex,
    atoms: [
      { fn, k, v },
      { fn, k, v: -v },
    ],
    steps: [m(`${fx(fn, k, 2)} = ${new Frac(nn, dd).toTex()}`), m(`${fx(fn, k)} = \\pm\\sqrt{${new Frac(nn, dd).toTex()}}`)],
  };
}

const ONE = new Frac(1);
const at = (fn: F, v: number): Atom => ({ fn, k: ONE, v });

/** Double-angle substitutions: [equation, rewritten, atoms]. */
const IDENTITY_EQS: Array<[string, string, Atom[]]> = [
  ['\\sin 2x = \\sin x', '\\sin x(2\\cos x - 1) = 0', [at('sin', 0), at('cos', 0.5)]],
  ['\\sin 2x + \\sin x = 0', '\\sin x(2\\cos x + 1) = 0', [at('sin', 0), at('cos', -0.5)]],
  ['\\sin 2x = \\cos x', '\\cos x(2\\sin x - 1) = 0', [at('cos', 0), at('sin', 0.5)]],
  ['\\sin 2x + \\cos x = 0', '\\cos x(2\\sin x + 1) = 0', [at('cos', 0), at('sin', -0.5)]],
  ['\\sin 2x = \\sqrt{2}\\cos x', '\\cos x(2\\sin x - \\sqrt{2}) = 0', [at('cos', 0), at('sin', Math.SQRT1_2)]],
  ['\\sin 2x + \\sqrt{3}\\sin x = 0', '\\sin x(2\\cos x + \\sqrt{3}) = 0', [at('sin', 0), at('cos', -Math.sqrt(3) / 2)]],
  ['\\cos 2x = \\cos x', '(2\\cos x + 1)(\\cos x - 1) = 0', [at('cos', 1), at('cos', -0.5)]],
  ['\\cos 2x + \\cos x = 0', '(2\\cos x - 1)(\\cos x + 1) = 0', [at('cos', 0.5), at('cos', -1)]],
  ['\\cos 2x = \\sin x', '(2\\sin x - 1)(\\sin x + 1) = 0', [at('sin', 0.5), at('sin', -1)]],
  ['\\cos 2x + \\sin x = 0', '(2\\sin x + 1)(\\sin x - 1) = 0', [at('sin', 1), at('sin', -0.5)]],
  ['\\cos 2x + 3\\sin x - 2 = 0', '(2\\sin x - 1)(\\sin x - 1) = 0', [at('sin', 1), at('sin', 0.5)]],
  ['\\cos 2x - 3\\cos x + 2 = 0', '(2\\cos x - 1)(\\cos x - 1) = 0', [at('cos', 1), at('cos', 0.5)]],
  ['\\cos 2x + 3\\cos x + 2 = 0', '(2\\cos x + 1)(\\cos x + 1) = 0', [at('cos', -1), at('cos', -0.5)]],
  ['\\cos 2x + 5\\sin x - 3 = 0', '(2\\sin x - 1)(\\sin x - 2) = 0', [at('sin', 0.5), at('sin', 2)]],
  ['\\sin 2x - \\sin x = 0', '\\sin x(2\\cos x - 1) = 0', [at('sin', 0), at('cos', 0.5)]],
  ['\\sin 2x = -\\sin x', '\\sin x(2\\cos x + 1) = 0', [at('sin', 0), at('cos', -0.5)]],
  ['\\sin 2x - \\cos x = 0', '\\cos x(2\\sin x - 1) = 0', [at('cos', 0), at('sin', 0.5)]],
  ['\\sin 2x = -\\cos x', '\\cos x(2\\sin x + 1) = 0', [at('cos', 0), at('sin', -0.5)]],
  ['\\sin 2x = \\sqrt{3}\\cos x', '\\cos x(2\\sin x - \\sqrt{3}) = 0', [at('cos', 0), at('sin', Math.sqrt(3) / 2)]],
  ['\\sin 2x + \\sqrt{2}\\sin x = 0', '\\sin x(2\\cos x + \\sqrt{2}) = 0', [at('sin', 0), at('cos', -Math.SQRT1_2)]],
  ['\\cos 2x - \\cos x = 0', '(2\\cos x + 1)(\\cos x - 1) = 0', [at('cos', 1), at('cos', -0.5)]],
  ['\\cos 2x = -\\cos x', '(2\\cos x - 1)(\\cos x + 1) = 0', [at('cos', 0.5), at('cos', -1)]],
  ['\\cos 2x - \\sin x = 0', '(2\\sin x - 1)(\\sin x + 1) = 0', [at('sin', 0.5), at('sin', -1)]],
  ['\\cos 2x = -\\sin x', '(2\\sin x + 1)(\\sin x - 1) = 0', [at('sin', 1), at('sin', -0.5)]],
  ['\\cos 2x = 2 - 3\\sin x', '(2\\sin x - 1)(\\sin x - 1) = 0', [at('sin', 1), at('sin', 0.5)]],
  ['\\cos 2x = 3\\cos x - 2', '(2\\cos x - 1)(\\cos x - 1) = 0', [at('cos', 1), at('cos', 0.5)]],
  ['\\cos 2x = 1 - \\sin x', '\\sin x(2\\sin x - 1) = 0', [at('sin', 0), at('sin', 0.5)]],
  ['\\cos 2x = 1 + \\sin x', '\\sin x(2\\sin x + 1) = 0', [at('sin', 0), at('sin', -0.5)]],
];

function identityEq(rng: Rng): Eq {
  const [tex, factored, atoms] = rng.pick(IDENTITY_EQS);
  const usesCos2 = tex.startsWith('\\cos 2x');
  const sub = usesCos2 ? (factored.includes('\\sin') ? '\\cos 2x = 1 - 2\\sin^{2} x' : '\\cos 2x = 2\\cos^{2} x - 1') : '\\sin 2x = 2\\sin x\\cos x';
  return { tex, atoms, steps: [`Substitute ${m(sub)}.`, m(factored)] };
}

export const multipleAngleEquations = defineTopic({
  id: 'trig.identities.multiple-angle-equations',
  subject: 'trigonometry',
  title: 'Solving Trig Equations with Multiple Angles',
  description: 'Solve equations such as sin 2x = 1/2, cos(x/2) = √2/2, tan² 3x = 1 and sin 2x = cos x on one revolution.',
  category: 'Trigonometric Identities and Equations',
  instruction: (o) => (o.units === 'deg' ? 'Solve each equation for 0° ≤ x < 360°. List every solution.' : 'Solve each equation for 0 ≤ x < 2π. List every solution.'),
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
        { value: 'linear', label: 'One multiple angle, e.g. 2 sin 3x = 1' },
        { value: 'squared', label: 'Squared, e.g. 4 cos² 2x = 3' },
        { value: 'identity', label: 'Double-angle substitution, e.g. sin 2x = cos x' },
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
    const form = f === 'linear' || f === 'squared' || f === 'identity' ? f : difficulty === 'easy' ? 'linear' : difficulty === 'medium' ? rng.pick(['linear', 'squared', 'identity'] as const) : rng.pick(['linear', 'squared', 'identity', 'identity'] as const);
    const eq = form === 'linear' ? linearEq(rng, difficulty) : form === 'squared' ? squaredEq(rng, difficulty) : identityEq(rng);
    const sols = solveAll(eq.atoms);
    const answer = answerTex(sols, unit);
    const steps = [...eq.steps];
    for (const a of eq.atoms) {
      const s = solveAtom(a);
      if (s.length === 0) steps.push(`${m(`${fx(a.fn, a.k)} = ${new Frac(Math.round(a.v * 2), 2).toTex()}`)} has no solution.`);
      else if (!a.k.eq(1)) {
        const hi = a.k.mul(360);
        steps.push(`For ${m(`0 \\le ${kxTex(a.k)} < ${angle(hi, unit)}`)}: ${m(`${kxTex(a.k)} = ${s.map((x) => angle(x.mul(a.k), unit)).join(', ')}`)}, so ${answerTex(s, unit)}.`);
      } else steps.push(`${m(fx(a.fn, a.k))}: ${answerTex(s, unit)}`);
    }
    // common mistakes
    const noDivide = solveAll(eq.atoms.map((a) => ({ ...a, k: ONE })));
    const firstTurn = solveAll(eq.atoms.map((a) => ({ ...a, k: ONE }))).map((x) => x.div(eq.atoms[0]!.k)).filter((x) => x.cmp(360) < 0);
    const signFlip = solveAll(eq.atoms.map((a) => ({ ...a, v: -a.v })));
    const dropFactor = eq.atoms.length > 1 ? solveAll(eq.atoms.slice(1)) : solveAll(eq.atoms).slice(0, 1);
    const cands = [noDivide, firstTurn, signFlip, dropFactor].map((x) => answerTex(x, unit));
    return {
      question: m(eq.tex),
      answer,
      steps: [...steps, `Solutions: ${answer}`],
      distractors: distinctDistractors(answer, cands, (k) => answerTex(sols.length ? sols.map((x) => x.add(15 * k).sub(360 * Math.floor(x.add(15 * k).value / 360))).sort((p, q) => p.cmp(q)) : [new Frac(15 * k), new Frac(180 - 15 * k)], unit)),
      check: { kind: 'trigonometry.equation', units: unit },
    };
  },
});
