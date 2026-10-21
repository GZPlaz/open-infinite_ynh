/** Parametric equations: eliminating the parameter, and graphing with orientation. */
import { graphPlane, plotParam } from '../../diagram';
import { Frac } from '../../fraction';
import { attempt, defineTopic, distinctDistractors } from '../../generator';
import type { Rng } from '../../rng';
import { decimal, linear, m, sum, term, tuple } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';

interface Param {
  x: string;
  y: string;
  /** rectangular equation */
  eq: string;
  restriction?: string;
  wrong: string[];
  fx: (t: number) => number;
  fy: (t: number) => number;
  step: string;
}

const sq = (h: number, v: string) => (h === 0 ? `${v}^{2}` : `(${linear(1, -h).replace(/x/g, v)})^{2}`);
const over = (top: string, d: number) => (d === 1 ? top : `\\frac{${top}}{${d}}`);

type Kind = 'linLin' | 'linQuad' | 'sqrt' | 'ellipse' | 'hyperbola' | 'double' | 'exp' | 'recip';
const KINDS: Record<Difficulty, Kind[]> = {
  easy: ['linLin', 'linQuad'],
  medium: ['linQuad', 'sqrt', 'ellipse', 'recip', 'linLin'],
  hard: ['ellipse', 'hyperbola', 'double', 'exp', 'sqrt'],
};

