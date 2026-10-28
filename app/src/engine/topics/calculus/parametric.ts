/** Parametric, polar and vector-valued functions in the plane. */
import { Frac, type FracLike } from '../../fraction';
import { attempt, defineTopic, distinctDistractors, offset, strOpt } from '../../generator';
import { Poly } from '../../polynomial';
import { simplifySqrt } from '../../radical';
import type { Rng } from '../../rng';
import { decimal, m, num, sum, tuple } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { joinSigned, piTex, type Signed } from './common';

const ds = (t: string) => `\\displaystyle ${t}`;
/** k·√d as TeX (k rational). */
const fracRad = (k: Frac, d: number) => (k.d === 1 ? `${k.n === 1 ? '' : k.n}\\sqrt{${d}}` : `\\frac{${k.n === 1 ? '' : k.n}\\sqrt{${d}}}{${k.d}}`);
const lineTex = (mm: Frac, b: Frac) => `y = ${sum([{ coef: mm, sym: 'x' }, { coef: b }])}`;

// ---------------------------------------------------------------- exact a + b√d

/** a + b√d with rational a, b (d square-free, or 1). */
class QR {
  constructor(
    readonly a: Frac,
    readonly b: Frac,
    readonly d: number,
  ) {}
  static of(a: FracLike, b: FracLike = 0, d = 1): QR {
    return new QR(Frac.of(a), Frac.of(b), d);
  }
  private same(o: QR): number {
    if (this.b.isZero()) return o.d;
    if (o.b.isZero() || o.d === this.d) return this.d;
    throw new Error('QR: mixed radicals');
  }
  add(o: QR): QR {
    return new QR(this.a.add(o.a), this.b.add(o.b), this.same(o));
  }
  sub(o: QR): QR {
    return this.add(o.scale(-1));
  }
  scale(k: FracLike): QR {
    return new QR(this.a.mul(k), this.b.mul(k), this.d);
  }
  mul(o: QR): QR {
    const d = this.same(o);
    return new QR(this.a.mul(o.a).add(this.b.mul(o.b).mul(d)), this.a.mul(o.b).add(this.b.mul(o.a)), d);
  }
  div(o: QR): QR {
    const d = this.same(o);
    const den = o.a.mul(o.a).sub(o.b.mul(o.b).mul(d));
    return this.mul(new QR(o.a, o.b.neg(), d)).scale(den.inv());
  }
  isZero(): boolean {
    return this.a.isZero() && this.b.isZero();
  }
  get value(): number {
    return this.a.value + this.b.value * Math.sqrt(this.d);
  }
  /** Rational part and radical part as signed terms. */
  terms(): Signed[] {
    const out: Signed[] = [];
    if (!this.a.isZero()) out.push({ neg: this.a.sign < 0, body: num(this.a.abs()) });
    if (!this.b.isZero()) {
      const c = this.b.abs();
      const rad = `\\sqrt{${this.d}}`;
      out.push({ neg: this.b.sign < 0, body: c.d === 1 ? `${c.n === 1 ? '' : c.n}${rad}` : `\\frac{${c.n === 1 ? '' : c.n}${rad}}{${c.d}}` });
    }
    return out;
  }
  toTex(): string {
    return joinSigned(this.terms());
  }
}

interface Angle {
  tex: string;
  value: number;
  cos: QR;
  sin: QR;
}
const half = (k: number) => new Frac(k, 2);
const ANGLES: Angle[] = [
  { tex: '0', value: 0, cos: QR.of(1), sin: QR.of(0) },
  { tex: '\\frac{\\pi}{6}', value: Math.PI / 6, cos: QR.of(0, half(1), 3), sin: QR.of(half(1)) },
  { tex: '\\frac{\\pi}{4}', value: Math.PI / 4, cos: QR.of(0, half(1), 2), sin: QR.of(0, half(1), 2) },
  { tex: '\\frac{\\pi}{3}', value: Math.PI / 3, cos: QR.of(half(1)), sin: QR.of(0, half(1), 3) },
  { tex: '\\frac{\\pi}{2}', value: Math.PI / 2, cos: QR.of(0), sin: QR.of(1) },
  { tex: '\\frac{2\\pi}{3}', value: (2 * Math.PI) / 3, cos: QR.of(half(-1)), sin: QR.of(0, half(1), 3) },
  { tex: '\\frac{3\\pi}{4}', value: (3 * Math.PI) / 4, cos: QR.of(0, half(-1), 2), sin: QR.of(0, half(1), 2) },
  { tex: '\\frac{5\\pi}{6}', value: (5 * Math.PI) / 6, cos: QR.of(0, half(-1), 3), sin: QR.of(half(1)) },
  { tex: '\\pi', value: Math.PI, cos: QR.of(-1), sin: QR.of(0) },
];

// ---------------------------------------------------------------- parametric derivatives

function paramPolys(rng: Rng, d: Difficulty): { X: Poly; Y: Poly } {
  return attempt('param', () => {
    const X = new Poly([rng.int(-4, 4), rng.int(-4, 4), rng.signedInt(1, 3, true), ...(d === 'hard' && rng.bool(0.5) ? [rng.signedInt(1, 2, true)] : [])]);
    const Y = new Poly([rng.int(-4, 4), rng.int(-5, 5), rng.int(-3, 3), ...(d === 'easy' ? [] : [rng.signedInt(1, 2, true)])]);
    if (Y.degree < 2 || X.degree < 2) return null;
    return { X, Y };
  });
}

