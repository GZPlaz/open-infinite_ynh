/** Differential equations: slope fields, Euler's method, separable equations, exponential and logistic models. */
import { graphPlane, plot, type DiagramBuilder, type Window } from '../../diagram';
import { Frac } from '../../fraction';
import { attempt, defineTopic, distinctDistractors, offset, strOpt } from '../../generator';
import type { Rng } from '../../rng';
import { decimal, m, num, sum, tuple } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { lead, pickName } from './common';

const deTex = (rhs: string, dep = 'y', ind = 'x') => `\\frac{d${dep}}{d${ind}} = ${rhs}`;

// ---------------------------------------------------------------- slope fields

interface FieldDE {
  tex: string;
  f: (x: number, y: number) => number;
  /** Solution through (0, y0), when the topic needs one. */
  sol?: (y0: number) => { tex: string; g: (x: number) => number } | null;
}

/** C·e^{E} + polynomial part, tidily: `2e^{x} - x - 1`. */
const ex = (C: number, e: string, ...rest: Array<[number, string]>) => sum([{ coef: C, sym: `e^{${e}}` }, ...rest.map(([c, sym]) => ({ coef: c, sym }))]);

const FIELDS: FieldDE[] = [
  { tex: 'x + y', f: (x, y) => x + y, sol: (y0) => ({ tex: ex(y0 + 1, 'x', [-1, 'x'], [-1, '']), g: (x) => (y0 + 1) * Math.exp(x) - x - 1 }) },
  { tex: 'y - x', f: (x, y) => y - x, sol: (y0) => ({ tex: ex(y0 - 1, 'x', [1, 'x'], [1, '']), g: (x) => (y0 - 1) * Math.exp(x) + x + 1 }) },
  { tex: 'x - y', f: (x, y) => x - y, sol: (y0) => ({ tex: ex(y0 + 1, '-x', [1, 'x'], [-1, '']), g: (x) => (y0 + 1) * Math.exp(-x) + x - 1 }) },
  { tex: 'y', f: (_x, y) => y, sol: (y0) => ({ tex: ex(y0, 'x'), g: (x) => y0 * Math.exp(x) }) },
  { tex: '-y', f: (_x, y) => -y, sol: (y0) => ({ tex: ex(y0, '-x'), g: (x) => y0 * Math.exp(-x) }) },
  { tex: 'x', f: (x) => x, sol: (y0) => ({ tex: sum([{ coef: new Frac(1, 2), sym: 'x^{2}' }, { coef: y0 }]), g: (x) => (x * x) / 2 + y0 }) },
  { tex: '-x', f: (x) => -x, sol: (y0) => ({ tex: sum([{ coef: new Frac(-1, 2), sym: 'x^{2}' }, { coef: y0 }]), g: (x) => (-x * x) / 2 + y0 }) },
  { tex: 'xy', f: (x, y) => x * y, sol: (y0) => ({ tex: ex(y0, '\\frac{x^{2}}{2}'), g: (x) => y0 * Math.exp((x * x) / 2) }) },
  { tex: '-xy', f: (x, y) => -x * y, sol: (y0) => ({ tex: ex(y0, '-\\frac{x^{2}}{2}'), g: (x) => y0 * Math.exp((-x * x) / 2) }) },
  { tex: '1 - y', f: (_x, y) => 1 - y, sol: (y0) => (y0 === 1 ? null : { tex: sum([{ coef: 1 }, { coef: y0 - 1, sym: 'e^{-x}' }]), g: (x) => 1 + (y0 - 1) * Math.exp(-x) }) },
  { tex: '-\\frac{x}{y}', f: (x, y) => -x / y, sol: (y0) => (y0 > 0 ? { tex: `\\sqrt{${y0 * y0} - x^{2}}`, g: (x) => Math.sqrt(y0 * y0 - x * x) } : null) },
  { tex: '\\frac{x}{y}', f: (x, y) => x / y, sol: (y0) => (y0 > 0 ? { tex: `\\sqrt{x^{2} + ${y0 * y0}}`, g: (x) => Math.sqrt(x * x + y0 * y0) } : null) },
  { tex: 'x^{2}', f: (x) => x * x },
  { tex: 'y^{2}', f: (_x, y) => y * y },
  { tex: 'x + 1', f: (x) => x + 1 },
  { tex: 'y - 1', f: (_x, y) => y - 1 },
  { tex: '2x - y', f: (x, y) => 2 * x - y },
  { tex: 'x^{2} - y', f: (x, y) => x * x - y },
];