function build(rng: Rng, kind: Kind): Param {
  switch (kind) {
    case 'linLin': {
      const a = rng.signedInt(1, 3, true);
      const b = rng.int(-6, 6);
      const c = rng.signedInt(1, 4, true);
      const d = rng.int(-6, 6);
      const mm = new Frac(c, a);
      const k = new Frac(d).sub(mm.mul(b));
      const line = (s: Frac, i: Frac) => `y = ${sum([{ coef: s, sym: 'x' }, { coef: i }])}`;
      return {
        x: linear(a, b, 't'),
        y: linear(c, d, 't'),
        eq: line(mm, k),
        wrong: [line(mm.inv(), k), line(mm, new Frac(d).add(mm.mul(b))), line(mm.neg(), k), line(mm, new Frac(d))],
        fx: (t) => a * t + b,
        fy: (t) => c * t + d,
        step: `Solve for ${m('t')}: ${m(`t = ${a === 1 ? linear(1, -b) : `\\frac{${linear(1, -b)}}{${a}}`}`)}, then substitute into ${m('y')}.`,
      };
    }
    case 'linQuad': {
      const b = rng.int(-5, 5);
      const a = rng.signedInt(1, 3, true);
      const c = rng.int(-6, 6);
      const y = (aa: number, h: number, cc: number) => `y = ${sum([{ coef: aa, sym: sq(h, 'x') }, { coef: cc }])}`;
      return {
        x: linear(1, b, 't'),
        y: sum([{ coef: a, sym: 't^{2}' }, { coef: c }]),
        eq: y(a, b, c),
        wrong: [y(a, -b, c), y(a, b, -c), y(-a, b, c), b === 0 ? y(a, 1, c) : y(a, 0, c)],
        fx: (t) => t + b,
        fy: (t) => a * t * t + c,
        step: `${m(`t = ${linear(1, -b)}`)}; substitute into ${m('y')}.`,
      };
    }
    case 'sqrt': {
      const a = rng.signedInt(1, 4, true);
      const c = rng.int(-6, 6);
      const y = (s: string) => `y = ${sum([{ coef: a, sym: s }, { coef: c }])}`;
      return {
        x: '\\sqrt{t}',
        y: sum([{ coef: a, sym: 't' }, { coef: c }]),
        eq: y('x^{2}'),
        restriction: 'x \\ge 0',
        wrong: [y('\\sqrt{x}'), y('x'), `y = ${sum([{ coef: a, sym: 'x^{2}' }, { coef: -c }])}`],
        fx: (t) => Math.sqrt(t),
        fy: (t) => a * t + c,
        step: `${m('t = x^{2}')} and ${m('x = \\sqrt{t} \\ge 0')}.`,
      };
    }
    case 'ellipse': {
      const a = rng.int(2, 5);
      const b = rng.bool(0.3) ? a : rng.intExcept(2, 5, [a]);
      const h = rng.int(-4, 4);
      const k = rng.int(-4, 4);
      const X = h === 0 ? 'x^{2}' : sq(h, 'x');
      const Y = k === 0 ? 'y^{2}' : sq(k, 'y');
      const eq = a === b ? `${X} + ${Y} = ${a * a}` : `\\frac{${X}}{${a * a}} + \\frac{${Y}}{${b * b}} = 1`;
      const alt = (A: number, B: number, hh: number, kk: number) => {
        const XX = hh === 0 ? 'x^{2}' : sq(hh, 'x');
        const YY = kk === 0 ? 'y^{2}' : sq(kk, 'y');
        return A === B ? `${XX} + ${YY} = ${A * A}` : `\\frac{${XX}}{${A * A}} + \\frac{${YY}}{${B * B}} = 1`;
      };
      return {
        x: sum([{ coef: a, sym: '\\cos t' }, { coef: h }]),
        y: sum([{ coef: b, sym: '\\sin t' }, { coef: k }]),
        eq,
        wrong: [alt(b, a, h, k), alt(a, b, -h, -k), a === b ? `${X} + ${Y} = ${a}` : `\\frac{${X}}{${a}} + \\frac{${Y}}{${b}} = 1`, a === b ? `${X} - ${Y} = ${a * a}` : `\\frac{${X}}{${a * a}} - \\frac{${Y}}{${b * b}} = 1`],
        fx: (t) => a * Math.cos(t) + h,
        fy: (t) => b * Math.sin(t) + k,
        step: `${m(`\\cos t = ${over(h === 0 ? 'x' : linear(1, -h), a)}`)}, ${m(`\\sin t = ${over(k === 0 ? 'y' : linear(1, -k).replace('x', 'y'), b)}`)}; use ${m('\\cos^{2} t + \\sin^{2} t = 1')}.`,
      };
    }
    case 'hyperbola': {
      const a = rng.int(1, 5);
      const b = rng.int(1, 5);
      const fr = (v: string, d: number) => (d === 1 ? `${v}^{2}` : `\\frac{${v}^{2}}{${d * d}}`);
      return {
        x: term(a, '\\sec t'),
        y: term(b, '\\tan t'),
        eq: `${fr('x', a)} - ${fr('y', b)} = 1`,
        wrong: [`${fr('y', b)} - ${fr('x', a)} = 1`, `${fr('x', a)} + ${fr('y', b)} = 1`, `${fr('x', b)} - ${fr('y', a)} = 1`],
        fx: (t) => a / Math.cos(t),
        fy: (t) => b * Math.tan(t),
        step: `Use ${m('\\sec^{2} t - \\tan^{2} t = 1')}.`,
      };
    }
    case 'double': {
      const k = rng.signedInt(1, 4, true);
      const useSin = rng.bool();
      // cos 2t = 1 − 2sin²t = 2cos²t − 1
      const eq = useSin ? `y = ${sum([{ coef: -2 * k, sym: 'x^{2}' }, { coef: k }])}` : `y = ${sum([{ coef: 2 * k, sym: 'x^{2}' }, { coef: -k }])}`;
      return {
        x: useSin ? '\\sin t' : '\\cos t',
        y: term(k, '\\cos(2t)'),
        eq,
        restriction: '-1 \\le x \\le 1',
        wrong: [useSin ? `y = ${sum([{ coef: 2 * k, sym: 'x^{2}' }, { coef: -k }])}` : `y = ${sum([{ coef: -2 * k, sym: 'x^{2}' }, { coef: k }])}`, `y = ${sum([{ coef: 2 * k, sym: 'x' }])}`, `y = ${sum([{ coef: k, sym: 'x^{2}' }])}`],
        fx: (t) => (useSin ? Math.sin(t) : Math.cos(t)),
        fy: (t) => k * Math.cos(2 * t),
        step: `Use ${m(useSin ? '\\cos 2t = 1 - 2\\sin^{2} t' : '\\cos 2t = 2\\cos^{2} t - 1')}; also ${m('-1 \\le x \\le 1')}.`,
      };
    }
    case 'exp': {
      const c = rng.int(-6, 6);
      const recip = rng.bool();
      const a = rng.signedInt(1, 5, true);
      return recip
        ? {
            x: 'e^{t}',
            y: term(a, 'e^{-t}'),
            eq: `y = ${a < 0 ? '-' : ''}\\frac{${Math.abs(a)}}{x}`,
            restriction: 'x > 0',
            wrong: [`y = ${term(a, 'x')}`, `y = ${a > 0 ? '-' : ''}\\frac{${Math.abs(a)}}{x}`, `y = ${term(a, 'x^{2}')}`],
            fx: (t) => Math.exp(t),
            fy: (t) => a * Math.exp(-t),
            step: `${m('e^{-t} = \\frac{1}{x}')} with ${m('x = e^{t} > 0')}.`,
          }
        : {
            x: 'e^{t}',
            y: sum([{ coef: a, sym: 'e^{2t}' }, { coef: c }]),
            eq: `y = ${sum([{ coef: a, sym: 'x^{2}' }, { coef: c }])}`,
            restriction: 'x > 0',
            wrong: [`y = ${sum([{ coef: 2 * a, sym: 'x' }, { coef: c }])}`, `y = ${sum([{ coef: a, sym: 'x^{2}' }, { coef: -c }])}`, `y = ${sum([{ coef: a, sym: 'e^{x}' }, { coef: c }])}`],
            fx: (t) => Math.exp(t),
            fy: (t) => a * Math.exp(2 * t) + c,
            step: `${m('e^{2t} = (e^{t})^{2} = x^{2}')} with ${m('x > 0')}.`,
          };
    }
    case 'recip':
    default: {
      const a = rng.signedInt(1, 6, true);
      const b = rng.signedInt(1, 5, true);
      const y = (aa: number, h: number) => `y = ${aa < 0 ? '-' : ''}\\frac{${Math.abs(aa)}}{${linear(1, -h)}}`;
      return {
        x: linear(1, b, 't'),
        y: `${a < 0 ? '-' : ''}\\frac{${Math.abs(a)}}{t}`,
        eq: y(a, b),
        wrong: [y(a, -b), y(-a, b), `y = ${sum([{ coef: a, sym: 'x' }, { coef: -a * b }])}`],
        fx: (t) => t + b,
        fy: (t) => a / t,
        step: `${m(`t = ${linear(1, -b)}`)}; substitute into ${m('y')}.`,
      };
    }
  }
}

