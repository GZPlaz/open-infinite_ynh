/** Angle sum/difference, double-angle and half-angle identities: exact values, given-value problems, simplification. */
import { Frac } from '../../fraction';
import { attempt, defineTopic, distinctDistractors, strOpt } from '../../generator';
import type { Rng } from '../../rng';
import { m } from '../../tex';
import type { Difficulty, GeneratorContext, ProblemContent } from '../../types';
import { pickUnit, unitsOpt } from './angles';
import { angleTex, cosExact, Exact, fnAt, negVal, piTex, sinExact, sqrtExact, trigExact, val, type AngleUnit, type TrigFn, type Val } from './exact';
import { triples } from '../geometry/common';

const CATEGORY = 'Trigonometric Identities and Equations';
const POOL = ['0', '1', '-1', '\\frac{1}{2}', '-\\frac{1}{2}', '\\frac{\\sqrt{2}}{2}', '-\\frac{\\sqrt{2}}{2}', '\\frac{\\sqrt{3}}{2}', '-\\frac{\\sqrt{3}}{2}', '\\sqrt{3}', '-\\sqrt{3}', '\\frac{\\sqrt{3}}{3}', '-\\frac{\\sqrt{3}}{3}'];
const poolFallback = (k: number) => (k <= POOL.length ? m(POOL[k - 1]!) : m(String(k)));
const ex = (e: Exact | null) => (e ? m(e.toTex()) : null);
const p = (t: string) => (t.startsWith('-') || /[+-]/.test(t.slice(1)) ? `\\left(${t}\\right)` : t);
/** Product of two factors with unit factors dropped. */
const pp = (x: string, y: string) => {
  const f = [x, y].filter((t) => t !== '1');
  if (f.length === 0) return '1';
  if (f.length === 1) return p(f[0]!);
  return f.map(p).join('');
};

// ---------------------------------------------------------------- given values

interface GivenAngle {
  /** Variable TeX, e.g. `\alpha`. */
  v: string;
  fn: 'sin' | 'cos' | 'tan';
  s: Exact;
  c: Exact;
  /** Quadrant 0–3. */
  q: number;
}

function givenAngle(rng: Rng, d: Difficulty, v: string, fns: Array<'sin' | 'cos' | 'tan'>): GivenAngle {
  const [a, b, h] = rng.pick(triples(d === 'hard' ? 41 : d === 'medium' ? 25 : 13).filter(([x, y, z]) => d === 'hard' || (x < 10 && y < 15 && z < 26)));
  const [u, w] = rng.bool() ? [a, b] : [b, a];
  const q = rng.int(0, 3);
  const sx = q === 0 || q === 3 ? 1 : -1;
  const sy = q <= 1 ? 1 : -1;
  return { v, fn: rng.pick(fns), s: Exact.of(new Frac(sy * u, h)), c: Exact.of(new Frac(sx * w, h)), q };
}

const QUAD_BOUNDS = [
  [0, 90],
  [90, 180],
  [180, 270],
  [270, 360],
];

function givenTex(g: GivenAngle, unit: AngleUnit): string[] {
  const value = g.fn === 'sin' ? g.s : g.fn === 'cos' ? g.c : g.s.div(g.c);
  const [lo, hi] = QUAD_BOUNDS[g.q]!;
  return [m(`\\${g.fn} ${g.v} = ${value.toTex()}`), m(`${angleTex(lo!, unit)} < ${g.v} < ${angleTex(hi!, unit)}`)];
}

function pythagStep(g: GivenAngle): string {
  if (g.fn === 'sin') return m(`\\cos ${g.v} = ${g.c.value < 0 ? '-' : ''}\\sqrt{1 - \\left(${g.s.toTex()}\\right)^{2}} = ${g.c.toTex()}`);
  if (g.fn === 'cos') return m(`\\sin ${g.v} = ${g.s.value < 0 ? '-' : ''}\\sqrt{1 - \\left(${g.c.toTex()}\\right)^{2}} = ${g.s.toTex()}`);
  return m(`\\sin ${g.v} = ${g.s.toTex()}, \\; \\cos ${g.v} = ${g.c.toTex()}`);
}