/** a·F as a field, tidily rendered. */
function scaled(de: FieldDE, a: number): FieldDE & { base: string } {
  const t = de.tex;
  const multi = / [+-] /.test(t);
  const tex = a === 1 ? t : t.startsWith('-') && !multi ? `${lead(-a)}${t.slice(1)}` : multi ? `${lead(a)}(${t})` : `${lead(a)}${t}`;
  return { tex, f: (x, y) => a * de.f(x, y), base: de.tex };
}

/** Slope-field figure on [−3, 3]²; marks are short segments drawn in 'ink'. */
function slopeField(de: FieldDE): { b: DiagramBuilder; w: Window } {
  const g = graphPlane(3, 1, 26);
  const L = 0.32;
  for (let x = -3; x <= 3; x++) {
    for (let y = -3; y <= 3; y++) {
      const s = de.f(x, y);
      if (!Number.isFinite(s)) continue;
      const n = Math.hypot(1, s);
      const dx = L / n;
      const dy = (L * s) / n;
      g.b.segment([x - dx, y - dy], [x + dx, y + dy], { ink: 'ink', weight: 1.3 });
    }
  }
  return g;
}

/** Fields that disagree with `de` somewhere on the grid. */
function differs(a: FieldDE, b: FieldDE): boolean {
  for (let x = -3; x <= 3; x++) for (let y = -3; y <= 3; y++) {
    const s = a.f(x, y);
    const t = b.f(x, y);
    if (Number.isFinite(s) && Math.abs(s - t) > 0.05) return true;
  }
  return false;
}