const fmt = (eq: string, restriction?: string) => (restriction ? `${m(eq)}, ${m(restriction)}` : m(eq));

export const eliminateParameter = defineTopic({
  id: 'precalc.parametric.eliminate',
  subject: 'precalculus',
  category: 'Parametric Equations',
  title: 'Eliminating the Parameter',
  description: 'Rewrite parametric equations as a rectangular equation, noting any restriction on x.',
  instruction: 'Eliminate the parameter. State any restriction on x.',
  multipleChoice: true,
  defaultCount: 10,
  options: [],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const p = build(rng, rng.pick(KINDS[difficulty]));
    const answer = fmt(p.eq, p.restriction);
    return {
      question: `${m(`x = ${p.x}`)}, ${m(`y = ${p.y}`)}`,
      answer,
      steps: [p.step, answer],
      distractors: distinctDistractors(answer, p.wrong.map((w) => fmt(w, p.restriction)), (k) => fmt(`${p.eq} + ${k}`, p.restriction)),
      check: { kind: 'precalculus.eliminate' },
    };
  },
});

// ---------------------------------------------------------------- graphing

interface GraphSpec {
  x: string;
  y: string;
  t0: number;
  t1: number;
  t0Tex: string;
  t1Tex: string;
  eq: string;
  fx: (t: number) => number;
  fy: (t: number) => number;
  closed: boolean;
}

function graphSpec(rng: Rng, d: Difficulty): GraphSpec {
  return attempt('param-graph', () => {
    const s = rawSpec(rng, d);
    for (let i = 0; i <= 40; i++) {
      const t = s.t0 + ((s.t1 - s.t0) * i) / 40;
      if (Math.abs(s.fx(t)) > 9.5 || Math.abs(s.fy(t)) > 9.5) return null;
    }
    return s;
  });
}