// ---------------------------------------------------------------- sum and difference

/** θ (≡ 15 mod 30) written as a sum or difference of special angles. */
function decompose(theta: number): [number, '+' | '-', number] {
  if (theta - 45 >= 30) return theta - 45 >= 45 ? [theta - 45, '+', 45] : [45, '+', theta - 45];
  return [45, '-', 45 - theta];
}

function sumDiffValue(fn: 'sin' | 'cos' | 'tan', A: number, op: '+' | '-', B: number) {
  const sA = sinExact(A);
  const cA = cosExact(A);
  const sB = sinExact(B);
  const cB = cosExact(B);
  const sg = op === '+' ? 1 : -1;
  if (fn === 'sin') return { expand: `${pp(sA.toTex(), cB.toTex())} ${op} ${pp(cA.toTex(), sB.toTex())}`, wrong: sA.add(sB.scale(sg)), signErr: sA.mul(cB).sub(cA.mul(sB).scale(sg)) };
  if (fn === 'cos') return { expand: `${pp(cA.toTex(), cB.toTex())} ${op === '+' ? '-' : '+'} ${pp(sA.toTex(), sB.toTex())}`, wrong: cA.add(cB.scale(sg)), signErr: cA.mul(cB).add(sA.mul(sB).scale(sg)) };
  const tA = sA.div(cA);
  const tB = sB.div(cB);
  return {
    expand: `\\frac{${tA.toTex()} ${op} ${p(tB.toTex())}}{1 ${op === '+' ? '-' : '+'} ${pp(tA.toTex(), tB.toTex())}}`,
    wrong: tA.add(tB.scale(sg)),
    signErr: Exact.ONE.sub(tA.mul(tB).scale(sg)).isZero() ? null : tA.add(tB.scale(sg)).div(Exact.ONE.add(tA.mul(tB).scale(sg))),
  };
}

const FORMULA: Record<'sin' | 'cos' | 'tan', (x: string, op: '+' | '-', y: string) => string> = {
  sin: (x, op, y) => `\\sin ${x}\\cos ${y} ${op} \\cos ${x}\\sin ${y}`,
  cos: (x, op, y) => `\\cos ${x}\\cos ${y} ${op === '+' ? '-' : '+'} \\sin ${x}\\sin ${y}`,
  tan: (x, op, y) => `\\frac{\\tan ${x} ${op} \\tan ${y}}{1 ${op === '+' ? '-' : '+'} \\tan ${x}\\tan ${y}}`,
};

/** "Simplify then evaluate" pair: A op B = R with R special. */
function simplifyPair(rng: Rng, unit: AngleUnit, fn: TrigFn, double: boolean): { A: Frac; B: Frac; op: '+' | '-'; R: number } {
  return attempt('simplify-pair', () => {
    const R = rng.pick([30, 45, 60, 120, 135, 150, 210, 225, 240, 300, 315, 330]);
    if (fn === 'tan' && R % 90 === 0) return null;
    if (double) return { A: new Frac(R, 360), B: new Frac(R, 360), op: '+' as const, R };
    // B as a fraction of π (radians: π/k denominators; degrees: multiples of 5°)
    const B = unit === 'deg' ? new Frac(rng.int(1, 30) * 5, 180) : new Frac(rng.int(1, 11), rng.pick([12, 18, 9, 10, 5]));
    const op = rng.pick(['+', '-'] as const);
    const Rf = new Frac(R, 180);
    const A = op === '+' ? Rf.sub(B) : Rf.add(B);
    if (A.sign <= 0 || A.eq(B) || A.value >= 2) return null;
    if (unit === 'deg' && !A.mul(180).isInt()) return null;
    return { A, B, op, R };
  });
}

const fracAngle = (f: Frac, unit: AngleUnit) => (unit === 'deg' ? `${f.mul(180).value}^\\circ` : piTex(f));