export const slopeFields = defineTopic({
  id: 'calc.slope-fields',
  subject: 'calculus',
  category: 'Differential Equations',
  title: 'Slope Fields',
  description: 'Match a differential equation to its slope field, or sketch the solution through a given point.',
  instruction: (o) => (o.task === 'sketch' ? 'Sketch the solution curve through the given point and identify it.' : 'Choose the differential equation whose slope field is shown.'),
  multipleChoice: true,
  defaultCount: 4,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Task',
      default: 'match',
      choices: [
        { value: 'match', label: 'Match the equation to the field' },
        { value: 'sketch', label: 'Sketch a solution through a point' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const sketch = strOpt(ctx, 'task') === 'sketch';
    const pool = difficulty === 'easy' ? FIELDS.slice(0, 10) : FIELDS;
    if (!sketch) {
      const a = difficulty === 'easy' ? rng.pick([1, 1, 2, -1]) : rng.pick([1, 2, -1, -2, 3]);
      const de = scaled(rng.pick(pool), a);
      const { b } = slopeField(de);
      const variants = [...FIELDS.map((o) => scaled(o, a)), ...[1, 2, -1, -2, 3].filter((c) => c !== a).map((c) => scaled(FIELDS.find((o) => o.tex === de.base)!, c))];
      const others = rng.shuffle(variants.filter((o) => o.tex !== de.tex && differs(o, de)));
      const answer = m(deTex(de.tex));
      return {
        question: 'Which differential equation has this slope field?',
        answer,
        diagram: b.build('Slope field'),
        steps: [`Check a few marks: at $(1, 1)$ the slope is $${decimal(de.f(1, 1), 2)}$; at $(-1, 2)$ it is $${decimal(de.f(-1, 2), 2)}$.`, answer],
        distractors: distinctDistractors(answer, others.map((o) => m(deTex(o.tex))), () => null),
        check: { kind: 'calculus.slopefield', task: 'match' },
      };
    }
    const { de, y0, s } = attempt('sketch', () => {
      const de = rng.pick(pool.filter((d) => d.sol));
      const y0 = rng.pick([-2, -1, 1, 2]);
      const s = de.sol!(y0);
      return s ? { de, y0, s } : null;
    });
    const fig = slopeField(de);
    fig.b.dot([0, y0], false, 'accent');
    const ans = slopeField(de);
    plot(ans.b, s.g, ans.w);
    ans.b.dot([0, y0], false, 'accent');
    const answer = m(`y = ${s.tex}`);
    // distractors: the same equation through another point, other equations through this point
    const wrongs: string[] = [];
    const alt = de.sol!(-y0) ?? de.sol!(y0 + 1);
    if (alt) wrongs.push(m(`y = ${alt.tex}`));
    for (const o of rng.shuffle(FIELDS.filter((q) => q.sol && q !== de))) {
      const t = o.sol!(y0);
      if (t) wrongs.push(m(`y = ${t.tex}`));
    }
    return {
      question: `$${deTex(de.tex)}$; solution through $${tuple([0, y0])}$`,
      answer,
      diagram: fig.b.build('Slope field with a marked point'),
      answerDiagram: ans.b.build('Slope field with the solution curve'),
      steps: [`Follow the slope marks from $${tuple([0, y0])}$.`, answer],
      distractors: distinctDistractors(answer, wrongs, () => null),
      check: { kind: 'calculus.slopefield', task: 'sketch' },
    };
  },
});

// ---------------------------------------------------------------- Euler's method

interface Mono {
  c: number;
  i: number;
  j: number;
}
const monoTex = (ts: Mono[]) =>
  sum(ts.map((t) => ({ coef: t.c, sym: `${t.i === 0 ? '' : t.i === 1 ? 'x' : `x^{${t.i}}`}${t.j === 0 ? '' : t.j === 1 ? 'y' : `y^{${t.j}}`}` })));
const monoEval = (ts: Mono[], x: Frac, y: Frac) => ts.reduce((s, t) => s.add(x.pow(t.i).mul(y.pow(t.j)).mul(t.c)), Frac.ZERO);

/** Exact decimal for a terminating fraction, otherwise the fraction. */
function exactTex(f: Frac): string {
  let d = f.d;
  let k = 0;
  while (d % 2 === 0) {
    d /= 2;
    k++;
  }
  let k5 = 0;
  while (d % 5 === 0) {
    d /= 5;
    k5++;
  }
  if (d !== 1 || Math.max(k, k5) > 10) return num(f);
  return String(Number(f.value.toFixed(Math.max(k, k5))));
}

export const eulersMethod = defineTopic({
  id: 'calc.eulers-method',
  subject: 'calculus',
  category: 'Differential Equations',
  title: "Euler's Method",
  description: 'Approximate a solution value of an initial value problem with a few steps of Euler’s method.',
  instruction: "Use Euler's method with the given step size to approximate the indicated value.",
  multipleChoice: true,
  defaultCount: 6,
  options: [],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const FORMS: Mono[][] = [
      [{ c: 1, i: 1, j: 0 }, { c: 1, i: 0, j: 1 }],
      [{ c: 1, i: 1, j: 0 }, { c: -1, i: 0, j: 1 }],
      [{ c: 2, i: 1, j: 0 }, { c: -1, i: 0, j: 1 }],
      [{ c: 1, i: 1, j: 1 }],
      [{ c: 1, i: 2, j: 0 }, { c: 1, i: 0, j: 1 }],
      [{ c: 1, i: 0, j: 1 }, { c: -1, i: 2, j: 0 }],
      [{ c: 3, i: 1, j: 0 }, { c: -2, i: 0, j: 1 }],
      [{ c: 1, i: 0, j: 0 }, { c: 1, i: 1, j: 1 }],
    ];
    const F = rng.pick(difficulty === 'easy' ? FORMS.slice(0, 3) : FORMS).map((t) => ({ ...t, c: t.c * (difficulty === 'hard' ? rng.pick([1, 1, 2, -1]) : 1) }));
    const h = difficulty === 'easy' ? rng.pick([new Frac(1), new Frac(1, 2)]) : rng.pick([new Frac(1, 2), new Frac(1, 4), new Frac(1, 10)]);
    const n = difficulty === 'easy' ? 2 : rng.int(2, difficulty === 'hard' ? 4 : 3);
    const x0 = new Frac(rng.int(-1, 2));
    const y0 = new Frac(rng.signedInt(1, 4, true));
    let x = x0;
    let y = y0;
    const steps: string[] = [];
    const ys: Frac[] = [y0];
    for (let k = 0; k < n; k++) {
      const s = monoEval(F, x, y);
      const ny = y.add(h.mul(s));
      steps.push(`$y(${exactTex(x.add(h))}) \\approx ${exactTex(y)} + ${h.eq(1) ? '' : exactTex(h)}(${exactTex(s)}) = ${exactTex(ny)}$`);
      x = x.add(h);
      y = ny;
      ys.push(y);
    }
    const T = x;
    const answer = m(`y(${exactTex(T)}) \\approx ${exactTex(y)}`);
    // mistakes: one step too few, slope at the new point, step of 1
    let back = y0;
    let xb = x0;
    for (let k = 0; k < n; k++) {
      xb = xb.add(h);
      back = back.add(h.mul(monoEval(F, xb, back)));
    }
    const wrongs = [ys[n - 1]!, back, ys[n]!.add(h.mul(monoEval(F, T, ys[n]!)))].map((v) => m(`y(${exactTex(T)}) \\approx ${exactTex(v)}`));
    return {
      question: `$${deTex(monoTex(F))}$, $y(${exactTex(x0)}) = ${exactTex(y0)}$, $h = ${exactTex(h)}$; approximate $y(${exactTex(T)})$`,
      answer,
      steps,
      distractors: distinctDistractors(answer, wrongs, (k) => m(`y(${exactTex(T)}) \\approx ${exactTex(y.add(offset(k)))}`)),
      check: { kind: 'calculus.euler' },
    };
  },
});

