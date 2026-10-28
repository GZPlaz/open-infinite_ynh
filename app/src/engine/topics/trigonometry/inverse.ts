/** Inverse trigonometric functions: evaluating them and composing them with trig functions. */
import { Frac } from '../../fraction';
import { attempt, defineTopic, distinctDistractors, strOpt } from '../../generator';
import type { Rng } from '../../rng';
import { decimal, m } from '../../tex';
import type { GeneratorContext, ProblemContent, SelectOptionDef } from '../../types';
import { angleTex, Exact, FN_VALUE, trigExact, type AngleUnit, type TrigFn } from './exact';
import { triples } from '../geometry/common';

const CATEGORY = 'Inverse Trigonometric Functions';
type Inv = 'sin' | 'cos' | 'tan';

const notationOpt: SelectOptionDef = {
  type: 'select',
  id: 'notation',
  label: 'Notation',
  default: 'inverse',
  choices: [
    { value: 'inverse', label: 'sin⁻¹ x' },
    { value: 'arc', label: 'arcsin x' },
    { value: 'mixed', label: 'Both' },
  ],
};

const unitOpt: SelectOptionDef = {
  type: 'select',
  id: 'units',
  label: 'Answer in',
  default: 'rad',
  choices: [
    { value: 'rad', label: 'Radians' },
    { value: 'deg', label: 'Degrees' },
  ],
};

function invName(ctx: GeneratorContext, fn: Inv): string {
  const n = strOpt(ctx, 'notation');
  const arc = n === 'arc' || (n === 'mixed' && ctx.rng.bool());
  return arc ? `\\arc${fn}` : `\\${fn}^{-1}`;
}

const wrap = (t: string) => (/^[\d.]+$/.test(t) ? `(${t})` : `\\left(${t}\\right)`);

/** Principal value (degrees) of the inverse at a special value, or null when none of the special angles fits. */
function principal(fn: Inv, v: number): number | null {
  const range = fn === 'sin' ? [-90, 90] : fn === 'cos' ? [0, 180] : [-75, 75];
  for (let d = range[0]!; d <= range[1]!; d += 15) {
    if (fn === 'tan' && Math.abs(d) === 90) continue;
    if (Math.abs(FN_VALUE[fn]((d * Math.PI) / 180) - v) < 1e-9) return d;
  }
  return null;
}

const SPECIAL_ARGS: Record<Inv, Exact[]> = {
  sin: [Exact.ZERO, Exact.of(new Frac(1, 2)), Exact.of(new Frac(1, 2), 2), Exact.of(new Frac(1, 2), 3), Exact.ONE],
  cos: [Exact.ZERO, Exact.of(new Frac(1, 2)), Exact.of(new Frac(1, 2), 2), Exact.of(new Frac(1, 2), 3), Exact.ONE],
  tan: [Exact.ZERO, Exact.ONE, Exact.of(1, 3), Exact.of(new Frac(1, 3), 3)],
};

const UNDEFINED_ARGS = ['2', '-2', '\\frac{3}{2}', '-\\frac{3}{2}', '\\sqrt{2}', '-\\sqrt{3}', '\\frac{5}{4}', '\\pi'];