export const sumDifferenceIdentities = defineTopic({
  id: 'trig.identities.sum-difference',
  subject: 'trigonometry',
  title: 'Angle Sum and Difference Identities',
  description: 'Use sum and difference identities to find exact values, evaluate from given ratios, and simplify expressions.',
  category: CATEGORY,
  instruction: (o) =>
    o.task === 'exact'
      ? 'Find the exact value of each expression using a sum or difference identity.'
      : o.task === 'given'
        ? 'Find the exact value of each expression.'
        : o.task === 'simplify'
          ? 'Use a sum or difference identity to write each expression as a single function, then find its exact value.'
          : 'Find the exact value of each expression.',
  multipleChoice: true,
  defaultCount: 9,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Problem type',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'exact', label: 'Exact values such as sin 75°' },
        { value: 'given', label: 'Given sin α and cos β' },
        { value: 'simplify', label: 'Recognize an expanded identity' },
      ],
    },
    unitsOpt('mixed'),
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const t = strOpt(ctx, 'task');
    const task = t === 'exact' || t === 'given' || t === 'simplify' ? t : rng.pick(['exact', 'given', 'simplify'] as const);
    const unit = pickUnit(ctx);
    const fn = rng.pick<'sin' | 'cos' | 'tan'>(difficulty === 'easy' ? ['sin', 'cos'] : ['sin', 'cos', 'tan']);

    if (task === 'exact') {
      const theta = attempt('sum angle', () => {
        const lim = difficulty === 'hard' ? 24 : 12;
        const k = rng.int(difficulty === 'hard' ? -lim : 0, lim - 1);
        const th = 30 * k + 15;
        return th === 0 ? null : th;
      });
      const dec = decompose(theta);
      const bad = fn === 'tan' && (cosExact(dec[0]).isZero() || cosExact(dec[2]).isZero());
      const [A, op, B] = !bad ? dec : cosExact(theta - 45).isZero() ? ([theta + 45, '-', 45] as const) : ([theta - 45, '+', 45] as const);
      const v = trigExact(fn, theta)!;
      const answer = m(v.toTex());
      const parts = sumDiffValue(fn, A, op, B);
      const thTex = angleTex(theta, unit);
      return {
        question: m(fnAt(fn, thTex)),
        answer,
        steps: [
          m(`${fnAt(fn, thTex)} = \\${fn}\\left(${angleTex(A, unit)} ${op} ${angleTex(B, unit)}\\right)`),
          m(`= ${parts.expand}`),
          m(`= ${v.toTex()}`),
        ],
        distractors: distinctDistractors(answer, [ex(parts.wrong), ex(parts.signErr), ex(v.neg()), ex(trigExact(fn === 'sin' ? 'cos' : fn === 'cos' ? 'sin' : 'cot', theta))], poolFallback),
        check: { kind: 'trigonometry.exact' },
      };
    }

    if (task === 'given') {
      const fns: Array<'sin' | 'cos' | 'tan'> = difficulty === 'hard' ? ['sin', 'cos', 'tan'] : ['sin', 'cos'];
      const a = givenAngle(rng, difficulty, '\\alpha', fns);
      const b = attempt('beta', () => {
        const x = givenAngle(rng, difficulty, '\\beta', fns);
        return x.s.eq(a.s) && x.c.eq(a.c) ? null : x;
      });
      const op = rng.pick(['+', '-'] as const);
      const sg = op === '+' ? 1 : -1;
      const val2 = (f: 'sin' | 'cos' | 'tan', A: GivenAngle, B: GivenAngle, s: number): Exact | null => {
        if (f === 'sin') return A.s.mul(B.c).add(A.c.mul(B.s).scale(s));
        if (f === 'cos') return A.c.mul(B.c).sub(A.s.mul(B.s).scale(s));
        const den = A.c.mul(B.c).sub(A.s.mul(B.s).scale(s));
        return den.isZero() ? null : A.s.mul(B.c).add(A.c.mul(B.s).scale(s)).div(den);
      };
      const target = attempt('target', () => {
        const f = rng.pick<'sin' | 'cos' | 'tan'>(difficulty === 'easy' ? ['sin', 'cos'] : ['sin', 'cos', 'tan']);
        return val2(f, a, b, sg) ? f : null;
      });
      const v = val2(target, a, b, sg)!;
      const answer = m(v.toTex());
      const flipC = (g: GivenAngle): GivenAngle => ({ ...g, c: g.c.neg() });
      const expr = `\\${target}(\\alpha ${op} \\beta)`;
      return {
        question: `${givenTex(a, unit).join(' and ')}; ${givenTex(b, unit).join(' and ')}. Find ${m(expr)}.`,
        answer,
        steps: [pythagStep(a), pythagStep(b), m(`${expr} = ${FORMULA[target]('\\alpha', op, '\\beta')} = ${v.toTex()}`)],
        distractors: distinctDistractors(answer, [ex(val2(target, a, b, -sg)), ex(val2(target, flipC(a), b, sg)), ex(val2(target, a, flipC(b), sg)), ex(v.neg())], (k) => m(v.add(Exact.of(new Frac(k, 5))).toTex())),
        check: { kind: 'trigonometry.given' },
      };
    }

    // simplify an expanded identity
    const { A, B, op, R } = simplifyPair(rng, unit, fn, false);
    const At = fracAngle(A, unit);
    const Bt = fracAngle(B, unit);
    const v = trigExact(fn, R)!;
    const answer = m(v.toTex());
    const Rt = angleTex(R, unit);
    return {
      question: m(FORMULA[fn](At, op, Bt)),
      answer,
      steps: [m(`= \\${fn}\\left(${At} ${op} ${Bt}\\right) = ${fnAt(fn, Rt)}`), m(`= ${v.toTex()}`)],
      distractors: distinctDistractors(answer, [ex(v.neg()), ex(trigExact(fn === 'sin' ? 'cos' : fn === 'cos' ? 'sin' : 'cot', R)), ex(trigExact(fn, 2 * R)), ex(trigExact(fn, 180 - R))], poolFallback),
      check: { kind: 'trigonometry.exact' },
    };
  },
});