/** Reduce P/Q by the integer content of both. */
function ratioTex(P: Poly, Q: Poly): string {
  const g = gcdN([...P.c, ...Q.c].map((c) => c.n));
  const s = Q.lead().sign < 0 ? -g : g;
  const p = P.scale(new Frac(1, s));
  const q = Q.scale(new Frac(1, s));
  if (q.degree === 0 && q.coef(0).eq(1)) return p.toTex('t');
  return `\\frac{${p.toTex('t')}}{${q.toTex('t')}}`;
}
function gcdN(xs: number[]): number {
  const g = (a: number, b: number): number => (b ? g(b, a % b) : Math.abs(a));
  return xs.reduce((acc, x) => g(acc, x), 0) || 1;
}

export const parametricDerivatives = defineTopic({
  id: 'calc.parametric-derivatives',
  subject: 'calculus',
  category: 'Parametric, Polar and Vector-Valued Functions',
  title: 'Derivatives of Parametric Equations',
  description: 'dy/dx and d²y/dx² for parametric curves, tangent lines, and points with horizontal or vertical tangents.',
  instruction: 'Answer each question about the parametric curve.',
  multipleChoice: true,
  defaultCount: 8,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Find',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'dydx', label: 'dy/dx' },
        { value: 'second', label: 'd²y/dx²' },
        { value: 'tangent', label: 'Tangent line at a point' },
        { value: 'hv', label: 'Horizontal and vertical tangents' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const tOpt = strOpt(ctx, 'task');
    const task = tOpt === 'any' ? rng.pick(difficulty === 'easy' ? ['dydx', 'tangent'] : ['dydx', 'second', 'tangent', 'hv']) : tOpt;
    if (task === 'hv') return horizVert(rng, difficulty);
    const { X, Y } = paramPolys(rng, difficulty);
    const Xp = X.derivative();
    const Yp = Y.derivative();
    const q = `$x = ${X.toTex('t')}$, $y = ${Y.toTex('t')}$`;
    const steps = [`$\\frac{dx}{dt} = ${Xp.toTex('t')}$, $\\frac{dy}{dt} = ${Yp.toTex('t')}$`];
    if (task === 'dydx') {
      const d = ratioTex(Yp, Xp);
      const answer = m(ds(`\\frac{dy}{dx} = ${d}`));
      return {
        question: q,
        answer,
        steps: [...steps, answer],
        distractors: distinctDistractors(answer, [ratioTex(Xp, Yp), ratioTex(Yp.scale(-1), Xp), ratioTex(Y, X), ratioTex(Yp.derivative(), Xp.derivative())].map((w) => m(ds(`\\frac{dy}{dx} = ${w}`))), (k) => m(ds(`\\frac{dy}{dx} = ${d} + ${k}`))),
        check: { kind: 'calculus.parametric', task: 'dydx' },
      };
    }
    if (task === 'second') {
      // d/dt(Y'/X') / X' = (Y''X' − Y'X'')/X'³
      const N = Yp.derivative().mul(Xp).sub(Yp.mul(Xp.derivative()));
      if (N.isZero()) return parametricDerivatives.generate({ ...ctx, rng: rng.fork('zero') });
      const den = Xp.degree === 0 ? num(Xp.coef(0).pow(3)) : `(${Xp.toTex('t')})^{3}`;
      const d2 = `\\frac{${N.toTex('t')}}{${den}}`;
      const answer = m(ds(`\\frac{d^{2}y}{dx^{2}} = ${d2}`));
      const den2 = Xp.degree === 0 ? num(Xp.coef(0).pow(2)) : `(${Xp.toTex('t')})^{2}`;
      return {
        question: q,
        answer,
        steps: [...steps, `$\\frac{dy}{dx} = ${ratioTex(Yp, Xp)}$`, `$\\frac{d^{2}y}{dx^{2}} = \\frac{\\frac{d}{dt}\\left(\\frac{dy}{dx}\\right)}{dx/dt}$`, answer],
        distractors: distinctDistractors(answer, [`\\frac{${N.toTex('t')}}{${den2}}`, ratioTex(Yp.derivative(), Xp.derivative()), `\\frac{${N.scale(-1).toTex('t')}}{${den}}`].map((w) => m(ds(`\\frac{d^{2}y}{dx^{2}} = ${w}`))), (k) => m(ds(`\\frac{d^{2}y}{dx^{2}} = ${d2} + ${k}`))),
        check: { kind: 'calculus.parametric', task: 'second' },
      };
    }
    const t0 = attempt('tan-t0', () => {
      const t = rng.int(-3, 3);
      return Xp.eval(t).isZero() ? null : t;
    });
    const x0 = X.eval(t0);
    const y0 = Y.eval(t0);
    const mm = Yp.eval(t0).div(Xp.eval(t0));
    const answer = m(lineTex(mm, y0.sub(mm.mul(x0))));
    steps.push(`At $t = ${t0}$: point $${tuple([x0, y0])}$, slope $${num(mm)}$`, answer);
    return {
      question: `${q}; tangent line at $t = ${t0}$`,
      answer,
      steps,
      distractors: distinctDistractors(answer, [lineTex(mm.isZero() ? new Frac(1) : mm.inv(), y0.sub((mm.isZero() ? new Frac(1) : mm.inv()).mul(x0))), lineTex(mm, y0.add(mm.mul(x0))), lineTex(mm, x0.sub(mm.mul(y0)))].map(m), (k) => m(lineTex(mm, y0.sub(mm.mul(x0)).add(offset(k))))),
      check: { kind: 'calculus.parametric', task: 'tangent' },
    };
  },
});

