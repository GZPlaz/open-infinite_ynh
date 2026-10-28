/**
 * More graphs: tangent / cotangent / secant / cosecant with transformations,
 * writing sinusoid equations from a graph, and sinusoidal models.
 */
import { plot } from '../../diagram';
import { Frac } from '../../fraction';
import { attempt, defineTopic, distinctDistractors, strOpt } from '../../generator';
import type { Rng } from '../../rng';
import { decimal, m, roundTo } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { piTex } from './exact';
import { radianPlane } from './figures';

const fracs = (...xs: Array<[number, number]>) => xs.map(([n, d]) => new Frac(n, d));

/** `x`, `2x`, `\frac{x}{2}` for b·x. */
const bxTex = (b: Frac) => (b.eq(1) ? 'x' : b.d === 1 ? `${b.n}x` : `\\frac{x}{${b.d}}`);
const coefTex = (a: number) => (a === 1 ? '' : a === -1 ? '-' : String(a));
const shiftTex = (d: number) => (d > 0 ? ` + ${d}` : d < 0 ? ` - ${-d}` : '');

/** Argument b·x − φπ written as `\left(2x - \frac{\pi}{2}\right)` (or bare when φ = 0). */
function argTex(b: Frac, phi: Frac): string {
  if (phi.isZero()) return ` ${bxTex(b)}`;
  return `\\left(${bxTex(b)} ${phi.sign > 0 ? '-' : '+'} ${piTex(phi.abs())}\\right)`;
}

const phaseText = (c: Frac) => (c.isZero() ? 'none' : `${m(piTex(c.abs()))} ${c.sign > 0 ? 'right' : 'left'}`);
const vshiftText = (d: number) => (d === 0 ? 'none' : `${m(String(Math.abs(d)))} ${d > 0 ? 'up' : 'down'}`);

/** `x = \frac{\pi}{4} + \frac{n\pi}{2}` for x = A + nS (A, S multiples of π). */
function asymptoteTex(A: Frac, S: Frac): string {
  const nS = S.eq(1) ? 'n\\pi' : S.d === 1 ? `${S.n}n\\pi` : `\\frac{${S.n === 1 ? '' : S.n}n\\pi}{${S.d}}`;
  return A.isZero() ? `x = ${nS}` : `x = ${piTex(A)} + ${nS}`;
}

/** A mod S in [0, S). */
function modFrac(A: Frac, S: Frac): Frac {
  const q = Math.floor(A.div(S).value + 1e-12);
  return A.sub(S.mul(q));
}

// ---------------------------------------------------------------- tan, cot, sec, csc

type R = 'tan' | 'cot' | 'sec' | 'csc';
const BASE: Record<R, (x: number) => number> = {
  tan: Math.tan,
  cot: (x) => Math.cos(x) / Math.sin(x),
  sec: (x) => 1 / Math.cos(x),
  csc: (x) => 1 / Math.sin(x),
};