// ---------------------------------------------------------------- double and half angle

type Kind = 'double' | 'half';

function kindFor(ctx: GeneratorContext): Kind {
  const k = strOpt(ctx, 'identity');
  return k === 'double' || k === 'half' ? k : ctx.rng.bool() ? 'double' : 'half';
}

/** sin, cos or tan of φ/2 with the sign chosen by the quadrant of φ/2. */
function halfValue(fn: 'sin' | 'cos' | 'tan', cosPhi: Exact, sinPhi: Exact, halfQuadrant: number): { v: Val; inner: Exact } {
  if (fn === 'tan') {
    const e = Exact.ONE.sub(cosPhi).div(sinPhi);
    return { v: val(e), inner: e };
  }
  const inner = (fn === 'sin' ? Exact.ONE.sub(cosPhi) : Exact.ONE.add(cosPhi)).scale(new Frac(1, 2));
  const root = sqrtExact(inner);
  const positive = fn === 'sin' ? halfQuadrant <= 1 : halfQuadrant === 0 || halfQuadrant === 3;
  return { v: positive ? root : negVal(root), inner };
}

export const doubleHalfIdentities = defineTopic({
  id: 'trig.identities.double-half',
  subject: 'trigonometry',
  title: 'Double-Angle and Half-Angle Identities',
  description: 'Use double-angle and half-angle identities to find exact values and to evaluate from a given ratio.',
  category: CATEGORY,
  instruction: (o) =>
    o.task === 'simplify'
      ? 'Use a double-angle identity to find the exact value of each expression.'
      : o.task === 'exact'
        ? 'Use a half-angle identity to find the exact value of each expression.'
        : 'Find the exact value of each expression.',
  multipleChoice: true,
  defaultCount: 9,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Problem type',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'exact', label: 'Half-angle exact values such as sin 15°' },
        { value: 'given', label: 'Given a ratio and the quadrant' },
        { value: 'simplify', label: 'Evaluate expanded double-angle expressions' },
      ],
    },
    {
      type: 'select',
      id: 'identity',
      label: 'Identities (given-ratio problems)',
      default: 'both',
      choices: [
        { value: 'both', label: 'Double and half angle' },
        { value: 'double', label: 'Double angle only' },
        { value: 'half', label: 'Half angle only' },
      ],
    },
    unitsOpt('mixed'),
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const t = strOpt(ctx, 'task');
    const task = t === 'exact' || t === 'given' || t === 'simplify' ? t : rng.pick(['exact', 'given', 'simplify'] as const);
    const unit = pickUnit(ctx);
    const fn = rng.pick<'sin' | 'cos' | 'tan'>(difficulty === 'easy' ? ['sin', 'cos'] : ['sin', 'cos', 'tan']);

    if (task === 'exact') {
      const phi = attempt('half angle', () => {
        const x = rng.pick(difficulty === 'easy' ? [30, 45, 90, 150, 135, 210, 225, 270, 315, 330] : [30, 45, 135, 150, 210, 225, 315, 330, 270, 390, 405, 495, 510]);
        return fn === 'tan' && x % 180 === 0 ? null : x;
      });
      const theta = phi / 2;
      const hq = Math.floor((((theta % 360) + 360) % 360) / 90);
      const { v } = halfValue(fn, cosExact(phi), sinExact(phi), hq);
      const answer = m(v.tex);
      const thTex = angleTex(theta, unit);
      const phTex = angleTex(phi, unit);
      const cTex = cosExact(phi).toTex();
      const sign = v.value < 0 ? '-' : '';
      const other = halfValue(fn === 'sin' ? 'cos' : 'sin', cosExact(phi), sinExact(phi), hq).v;
      const noHalf = fn === 'tan' ? null : sqrtExact((fn === 'sin' ? Exact.ONE.sub(cosExact(phi)) : Exact.ONE.add(cosExact(phi))));
      const steps =
        fn === 'tan'
          ? [m(`\\tan ${thTex} = \\tan \\frac{${phTex}}{2} = \\frac{1 - \\cos ${phTex}}{\\sin ${phTex}}`), m(`= \\frac{1 - ${p(cTex)}}{${sinExact(phi).toTex()}} = ${v.tex}`)]
          : [
              m(`${fnAt(fn, thTex)} = ${fn === 'sin' ? '\\sin' : '\\cos'} \\frac{${phTex}}{2} = ${sign}\\sqrt{\\frac{1 ${fn === 'sin' ? '-' : '+'} \\cos ${phTex}}{2}}`),
              m(`= ${sign}\\sqrt{\\frac{1 ${fn === 'sin' ? '-' : '+'} ${p(cTex)}}{2}} = ${v.tex}`),
            ];
      return {
        question: m(fnAt(fn, thTex)),
        answer,
        steps,
        distractors: distinctDistractors(answer, [m(negVal(v).tex), m(other.tex), noHalf ? m(noHalf.tex) : null, ex(trigExact(fn, phi)?.scale(new Frac(1, 2)) ?? null), ex(trigExact(fn, phi))], poolFallback),
        check: { kind: 'trigonometry.exact' },
      };
    }

    if (task === 'simplify') {
      const { A, R } = simplifyPair(rng, unit, fn, true);
      const At = fracAngle(A, unit);
      const forms: Record<'sin' | 'cos' | 'tan', string[]> = {
        sin: [`2\\sin ${At}\\cos ${At}`],
        cos: [`\\cos^{2} ${At} - \\sin^{2} ${At}`, `2\\cos^{2} ${At} - 1`, `1 - 2\\sin^{2} ${At}`],
        tan: [`\\frac{2\\tan ${At}}{1 - \\tan^{2} ${At}}`],
      };
      const q = rng.pick(forms[fn]);
      const v = trigExact(fn, R)!;
      const answer = m(v.toTex());
      return {
        question: m(q),
        answer,
        steps: [m(`= \\${fn}\\left(2 \\cdot ${At}\\right) = ${fnAt(fn, angleTex(R, unit))}`), m(`= ${v.toTex()}`)],
        distractors: distinctDistractors(answer, [ex(v.neg()), (R / 2) % 15 === 0 ? ex(trigExact(fn, R / 2)) : null, ex(trigExact(fn === 'sin' ? 'cos' : fn === 'cos' ? 'sin' : 'cot', R)), ex(trigExact(fn, 180 - R))], poolFallback),
        check: { kind: 'trigonometry.exact' },
      };
    }

    // given ratio + quadrant
    const kind = kindFor(ctx);
    const fns: Array<'sin' | 'cos' | 'tan'> = difficulty === 'hard' ? ['sin', 'cos', 'tan'] : ['sin', 'cos'];
    const g = attempt('given', () => {
      const x = givenAngle(rng, difficulty, '\\theta', fns);
      if (kind === 'double' && fn === 'tan' && x.c.mul(x.c).sub(x.s.mul(x.s)).isZero()) return null;
      return x;
    });
    const { s, c } = g;
    let v: Val;
    let expr: string;
    let formula: string;
    let wrong: Array<string | null>;
    if (kind === 'double') {
      expr = fn === 'sin' ? '\\sin 2\\theta' : fn === 'cos' ? '\\cos 2\\theta' : '\\tan 2\\theta';
      const tn = s.div(c);
      const e = fn === 'sin' ? s.mul(c).scale(2) : fn === 'cos' ? c.mul(c).sub(s.mul(s)) : tn.scale(2).div(Exact.ONE.sub(tn.mul(tn)));
      v = val(e);
      formula = fn === 'sin' ? '2\\sin\\theta\\cos\\theta' : fn === 'cos' ? '\\cos^{2}\\theta - \\sin^{2}\\theta' : '\\frac{2\\tan\\theta}{1 - \\tan^{2}\\theta}';
      wrong = [
        ex(fn === 'sin' ? s.scale(2) : fn === 'cos' ? c.scale(2) : tn.scale(2)),
        ex(e.neg()),
        ex(fn === 'sin' ? s.mul(c) : fn === 'cos' ? s.mul(s).sub(c.mul(c)).add(Exact.ONE) : tn.scale(2).div(Exact.ONE.add(tn.mul(tn)))),
        ex(fn === 'cos' ? Exact.ONE.sub(c.mul(c).scale(2)) : fn === 'sin' ? s.mul(c).scale(-2).add(Exact.of(new Frac(1, 5))) : tn.mul(tn)),
      ];
    } else {
      expr = `\\${fn} \\frac{\\theta}{2}`;
      const hq = g.q <= 1 ? 0 : 1; // θ/2 lies in (0°, 90°) or (90°, 180°)
      const res = halfValue(fn, c, s, hq);
      v = res.v;
      formula = fn === 'tan' ? '\\frac{1 - \\cos\\theta}{\\sin\\theta}' : `\\pm\\sqrt{\\frac{1 ${fn === 'sin' ? '-' : '+'} \\cos\\theta}{2}}`;
      const swap = fn === 'tan' ? val(Exact.ONE.add(c).div(s)) : halfValue(fn === 'sin' ? 'cos' : 'sin', c, s, hq).v;
      wrong = [m(negVal(v).tex), m(swap.tex), fn === 'tan' ? ex(s.div(Exact.ONE.add(c)).neg()) : ex(res.inner), fn === 'tan' ? ex(s.div(c).scale(new Frac(1, 2))) : ex((fn === 'sin' ? s : c).scale(new Frac(1, 2)))];
    }
    const answer = m(v.tex);
    return {
      question: `${givenTex(g, unit).join(' and ')}. Find ${m(expr)}.`,
      answer,
      steps: [
        pythagStep(g),
        ...(kind === 'half' ? [`${m('\\frac{\\theta}{2}')} is in Quadrant ${g.q <= 1 ? 'I' : 'II'}.`] : []),
        m(`${expr} = ${formula} = ${v.tex}`),
      ],
      distractors: distinctDistractors(answer, wrong, (k) => m(Exact.of(new Frac(k, 7)).add(Exact.of(v.value > 0 ? 1 : -1)).toTex())),
      check: { kind: 'trigonometry.given' },
    };
  },
});