function horizVert(rng: Rng, d: Difficulty): ProblemContent {
  // x' = a(t − p), y' = b(t − q)(t − r): x quadratic, y cubic with integer coefficients
  const { p, q, r } = attempt('hv', () => {
    const p = rng.int(-3, 3);
    const q = rng.int(-3, 3);
    const r = d === 'medium' ? null : rng.int(-3, 3);
    if (q === p || r === p || (r !== null && r === q)) return null;
    return { p, q, r };
  });
  const a = 2 * rng.signedInt(1, 2, true);
  const b = (r === null ? 2 : 6) * rng.signedInt(1, 1, true);
  const Xp = Poly.fromRoots([p]).scale(a);
  const Yp = Poly.fromRoots(r === null ? [q] : [q, r]).scale(b);
  const X = Xp.antiderivative().add(Poly.of(rng.int(-4, 4)));
  const Y = Yp.antiderivative().add(Poly.of(rng.int(-4, 4)));
  const pt = (t: number) => `$${tuple([X.eval(t), Y.eval(t)])}$`;
  const hs = r === null ? [q] : [q, r].sort((u, v) => u - v);
  const render = (hT: number[], vT: number[]) => `Horizontal: ${hT.length ? hT.map(pt).join(', ') : 'none'}; vertical: ${vT.length ? vT.map(pt).join(', ') : 'none'}`;
  const answer = render(hs, [p]);
  return {
    question: `$x = ${X.toTex('t')}$, $y = ${Y.toTex('t')}$; horizontal and vertical tangents`,
    answer,
    steps: [`$\\frac{dy}{dt} = ${Yp.toTex('t')} = 0$ at $t = ${hs.join(', ')}$ (horizontal)`, `$\\frac{dx}{dt} = ${Xp.toTex('t')} = 0$ at $t = ${p}$ (vertical)`, answer],
    distractors: distinctDistractors(answer, [render([p], hs), render(hs.map((t) => -t).filter((t) => t !== p), [p]), render(hs, [-p === p ? p + 1 : -p])], (k) => render(hs, [p + offset(k)])),
    check: { kind: 'calculus.parametric', task: 'hv' },
  };
}

// ---------------------------------------------------------------- arc length