export const graphingReciprocal = defineTopic({
  id: 'trig.functions.graphing-reciprocal',
  subject: 'trigonometry',
  title: 'Graphing Tangent, Cotangent, Secant and Cosecant',
  description: 'Period, phase shift, vertical shift and asymptotes of transformed tan, cot, sec and csc graphs, with the graph.',
  category: 'Trigonometric Functions',
  instruction: (o) =>
    o.graph === false
      ? 'Find the period, phase shift, vertical shift and the equations of the asymptotes (n is any integer).'
      : 'Find the period, phase shift, vertical shift and the equations of the asymptotes (n is any integer). Then graph the function.',
  multipleChoice: true,
  defaultCount: 6,
  options: [
    {
      type: 'select',
      id: 'fns',
      label: 'Functions',
      default: 'all',
      choices: [
        { value: 'all', label: 'tan, cot, sec and csc' },
        { value: 'tancot', label: 'Tangent and cotangent' },
        { value: 'seccsc', label: 'Secant and cosecant' },
      ],
    },
    { type: 'boolean', id: 'graph', label: 'Graph the function', default: true },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const f = strOpt(ctx, 'fns');
    const g = rng.pick<R>(f === 'tancot' ? ['tan', 'cot'] : f === 'seccsc' ? ['sec', 'csc'] : ['tan', 'cot', 'sec', 'csc']);
    const { a, b, phi, d } = attempt('reciprocal graph', () => {
      const a = rng.signedInt(1, difficulty === 'easy' ? 2 : 3, difficulty !== 'easy');
      const b = rng.pick(difficulty === 'easy' ? fracs([1, 1], [2, 1]) : fracs([1, 1], [2, 1], [1, 2]));
      let phi = new Frac(0);
      let d = 0;
      if (difficulty !== 'easy') {
        const k = rng.int(0, 2);
        if (k !== 1) phi = rng.pick(fracs([1, 4], [1, 2], [3, 4])).mul(rng.sign());
        if (k !== 0) d = rng.signedInt(1, 2, true);
        if (difficulty === 'medium' && !b.eq(1) && !phi.isZero()) return null;
      }
      // keep asymptotes on the π/4 grid
      const c = phi.div(b);
      if (!c.mul(4).isInt()) return null;
      return { a, b, phi, d };
    });
    const c = phi.div(b);
    const periodBase = g === 'tan' || g === 'cot' ? new Frac(1) : new Frac(2);
    const P = periodBase.div(b);
    const S = new Frac(1).div(b); // spacing of asymptotes
    const A0 = modFrac(g === 'tan' || g === 'sec' ? c.add(new Frac(1, 2).div(b)) : c, S);
    const eq = `y = ${coefTex(a)}\\${g}${argTex(b, phi)}${shiftTex(d)}`;
    const text = (per: Frac, ph: Frac, A: Frac, Sp: Frac) => `Period: ${m(piTex(per))}; Phase shift: ${phaseText(ph)}; Vertical shift: ${vshiftText(d)}; Asymptotes: ${m(asymptoteTex(A, Sp))}`;
    const answer = text(P, c, A0, S);
    const otherA = modFrac(g === 'tan' || g === 'sec' ? c : c.add(new Frac(1, 2).div(b)), S);
    const wrongs = [
      text(g === 'tan' || g === 'cot' ? P.mul(2) : P.div(2), c, A0, S),
      text(P, c, otherA, S),
      text(P, c.neg(), modFrac(A0.sub(c.mul(2)), S), S),
      text(P, c, modFrac(A0, S.mul(2)), S.mul(2)),
      text(P.mul(b).mul(b), c, A0, S),
    ];
    const asyStep = g === 'tan' || g === 'sec' ? `${bxTex(b)} ${phi.isZero() ? '' : `${phi.sign > 0 ? '-' : '+'} ${piTex(phi.abs())} `}= \\frac{\\pi}{2} + n\\pi` : `${bxTex(b)} ${phi.isZero() ? '' : `${phi.sign > 0 ? '-' : '+'} ${piTex(phi.abs())} `}= n\\pi`;
    const out: ProblemContent = {
      question: m(eq),
      answer,
      steps: [
        m(`\\text{Period} = \\frac{${periodBase.eq(1) ? '\\pi' : '2\\pi'}}{${b.toTex()}} = ${piTex(P)}`),
        c.isZero() ? 'No phase shift.' : m(`\\text{Phase shift: } x = ${piTex(c)}`),
        `Asymptotes where ${m(`\\${g === 'tan' || g === 'sec' ? 'cos' : 'sin'}`)} of the argument is ${m('0')}: ${m(asyStep)}, so ${m(asymptoteTex(A0, S))}.`,
      ],
      distractors: distinctDistractors(answer, wrongs, (k) => text(P.mul(k + 2), c, A0, S)),
      check: { kind: 'trigonometry.recipGraph' },
    };
    if (ctx.options.graph !== false) {
      const yr = Math.max(5, Math.abs(d) + 4);
      out.diagram = radianPlane([-4, 4], yr).b.build('Blank graph with x from -2π to 2π');
      const { b: B, w } = radianPlane([-4, 4], yr);
      const Sv = S.value * Math.PI;
      for (let k = -20; k <= 20; k++) {
        const x = A0.value * Math.PI + k * Sv;
        if (x > w.x0 + 1e-9 && x < w.x1 - 1e-9) B.segment([x, w.y0], [x, w.y1], { dash: true, ink: 'muted', weight: 0.9 });
      }
      const bv = b.value;
      const cv = c.value * Math.PI;
      plot(B, (x) => a * BASE[g](bv * (x - cv)) + d, w, {}, 960);
      out.answerDiagram = B.build(`Graph of ${eq} with dashed asymptotes`);
    }
    return out;
  },
});

// ---------------------------------------------------------------- equations of sinusoids from a graph

interface Sin {
  fn: 'sin' | 'cos';
  a: number;
  b: Frac;
  c: Frac; // multiple of π
  d: number;
}