export const inverseEvaluate = defineTopic({
  id: 'trig.inverse.evaluate',
  subject: 'trigonometry',
  title: 'Evaluating Inverse Trig Functions',
  description: 'Exact values of inverse sine, cosine and tangent in their principal ranges, calculator values, and undefined cases.',
  category: CATEGORY,
  instruction: (o) =>
    `Find the value of each expression${o.units === 'deg' ? ' in degrees' : ' in radians'}. Round decimal answers to the nearest ${o.units === 'deg' ? 'tenth' : 'hundredth'}. Write "Undefined" when there is no value.`,
  multipleChoice: true,
  defaultCount: 12,
  options: [notationOpt, unitOpt],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const unit: AngleUnit = strOpt(ctx, 'units') === 'deg' ? 'deg' : 'rad';
    const fn = rng.pick<Inv>(['sin', 'cos', 'tan']);
    const name = invName(ctx, fn);
    const A = (d: number) => angleTex(d, unit);
    const kind = difficulty === 'easy' ? 'exact' : rng.weighted<'exact' | 'undef' | 'calc'>(fn === 'tan' ? [['exact', 0.7], ['calc', difficulty === 'hard' ? 0.3 : 0]] : [['exact', 0.65], ['undef', 0.15], ['calc', difficulty === 'hard' ? 0.3 : 0]]);
    const range = fn === 'sin' ? `[${A(-90)}, ${A(90)}]` : fn === 'cos' ? `[${A(0)}, ${A(180)}]` : `(${A(-90)}, ${A(90)})`;

    if (kind === 'undef') {
      const arg = rng.pick(UNDEFINED_ARGS);
      const answer = 'Undefined';
      return {
        question: m(`${name}${wrap(arg)}`),
        answer,
        steps: [`The ${fn === 'sin' ? 'sine' : 'cosine'} of an angle is always between ${m('-1')} and ${m('1')}, and ${m(arg)} is not, so there is no value.`],
        distractors: distinctDistractors(answer, [m(A(fn === 'sin' ? 90 : 0)), m(A(fn === 'sin' ? -90 : 180)), m(A(60))], (k) => m(A(15 * k))),
        check: { kind: 'trigonometry.inverse' },
      };
    }

    if (kind === 'calc') {
      const v = fn === 'tan' ? rng.signedInt(5, 60, true) / 10 : rng.signedInt(5, 95, true) / 100;
      const inv = fn === 'sin' ? Math.asin(v) : fn === 'cos' ? Math.acos(v) : Math.atan(v);
      const fmtV = (r: number) => (unit === 'deg' ? m(`\\approx ${decimal((r * 180) / Math.PI)}^\\circ`) : m(`\\approx ${decimal(r, 2)}`));
      const answer = fmtV(inv);
      const other = fn === 'sin' ? Math.acos(Math.abs(v)) : fn === 'cos' ? Math.asin(Math.abs(v)) : Math.atan(1 / v);
      return {
        question: m(`${name}(${v})`),
        answer,
        steps: [`Use a calculator in ${unit === 'deg' ? 'degree' : 'radian'} mode; the result lies in ${m(range)}: ${answer}.`],
        distractors: distinctDistractors(answer, [fmtV(-inv), fmtV(other), fmtV(Math.PI - inv), fmtV(1 / (fn === 'sin' ? Math.sin(v) : fn === 'cos' ? Math.cos(v) : Math.tan(v)))], (k) => fmtV(inv + k * 0.13)),
        check: { kind: 'trigonometry.inverse' },
      };
    }

    const base = rng.pick(SPECIAL_ARGS[fn]);
    const arg = rng.bool(fn === 'cos' ? 0.5 : 0.45) && !base.isZero() ? base.neg() : base;
    const deg = principal(fn, arg.value)!;
    const answer = m(A(deg));
    const same = fn === 'sin' ? [180 - deg, deg + 360] : fn === 'cos' ? [-deg, 360 - deg] : [deg + 180, deg - 180];
    const other = fn === 'sin' ? principal('cos', arg.value) : fn === 'cos' ? principal('sin', arg.value) : null;
    return {
      question: m(`${name}${wrap(arg.toTex())}`),
      answer,
      steps: [`Find the angle in ${m(range)} whose ${fn === 'sin' ? 'sine' : fn === 'cos' ? 'cosine' : 'tangent'} is ${m(arg.toTex())}: ${m(`\\${fn} ${A(deg)} = ${arg.toTex()}`)}.`],
      distractors: distinctDistractors(answer, [...same.map((x) => m(A(x))), other === null ? null : m(A(other)), m(A(-deg))], (k) => m(A(deg + 15 * k))),
      check: { kind: 'trigonometry.inverse' },
    };
  },
});

// ---------------------------------------------------------------- compositions