// ---------------------------------------------------------------- separable equations

interface Sep {
  de: string;
  general: string;
  particular: (y0: number) => string | null;
  wrongGeneral: string[];
  sep: string;
  y0s: number[];
}

function separableFor(rng: Rng, d: Difficulty): Sep {
  const kinds = d === 'easy' ? ['kxy', 'cooling'] : d === 'medium' ? ['kxy', 'y2', 'cube', 'cooling'] : ['y2', 'cube', 'cosy', 'expxy', 'tan', 'kxy'];
  const kind = rng.pick(kinds);
  switch (kind) {
    case 'kxy': {
      const k = rng.signedInt(1, 4, true);
      const n = rng.int(0, 2);
      const xp = n + 1 === 1 ? 'x' : `x^{${n + 1}}`;
      const e = sum([{ coef: new Frac(k, n + 1), sym: xp }]);
      const xn = n === 0 ? '' : n === 1 ? 'x' : `x^{${n}}`;
      return {
        de: `${lead(k)}${xn}y`,
        general: `Ce^{${e}}`,
        particular: (y0) => `${lead(y0)}e^{${e}}`,
        wrongGeneral: [`e^{${e}} + C`, `Ce^{${sum([{ coef: new Frac(-k, n + 1), sym: xp }])}}`, `Ce^{${sum([{ coef: k * (n + 1), sym: xp }])}}`],
        sep: `\\frac{dy}{y} = ${kdx(k, xn)}`,
        y0s: [-3, -2, -1, 1, 2, 3, 4, 5],
      };
    }
    case 'cooling': {
      const k = rng.signedInt(1, 3, true);
      const M = rng.int(-5, 9);
      const dy = M === 0 ? 'y' : `y ${M > 0 ? '-' : '+'} ${Math.abs(M)}`;
      const E = `e^{${lin(k)}}`;
      return {
        de: k === 1 ? dy : `${lead(k)}(${dy})`,
        general: sum([{ coef: M }, { coef: 1, sym: `C${E}` }]),
        particular: (y0) => (y0 === M ? null : sum([{ coef: M }, { coef: y0 - M, sym: E }])),
        wrongGeneral: [sum([{ coef: -M }, { coef: 1, sym: `C${E}` }]), sum([{ coef: M }, { coef: 1, sym: `Ce^{${lin(-k)}}` }]), `${sum([{ coef: M }, { coef: 1, sym: E }])} + C`],
        sep: `\\frac{dy}{${dy}} = ${kdx(k)}`,
        y0s: [M - 2, M - 1, M + 1, M + 3],
      };
    }
    case 'y2': {
      const k = rng.signedInt(1, 4, true);
      return {
        de: `${lead(k)}y^{2}`,
        general: `-\\frac{1}{${lin(k)} + C}`,
        particular: (y0) => {
          // y = y0 / (1 − k y0 x)
          const kk = k * y0;
          return `${y0 < 0 ? '-' : ''}\\frac{${Math.abs(y0)}}{1 ${kk > 0 ? '-' : '+'} ${lin(Math.abs(kk))}}`;
        },
        wrongGeneral: [`\\frac{1}{${lin(k)} + C}`, `-\\frac{1}{${lin(k)}} + C`, `Ce^{${lin(k)}}`],
        sep: `\\frac{dy}{y^{2}} = ${kdx(k)}`,
        y0s: [-2, -1, 1, 2],
      };
    }
    case 'cube': {
      const mm = rng.int(1, 3);
      const q = new Frac(3, mm + 1);
      const xp = `x^{${mm + 1}}`;
      return {
        de: `\\frac{x${mm === 1 ? '' : `^{${mm}}`}}{y^{2}}`,
        general: `\\sqrt[3]{${sum([{ coef: q, sym: xp }])} + C}`,
        particular: (y0) => `\\sqrt[3]{${sum([{ coef: q, sym: xp }, { coef: y0 ** 3 }])}}`,
        wrongGeneral: [`\\sqrt[3]{${sum([{ coef: new Frac(1, mm + 1), sym: xp }])}} + C`, `\\sqrt[3]{${sum([{ coef: new Frac(1, mm + 1), sym: xp }])} + C}`, `\\sqrt{${sum([{ coef: new Frac(2, mm + 1), sym: xp }])} + C}`],
        sep: `y^{2}\\,dy = x${mm === 1 ? '' : `^{${mm}}`}\\,dx`,
        y0s: [-2, -1, 1, 2, 3],
      };
    }
    case 'cosy': {
      const k = rng.signedInt(1, 3, true);
      const fn = rng.pick(['cos', 'sin']);
      // y' = k y cos x → C e^{k sin x};  y' = k y sin x → C e^{−k cos x}
      const E = fn === 'cos' ? `e^{${lead(k)}\\sin x}` : `e^{${lead(-k)}\\cos x}`;
      const W = fn === 'cos' ? `e^{${lead(k)}\\cos x}` : `e^{${lead(k)}\\cos x}`;
      return {
        de: `${lead(k)}y\\${fn} x`,
        general: `C${E}`,
        particular: (y0) => (fn === 'sin' ? `${lead(y0)}e^{${k === 1 ? '1 - \\cos x' : `${lead(k)}(1 - \\cos x)`}}` : `${lead(y0)}${E}`),
        wrongGeneral: [`${E} + C`, `C${W}`, `C${fn === 'cos' ? `e^{${lead(-k)}\\sin x}` : `e^{${lead(k)}\\sin x}`}`],
        sep: `\\frac{dy}{y} = ${lead(k)}\\${fn} x\\,dx`,
        y0s: [-3, -2, -1, 1, 2, 3],
      };
    }
    case 'expxy': {
      const a = rng.int(1, 4);
      const aE = a === 1 ? 'e^{x}' : `${a}e^{x}`;
      return {
        de: a === 1 ? 'e^{x - y}' : `${a}e^{x - y}`,
        general: `\\ln(${aE} + C)`,
        particular: (y0) => {
          // e^{y} = a e^{x} + e^{y0} − a
          if (y0 === 0) return a === 1 ? 'x' : `\\ln(${aE} - ${a - 1})`;
          return `\\ln(${aE} + e${y0 === 1 ? '' : `^{${y0}}`} - ${a})`;
        },
        wrongGeneral: [`\\ln(${aE}) + C`, `${aE} + C`, `\\ln(${a === 1 ? '' : a}e^{-x} + C)`],
        sep: `e^{y}\\,dy = ${aE}\\,dx`,
        y0s: [0, 1, 2, 3],
      };
    }
    case 'tan':
    default: {
      const k = rng.int(1, 3);
      const half = sum([{ coef: new Frac(k, 2), sym: 'x^{2}' }]);
      return {
        de: `${k === 1 ? '' : k}x(1 + y^{2})`,
        general: `\\tan\\left(${half} + C\\right)`,
        particular: (y0) => (y0 === 0 ? `\\tan\\left(${half}\\right)` : y0 === 1 ? `\\tan\\left(${half} + \\frac{\\pi}{4}\\right)` : `\\tan\\left(${half} - \\frac{\\pi}{4}\\right)`),
        wrongGeneral: [`\\tan\\left(${half}\\right) + C`, `\\tan(${k === 1 ? '' : k}x^{2} + C)`, `\\tan^{-1}\\left(${half} + C\\right)`],
        sep: `\\frac{dy}{1 + y^{2}} = ${k === 1 ? '' : k}x\\,dx`,
        y0s: [0, 1, -1],
      };
    }
  }
}