const sinFn = (s: Sin) => (x: number) => s.a * (s.fn === 'sin' ? Math.sin : Math.cos)(s.b.value * (x - s.c.value * Math.PI)) + s.d;

function sinTex(s: Sin): string {
  let arg: string;
  if (s.c.isZero()) arg = ` ${bxTex(s.b)}`;
  else {
    const inner = `x ${s.c.sign > 0 ? '-' : '+'} ${piTex(s.c.abs())}`;
    arg = s.b.eq(1) ? `\\left(${inner}\\right)` : `\\left(${s.b.toTex()}\\left(${inner}\\right)\\right)`;
  }
  return `y = ${coefTex(s.a)}\\${s.fn}${arg}${shiftTex(s.d)}`;
}

const SAMPLE_X = Array.from({ length: 25 }, (_, i) => -6 + 0.5 * i + 0.013);
const sameFn = (f: (x: number) => number, g: (x: number) => number) => SAMPLE_X.every((x) => Math.abs(f(x) - g(x)) < 1e-6);

export const sinusoidEquations = defineTopic({
  id: 'trig.functions.sinusoid-equations',
  subject: 'trigonometry',
  title: 'Writing Equations of Sinusoids',
  description: 'Read amplitude, period, phase shift and midline from a graph and write y = a sin(b(x − c)) + d or the cosine form.',
  category: 'Trigonometric Functions',
  instruction: (o) =>
    o.form === 'sin' ? 'Write a sine equation for each graph.' : o.form === 'cos' ? 'Write a cosine equation for each graph.' : 'Write an equation for each graph in the indicated form.',
  multipleChoice: true,
  defaultCount: 6,
  options: [
    {
      type: 'select',
      id: 'form',
      label: 'Equation form',
      default: 'either',
      choices: [
        { value: 'either', label: 'Sine or cosine' },
        { value: 'sin', label: 'Sine' },
        { value: 'cos', label: 'Cosine' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const form = strOpt(ctx, 'form');
    const fn = form === 'sin' || form === 'cos' ? form : rng.pick(['sin', 'cos'] as const);
    const s: Sin = attempt('sinusoid', () => {
      const a = rng.int(1, difficulty === 'easy' ? 3 : 4);
      const b = rng.pick(fracs([1, 1], [2, 1], [1, 2]));
      const P = new Frac(2).div(b);
      const quarter = P.div(4);
      let c = new Frac(0);
      if (difficulty !== 'easy') {
        const k = rng.int(1, 3);
        c = quarter.mul(k);
        if (difficulty === 'hard' && rng.bool(0.5)) c = c.neg();
      }
      const d = difficulty === 'easy' ? 0 : rng.int(-2, 2);
      if (Math.abs(d) + a > 5) return null;
      return { fn, a, b, c, d };
    });
    const answer = m(sinTex(s));
    const f = sinFn(s);
    const cands: Sin[] = [
      { ...s, b: s.b.eq(1) ? new Frac(2) : s.b.inv() },
      { ...s, c: s.c.neg() },
      { ...s, c: s.c.add(new Frac(1, 2).div(s.b)) },
      { ...s, fn: fn === 'sin' ? 'cos' : 'sin' },
      { ...s, a: 2 * s.a },
      { ...s, d: -s.d },
      { ...s, a: s.d !== 0 ? Math.abs(s.d) : s.a + 1, d: s.d !== 0 ? Math.sign(s.d) * s.a : s.d },
    ];
    const distinct = cands.filter((x) => !sameFn(sinFn(x), f)).map((x) => m(sinTex(x)));
    const P = new Frac(2).div(s.b);
    const yr = Math.max(3, s.a + Math.abs(s.d) + 1);
    const { b: B, w } = radianPlane([-4, 4], yr);
    plot(B, f, w, {}, 480);
    // mark one maximum and the following minimum
    const peak = s.c.value * Math.PI + (fn === 'sin' ? P.value * Math.PI / 4 : 0);
    const half = (P.value * Math.PI) / 2;
    const x0 = peak - Math.floor((peak - w.x0) / (2 * half) + 1e-9) * 2 * half;
    for (const x of [x0 + 2 * half, x0 + 3 * half]) if (x >= w.x0 && x <= w.x1) B.dot([x, f(x)], false, 'accent');
    return {
      question: 'Write an equation for the graph.',
      answer,
      steps: [
        m(`\\text{Amplitude: } a = \\frac{${s.a + s.d} - (${s.d - s.a})}{2} = ${s.a}`),
        m(`\\text{Midline: } y = ${s.d}`),
        m(`\\text{Period} = ${piTex(P)} \\Rightarrow b = \\frac{2\\pi}{${piTex(P)}} = ${s.b.toTex()}`),
        s.c.isZero() ? `The graph starts a ${fn === 'sin' ? 'rising midline crossing' : 'maximum'} at ${m('x = 0')}: no phase shift.` : `A ${fn === 'sin' ? 'rising midline crossing' : 'maximum'} occurs at ${m(`x = ${piTex(s.c)}`)}, so ${m(`c = ${piTex(s.c)}`)}.`,
        answer,
      ],
      distractors: distinctDistractors(answer, distinct, (k) => m(sinTex({ ...s, a: s.a + k + 1 }))),
      diagram: B.build('Graph of a sinusoid on a radian grid'),
      check: { kind: 'trigonometry.sinusoidFit' },
    };
  },
});

// ---------------------------------------------------------------- sinusoidal models

type Scenario = 'ferris' | 'tide' | 'daylight' | 'temperature';

interface Model {
  /** h(t) = A·cos(B(t − t0)) + k with B = Bπ. */
  A: number;
  B: Frac;
  t0: number;
  k: number;
  fname: string;
  unit: string;
  tUnit: string;
  story: string;
  period: number;
  max: [number, number];
  min: [number, number];
}

function makeModel(rng: Rng, s: Scenario, d: Difficulty): Model {
  const names = ['Ava', 'Bao', 'Chidi', 'Dana', 'Eitan', 'Farah', 'Gus', 'Hana', 'Ines', 'Jun'];
  if (s === 'ferris') {
    const D = rng.int(4, 25) * 10;
    const p = rng.int(2, 10);
    const T = rng.int(d === 'easy' ? 2 : 3, 20);
    return {
      A: -D / 2,
      B: new Frac(2, T),
      t0: 0,
      k: D / 2 + p,
      fname: 'h',
      unit: 'feet',
      tUnit: 'minutes',
      story: `A Ferris wheel is ${D} feet in diameter, and its lowest car is ${p} feet above the ground. The wheel makes one revolution every ${T} minutes. ${rng.pick(names)} boards at the lowest point at ${'$'}t = 0${'$'}. Let ${'$'}h(t)${'$'} be the rider's height in feet after ${'$'}t${'$'} minutes.`,
      period: T,
      max: [T / 2, D + p],
      min: [0, p],
    };
  }
  if (s === 'tide') {
    const m0 = rng.int(1, 6);
    const M = m0 + rng.int(4, 14);
    const t0 = rng.int(0, 11);
    return {
      A: (M - m0) / 2,
      B: new Frac(1, 6),
      t0,
      k: (M + m0) / 2,
      fname: 'h',
      unit: 'feet',
      tUnit: 'hours after midnight',
      story: `At a harbor, high tide of ${M} feet occurs ${t0} hours after midnight and low tide of ${m0} feet occurs 6 hours later. Assume the depth follows a sinusoid with a period of 12 hours, and let ${'$'}h(t)${'$'} be the depth in feet ${'$'}t${'$'} hours after midnight.`,
      period: 12,
      max: [t0, M],
      min: [t0 + 6, m0],
    };
  }
  if (s === 'daylight') {
    const L = rng.int(130, 170) / 10;
    const S = roundTo(24 - L - rng.int(0, 10) / 10, 1);
    const city = rng.pick(['Oslo', 'Seattle', 'Montreal', 'Berlin', 'Anchorage', 'Edinburgh', 'Minneapolis', 'Warsaw']);
    return {
      A: roundTo((L - S) / 2, 2),
      B: new Frac(2, 365),
      t0: 172,
      k: roundTo((L + S) / 2, 2),
      fname: 'D',
      unit: 'hours',
      tUnit: 'days',
      story: `In ${city}, the longest day has ${L} hours of daylight on day 172 of the year and the shortest has ${S} hours half a year later. Assume a period of 365 days, and let ${'$'}D(t)${'$'} be the hours of daylight on day ${'$'}t${'$'}.`,
      period: 365,
      max: [172, roundTo((L + S) / 2, 2) + roundTo((L - S) / 2, 2)],
      min: [172 + 182.5, roundTo((L + S) / 2, 2) - roundTo((L - S) / 2, 2)],
    };
  }
  const lo = rng.int(-10, 45);
  const hi = lo + rng.int(20, 50);
  const city = rng.pick(['Chicago', 'Denver', 'Boston', 'Kansas City', 'Omaha', 'Detroit', 'Toronto', 'Salt Lake City']);
  return {
    A: (hi - lo) / 2,
    B: new Frac(1, 6),
    t0: 7,
    k: (hi + lo) / 2,
    fname: 'T',
    unit: '°F',
    tUnit: 'months',
    story: `In ${city}, the average monthly temperature peaks at ${hi}°F in July (${'$'}t = 7${'$'}) and is lowest, ${lo}°F, in January (${'$'}t = 1${'$'}). Assume a period of 12 months, and let ${'$'}T(t)${'$'} be the average temperature in month ${'$'}t${'$'}.`,
    period: 12,
    max: [7, hi],
    min: [13, lo],
  };
}

function modelTex(md: Model, alt: { fn?: 'sin' | 'cos'; A?: number; B?: Frac; t0?: number; k?: number } = {}): string {
  const A = alt.A ?? md.A;
  const B = alt.B ?? md.B;
  const t0 = alt.t0 ?? md.t0;
  const k = alt.k ?? md.k;
  const fn = alt.fn ?? 'cos';
  const Btex = piTex(B);
  const arg = t0 === 0 ? `\\left(${Btex}t\\right)` : `\\left(${Btex}(t ${t0 > 0 ? '-' : '+'} ${Math.abs(t0)})\\right)`;
  return `${md.fname}(t) = ${coefTex(A)}\\${fn}${arg}${shiftTex(k)}`;
}

const modelFn = (md: Model) => (t: number) => md.A * Math.cos(md.B.value * Math.PI * (t - md.t0)) + md.k;

export const sinusoidalModels = defineTopic({
  id: 'trig.functions.sinusoidal-models',
  subject: 'trigonometry',
  title: 'Sinusoidal Models',
  description: 'Model Ferris wheels, tides, daylight and temperature with sinusoids; evaluate and solve the models.',
  category: 'Trigonometric Functions',
  instruction: (o) =>
    o.task === 'model' ? 'Write a cosine model for each situation.' : o.task === 'value' ? 'Use the model to answer each question. Round to the nearest tenth.' : o.task === 'time' ? 'Use the model to answer each question. Round to the nearest tenth.' : 'Answer each question. Round to the nearest tenth.',
  multipleChoice: true,
  defaultCount: 4,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Ask for',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'model', label: 'The model' },
        { value: 'value', label: 'The value at a time' },
        { value: 'time', label: 'The first time a value is reached' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const t = strOpt(ctx, 'task');
    const task = t === 'model' || t === 'value' || t === 'time' ? t : rng.pick(['model', 'value', 'time'] as const);
    const scenario = rng.pick<Scenario>(difficulty === 'easy' ? ['ferris', 'tide', 'temperature'] : ['ferris', 'tide', 'daylight', 'temperature']);
    const md = makeModel(rng, scenario, difficulty);
    const f = modelFn(md);
    const model = modelTex(md);
    const facts = { period: md.period, max: md.max, min: md.min };

    if (task === 'model') {
      const answer = m(model);
      const cands = [
        m(modelTex(md, { fn: 'sin' })),
        m(modelTex(md, { B: md.B.div(2) })),
        m(modelTex(md, { A: -md.A })),
        m(modelTex(md, { A: md.k, k: md.A })),
        m(modelTex(md, { B: md.B.mul(2) })),
      ];
      return {
        question: md.story,
        answer,
        steps: [
          m(`\\text{Amplitude} = \\frac{${md.max[1]} - ${md.min[1]}}{2} = ${Math.abs(md.A)}, \\; \\text{midline} = ${md.k}`),
          m(`B = \\frac{2\\pi}{${md.period}} = ${piTex(md.B)}`),
          md.A < 0 ? `The rider starts at the minimum, so use ${m('-\\cos')} with no shift.` : `The maximum occurs at ${m(`t = ${md.t0}`)}, so shift the cosine ${m(String(md.t0))} units right.`,
          answer,
        ],
        distractors: distinctDistractors(answer, cands, (k) => m(modelTex(md, { k: md.k + k }))),
        check: { kind: 'trigonometry.model', task, facts },
      };
    }

    const fmt = (v: number, name: string) => m(`${name} ${Math.abs(roundTo(v, 1) - v) > 1e-9 ? '\\approx' : '='} ${decimal(v)}`);
    if (task === 'value') {
      const tt = attempt('time', () => {
        const x = scenario === 'daylight' ? rng.int(1, 365) : rng.int(1, Math.max(2, Math.floor(md.period * 10))) / 10;
        if (scenario === 'temperature' && !Number.isInteger(x)) return null;
        return Math.abs(Math.cos(md.B.value * Math.PI * (x - md.t0))) > 0.999 ? null : x;
      });
      const v = f(tt);
      const answer = fmt(v, `${md.fname}(${tt})`);
      const deg = md.A * Math.cos(((md.B.value * Math.PI * (tt - md.t0)) * Math.PI) / 180) + md.k;
      const wrong = [deg, md.A * Math.sin(md.B.value * Math.PI * (tt - md.t0)) + md.k, -md.A * Math.cos(md.B.value * Math.PI * (tt - md.t0)) + md.k, md.A * Math.cos(md.B.value * Math.PI * (tt + md.t0)) + md.k];
      return {
        question: `${md.story} The model is ${m(model)}. Find ${m(`${md.fname}(${tt})`)}.`,
        answer,
        steps: [m(`${md.fname}(${tt}) = ${coefTex(md.A)}\\cos\\left(${piTex(md.B)}(${tt} ${md.t0 >= 0 ? '-' : '+'} ${Math.abs(md.t0)})\\right)${shiftTex(md.k)} \\approx ${decimal(v)}`)],
        distractors: distinctDistractors(answer, wrong.filter((w) => Math.abs(roundTo(w, 1) - roundTo(v, 1)) > 0.05).map((w) => fmt(w, `${md.fname}(${tt})`)), (k) => fmt(v + k * 1.3, `${md.fname}(${tt})`)),
        check: { kind: 'trigonometry.model', task, facts },
      };
    }

    // first time a target value is reached (t > 0)
    const lo = Math.min(md.max[1], md.min[1]);
    const hi = Math.max(md.max[1], md.min[1]);
    const target = attempt('target', () => {
      const v = roundTo(lo + ((hi - lo) * rng.int(10, 90)) / 100, scenario === 'daylight' ? 1 : 0);
      if (v <= lo + 0.05 * (hi - lo) || v >= hi - 0.05 * (hi - lo)) return null;
      return v;
    });
    // first solution: scan
    const P = md.period;
    let first = NaN;
    const N = 20000;
    for (let i = 0; i < N; i++) {
      const x0 = (P * i) / N;
      const x1 = (P * (i + 1)) / N;
      if ((f(x0) - target) * (f(x1) - target) <= 0) {
        let a = x0;
        let b = x1;
        for (let j = 0; j < 60; j++) {
          const mid = (a + b) / 2;
          if ((f(a) - target) * (f(mid) - target) <= 0) b = mid;
          else a = mid;
        }
        first = (a + b) / 2;
        if (first > 1e-9) break;
      }
    }
    const answer = fmt(first, 't');
    const theta = Math.acos((target - md.k) / md.A);
    const alts = [first + P / 2, P - first, first * 2, (Math.acos((target - md.k) / md.A) * 180) / Math.PI / (md.B.value * 180) + md.t0];
    return {
      question: `${md.story} The model is ${m(model)}. When, for ${m('t > 0')}, does ${m(md.fname)} first equal ${m(String(target))}?`,
      answer,
      steps: [
        m(`${coefTex(md.A)}\\cos\\left(${piTex(md.B)}(t ${md.t0 >= 0 ? '-' : '+'} ${Math.abs(md.t0)})\\right)${shiftTex(md.k)} = ${target}`),
        m(`\\cos\\left(${piTex(md.B)}(t ${md.t0 >= 0 ? '-' : '+'} ${Math.abs(md.t0)})\\right) = ${decimal((target - md.k) / md.A, 4)}`),
        m(`\\cos^{-1}(${decimal((target - md.k) / md.A, 4)}) \\approx ${decimal(theta, 4)}`),
        `The first positive solution is ${answer}.`,
      ],
      distractors: distinctDistractors(answer, alts.filter((w) => w > 0 && Math.abs(roundTo(w, 1) - roundTo(first, 1)) > 0.05).map((w) => fmt(w, 't')), (k) => fmt(first + k * 0.7, 't')),
      check: { kind: 'trigonometry.model', task, facts, target },
    };
  },
});