/** sin and cos of θ = inv(v) in the principal range, exactly. */
function principalSinCos(inv: Inv, num: number, den: number): { s: Exact; c: Exact } {
  if (inv === 'tan') {
    const r = Exact.of(1, num * num + den * den);
    return { s: Exact.of(num).div(r), c: Exact.of(den).div(r) };
  }
  const v = Exact.of(new Frac(num, den));
  const other = Exact.of(new Frac(1, den), den * den - num * num);
  return inv === 'sin' ? { s: v, c: other } : { s: other, c: v };
}

function outerValue(fn: TrigFn, s: Exact, c: Exact): Exact | null {
  const q = (a: Exact, b: Exact) => (b.isZero() ? null : a.div(b));
  return fn === 'sin' ? s : fn === 'cos' ? c : fn === 'tan' ? q(s, c) : fn === 'cot' ? q(c, s) : fn === 'sec' ? q(Exact.ONE, c) : q(Exact.ONE, s);
}

const SPECIAL_DEG = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330];

/** Algebraic compositions u ↦ outer(inv(u)) with u = x, x/k or kx. */
interface Alg {
  outer: TrigFn;
  inv: Inv;
  tex: string;
  f: (x: number) => number;
}

function algebraic(rng: Rng): { q: string; answer: Alg; cands: Alg[]; argTex: string; inv: Inv; k: number } {
  const inv = rng.pick<Inv>(['sin', 'cos', 'tan']);
  const k = rng.pick([1, 1, 2, 3]);
  // u = x/k for sin/cos (|u| < 1 on the sample points), u = kx for tan
  const argTex = k === 1 ? 'x' : inv === 'tan' ? `${k}x` : `\\frac{x}{${k}}`;
  const k2 = k * k;
  // radicand (as TeX) and its value: sin/cos → k² − x² over k ; tan → k²x² + 1
  const Rtex = inv === 'tan' ? (k === 1 ? 'x^{2} + 1' : `${k2}x^{2} + 1`) : k === 1 ? '1 - x^{2}' : `${k2} - x^{2}`;
  const R = (x: number) => (inv === 'tan' ? k2 * x * x + 1 : k2 - x * x);
  const D = inv === 'tan' ? 1 : k; // √(1 − u²) = √R / D ; √(1 + u²) = √R
  const u = (x: number) => (inv === 'tan' ? k * x : x / k);
  const uTex = inv === 'tan' ? (k === 1 ? 'x' : `${k}x`) : 'x';
  const frac = (n: string, d: string) => (d === '1' ? n : `\\frac{${n}}{${d}}`);
  const sq = `\\sqrt{${Rtex}}`;
  // the "other" side: adj for sin/tan, opp for cos — sin θ, cos θ as functions
  const S = (x: number) => (inv === 'sin' ? u(x) : inv === 'cos' ? Math.sqrt(R(x)) / D : u(x) / Math.sqrt(R(x)));
  const C = (x: number) => (inv === 'sin' ? Math.sqrt(R(x)) / D : inv === 'cos' ? u(x) : 1 / Math.sqrt(R(x)));
  // TeX of sin θ, cos θ in simplest (rationalized) form
  const sTex = inv === 'sin' ? (k === 1 ? 'x' : `\\frac{x}{${k}}`) : inv === 'cos' ? frac(sq, String(D)) : frac(`${uTex}${sq}`, `${Rtex}`);
  const cTex = inv === 'sin' ? frac(sq, String(D)) : inv === 'cos' ? (k === 1 ? 'x' : `\\frac{x}{${k}}`) : frac(sq, Rtex);
  // tan = S/C etc., rationalized by hand
  const tTex = inv === 'sin' ? frac(`x${sq}`, Rtex) : inv === 'cos' ? frac(sq, 'x') : uTex;
  const cotTex = inv === 'sin' ? frac(sq, 'x') : inv === 'cos' ? frac(`x${sq}`, Rtex) : k === 1 ? '\\frac{1}{x}' : `\\frac{1}{${k}x}`;
  const secTex = inv === 'sin' ? frac(`${D === 1 ? '' : D}${sq}`, Rtex) : inv === 'cos' ? frac(String(k), 'x') : sq;
  const cscTex = inv === 'sin' ? frac(String(k), 'x') : inv === 'cos' ? frac(`${D === 1 ? '' : D}${sq}`, Rtex) : frac(sq, uTex);
  const all: Alg[] = [
    { outer: 'sin', inv, tex: sTex, f: S },
    { outer: 'cos', inv, tex: cTex, f: C },
    { outer: 'tan', inv, tex: tTex, f: (x) => S(x) / C(x) },
    { outer: 'cot', inv, tex: cotTex, f: (x) => C(x) / S(x) },
    { outer: 'sec', inv, tex: secTex, f: (x) => 1 / C(x) },
    { outer: 'csc', inv, tex: cscTex, f: (x) => 1 / S(x) },
  ];
  // the trivial ones (sin∘arcsin etc.) are not asked
  const askable = all.filter((a) => !(a.outer === inv) && !(inv === 'sin' && a.outer === 'csc') && !(inv === 'cos' && a.outer === 'sec') && !(inv === 'tan' && a.outer === 'cot'));
  const answer = rng.pick(askable);
  const q = `\\${answer.outer}\\left(\\${inv}^{-1}${argTex === 'x' ? ' x' : `\\left(${argTex}\\right)`}\\right)`;
  // wrong forms: the other functions of the same angle, and the reciprocal-radicand mix-up
  const flip: Alg = { outer: answer.outer, inv, tex: answer.tex.includes('\\sqrt') ? answer.tex.replace(/\\sqrt\{([^{}]*)\}/, (_s, r: string) => `\\sqrt{${r.includes(' - ') ? r.replace(' - ', ' + ') : r.replace(' + ', ' - ')}}`) : `\\sqrt{${Rtex}}`, f: () => NaN };
  return { q, answer, cands: [...all.filter((a) => a !== answer), flip], argTex, inv, k };
}