function rawSpec(rng: Rng, d: Difficulty): GraphSpec {
  return (() => {
    const kind = rng.pick(d === 'easy' ? ['line', 'parab'] : d === 'medium' ? ['line', 'parab', 'side', 'circle'] : ['side', 'circle', 'half', 'parab']);
    if (kind === 'line') {
      const a = rng.signedInt(1, 3, true);
      const b = rng.int(-3, 3);
      const c = rng.signedInt(1, 3, true);
      const e = rng.int(-3, 3);
      const t0 = rng.int(-3, -1);
      const t1 = rng.int(1, 3);
      const mm = new Frac(c, a);
      const k = new Frac(e).sub(mm.mul(b));
      const s: GraphSpec = { x: linear(a, b, 't'), y: linear(c, e, 't'), t0, t1, t0Tex: String(t0), t1Tex: String(t1), eq: `y = ${sum([{ coef: mm, sym: 'x' }, { coef: k }])}`, fx: (t) => a * t + b, fy: (t) => c * t + e, closed: false };
      return s;
    }
    if (kind === 'parab' || kind === 'side') {
      const c = rng.int(-4, 4);
      const a = rng.pick([1, -1]);
      const t0 = -3;
      const t1 = rng.int(1, 3);
      const quad = sum([{ coef: a, sym: 't^{2}' }, { coef: c }]);
      const side = kind === 'side';
      return {
        x: side ? quad : 't',
        y: side ? 't' : quad,
        t0,
        t1,
        t0Tex: String(t0),
        t1Tex: String(t1),
        eq: side ? `x = ${sum([{ coef: a, sym: 'y^{2}' }, { coef: c }])}` : `y = ${sum([{ coef: a, sym: 'x^{2}' }, { coef: c }])}`,
        fx: side ? (t) => a * t * t + c : (t) => t,
        fy: side ? (t) => t : (t) => a * t * t + c,
        closed: false,
      };
    }
    const r1 = rng.int(2, 7);
    const r2 = rng.bool(0.5) ? r1 : rng.intExcept(2, 7, [r1]);
    const swap = rng.bool();
    const half = kind === 'half';
    const [fx, fy] = swap ? [(t: number) => r1 * Math.sin(t), (t: number) => r2 * Math.cos(t)] : [(t: number) => r1 * Math.cos(t), (t: number) => r2 * Math.sin(t)];
    const eq = r1 === r2 ? `x^{2} + y^{2} = ${r1 * r1}` : `\\frac{x^{2}}{${r1 * r1}} + \\frac{y^{2}}{${r2 * r2}} = 1`;
    return {
      x: term(r1, swap ? '\\sin t' : '\\cos t'),
      y: term(r2, swap ? '\\cos t' : '\\sin t'),
      t0: 0,
      t1: half ? Math.PI : 2 * Math.PI,
      t0Tex: '0',
      t1Tex: half ? '\\pi' : '2\\pi',
      eq,
      fx,
      fy,
      closed: !half,
    };
  })();
}

export const parametricGraph = defineTopic({
  id: 'precalc.parametric.graph',
  subject: 'precalculus',
  category: 'Parametric Equations',
  title: 'Graphing Parametric Equations',
  description: 'Graph parametric equations over an interval of t and show the orientation with arrows.',
  instruction: 'Graph each pair of parametric equations. Show the orientation.',
  multipleChoice: false,
  defaultCount: 4,
  options: [{ type: 'boolean', id: 'arrows', label: 'Draw orientation arrows', default: true }],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const g = graphSpec(rng, difficulty);
    const { b, w } = graphPlane(10, 2);
    plotParam(b, g.fx, g.fy, g.t0, g.t1, w, {}, 360);
    if (ctx.options.arrows === true) {
      for (const f of [0.3, 0.7]) {
        const t = g.t0 + (g.t1 - g.t0) * f;
        const h = 1e-3;
        const dx = (g.fx(t + h) - g.fx(t - h)) / (2 * h);
        const dy = (g.fy(t + h) - g.fy(t - h)) / (2 * h);
        const n = Math.hypot(dx, dy) || 1;
        const p0: [number, number] = [g.fx(t), g.fy(t)];
        b.arrow(p0, [p0[0] + (dx / n) * 0.9, p0[1] + (dy / n) * 0.9], { ink: 'accent', weight: 1.6 });
      }
    }
    const P = (t: number) => m(tuple([decimal(g.fx(t), 2), decimal(g.fy(t), 2)]));
    const orient = g.closed ? `traced ${signedArea(g) > 0 ? 'counterclockwise' : 'clockwise'} starting at ${P(g.t0)}` : `from ${P(g.t0)} to ${P(g.t1)}`;
    const answer = `Rectangular equation: ${m(g.eq)}; ${orient}`;
    const steps = [`Eliminate ${m('t')}: ${m(g.eq)}.`, `At ${m(`t = ${g.t0Tex}`)} the point is ${P(g.t0)}; as ${m('t')} increases the curve is ${orient}.`];
    return {
      question: `${m(`x = ${g.x}`)}, ${m(`y = ${g.y}`)}, ${m(`${g.t0Tex} \\le t \\le ${g.t1Tex}`)}`,
      answer,
      steps,
      diagram: graphPlane(10, 2).b.build('Blank coordinate plane'),
      answerDiagram: b.build(`Graph of the parametric curve from t = ${g.t0Tex} to t = ${g.t1Tex}`),
      check: { kind: 'precalculus.paramGraph' },
    };
  },
});

function signedArea(g: GraphSpec): number {
  let s = 0;
  const N = 200;
  for (let i = 0; i < N; i++) {
    const a = g.t0 + ((g.t1 - g.t0) * i) / N;
    const c = g.t0 + ((g.t1 - g.t0) * (i + 1)) / N;
    s += g.fx(a) * g.fy(c) - g.fx(c) * g.fy(a);
  }
  return s;
}