export const arcLength = defineTopic({
  id: 'calc.arc-length',
  subject: 'calculus',
  category: 'Parametric, Polar and Vector-Valued Functions',
  title: 'Arc Length',
  description: 'Lengths of graphs y = f(x) and of parametric curves: exact when the integral is nice, otherwise to three decimals.',
  instruction: 'Find the length of each curve. Round to three decimal places when the answer is not exact.',
  multipleChoice: true,
  defaultCount: 6,
  options: [
    {
      type: 'select',
      id: 'curve',
      label: 'Curves',
      default: 'any',
      choices: [
        { value: 'any', label: 'Functions and parametric curves' },
        { value: 'function', label: 'Functions y = f(x)' },
        { value: 'parametric', label: 'Parametric curves' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const cOpt = strOpt(ctx, 'curve');
    const param = cOpt === 'parametric' || (cOpt === 'any' && rng.bool(0.4));
    const exact = difficulty !== 'hard' || rng.bool(0.5);
    let question: string;
    let L: number;
    let Ltex: string;
    let wrongs: string[];
    let approx = false;
    const steps: string[] = [];
    if (!param) {
      if (exact) {
        const kind = rng.pick(difficulty === 'easy' ? ['line', 'pow32'] : ['pow32', 'cubic', 'quartic', 'line']);
        switch (kind) {
          case 'line': {
            const mm = rng.signedInt(1, 4, true);
            const a = rng.int(-2, 1);
            const b = a + rng.int(1, 4);
            const { out, inside } = simplifySqrt(1 + mm * mm);
            const k = out * (b - a);
            question = `$y = ${sum([{ coef: mm, sym: 'x' }, { coef: rng.int(-5, 5) }])}$, $${a} \\le x \\le ${b}$`;
            Ltex = `${k === 1 ? '' : k}\\sqrt{${inside}}`;
            L = k * Math.sqrt(inside);
            steps.push(`$L = \\int_{${a}}^{${b}} \\sqrt{1 + ${mm * mm}}\\,dx$`);
            wrongs = [`${b - a}`, `${(b - a) * (1 + mm * mm)}`, `${k * Math.abs(mm)}`];
            break;
          }
          case 'pow32': {
            // y = (2/3)x^{3/2}: L = (2/3)[(1 + x)^{3/2}]
            const ps = rng.sample([1, 2, 3, 4], 2).sort((u, v) => u - v);
            const a = ps[0]! ** 2 - 1;
            const b = ps[1]! ** 2 - 1;
            question = `$y = \\frac{2}{3}x^{\\frac{3}{2}}$, $${a} \\le x \\le ${b}$`;
            const val = new Frac(2 * (ps[1]! ** 3 - ps[0]! ** 3), 3);
            Ltex = num(val);
            L = val.value;
            steps.push(`$1 + (y')^{2} = 1 + x$, so $L = \\int_{${a}}^{${b}} \\sqrt{1 + x}\\,dx$`);
            wrongs = [num(val.mul(2)), num(new Frac(b - a)), num(val.div(2))];
            break;
          }
          case 'cubic':
          default: {
            // y = x³/6 + 1/(2x): L = [x³/6 − 1/(2x)];  y = x⁴/8 + 1/(4x²): L = [x⁴/8 − 1/(4x²)]
            const quartic = kind === 'quartic';
            const a = rng.int(1, 3);
            const b = a + rng.int(1, 3);
            const F = (x: number) => (quartic ? new Frac(x ** 4, 8).sub(new Frac(1, 4 * x * x)) : new Frac(x ** 3, 6).sub(new Frac(1, 2 * x)));
            const G = (x: number) => (quartic ? new Frac(x ** 4, 8).add(new Frac(1, 4 * x * x)) : new Frac(x ** 3, 6).add(new Frac(1, 2 * x)));
            const val = F(b).sub(F(a));
            question = quartic ? `$y = \\frac{x^{4}}{8} + \\frac{1}{4x^{2}}$, $${a} \\le x \\le ${b}$` : `$y = \\frac{x^{3}}{6} + \\frac{1}{2x}$, $${a} \\le x \\le ${b}$`;
            Ltex = num(val);
            L = val.value;
            steps.push(quartic ? '$1 + (y\')^{2} = \\left(\\frac{x^{3}}{2} + \\frac{1}{2x^{3}}\\right)^{2}$' : "$1 + (y')^{2} = \\left(\\frac{x^{2}}{2} + \\frac{1}{2x^{2}}\\right)^{2}$");
            wrongs = [num(G(b).sub(G(a))), num(val.mul(2)), num(val.add(1))];
            break;
          }
        }
      } else {
        const kind = rng.pick(['parab', 'sin', 'exp']);
        if (kind === 'parab') {
          const b = rng.int(1, 3);
          question = `$y = x^{2}$, $0 \\le x \\le ${b}$`;
          L = (b * Math.sqrt(1 + 4 * b * b)) / 2 + Math.asinh(2 * b) / 4;
        } else if (kind === 'sin') {
          question = '$y = \\sin x$, $0 \\le x \\le \\pi$';
          L = 3.820197789;
        } else {
          const b = rng.int(1, 2);
          question = `$y = e^{x}$, $0 \\le x \\le ${b}$`;
          L = Math.sqrt(1 + Math.exp(2 * b)) - Math.sqrt(2) + Math.atanh(1 / Math.sqrt(2)) - Math.atanh(1 / Math.sqrt(1 + Math.exp(2 * b)));
        }
        Ltex = decimal(L, 3);
        approx = true;
        steps.push("$L = \\int_{a}^{b} \\sqrt{1 + (y')^{2}}\\,dx$, evaluated numerically.");
        wrongs = [decimal(L * 0.8, 3), decimal(L + 1, 3), decimal(L * 1.25, 3)];
      }
    } else {
      const kind = exact ? rng.pick(difficulty === 'easy' ? ['circle', 'line'] : ['circle', 'cusp', 'line']) : 'ellipse';
      switch (kind) {
        case 'circle': {
          const r = rng.int(1, 6);
          const ang = rng.pick(ANGLES.slice(1));
          const turns = rng.pick([1, 2]);
          const end = turns === 2 && ang.value === Math.PI ? 2 * Math.PI : ang.value;
          const endTex = turns === 2 && ang.value === Math.PI ? '2\\pi' : ang.tex;
          question = `$x = ${r === 1 ? '' : r}\\cos t$, $y = ${r === 1 ? '' : r}\\sin t$, $0 \\le t \\le ${endTex}$`;
          const k = new Frac(Math.round((end / Math.PI) * 12), 12).mul(r);
          Ltex = piTex(k);
          L = k.value * Math.PI;
          steps.push(`Speed $= \\sqrt{${r * r}\\sin^{2} t + ${r * r}\\cos^{2} t} = ${r}$`);
          wrongs = [piTex(k.mul(r)), piTex(k.div(2)), piTex(k.mul(2))];
          break;
        }
        case 'line': {
          const [a0, b0, c0] = rng.pick([
            [3, 4, 5],
            [5, 12, 13],
            [8, 15, 17],
          ] as const);
          const T = rng.int(1, 4);
          question = `$x = ${a0}t ${rng.bool() ? '+' : '-'} ${rng.int(1, 5)}$, $y = ${b0}t$, $0 \\le t \\le ${T}$`;
          Ltex = `${c0 * T}`;
          L = c0 * T;
          steps.push(`Speed $= \\sqrt{${a0 * a0} + ${b0 * b0}} = ${c0}$`);
          wrongs = [`${(a0 + b0) * T}`, `${c0 * c0 * T}`, `${c0}`];
          break;
        }
        case 'cusp':
        default: {
          // x = t², y = (2/3)t³: speed 2t√(1 + t²); L = (2/3)[(1 + t²)^{3/2}] from 0 to T
          const T = rng.pick([1, 2, 3]);
          const s = 1 + T * T;
          const { out, inside } = simplifySqrt(s);
          // (2/3)(s√s − 1)
          const coef = new Frac(2 * s * out, 3);
          Ltex = `${fracRad(coef, inside)} - \\frac{2}{3}`;
          L = (2 / 3) * (s * Math.sqrt(s) - 1);
          question = `$x = t^{2}$, $y = \\frac{2}{3}t^{3}$, $0 \\le t \\le ${T}$`;
          steps.push('Speed $= \\sqrt{4t^{2} + 4t^{4}} = 2t\\sqrt{1 + t^{2}}$');
          wrongs = [fracRad(coef, inside), `${fracRad(coef, inside)} + \\frac{2}{3}`, `${fracRad(coef.mul(2), inside)} - \\frac{4}{3}`];
          break;
        }
        case 'ellipse': {
          const a = rng.int(2, 4);
          question = `$x = ${a}\\cos t$, $y = \\sin t$, $0 \\le t \\le 2\\pi$`;
          // numeric value
          let acc = 0;
          const N = 2000;
          for (let i = 0; i < N; i++) {
            const t = ((i + 0.5) * 2 * Math.PI) / N;
            acc += Math.hypot(a * Math.sin(t), Math.cos(t));
          }
          L = (acc * 2 * Math.PI) / N;
          Ltex = decimal(L, 3);
          approx = true;
          steps.push(`$L = \\int_{0}^{2\\pi} \\sqrt{${a * a}\\sin^{2} t + \\cos^{2} t}\\,dt$, evaluated numerically.`);
          wrongs = [decimal(2 * Math.PI * a, 3), decimal(Math.PI * (a + 1), 3), decimal(Math.PI * a, 3)];
          break;
        }
      }
    }
    const show = (t: string) => m(`L ${approx ? '\\approx' : '='} ${t}`);
    const answer = show(Ltex);
    return {
      question,
      answer,
      steps: [...steps, answer],
      distractors: distinctDistractors(answer, wrongs.map(show), (k) => show(decimal(L + offset(k), 3))),
      check: { kind: 'calculus.arclength', approx },
    };
  },
});

// ---------------------------------------------------------------- polar derivatives

interface Polar {
  tex: string;
  r: (c: QR, s: QR) => QR;
  dr: (c: QR, s: QR) => QR;
}

function polarCurve(rng: Rng, d: Difficulty): Polar {
  const kind = rng.pick(d === 'easy' ? ['acos', 'asin'] : ['limacon', 'limaconSin', 'acos', 'asin']);
  const a = rng.int(1, 4);
  const b = rng.signedInt(1, 4, true);
  switch (kind) {
    case 'acos':
      return { tex: `${a === 1 ? '' : a}\\cos\\theta`, r: (c) => c.scale(a), dr: (_c, s) => s.scale(-a) };
    case 'asin':
      return { tex: `${a === 1 ? '' : a}\\sin\\theta`, r: (_c, s) => s.scale(a), dr: (c) => c.scale(a) };
    case 'limacon':
      return { tex: `${a} ${b < 0 ? '-' : '+'} ${Math.abs(b) === 1 ? '' : Math.abs(b)}\\cos\\theta`, r: (c) => QR.of(a).add(c.scale(b)), dr: (_c, s) => s.scale(-b) };
    default:
      return { tex: `${a} ${b < 0 ? '-' : '+'} ${Math.abs(b) === 1 ? '' : Math.abs(b)}\\sin\\theta`, r: (_c, s) => QR.of(a).add(s.scale(b)), dr: (c) => c.scale(b) };
  }
}

export const polarDerivatives = defineTopic({
  id: 'calc.polar-derivatives',
  subject: 'calculus',
  category: 'Parametric, Polar and Vector-Valued Functions',
  title: 'Polar Derivatives and Tangent Lines',
  description: 'Slopes dy/dx of polar curves and equations of tangent lines at given angles, exactly.',
  instruction: (o) => (o.task === 'tangent' ? 'Find the equation of the tangent line at the given angle.' : 'Find dy/dx at the given angle.'),
  multipleChoice: true,
  defaultCount: 8,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Find',
      default: 'slope',
      choices: [
        { value: 'slope', label: 'Slope dy/dx' },
        { value: 'tangent', label: 'Tangent line' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const tangent = strOpt(ctx, 'task') === 'tangent';
    const { P, A, slope, x0, y0 } = attempt('polar-slope', () => {
      const P = polarCurve(rng, difficulty);
      const A = rng.pick(difficulty === 'easy' ? [ANGLES[1]!, ANGLES[3]!, ANGLES[4]!, ANGLES[2]!] : ANGLES.slice(1, 8));
      const r = P.r(A.cos, A.sin);
      const dr = P.dr(A.cos, A.sin);
      const num_ = dr.mul(A.sin).add(r.mul(A.cos));
      const den = dr.mul(A.cos).sub(r.mul(A.sin));
      if (den.isZero() || (tangent && r.isZero())) return null;
      try {
        return { P, A, slope: num_.div(den), x0: r.mul(A.cos), y0: r.mul(A.sin) };
      } catch {
        return null;
      }
    });
    const q = `$r = ${P.tex}$ at $\\theta = ${A.tex}$`;
    const steps = [`$\\displaystyle \\frac{dy}{dx} = \\frac{r'\\sin\\theta + r\\cos\\theta}{r'\\cos\\theta - r\\sin\\theta}$`, `At $\\theta = ${A.tex}$: $\\frac{dy}{dx} = ${slope.toTex()}$`];
    if (!tangent) {
      const answer = m(`\\frac{dy}{dx} = ${slope.toTex()}`);
      const r = P.r(A.cos, A.sin);
      const dr = P.dr(A.cos, A.sin);
      const alt1 = dr.isZero() ? null : r.div(dr);
      const wrongs = [slope.scale(-1), alt1, (() => { try { return QR.of(1).div(slope); } catch { return null; } })(), dr].filter((w): w is QR => !!w).map((w) => m(`\\frac{dy}{dx} = ${w.toTex()}`));
      return {
        question: q,
        answer,
        steps: [...steps, answer],
        distractors: distinctDistractors(answer, wrongs, (k) => m(`\\frac{dy}{dx} = ${slope.add(QR.of(offset(k))).toTex()}`)),
        check: { kind: 'calculus.polar', task: 'slope' },
      };
    }
    const b = y0.sub(slope.mul(x0));
    const line = (mm: QR, bb: QR) => {
      const mt = mm.terms();
      const parts: Signed[] = mm.isZero() ? [] : mt.length > 1 ? [{ neg: false, body: `\\left(${mm.toTex()}\\right)x` }] : [{ neg: mt[0]!.neg, body: `${mt[0]!.body === '1' ? '' : mt[0]!.body}x` }];
      return `y = ${joinSigned([...parts, ...bb.terms()])}`;
    };
    const answer = m(line(slope, b));
    steps.push(`Point: $x = ${x0.toTex()}$, $y = ${y0.toTex()}$`, answer);
    const wrongs = [line(slope, y0.add(slope.mul(x0))), line(slope.scale(-1), y0.add(slope.mul(x0))), line(slope, x0.sub(slope.mul(y0)))].map(m);
    return {
      question: q,
      answer,
      steps,
      distractors: distinctDistractors(answer, wrongs, (k) => m(line(slope, b.add(QR.of(offset(k)))))),
      check: { kind: 'calculus.polar', task: 'tangent' },
    };
  },
});

// ---------------------------------------------------------------- polar area

export const polarArea = defineTopic({
  id: 'calc.polar-area',
  subject: 'calculus',
  category: 'Parametric, Polar and Vector-Valued Functions',
  title: 'Area in Polar Coordinates',
  description: 'Area of one petal, a cardioid, a limaçon, an inner loop, and the region inside one polar curve and outside another.',
  instruction: 'Find the area of each region.',
  multipleChoice: true,
  defaultCount: 6,
  options: [
    {
      type: 'select',
      id: 'region',
      label: 'Region',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'one', label: 'Inside one curve' },
        { value: 'between', label: 'Between two curves' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const rOpt = strOpt(ctx, 'region');
    const between = rOpt === 'between' || (rOpt === 'any' && difficulty !== 'easy' && rng.bool(0.4));
    const a = rng.int(1, 4);
    const at = (k: number) => (k === 1 ? '' : String(k));
    let question: string;
    let area: { tex: string; v: number };
    let bounds: [number, number];
    let wrongs: string[];
    const steps: string[] = [];
    if (!between) {
      const kind = rng.pick(difficulty === 'easy' ? ['petal', 'circle', 'cardioid'] : ['petal', 'cardioid', 'limacon', 'loop']);
      switch (kind) {
        case 'petal': {
          const k = rng.int(2, 5);
          const fn = rng.pick(['sin', 'cos']);
          question = `One petal of $r = ${at(a)}\\${fn} ${k}\\theta$`;
          const A = new Frac(a * a, 4 * k);
          area = { tex: piTex(A), v: A.value * Math.PI };
          bounds = fn === 'sin' ? [0, Math.PI / k] : [-Math.PI / (2 * k), Math.PI / (2 * k)];
          steps.push(`$A = \\frac{1}{2}\\int r^{2}\\,d\\theta$ over one petal, $\\theta$ from ${fn === 'sin' ? `$0$ to $\\frac{\\pi}{${k}}$` : `$-\\frac{\\pi}{${2 * k}}$ to $\\frac{\\pi}{${2 * k}}$`}`);
          wrongs = [piTex(A.mul(2)), piTex(A.mul(k)), piTex(new Frac(a * a, 2 * k))];
          break;
        }
        case 'circle': {
          question = `The region inside $r = ${at(2 * a)}\\cos\\theta$`;
          const A = new Frac(a * a);
          area = { tex: piTex(A), v: A.value * Math.PI };
          bounds = [-Math.PI / 2, Math.PI / 2];
          steps.push(`The circle is traced once for $-\\frac{\\pi}{2} \\le \\theta \\le \\frac{\\pi}{2}$; its radius is $${a}$.`);
          wrongs = [piTex(A.mul(4)), piTex(A.mul(2)), piTex(A.div(2))];
          break;
        }
        case 'cardioid': {
          const sgn = rng.pick(['+', '-']);
          const fn = rng.pick(['cos', 'sin']);
          question = `The region inside $r = ${a === 1 ? `1 ${sgn} \\${fn}\\theta` : `${a}(1 ${sgn} \\${fn}\\theta)`}$`;
          const A = new Frac(3 * a * a, 2);
          area = { tex: piTex(A), v: A.value * Math.PI };
          bounds = [0, 2 * Math.PI];
          steps.push(`$\\frac{1}{2}\\int_{0}^{2\\pi} ${a === 1 ? '' : a * a}(1 ${sgn} \\${fn}\\theta)^{2}\\,d\\theta$`);
          wrongs = [piTex(new Frac(a * a)), piTex(new Frac(3 * a * a)), piTex(new Frac(a * a, 2))];
          break;
        }
        case 'limacon': {
          const b = rng.int(1, a + 1);
          const A0 = a + b;
          question = `The region inside $r = ${A0} + ${at(b)}\\cos\\theta$`;
          const A = new Frac(2 * A0 * A0 + b * b, 2);
          area = { tex: piTex(A), v: A.value * Math.PI };
          bounds = [0, 2 * Math.PI];
          steps.push(`$\\frac{1}{2}\\int_{0}^{2\\pi} (${A0} + ${at(b)}\\cos\\theta)^{2}\\,d\\theta = \\pi\\left(${A0 * A0} + \\frac{${b * b}}{2}\\right)$`);
          wrongs = [piTex(new Frac(A0 * A0 + b * b)), piTex(new Frac(A0 * A0)), piTex(A.mul(2))];
          break;
        }
        case 'loop':
        default: {
          // inner loop of r = a(1 + 2cos θ): a²(π − 3√3/2)
          question = `The inner loop of $r = ${a === 1 ? '1 + 2\\cos\\theta' : `${a} + ${2 * a}\\cos\\theta`}$`;
          const k = new Frac(3 * a * a, 2);
          area = { tex: `${piTex(new Frac(a * a))} - ${fracRad(k, 3)}`, v: a * a * (Math.PI - 1.5 * Math.sqrt(3)) };
          bounds = [(2 * Math.PI) / 3, (4 * Math.PI) / 3];
          steps.push('The inner loop is traced for $\\frac{2\\pi}{3} \\le \\theta \\le \\frac{4\\pi}{3}$.');
          wrongs = [`${piTex(new Frac(a * a))} + ${fracRad(k, 3)}`, piTex(new Frac(a * a)), `${piTex(new Frac(2 * a * a))} + ${fracRad(k, 3)}`];
          break;
        }
      }
    } else {
      const kind = rng.pick(['circleCard', 'circleCircle', 'cardOut']);
      const a = rng.int(1, 6);
      const a2 = a * a;
      switch (kind) {
        case 'circleCard': {
          // inside r = 3a cos θ, outside r = a(1 + cos θ): a²π on [−π/3, π/3]
          question = `Inside $r = ${3 * a}\\cos\\theta$ and outside $r = ${a === 1 ? '1 + \\cos\\theta' : `${a} + ${a}\\cos\\theta`}$`;
          area = { tex: piTex(new Frac(a2)), v: a2 * Math.PI };
          bounds = [-Math.PI / 3, Math.PI / 3];
          steps.push('The curves meet where $\\cos\\theta = \\frac{1}{2}$: $\\theta = \\pm\\frac{\\pi}{3}$.');
          wrongs = [piTex(new Frac(2 * a2)), piTex(new Frac(9 * a2, 4)), piTex(new Frac(a2, 2))];
          break;
        }
        case 'circleCircle': {
          // inside r = 2a sin θ, outside r = a: a²(π/3 + √3/2)
          const fn = rng.pick(['sin', 'cos']);
          question = `Inside $r = ${2 * a}\\${fn}\\theta$ and outside $r = ${a}$`;
          const k = new Frac(a2, 2);
          const rad = fracRad(k, 3);
          area = { tex: `${piTex(new Frac(a2, 3))} + ${rad}`, v: a2 * (Math.PI / 3 + Math.sqrt(3) / 2) };
          bounds = fn === 'sin' ? [Math.PI / 6, (5 * Math.PI) / 6] : [-Math.PI / 3, Math.PI / 3];
          steps.push(fn === 'sin' ? 'The curves meet where $\\sin\\theta = \\frac{1}{2}$: $\\theta = \\frac{\\pi}{6}, \\frac{5\\pi}{6}$.' : 'The curves meet where $\\cos\\theta = \\frac{1}{2}$: $\\theta = \\pm\\frac{\\pi}{3}$.');
          wrongs = [`${piTex(new Frac(a2, 3))} - ${rad}`, piTex(new Frac(a2)), piTex(new Frac(2 * a2, 3))];
          break;
        }
        case 'cardOut':
        default: {
          // inside r = a, outside r = a(1 − cos θ): a²(2 − π/4)
          question = `Inside $r = ${a}$ and outside $r = ${a === 1 ? '1 - \\cos\\theta' : `${a} - ${a}\\cos\\theta`}$`;
          area = { tex: `${2 * a2} - ${piTex(new Frac(a2, 4))}`, v: a2 * (2 - Math.PI / 4) };
          bounds = [-Math.PI / 2, Math.PI / 2];
          steps.push('The curves meet where $\\cos\\theta = 0$: $\\theta = \\pm\\frac{\\pi}{2}$.');
          wrongs = [`${2 * a2} + ${piTex(new Frac(a2, 4))}`, piTex(new Frac(a2, 4)), `${a2} - ${piTex(new Frac(a2, 4))}`];
          break;
        }
      }
      steps.push('$A = \\frac{1}{2}\\int \\left(r_{\\text{outer}}^{2} - r_{\\text{inner}}^{2}\\right)d\\theta$');
    }
    const answer = m(area.tex);
    return {
      question,
      answer,
      steps: [...steps, answer],
      distractors: distinctDistractors(answer, wrongs.map(m), (k) => m(piTex(new Frac(Math.round(area.v / Math.PI + offset(k)) || 7)))),
      check: { kind: 'calculus.polararea', bounds, between },
    };
  },
});

// ---------------------------------------------------------------- vector-valued functions

const vec = (a: string, b: string) => `\\left\\langle ${a}, ${b} \\right\\rangle`;
const vecF = (a: Frac, b: Frac) => vec(num(a), num(b));

export const vectorFunctions = defineTopic({
  id: 'calc.vector-functions',
  subject: 'calculus',
  category: 'Parametric, Polar and Vector-Valued Functions',
  title: 'Vector-Valued Functions',
  description: 'Particles moving in the plane: velocity, acceleration, speed, displacement and total distance traveled.',
  instruction: 'A particle moves in the plane with position vector r(t). Answer each question.',
  multipleChoice: true,
  defaultCount: 6,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Find',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'va', label: 'Velocity and acceleration' },
        { value: 'speed', label: 'Speed' },
        { value: 'displacement', label: 'Displacement' },
        { value: 'distance', label: 'Total distance traveled' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const tOpt = strOpt(ctx, 'task');
    const task = tOpt === 'any' ? rng.pick(['va', 'speed', 'displacement', 'distance']) : tOpt;
    let X: Poly;
    let Y: Poly;
    if (task === 'distance') {
      // x' = 3k(1 − t²), y' = 6kt: speed 3k(1 + t²)
      const k = rng.int(1, 2);
      X = new Poly([rng.int(-4, 4), 3 * k, 0, -k]);
      Y = new Poly([rng.int(-4, 4), 0, 3 * k]);
    } else {
      X = randomPoly(rng, difficulty);
      Y = randomPoly(rng, difficulty);
    }
    const q = `$r(t) = ${vec(X.toTex('t'), Y.toTex('t'))}$`;
    const Xp = X.derivative();
    const Yp = Y.derivative();
    const steps = [`$v(t) = ${vec(Xp.toTex('t'), Yp.toTex('t'))}$`];
    if (task === 'va') {
      const t0 = rng.int(0, 3);
      const items = (v1: Frac, v2: Frac, a1: Frac, a2: Frac) => `$v(${t0}) = ${vecF(v1, v2)}$, $a(${t0}) = ${vecF(a1, a2)}$`;
      const V = [Xp.eval(t0), Yp.eval(t0)] as const;
      const A = [Xp.derivative().eval(t0), Yp.derivative().eval(t0)] as const;
      const answer = items(V[0], V[1], A[0], A[1]);
      steps.push(`$a(t) = ${vec(Xp.derivative().toTex('t'), Yp.derivative().toTex('t'))}$`, answer);
      return {
        question: `${q}; find $v(${t0})$ and $a(${t0})$`,
        answer,
        steps,
        distractors: distinctDistractors(answer, [items(A[0], A[1], V[0], V[1]), items(X.eval(t0), Y.eval(t0), V[0], V[1]), items(V[1], V[0], A[1], A[0])], (k) => items(V[0].add(offset(k)), V[1], A[0], A[1])),
        check: { kind: 'calculus.vector2d', task: 'va' },
      };
    }
    if (task === 'speed') {
      const t0 = rng.int(0, 3);
      const s2 = Xp.eval(t0).pow(2).add(Yp.eval(t0).pow(2));
      const { out, inside } = simplifySqrt(s2.n);
      const sp = inside === 1 ? String(out) : `${out === 1 ? '' : out}\\sqrt{${inside}}`;
      const answer = m(`|v(${t0})| = ${sp}`);
      steps.push(`$|v(${t0})| = \\sqrt{(${num(Xp.eval(t0))})^{2} + (${num(Yp.eval(t0))})^{2}}$`, answer);
      return {
        question: `${q}; find the speed at $t = ${t0}$`,
        answer,
        steps,
        distractors: distinctDistractors(answer, [`${num(s2)}`, `${num(Xp.eval(t0).abs().add(Yp.eval(t0).abs()))}`, `${num(new Frac(Math.round(Math.hypot(X.evalNum(t0), Y.evalNum(t0)) * 10), 10))}`].map((w) => m(`|v(${t0})| = ${w}`)), (k) => m(`|v(${t0})| = ${num(s2.add(offset(k)))}`)),
        check: { kind: 'calculus.vector2d', task: 'speed' },
      };
    }
    const t0 = rng.int(0, 1);
    const t1 = t0 + rng.int(1, 3);
    if (task === 'displacement') {
      const D = [X.eval(t1).sub(X.eval(t0)), Y.eval(t1).sub(Y.eval(t0))] as const;
      const answer = m(vecF(D[0], D[1]));
      steps.push(`$r(${t1}) - r(${t0})$`, answer);
      return {
        question: `${q}; displacement from $t = ${t0}$ to $t = ${t1}$`,
        answer,
        steps,
        distractors: distinctDistractors(answer, [vecF(X.eval(t1), Y.eval(t1)), vecF(Xp.eval(t1).sub(Xp.eval(t0)), Yp.eval(t1).sub(Yp.eval(t0))), vecF(D[0].neg(), D[1].neg())].map(m), (k) => m(vecF(D[0].add(offset(k)), D[1]))),
        check: { kind: 'calculus.vector2d', task: 'displacement' },
      };
    }
    // distance: ∫ 3k(1 + t²) dt
    const k = Xp.coef(0).div(3);
    const dist = k.mul(3).mul(new Frac(t1 - t0).add(new Frac(t1 ** 3 - t0 ** 3, 3)));
    const disp = Math.hypot(X.evalNum(t1) - X.evalNum(t0), Y.evalNum(t1) - Y.evalNum(t0));
    const answer = m(num(dist));
    steps.push(`Speed $= \\sqrt{(${Xp.toTex('t')})^{2} + (${Yp.toTex('t')})^{2}} = ${num(k.mul(3))}(1 + t^{2})$`, `Distance $= \\int_{${t0}}^{${t1}} |v(t)|\\,dt = ${num(dist)}$`);
    return {
      question: `${q}; total distance traveled for $${t0} \\le t \\le ${t1}$`,
      answer,
      steps,
      distractors: distinctDistractors(answer, [decimal(disp, 3), num(dist.mul(2)), num(k.mul(3).mul(t1 - t0))].map(m), (q2) => m(num(dist.add(offset(q2))))),
      check: { kind: 'calculus.vector2d', task: 'distance' },
    };
  },
});

function randomPoly(rng: Rng, d: Difficulty): Poly {
  return attempt('vpoly', () => {
    const p = new Poly([rng.int(-5, 5), rng.int(-4, 4), rng.int(-3, 3), ...(d === 'easy' ? [] : [rng.int(-2, 2)])]);
    return p.degree >= 1 ? p : null;
  });
}