export const inverseCompositions = defineTopic({
  id: 'trig.inverse.compositions',
  subject: 'trigonometry',
  title: 'Compositions of Trig and Inverse Trig Functions',
  description: 'Evaluate expressions such as sin(cos⁻¹(3/5)) and sin⁻¹(sin(5π/6)), and write cos(tan⁻¹ x) algebraically.',
  category: CATEGORY,
  instruction: (o) => (o.task === 'algebraic' ? 'Write each expression as an algebraic expression in x.' : 'Find the exact value of each expression.'),
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Type',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed (by difficulty)' },
        { value: 'trigOfInverse', label: 'Trig of an inverse, e.g. sin(cos⁻¹ 3/5)' },
        { value: 'inverseOfTrig', label: 'Inverse of a trig value, e.g. sin⁻¹(sin 5π/6)' },
        { value: 'algebraic', label: 'Algebraic forms, e.g. cos(tan⁻¹ x)' },
      ],
    },
    unitOpt,
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const t = strOpt(ctx, 'task');
    const task = t === 'trigOfInverse' || t === 'inverseOfTrig' || t === 'algebraic' ? t : difficulty === 'hard' ? rng.pick(['trigOfInverse', 'inverseOfTrig', 'algebraic'] as const) : rng.pick(['trigOfInverse', 'inverseOfTrig'] as const);
    const unit: AngleUnit = strOpt(ctx, 'units') === 'deg' ? 'deg' : 'rad';

    if (task === 'algebraic') {
      const { q, answer, cands } = algebraic(rng);
      const ans = m(answer.tex);
      return {
        question: m(q),
        answer: ans,
        steps: [
          `Let ${m(`\\theta = ${q.slice(q.indexOf('\\left(') + 6, q.lastIndexOf('\\right)'))}`)}; draw a right triangle with the matching sides.`,
          m(`\\${answer.outer} \\theta = ${answer.tex}`),
        ],
        distractors: distinctDistractors(ans, cands.map((c) => m(c.tex)), (k) => m(`${k + 1}${answer.tex.startsWith('\\frac') ? `\\left(${answer.tex}\\right)` : answer.tex}`)),
        check: { kind: 'trigonometry.composition', algebraic: true },
      };
    }

    if (task === 'inverseOfTrig') {
      const inv = rng.pick<Inv>(['sin', 'cos', 'tan']);
      const deg = attempt('angle', () => {
        const a = rng.pick(SPECIAL_DEG) + (difficulty === 'hard' ? 360 * rng.pick([-1, 0, 1]) : difficulty === 'medium' ? 360 * rng.pick([-1, 0]) : 0);
        if (inv === 'tan' && a % 180 === 90) return null;
        return a;
      });
      const v = trigExact(inv, deg)!;
      const p = principal(inv, v.value)!;
      const A = (d: number) => angleTex(d, unit);
      const answer = m(A(p));
      const q = `\\${inv}^{-1}\\left(${inv === 'sin' ? '\\sin' : inv === 'cos' ? '\\cos' : '\\tan'} ${deg < 0 ? `\\left(${A(deg)}\\right)` : A(deg)}\\right)`;
      return {
        question: m(q),
        answer,
        steps: [m(`\\${inv} ${deg < 0 ? `\\left(${A(deg)}\\right)` : A(deg)} = ${v.toTex()}`), `The angle in the principal range with that ${inv === 'sin' ? 'sine' : inv === 'cos' ? 'cosine' : 'tangent'} is ${answer}.`],
        distractors: distinctDistractors(answer, [m(A(deg)), m(A(-p)), m(A(180 - p)), m(A(p + 180))], (k) => m(A(p + 15 * k))),
        check: { kind: 'trigonometry.composition' },
      };
    }

    // trig of an inverse at a ratio
    const inv = rng.pick<Inv>(['sin', 'cos', 'tan']);
    const outer = rng.pick<TrigFn>((difficulty === 'easy' ? ['sin', 'cos', 'tan'] : ['sin', 'cos', 'tan', 'csc', 'sec', 'cot']).filter((f) => f !== inv) as TrigFn[]);
    const { num, den } = attempt('ratio', () => {
      if (difficulty === 'hard' && rng.bool(0.5)) {
        const d = rng.int(3, 9);
        const n = rng.int(1, inv === 'tan' ? 9 : d - 1);
        return new Frac(n, d).d === d || inv === 'tan' ? { num: n * (rng.bool() ? 1 : -1), den: d } : null;
      }
      const [a, b, c] = rng.pick(triples(41).filter(([, , z]) => z <= (difficulty === 'easy' ? 13 : 41)));
      const sgn = difficulty === 'easy' ? 1 : rng.sign();
      return inv === 'tan' ? { num: sgn * a, den: b } : { num: sgn * a, den: c };
    });
    const f = new Frac(num, den);
    const { s, c } = principalSinCos(inv, f.n, f.d);
    const v = outerValue(outer, s, c);
    if (!v) throw new Error('composition: undefined value');
    const answer = m(v.toTex());
    const q = `\\${outer}\\left(\\${inv}^{-1}\\left(${f.toTex()}\\right)\\right)`;
    const rec = outerValue(outer === 'sin' ? 'csc' : outer === 'cos' ? 'sec' : outer === 'tan' ? 'cot' : outer === 'csc' ? 'sin' : outer === 'sec' ? 'cos' : 'tan', s, c);
    const swapped = outerValue(outer, c, s);
    return {
      question: m(q),
      answer,
      steps: [
        `Let ${m(`\\theta = \\${inv}^{-1}\\left(${f.toTex()}\\right)`)}, so ${m(`\\${inv} \\theta = ${f.toTex()}`)} with ${m('\\theta')} in the principal range.`,
        m(`\\sin \\theta = ${s.toTex()}, \\; \\cos \\theta = ${c.toTex()}`),
        m(`\\${outer} \\theta = ${v.toTex()}`),
      ],
      distractors: distinctDistractors(answer, [m(v.neg().toTex()), rec ? m(rec.toTex()) : null, swapped ? m(swapped.toTex()) : null, swapped ? m(swapped.neg().toTex()) : null], (k) => m(v.add(Exact.of(new Frac(k, den))).toTex())),
      check: { kind: 'trigonometry.composition' },
    };
  },
});