/** Put a number in for C: `+ C` → `- 2`, a leading `C` → coefficient, other C → bracketed. */
const subC = (w: string, v: number) =>
  w
    .replace(/\+ C/g, v < 0 ? `- ${-v}` : `+ ${v}`)
    .replace(/(^|[({ ])C(?=[a-z\\])/g, (_s, pre: string) => `${pre}${lead(v)}`)
    .replace(/C/g, v < 0 ? `(${v})` : String(v));
const lin = (k: number, v = 'x') => (k === 1 ? v : k === -1 ? `-${v}` : `${k}${v}`);
/** k·(factor)·dx tidily: `dx`, `-x\,dx`, `3x^{2}\,dx`. */
const kdx = (k: number, factor = '') => (factor ? `${lead(k)}${factor}\\,dx` : k === 1 ? 'dx' : k === -1 ? '-dx' : `${k}\\,dx`);

export const separableEquations = defineTopic({
  id: 'calc.separable-equations',
  subject: 'calculus',
  category: 'Differential Equations',
  title: 'Separable Differential Equations',
  description: 'General and particular solutions of separable differential equations.',
  instruction: (o) => (o.type === 'general' ? 'Find the general solution of each differential equation.' : 'Solve each initial value problem.'),
  multipleChoice: true,
  defaultCount: 8,
  options: [
    {
      type: 'select',
      id: 'type',
      label: 'Solution',
      default: 'particular',
      choices: [
        { value: 'particular', label: 'Particular (initial value problems)' },
        { value: 'general', label: 'General solution' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const general = strOpt(ctx, 'type') === 'general';
    const s = separableFor(rng, difficulty);
    const steps = [`Separate: $${s.sep}$`, 'Integrate both sides and solve for $y$.'];
    if (general) {
      const answer = m(`y = ${s.general}`);
      return {
        question: m(deTex(s.de)),
        answer,
        steps: [...steps, answer],
        distractors: distinctDistractors(answer, s.wrongGeneral.map((w) => m(`y = ${w}`)), (q) => m(`y = ${s.general} + ${q}`)),
        check: { kind: 'calculus.ode' },
      };
    }
    const { y0, part } = attempt('ivp', () => {
      const y0 = rng.pick(s.y0s);
      const part = s.particular(y0);
      return part ? { y0, part } : null;
    });
    const answer = m(`y = ${part}`);
    const others = s.y0s.filter((v) => v !== y0).map((v) => s.particular(v)).filter((v): v is string => !!v);
    return {
      question: `$${deTex(s.de)}$, $y(0) = ${y0}$`,
      answer,
      steps: [...steps, `Use $y(0) = ${y0}$ to find the constant.`, answer],
      distractors: distinctDistractors(answer, [...others.map((w) => m(`y = ${w}`)), ...s.wrongGeneral.map((w) => m(`y = ${subC(w, y0)}`))], (q) => m(`y = ${part} + ${q}`)),
      check: { kind: 'calculus.ode', pts: [0.03, 0.06, -0.05, -0.08, 0.045] },
    };
  },
});

// ---------------------------------------------------------------- exponential growth and decay

const round = (v: number, places: number) => decimal(v, places);

export const exponentialModels = defineTopic({
  id: 'calc.exponential-models',
  subject: 'calculus',
  category: 'Differential Equations',
  title: 'Exponential Growth and Decay',
  description: 'Word problems modeled by dy/dt = ky: growth, half-life, continuous interest and Newton’s law of cooling.',
  instruction: 'Solve each problem. Round to the nearest tenth unless told otherwise.',
  multipleChoice: true,
  defaultCount: 5,
  options: [],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const kind = rng.pick(difficulty === 'easy' ? ['bacteria', 'halflife', 'interest'] : difficulty === 'medium' ? ['bacteria', 'halflife', 'time', 'interest'] : ['cooling', 'time', 'findk', 'halflife']);
    const name = pickName(rng);
    let question: string;
    let value: number;
    let lhs: string;
    let unit: string;
    let wrongVals: number[];
    let places = 1;
    const steps: string[] = [];
    switch (kind) {
      case 'bacteria': {
        const N0 = rng.int(2, 9) * 100;
        const factor = rng.pick([2, 3, 1.5, 4]);
        const t1 = rng.int(2, 6);
        const t2 = t1 + rng.int(1, 6);
        const k = Math.log(factor) / t1;
        value = N0 * Math.exp(k * t2);
        question = `A bacteria culture grows at a rate proportional to its size. It starts with $${N0}$ bacteria and has $${N0 * factor}$ after $${t1}$ hours. How many bacteria are there after $${t2}$ hours?`;
        lhs = `y(${t2})`;
        unit = 'bacteria';
        steps.push(`$y = ${N0}e^{kt}$ with $k = \\frac{\\ln ${factor}}{${t1}}$`);
        wrongVals = [N0 * factor * (t2 / t1), N0 * Math.exp(factor * t2 / t1), N0 * factor ** (t1 / t2)];
        break;
      }
      case 'halflife': {
        const M = rng.int(2, 20) * 10;
        const H = rng.pick([5, 8, 10, 12, 20, 25, 30]);
        const t = rng.int(2, 8) * 5;
        value = M * 0.5 ** (t / H);
        question = `A radioactive substance has a half-life of $${H}$ years. If there are $${M}$ grams now, how much will remain after $${t}$ years?`;
        lhs = `y(${t})`;
        unit = 'g';
        steps.push(`$y = ${M}e^{-kt}$ with $k = \\frac{\\ln 2}{${H}}$`);
        wrongVals = [M * Math.max(0, 1 - t / (2 * H)), M * Math.exp(-t / H), M / 2 ** (H / t)];
        break;
      }
      case 'interest': {
        const P = rng.int(5, 50) * 100;
        const r = rng.int(2, 8);
        const t = rng.int(3, 20);
        value = P * Math.exp((r / 100) * t);
        places = 2;
        question = `${name} invests \\$${P} at $${r}\\%$ interest compounded continuously. What is the balance after $${t}$ years? (Round to the nearest cent.)`;
        lhs = `A(${t})`;
        unit = 'dollars';
        steps.push(`$\\frac{dA}{dt} = ${r / 100}A$, so $A = ${P}e^{${r / 100}t}$`);
        wrongVals = [P * (1 + r / 100) ** t, P * (1 + (r * t) / 100), P * Math.exp(r * t / 1000)];
        break;
      }
      case 'time': {
        const N0 = rng.int(2, 9) * 100;
        const rate = rng.int(2, 9);
        const mult = rng.pick([2, 3, 5, 10]);
        value = Math.log(mult) / (rate / 100);
        question = `A population of $${N0}$ grows according to $\\frac{dP}{dt} = ${rate / 100}P$ ($t$ in years). How long until the population is $${N0 * mult}$?`;
        lhs = 't';
        unit = 'years';
        steps.push(`$${N0 * mult} = ${N0}e^{${rate / 100}t}$, so $t = \\frac{\\ln ${mult}}{${rate / 100}}$`);
        wrongVals = [mult / (rate / 100), Math.log(mult * N0) / (rate / 100), Math.log10(mult) / (rate / 100)];
        break;
      }
      case 'findk': {
        const N0 = rng.int(2, 9) * 100;
        const t1 = rng.int(2, 8);
        const N1 = N0 + rng.int(1, 9) * 50;
        value = Math.log(N1 / N0) / t1;
        places = 4;
        question = `A quantity grows according to $\\frac{dy}{dt} = ky$. It is $${N0}$ at $t = 0$ and $${N1}$ at $t = ${t1}$. Find $k$ to four decimal places.`;
        lhs = 'k';
        unit = '';
        steps.push(`$${N1} = ${N0}e^{${t1}k}$, so $k = \\frac{1}{${t1}}\\ln\\frac{${N1}}{${N0}}$`);
        wrongVals = [(N1 - N0) / (N0 * t1), Math.log(N1 - N0) / t1, Math.log(N1 / N0) * t1];
        break;
      }
      case 'cooling':
      default: {
        const Ta = rng.int(15, 25);
        const T0 = rng.int(80, 98);
        const t1 = rng.int(5, 15);
        const T1 = rng.int(Math.round((T0 + Ta) / 2) + 2, T0 - 5);
        const t2 = t1 + rng.int(5, 20);
        const k = Math.log((T1 - Ta) / (T0 - Ta)) / t1;
        value = Ta + (T0 - Ta) * Math.exp(k * t2);
        question = `A cup of coffee at $${T0}^\\circ\\text{C}$ cools in a $${Ta}^\\circ\\text{C}$ room according to $\\frac{dT}{dt} = k(T - ${Ta})$. After $${t1}$ minutes it is $${T1}^\\circ\\text{C}$. What is its temperature after $${t2}$ minutes?`;
        lhs = `T(${t2})`;
        unit = '°C';
        steps.push(`$T = ${Ta} + ${T0 - Ta}e^{kt}$ with $k = \\frac{1}{${t1}}\\ln\\frac{${T1 - Ta}}{${T0 - Ta}}$`);
        wrongVals = [T0 * Math.exp((Math.log(T1 / T0) / t1) * t2), Ta + (T0 - Ta) * Math.exp(k * (t2 - t1)), T1 - ((T0 - T1) / t1) * (t2 - t1)];
        break;
      }
    }
    const show = (v: number) => `$${lhs} \\approx ${round(v, places)}$${unit ? ` ${unit}` : ''}`;
    const answer = show(value);
    steps.push(answer);
    return {
      question,
      answer,
      steps,
      distractors: distinctDistractors(answer, wrongVals.filter((v) => Number.isFinite(v) && v > 0).map(show), (k) => show(value * (1 + offset(k) * 0.1))),
      check: { kind: 'expect', value, tol: (0.51 * 10 ** -places) / Math.max(1, Math.abs(value)) },
    };
  },
});

// ---------------------------------------------------------------- logistic growth

export const logisticGrowth = defineTopic({
  id: 'calc.logistic-growth',
  subject: 'calculus',
  category: 'Differential Equations',
  title: 'Logistic Growth',
  description: 'Carrying capacity, fastest growth, long-run limits and solutions of logistic differential equations.',
  instruction: 'Answer each question about the logistic model.',
  multipleChoice: true,
  defaultCount: 6,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Questions',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'capacity', label: 'Carrying capacity' },
        { value: 'fastest', label: 'Where growth is fastest' },
        { value: 'limit', label: 'Long-run limit' },
        { value: 'solve', label: 'Solve the equation' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const tOpt = strOpt(ctx, 'task');
    const task = tOpt === 'any' ? rng.pick(difficulty === 'easy' ? ['capacity', 'fastest', 'limit'] : ['capacity', 'fastest', 'limit', 'solve']) : tOpt;
    const K = rng.int(2, 30) * (difficulty === 'easy' ? 10 : 50);
    const kNum = rng.int(1, 9);
    const k = new Frac(kNum, 10);
    const expanded = difficulty === 'hard' && task !== 'solve' && rng.bool(0.6);
    // kP(1 − P/K) = kP − (k/K)P²
    const kd = decimal(k.value, 1);
    const rhs = expanded ? `${kd}P - ${num(k.div(K))}P^{2}` : `${kd}P\\left(1 - \\frac{P}{${K}}\\right)`;
    const de = `\\frac{dP}{dt} = ${rhs}`;
    const P0 = rng.int(1, Math.max(1, K / 10 - 1)) * 10;
    let question: string;
    let answer: string;
    let wrongs: string[];
    const steps: string[] = [];
    switch (task) {
      case 'capacity':
        question = `$${de}$. What is the carrying capacity?`;
        answer = m(`${K}`);
        wrongs = [`${K / 2}`, kd, `${2 * K}`].map(m);
        steps.push(expanded ? `Factor: $${kd}P\\left(1 - \\frac{P}{${K}}\\right)$` : 'Read $K$ from $kP\\left(1 - \\frac{P}{K}\\right)$.', answer);
        break;
      case 'fastest':
        question = `$${de}$. For what value of $P$ is the population growing fastest?`;
        answer = m(`P = ${num(new Frac(K, 2))}`);
        wrongs = [`P = ${K}`, `P = ${num(new Frac(K, 4))}`, `P = ${kd}`].map(m);
        steps.push('$\\frac{dP}{dt}$ is a downward parabola in $P$ with zeros $0$ and $K$; its maximum is at $P = \\frac{K}{2}$.', answer);
        break;
      case 'limit':
        question = `$${de}$, $P(0) = ${P0}$. Find $\\displaystyle \\lim_{t \\to \\infty} P(t)$.`;
        answer = m(`${K}`);
        wrongs = [`${num(new Frac(K, 2))}`, '\\infty', `${P0}`, '0'].map(m);
        steps.push(`Starting between $0$ and $${K}$, solutions increase toward the carrying capacity.`, answer);
        break;
      case 'solve':
      default: {
        const A = new Frac(K - P0, P0);
        const sol = (a: Frac) => `\\frac{${K}}{1 + ${a.eq(1) ? '' : num(a)}e^{-${kd}t}}`;
        question = `$${de}$, $P(0) = ${P0}$. Solve for $P(t)$.`;
        answer = m(`P = ${sol(A)}`);
        wrongs = [m(`P = ${sol(new Frac(P0, K - P0))}`), m(`P = \\frac{${K}}{1 + ${num(A)}e^{${kd}t}}`.replace('1 + 1e', '1 + e')), m(`P = ${P0}e^{${kd}t}`)];
        steps.push('$P = \\frac{K}{1 + Ae^{-kt}}$ with $A = \\frac{K - P_0}{P_0}$', answer);
        break;
      }
    }
    return {
      question,
      answer,
      steps,
      distractors: distinctDistractors(answer, wrongs, (q) => m(`${K + offset(q) * 10}`)),
      check: task === 'solve' ? { kind: 'calculus.ode', pts: [0.5, 1.5, 3, 7, 12] } : { kind: 'calculus.logistic', task },
    };
  },
});
