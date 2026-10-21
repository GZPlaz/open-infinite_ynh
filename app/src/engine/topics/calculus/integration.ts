/** Integration: Riemann sums, definite integrals, u-substitution, parts, trig/exponential integrals, FTC, average value. */
import { Frac } from '../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, offset, strOpt } from '../../generator';
import { Poly } from '../../polynomial';
import { m, num, paren } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { atom, fderiv, fnorm, ft, ftex, joinSigned, lead, lin, polyFactor, randPoly, sqrtFracTex, type FTerm, type Signed } from './common';
import { integrate, powerSumTex, pt, type PowerTerm } from './power-terms';

const ds = (t: string) => `\\displaystyle ${t}`;
const intTex = (body: string, lo?: string | number, hi?: string | number, v = 'x') => (lo === undefined ? `\\int ${body}\\,d${v}` : `\\int_{${lo}}^{${hi}} ${body}\\,d${v}`);
const plusC = (t: string) => `${t} + C`;

// ---------------------------------------------------------------- Riemann sums

type Method = 'left' | 'right' | 'mid' | 'trap';
const METHOD_TEXT: Record<Method, string> = {
  left: 'a left Riemann sum',
  right: 'a right Riemann sum',
  mid: 'a midpoint Riemann sum',
  trap: 'the trapezoidal rule',
};

function riemannSum(xs: Frac[], ys: Frac[], method: Method): Frac {
  let total = Frac.ZERO;
  for (let i = 0; i + 1 < xs.length; i++) {
    const w = xs[i + 1]!.sub(xs[i]!);
    total = total.add(method === 'left' ? w.mul(ys[i]!) : method === 'right' ? w.mul(ys[i + 1]!) : w.mul(ys[i]!.add(ys[i + 1]!)).div(2));
  }
  return total;
}

export const riemannSums = defineTopic({
  id: 'calc.riemann-sums',
  subject: 'calculus',
  category: 'Integration',
  title: 'Riemann Sums',
  description: 'Approximate definite integrals with left, right and midpoint Riemann sums and the trapezoidal rule, from a formula or a table.',
  instruction: 'Approximate each integral using the given method.',
  multipleChoice: true,
  defaultCount: 6,
  options: [
    {
      type: 'select',
      id: 'method',
      label: 'Method',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'left', label: 'Left endpoints' },
        { value: 'right', label: 'Right endpoints' },
        { value: 'mid', label: 'Midpoints' },
        { value: 'trap', label: 'Trapezoidal rule' },
      ],
    },
    {
      type: 'select',
      id: 'source',
      label: 'Given',
      default: 'any',
      choices: [
        { value: 'any', label: 'Formula or table' },
        { value: 'formula', label: 'A formula' },
        { value: 'table', label: 'A table of values' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const mOpt = strOpt(ctx, 'method');
    const method = (mOpt === 'any' ? rng.pick(['left', 'right', 'mid', 'trap']) : mOpt) as Method;
    const sOpt = strOpt(ctx, 'source');
    const table = sOpt === 'table' || (sOpt === 'any' && rng.bool(0.4));
    const n = rng.int(3, difficulty === 'easy' ? 4 : 6);
    const steps: string[] = [];
    let question: string;
    let value: Frac;
    const others: Frac[] = [];
    if (!table) {
      const p = randPoly(rng, difficulty === 'easy' ? rng.int(1, 2) : rng.int(2, 3), difficulty === 'hard' ? 5 : 4, 0.7);
      const w = difficulty === 'hard' ? rng.pick([new Frac(1, 2), new Frac(1), new Frac(2)]) : new Frac(rng.int(1, 2));
      const a = new Frac(rng.int(-2, 2));
      const b = a.add(w.mul(n));
      const xs = Array.from({ length: n + 1 }, (_, i) => a.add(w.mul(i)));
      const f = (x: Frac) => p.eval(x);
      const sample = (meth: Method) => (meth === 'mid' ? xs.slice(0, -1).map((x) => x.add(w.div(2))) : meth === 'left' ? xs.slice(0, -1) : meth === 'right' ? xs.slice(1) : xs);
      const calc = (meth: Method) => (meth === 'mid' ? sample('mid').reduce((s, x) => s.add(w.mul(f(x))), Frac.ZERO) : riemannSum(xs, xs.map(f), meth));
      value = calc(method);
      for (const meth of ['left', 'right', 'mid', 'trap'] as Method[]) if (meth !== method) others.push(calc(meth));
      const F = p.antiderivative();
      others.push(F.eval(b).sub(F.eval(a)));
      question = `Use ${METHOD_TEXT[method]} with $n = ${n}$ subintervals of equal width to approximate $${ds(intTex(`(${p.toTex()})`, num(a), num(b)))}$.`;
      steps.push(`$\\Delta x = ${num(w)}$; ${method === 'trap' ? 'endpoints' : 'sample points'}: $x = ${sample(method).map(num).join(', ')}$`);
      steps.push(
        method === 'trap'
          ? `$\\frac{${num(w)}}{2}\\left[f(${num(xs[0]!)}) + 2f(${num(xs[1]!)}) + \\cdots + f(${num(xs[n]!)})\\right] = ${num(value)}$`
          : `$${num(w)}\\left[${sample(method).map((x) => `f(${num(x)})`).join(' + ')}\\right] = ${num(value)}$`,
      );
    } else {
      // table of values; uneven spacing on hard (not for midpoints)
      const pts = method === 'mid' ? 2 * n : n;
      const even = difficulty !== 'hard' || method === 'mid';
      const step = rng.int(1, 3);
      const x0 = rng.int(0, 2) * step;
      const xs: Frac[] = [new Frac(x0)];
      for (let i = 0; i < pts; i++) xs.push(xs[i]!.add(even ? step : rng.int(1, 4)));
      const ys = xs.map(() => new Frac(rng.int(difficulty === 'easy' ? 0 : -5, 15)));
      const fname = rng.pick(['f', 'g', 'h']);
      if (method === 'mid') {
        value = Frac.ZERO;
        for (let i = 0; i < n; i++) value = value.add(xs[2 * i + 2]!.sub(xs[2 * i]!).mul(ys[2 * i + 1]!));
        others.push(riemannSum(xs, ys, 'left'), riemannSum(xs, ys, 'trap'), riemannSum(xs, ys, 'right'));
        steps.push(`Each subinterval has width $${2 * step}$; use the values at $x = ${xs.filter((_, i) => i % 2 === 1).map(num).join(', ')}$.`);
      } else {
        value = riemannSum(xs, ys, method);
        for (const meth of ['left', 'right', 'trap'] as Method[]) if (meth !== method) others.push(riemannSum(xs, ys, meth));
        others.push(ys.reduce((s, y) => s.add(y), Frac.ZERO));
        steps.push(method === 'trap' ? 'Sum the trapezoid areas $\\frac{\\Delta x_i}{2}(y_{i-1} + y_i)$.' : `Multiply each width by the ${method === 'left' ? 'left' : 'right'}-endpoint value and add.`);
      }
      steps.push(`Approximation: $${num(value)}$`);
      const arr = `\\begin{array}{c|${'c'.repeat(xs.length)}} x & ${xs.map(num).join(' & ')} \\\\ \\hline ${fname}(x) & ${ys.map(num).join(' & ')} \\end{array}`;
      question = `Use the table and ${METHOD_TEXT[method]} with $n = ${n}$ subintervals to approximate $${ds(intTex(`${fname}(x)`, num(xs[0]!), num(xs[xs.length - 1]!)))}$. $${arr}$`;
    }
    const answer = m(num(value));
    return {
      question,
      answer,
      steps,
      distractors: distinctDistractors(answer, others.map((o) => m(num(o))), (k) => m(num(value.add(offset(k))))),
      check: { kind: 'calculus.riemann' },
    };
  },
});

// ---------------------------------------------------------------- definite integrals

/** Exact xᵖ for a rational exponent (x a perfect power when needed). */
function powExact(x: number, p: Frac): Frac {
  if (p.isInt()) return new Frac(x).pow(p.n);
  const r = Math.round(x ** (1 / p.d));
  if (r ** p.d !== x) throw new Error(`powExact: ${x}^${p.toString()}`);
  return new Frac(r).pow(p.n);
}
const evalTerms = (ts: PowerTerm[], x: number) => ts.reduce((s, t) => s.add(t.c.mul(powExact(x, t.p))), Frac.ZERO);

export const definiteIntegrals = defineTopic({
  id: 'calc.definite-integrals',
  subject: 'calculus',
  category: 'Integration',
  title: 'Definite Integrals',
  description: 'Evaluate definite integrals of polynomials, powers and roots, and trig, exponential and 1/x integrands.',
  instruction: 'Evaluate each definite integral.',
  multipleChoice: true,
  defaultCount: 10,
  options: [{ type: 'boolean', id: 'transcendental', label: 'Include trig, exponential and 1/x integrands', default: true }],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const trans = boolOpt(ctx, 'transcendental');
    const kind = difficulty === 'easy' ? 'poly' : difficulty === 'medium' ? rng.pick(['poly', 'power']) : rng.pick(trans ? ['power', 'trans', 'trans'] : ['power', 'poly']);
    const steps: string[] = [];
    let question: string;
    let value: Frac;
    let valueTex: string;
    let wrongs: string[];
    if (kind === 'poly' || kind === 'power') {
      let terms: PowerTerm[];
      let a: number;
      let b: number;
      if (kind === 'poly') {
        const p = randPoly(rng, rng.int(1, difficulty === 'easy' ? 2 : 3), difficulty === 'easy' ? 6 : 9, 0.7);
        terms = p.c.map((c, i) => pt(c, i)).filter((t) => !t.c.isZero()).reverse();
        a = rng.int(-3, 2);
        b = a + rng.int(1, 4);
      } else {
        const root = rng.bool();
        const pool = root ? [new Frac(1, 2), new Frac(-1, 2), new Frac(3, 2)] : [new Frac(-2), new Frac(-3)];
        terms = [pt(rng.signedInt(1, 6, true) * (root ? 3 : 1), rng.pick(pool)), pt(rng.signedInt(1, 6, true), rng.int(0, 2))];
        if (root) {
          const r1 = rng.int(1, 3);
          a = r1 * r1;
          b = (r1 + rng.int(1, 2)) ** 2;
        } else {
          a = rng.int(1, 3);
          b = a + rng.int(1, 3);
        }
      }
      const F = integrate(terms);
      value = evalTerms(F, b).sub(evalTerms(F, a));
      valueTex = num(value);
      question = intTex(`(${powerSumTex(terms, 'x', true)})`, a, b);
      steps.push(m(ds(`= \\left[ ${powerSumTex(F)} \\right]_{${a}}^{${b}}`)));
      steps.push(m(`= ${paren(evalTerms(F, b))} - ${paren(evalTerms(F, a))} = ${valueTex}`));
      const fb = evalTerms(F, b);
      const fa = evalTerms(F, a);
      wrongs = [num(fb.add(fa)), num(evalTerms(terms, b).sub(evalTerms(terms, a))), num(value.neg())];
    } else {
      const c = rng.signedInt(1, 6, true);
      const which = rng.pick(['cos', 'sin', 'inv', 'exp', 'sec2']);
      switch (which) {
        case 'cos': {
          const top = rng.pick([
            ['\\frac{\\pi}{2}', 1],
            ['\\frac{\\pi}{6}', new Frac(1, 2)],
            ['\\pi', 0],
          ] as const);
          question = intTex(`${lead(c)}\\cos x`, 0, top[0]);
          value = Frac.of(top[1]).mul(c);
          steps.push(m(ds(`= \\left[ ${lead(c)}\\sin x \\right]_{0}^{${top[0]}}`)));
          wrongs = [num(value.neg()), num(new Frac(c)), num(new Frac(c * 2))];
          break;
        }
        case 'sin': {
          const top = rng.pick([
            ['\\frac{\\pi}{2}', 1],
            ['\\pi', 2],
            ['\\frac{\\pi}{3}', new Frac(1, 2)],
          ] as const);
          question = intTex(`${lead(c)}\\sin x`, 0, top[0]);
          value = Frac.of(top[1]).mul(c);
          steps.push(m(ds(`= \\left[ ${lead(-c)}\\cos x \\right]_{0}^{${top[0]}}`)));
          wrongs = [num(value.neg()), num(Frac.ZERO), num(value.add(c))];
          break;
        }
        case 'inv': {
          const k = rng.int(1, 4);
          question = intTex(`\\frac{${c}}{x}`, 1, k === 1 ? 'e' : `e^{${k}}`);
          value = new Frac(c * k);
          steps.push(m(ds(`= \\left[ ${lead(c)}\\ln x \\right]_{1}^{${k === 1 ? 'e' : `e^{${k}}`}}`)));
          wrongs = [num(new Frac(c)), num(value.neg()), num(new Frac(c * k * k))];
          break;
        }
        case 'exp': {
          const k = rng.int(2, 6);
          const a = rng.pick([1, 2]);
          question = intTex(`${lead(c)}e^{${lin(a)}}`, 0, `\\ln ${k}`);
          value = new Frac(c * (k ** a - 1), a);
          steps.push(m(ds(`= \\left[ ${lead(new Frac(c, a))}e^{${lin(a)}} \\right]_{0}^{\\ln ${k}}`)));
          wrongs = [num(new Frac(c * k ** a, a)), num(new Frac(c * (k ** a - 1))), num(value.neg())];
          break;
        }
        default: {
          question = intTex(`${lead(c)}\\sec^{2} x`, 0, '\\frac{\\pi}{4}');
          value = new Frac(c);
          steps.push(m(ds(`= \\left[ ${lead(c)}\\tan x \\right]_{0}^{\\frac{\\pi}{4}}`)));
          wrongs = [num(new Frac(c * 2)), num(value.neg()), '0'];
          break;
        }
      }
      valueTex = num(value);
      steps.push(m(`= ${valueTex}`));
    }
    const answer = m(valueTex);
    return {
      question: m(ds(question)),
      answer,
      steps,
      distractors: distinctDistractors(answer, wrongs.map(m), (k) => m(num(value.add(offset(k))))),
      check: { kind: 'calculus.integral' },
    };
  },
});

// ---------------------------------------------------------------- u-substitution

export const uSubstitution = defineTopic({
  id: 'calc.u-substitution',
  subject: 'calculus',
  category: 'Integration',
  title: 'Integration by Substitution',
  description: 'Indefinite and definite integrals by u-substitution: powers of polynomials, roots, logarithms, trig and exponential compositions.',
  instruction: (o) => (o.type === 'definite' ? 'Evaluate each definite integral using substitution.' : 'Evaluate each integral using substitution.'),
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'type',
      label: 'Integrals',
      default: 'indefinite',
      choices: [
        { value: 'indefinite', label: 'Indefinite' },
        { value: 'definite', label: 'Definite' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const definite = strOpt(ctx, 'type') === 'definite';
    const KINDS: Record<Difficulty, string[]> = definite
      ? { easy: ['power'], medium: ['power', 'root'], hard: ['power', 'root'] }
      : { easy: ['power', 'linear'], medium: ['power', 'root', 'log', 'expx2', 'trigpow'], hard: ['root', 'log', 'lnpow', 'trigpow', 'expfrac'] };
    const kind = rng.pick(KINDS[difficulty]);
    const steps: string[] = [];
    let integrand: string;
    let F: string; // antiderivative (no + C)
    let Fnum: (x: number) => Frac = () => Frac.ZERO;
    let wrongs: string[];
    let pts: number[] | undefined;
    let bounds: [number, number] = [0, 1];
    switch (kind) {
      case 'power': {
        // ∫ c·x^{m−1}(a x^m + b)^n dx = c/(m a (n+1)) (a x^m + b)^{n+1}
        const mm = difficulty === 'easy' ? rng.int(1, 2) : rng.int(2, 3);
        const n = rng.int(2, definite ? 3 : 5);
        const a = rng.int(1, 3);
        const b = definite ? rng.int(1, 3) : rng.signedInt(1, 9, true);
        const inner = new Poly([b, ...Array(mm - 1).fill(0), a]);
        const t = inner.toTex();
        const k = rng.signedInt(1, 3, true);
        const c = k * mm * a * (n + 1);
        const coef = new Frac(c, mm * a * (n + 1));
        const xPart = mm === 1 ? '' : mm === 2 ? 'x' : `x^{${mm - 1}}`;
        integrand = `${lead(c)}${xPart}(${t})^{${n}}`;
        F = `${lead(coef)}(${t})^{${n + 1}}`;
        Fnum = (x) => coef.mul(inner.eval(x).pow(n + 1));
        steps.push(`Let $u = ${t}$, so $du = ${mm * a === 1 ? '' : mm * a}${xPart || ''}\\,dx$`.replace('= \\,dx', '= dx'));
        steps.push(m(ds(`${lead(new Frac(c, mm * a))}\\int u^{${n}}\\,du = ${lead(coef)}u^{${n + 1}}`)));
        wrongs = [`${lead(new Frac(c, n + 1))}(${t})^{${n + 1}}`, `${lead(new Frac(c * n, mm * a))}(${t})^{${n - 1}}`, `${lead(coef.neg())}(${t})^{${n + 1}}`];
        bounds = [0, rng.int(1, 2)];
        break;
      }
      case 'linear': {
        const fn = rng.pick(['cos', 'sin', 'exp']);
        const a = rng.int(2, 6);
        const b = rng.int(-5, 5);
        const c = a * rng.signedInt(1, 4, true);
        const u = new Poly([b, a]).toTex();
        if (fn === 'exp') {
          integrand = `${lead(c)}e^{${u}}`;
          F = `${lead(new Frac(c, a))}e^{${u}}`;
          wrongs = [`${lead(c)}e^{${u}}`, `${lead(c * a)}e^{${u}}`, `${lead(new Frac(c, a))}e^{${u}} \\cdot x`];
        } else {
          const g = fn === 'cos' ? 'sin' : 'cos';
          const s = fn === 'cos' ? new Frac(c, a) : new Frac(-c, a);
          integrand = `${lead(c)}\\${fn}(${u})`;
          F = `${lead(s)}\\${g}(${u})`;
          wrongs = [`${lead(s.neg())}\\${g}(${u})`, `${lead(c * a)}\\${g}(${u})`, `${lead(s)}\\${fn}(${u})`];
        }
        steps.push(`Let $u = ${u}$, so $du = ${a}\\,dx$`);
        break;
      }
      case 'root': {
        // ∫ c x / √(x² + a) dx = c √(x² + a)
        const a = definite ? rng.pick([9, 16, 5, 7]) : rng.int(1, 9);
        const c = rng.signedInt(1, 6, true);
        const inside = `x^{2} + ${a}`;
        integrand = `\\frac{${lin(c)}}{\\sqrt{${inside}}}`;
        F = `${lead(c)}\\sqrt{${inside}}`;
        steps.push(`Let $u = ${inside}$, so $du = 2x\\,dx$: $${ds(`\\frac{${c}}{2}\\int u^{-\\frac{1}{2}}\\,du = ${lead(c)}u^{\\frac{1}{2}}`)}$`.replace('\\frac{1}{2}\\int', '\\frac{1}{2}\\int'));
        wrongs = [`${lead(2 * c)}\\sqrt{${inside}}`, `${lead(new Frac(c, 2))}\\sqrt{${inside}}`, `\\frac{${c}}{2\\sqrt{${inside}}}`.replace('{-', '{-')];
        // bounds where x² + a is a perfect square
        const tops: Record<number, number> = { 9: 4, 16: 3, 5: 2, 7: 3 };
        bounds = [0, tops[a] ?? 1];
        Fnum = (x) => new Frac(c * Math.round(Math.sqrt(x * x + a)));
        break;
      }
      case 'log': {
        // ∫ k(2x + b)/(x² + bx + c) dx = k ln|x² + bx + c|
        const b = rng.int(1, 6);
        const c0 = rng.int(1, 9);
        const k = rng.signedInt(1, 4, true);
        const den = new Poly([c0, b, 1]).toTex();
        const top = new Poly([k * b, 2 * k]).toTex();
        integrand = `\\frac{${top}}{${den}}`;
        F = `${lead(k)}\\ln|${den}|`;
        steps.push(`Let $u = ${den}$, so $du = (2x + ${b})\\,dx$`);
        wrongs = [`${lead(2 * k)}\\ln|${den}|`, `\\frac{${k === 1 ? '' : k}}{${den}}`.replace('{}', '{1}'), `${lead(k)}(${den})^{2}`];
        break;
      }
      case 'expx2': {
        const a = rng.int(1, 4);
        const c = 2 * a * rng.signedInt(1, 3, true);
        integrand = `${lin(c)}e^{${a === 1 ? '' : a}x^{2}}`;
        F = `${lead(new Frac(c, 2 * a))}e^{${a === 1 ? '' : a}x^{2}}`;
        steps.push(`Let $u = ${a === 1 ? '' : a}x^{2}$, so $du = ${2 * a}x\\,dx$`);
        wrongs = [`${lead(c)}e^{${a === 1 ? '' : a}x^{2}}`, `${lead(new Frac(c, a))}e^{${a === 1 ? '' : a}x^{2}}`, `${lead(new Frac(c, 2 * a))}x^{2}e^{${a === 1 ? '' : a}x^{2}}`];
        pts = [0.3, 0.6, 0.9, -0.5, 1.2];
        break;
      }
      case 'trigpow': {
        const n = rng.int(2, 6);
        const c = (n + 1) * rng.signedInt(1, 3, true);
        const sin = rng.bool();
        const f = sin ? 'sin' : 'cos';
        const g = sin ? 'cos' : 'sin';
        integrand = `${lead(c)}\\${f}^{${n}} x\\${g} x`;
        const coef = new Frac(sin ? c : -c, n + 1);
        F = `${lead(coef)}\\${f}^{${n + 1}} x`;
        steps.push(`Let $u = \\${f} x$, so $du = ${sin ? '' : '-'}\\${g} x\\,dx$`);
        wrongs = [`${lead(coef.neg())}\\${f}^{${n + 1}} x`, `${lead(new Frac(c, n))}\\${f}^{${n - 1}} x`, `${lead(coef)}\\${g}^{${n + 1}} x`];
        pts = [0.3, 0.7, 1.1, -0.4, 2.0];
        break;
      }
      case 'lnpow': {
        const n = rng.int(1, 4);
        const c = (n + 1) * rng.signedInt(1, 3, true);
        integrand = `\\frac{${c}(\\ln x)^{${n}}}{x}`.replace('^{1}', '');
        F = `${lead(new Frac(c, n + 1))}(\\ln x)^{${n + 1}}`;
        steps.push('Let $u = \\ln x$, so $du = \\frac{1}{x}\\,dx$');
        wrongs = [`${lead(c)}(\\ln x)^{${n + 1}}`, `${lead(new Frac(c, n + 1))}(\\ln x)^{${n + 1}} \\cdot x`, `${lead(new Frac(-c, n + 1))}(\\ln x)^{${n + 1}}`];
        break;
      }
      case 'expfrac':
      default: {
        const a = rng.int(1, 9);
        const k = rng.signedInt(1, 5, true);
        integrand = `\\frac{${lin(k, 'e^{x}')}}{e^{x} + ${a}}`;
        F = `${lead(k)}\\ln(e^{x} + ${a})`;
        steps.push(`Let $u = e^{x} + ${a}$, so $du = e^{x}\\,dx$`);
        wrongs = [`${lead(k)}\\ln(e^{x})`, `\\frac{${k}}{e^{x} + ${a}}`, `${lead(k)}e^{x}\\ln(e^{x} + ${a})`];
        break;
      }
    }
    if (definite) {
      const [lo, hi] = bounds;
      const value = Fnum(hi).sub(Fnum(lo));
      const answer = m(num(value));
      steps.push(m(ds(`= \\left[ ${F} \\right]_{${lo}}^{${hi}} = ${num(value)}`)));
      return {
        question: m(ds(intTex(integrand, lo, hi))),
        answer,
        steps,
        distractors: distinctDistractors(answer, [num(Fnum(hi)), num(Fnum(hi).add(Fnum(lo))), num(value.neg())].map(m), (k) => m(num(value.add(offset(k))))),
        check: { kind: 'calculus.integral' },
      };
    }
    const answer = m(plusC(F));
    steps.push(answer);
    return {
      question: m(ds(intTex(integrand))),
      answer,
      steps,
      distractors: distinctDistractors(answer, wrongs.map((w) => m(plusC(w))), (k) => m(plusC(`${F} + ${k}x`))),
      check: { kind: 'calculus.integral', pts },
    };
  },
});

// ---------------------------------------------------------------- integration by parts

export const integrationByParts = defineTopic({
  id: 'calc.integration-by-parts',
  subject: 'calculus',
  category: 'Integration',
  title: 'Integration by Parts',
  description: 'Integrals of x·eᵃˣ, x·sin(ax), xⁿ ln x, ln x, x²eᵃˣ and eᵃˣ sin(bx) by parts.',
  instruction: 'Evaluate each integral using integration by parts.',
  multipleChoice: true,
  defaultCount: 8,
  options: [],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const KINDS: Record<Difficulty, string[]> = { easy: ['xexp', 'xtrig', 'lnx'], medium: ['xexp', 'xtrig', 'xnln'], hard: ['x2exp', 'x2trig', 'expsin', 'xnln'] };
    const kind = rng.pick(KINDS[difficulty]);
    const c = rng.signedInt(1, difficulty === 'easy' ? 3 : 5, true);
    const a = rng.signedInt(1, 4, kind !== 'xtrig' && kind !== 'x2trig');
    let I: FTerm[];
    let uTex: string;
    let dvTex: string;
    let pts: number[] | undefined;
    switch (kind) {
      case 'xexp':
      case 'x2exp': {
        const deg = kind === 'xexp' ? 1 : 2;
        I = [ft(c, deg, [atom('exp', a)])];
        uTex = deg === 1 ? 'x' : 'x^{2}';
        dvTex = `e^{${lin(a)}}\\,dx`;
        pts = [0.3, 0.7, 1.1, -0.5, -1.2];
        break;
      }
      case 'xtrig':
      case 'x2trig': {
        const deg = kind === 'xtrig' ? 1 : 2;
        const f = rng.pick(['sin', 'cos'] as const);
        I = [ft(c, deg, [atom(f, Math.abs(a))])];
        uTex = deg === 1 ? 'x' : 'x^{2}';
        dvTex = `${f === 'sin' ? '\\sin' : '\\cos'}${Math.abs(a) === 1 ? ' x' : `(${Math.abs(a)}x)`}\\,dx`;
        break;
      }
      case 'lnx':
        I = [ft(c, 0, [atom('ln')])];
        uTex = '\\ln x';
        dvTex = 'dx';
        break;
      case 'xnln': {
        const n = rng.int(1, 4);
        I = [ft(c * (n + 1) ** (difficulty === 'hard' ? 0 : 1), n, [atom('ln')])];
        uTex = '\\ln x';
        dvTex = `${n === 1 ? 'x' : `x^{${n}}`}\\,dx`;
        break;
      }
      default: {
        const b = rng.int(1, 3);
        const aa = rng.signedInt(1, 3, true);
        const f = rng.pick(['sin', 'cos'] as const);
        I = [ft(c * (aa * aa + b * b), 0, [atom('exp', aa), atom(f, b)])];
        uTex = `${f === 'sin' ? '\\sin' : '\\cos'}${b === 1 ? ' x' : `(${b}x)`}`;
        dvTex = `e^{${lin(aa)}}\\,dx`;
        pts = [0.3, 0.7, 1.1, -0.5, -1.2];
        break;
      }
    }
    const F = antiderivByParts(I[0]!);
    // sanity: F' = integrand
    const back = fnorm(fderiv(F));
    if (ftex(back) !== ftex(I)) throw new Error(`by parts: ${ftex(F)}' = ${ftex(back)} ≠ ${ftex(I)}`);
    const FTex = ftex(F);
    const answer = m(plusC(FTex));
    const last = F.length > 1 ? [...F.slice(0, -1), { ...F[F.length - 1]!, c: F[F.length - 1]!.c.neg() }] : F.map((t) => ({ ...t, c: t.c.neg() }));
    const wrongs = [ftex(last), ftex(F.slice(0, 1)), ftex(F.map((t, i) => (i === 0 ? t : { ...t, c: t.c.mul(2) })))];
    return {
      question: m(ds(intTex(ftex(I)))),
      answer,
      steps: [`Let $u = ${uTex}$ and $dv = ${dvTex}$.`, '$\\int u\\,dv = uv - \\int v\\,du$', answer],
      distractors: distinctDistractors(answer, wrongs.map((w) => m(plusC(w))), (k) => m(plusC(ftex([{ ...F[0]!, c: F[0]!.c.add(offset(k)) }, ...F.slice(1)])))),
      check: { kind: 'calculus.integral', pts },
    };
  },
});

/** Antiderivative of c·xⁿ·(atoms) for the by-parts families (solved symbolically). */
function antiderivByParts(t: FTerm): FTerm[] {
  const [A, B] = t.atoms;
  const n = t.p.n;
  if (A && B) {
    // ∫ c e^{ax} T(bx) dx = c e^{ax}(a T − T'·…)/(a² + b²)
    const a = A.a;
    const b = B.a;
    const k = t.c.div(a * a + b * b);
    const other = B.fn === 'sin' ? 'cos' : 'sin';
    const s = B.fn === 'sin' ? -1 : 1;
    return fnorm([ft(k.mul(a), 0, [A, B]), ft(k.mul(b * s), 0, [A, atom(other, b)])]);
  }
  if (A!.fn === 'ln') {
    // ∫ c xⁿ ln x = c xⁿ⁺¹ ln x/(n+1) − c xⁿ⁺¹/(n+1)²
    return fnorm([ft(t.c.div(n + 1), n + 1, [A!]), ft(t.c.div(-((n + 1) ** 2)), n + 1)]);
  }
  // tabular: ∫ c xⁿ g(x) = Σ (−1)^k c (xⁿ)^{(k)} G_{k+1}
  const out: FTerm[] = [];
  let coef = t.c;
  let pw = n;
  let sign = 1;
  let g = A!;
  let gCoef = Frac.ONE;
  for (;;) {
    // integrate g once: e^{ax} → e^{ax}/a, sin(ax) → −cos(ax)/a, cos(ax) → sin(ax)/a
    const a = g.a;
    let next: typeof g;
    let f: Frac;
    if (g.fn === 'exp') {
      next = g;
      f = new Frac(1, a);
    } else if (g.fn === 'sin') {
      next = atom('cos', a);
      f = new Frac(-1, a);
    } else {
      next = atom('sin', a);
      f = new Frac(1, a);
    }
    gCoef = gCoef.mul(f);
    g = next;
    out.push(ft(coef.mul(gCoef).mul(sign), pw, [g]));
    if (pw === 0) break;
    coef = coef.mul(pw);
    pw -= 1;
    sign = -sign;
  }
  return fnorm(out);
}

// ---------------------------------------------------------------- trig and exponential integrals

function sgnTerm(coef: Frac, part: string): Signed {
  const a = coef.abs();
  const body = a.eq(1) ? part : /^\d/.test(part) ? `${num(a)} \\cdot ${part}` : `${num(a)}${part}`;
  return { neg: coef.sign < 0, body };
}

export const trigExpIntegrals = defineTopic({
  id: 'calc.trig-exp-integrals',
  subject: 'calculus',
  category: 'Integration',
  title: 'Integrals of Trigonometric and Exponential Functions',
  description: 'Basic antiderivatives of sin, cos, sec², sec tan, csc², csc cot, eᵏˣ, bˣ and 1/x.',
  instruction: 'Evaluate each indefinite integral.',
  multipleChoice: true,
  defaultCount: 10,
  options: [],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    type Piece = { q: Signed; a: Signed; w: Signed };
    const kTerms = difficulty === 'easy' ? rng.int(1, 2) : difficulty === 'medium' ? 2 : 3;
    const a = difficulty === 'easy' ? 1 : rng.int(1, 3);
    const arg = lin(a);
    const fx = (f: string, pw = '') => (arg === 'x' ? `\\${f}${pw} x` : `\\${f}${pw}(${arg})`);
    const make = (kind: string): Piece => {
      const c = rng.signedInt(1, 6, true) * a;
      const C = new Frac(c);
      const ca = new Frac(c, a);
      switch (kind) {
        case 'sin':
          return { q: sgnTerm(C, fx('sin')), a: sgnTerm(ca.neg(), fx('cos')), w: sgnTerm(ca, fx('cos')) };
        case 'cos':
          return { q: sgnTerm(C, fx('cos')), a: sgnTerm(ca, fx('sin')), w: sgnTerm(ca.neg(), fx('sin')) };
        case 'sec2':
          return { q: sgnTerm(C, fx('sec', '^{2}')), a: sgnTerm(ca, fx('tan')), w: sgnTerm(ca, fx('sec')) };
        case 'sectan':
          return { q: sgnTerm(C, fx('sec') + fx('tan')), a: sgnTerm(ca, fx('sec')), w: sgnTerm(ca, fx('tan')) };
        case 'csc2':
          return { q: sgnTerm(C, fx('csc', '^{2}')), a: sgnTerm(ca.neg(), fx('cot')), w: sgnTerm(ca, fx('cot')) };
        case 'csccot':
          return { q: sgnTerm(C, fx('csc') + fx('cot')), a: sgnTerm(ca.neg(), fx('csc')), w: sgnTerm(ca, fx('csc')) };
        case 'exp': {
          const k = rng.signedInt(1, 5, true);
          const ck = new Frac(c, k);
          return { q: sgnTerm(C, `e^{${lin(k)}}`), a: sgnTerm(ck, `e^{${lin(k)}}`), w: sgnTerm(C.mul(k), `e^{${lin(k)}}`) };
        }
        case 'bx': {
          const b = rng.pick([2, 3, 5, 10]);
          const cc = new Frac(rng.signedInt(1, 6, true));
          const top = cc.abs().eq(1) ? `${b}^{x}` : `${cc.abs().n} \\cdot ${b}^{x}`;
          return { q: sgnTerm(cc, `${b}^{x}`), a: { neg: cc.sign < 0, body: `\\frac{${top}}{\\ln ${b}}` }, w: { neg: cc.sign < 0, body: `${cc.abs().eq(1) ? '' : `${cc.abs().n} \\cdot `}${b}^{x}\\ln ${b}` } };
        }
        default: {
          const cc = new Frac(rng.signedInt(1, 9, true));
          return { q: { neg: cc.sign < 0, body: `\\frac{${cc.abs().n}}{x}` }, a: sgnTerm(cc, '\\ln|x|'), w: { neg: cc.sign > 0, body: `\\frac{${cc.abs().n}}{x^{2}}` } };
        }
      }
    };
    const pool = ['sin', 'cos', 'sec2', 'sectan', 'csc2', 'csccot', 'exp', 'bx', 'inv'];
    const kinds = rng.sample(pool, kTerms);
    const pieces = kinds.map(make);
    const answerTex = joinSigned(pieces.map((p) => p.a));
    const answer = m(plusC(answerTex));
    const wrongs = [joinSigned(pieces.map((p) => p.w)), joinSigned(pieces.map((p, i) => (i === 0 ? p.w : p.a))), joinSigned(pieces.map((p) => ({ ...p.a, neg: !p.a.neg })))];
    return {
      question: m(ds(intTex(pieces.length > 1 ? `(${joinSigned(pieces.map((p) => p.q))})` : joinSigned(pieces.map((p) => p.q))))),
      answer,
      steps: [`Integrate term by term: $${answerTex} + C$`],
      distractors: distinctDistractors(answer, wrongs.map((w) => m(plusC(w))), (k) => m(plusC(`${answerTex} + ${k}x`))),
      check: { kind: 'calculus.integral', pts: [0.13, 0.27, 0.41, 0.33, 0.21] },
    };
  },
});

// ---------------------------------------------------------------- fundamental theorem of calculus

interface Wrapper {
  /** integrand in t */
  tex: (inner: string) => string;
  kind: 'poly' | 'sqrt' | 'cos' | 'recip' | 'exp';
}

export const ftc = defineTopic({
  id: 'calc.ftc',
  subject: 'calculus',
  category: 'Integration',
  title: 'The Fundamental Theorem of Calculus',
  description: 'Differentiate integrals with variable limits: d/dx of the integral from a to g(x) of f(t) dt.',
  instruction: "Find F'(x) for each function.",
  multipleChoice: true,
  defaultCount: 8,
  options: [],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const kind = rng.pick<Wrapper['kind']>(difficulty === 'easy' ? ['poly', 'sqrt', 'cos'] : ['poly', 'sqrt', 'cos', 'recip', 'exp']);
    // P(t): small polynomial; the integrand is wrap(P(t))
    const P = attempt('ftc-P', () => {
      const deg = rng.int(1, 3);
      const p = new Poly([kind === 'sqrt' || kind === 'recip' ? rng.int(1, 9) : rng.int(-5, 5), ...Array(deg - 1).fill(0), kind === 'sqrt' || kind === 'recip' ? rng.int(1, 3) : rng.signedInt(1, 4, true)]);
      return p.degree >= 1 ? p : null;
    });
    const wrap = (inner: string): string => {
      switch (kind) {
        case 'poly':
          return `(${inner})`;
        case 'sqrt':
          return `\\sqrt{${inner}}`;
        case 'cos':
          return `\\cos(${inner})`;
        case 'recip':
          return `\\frac{1}{${inner}}`;
        default:
          return `e^{${inner}}`;
      }
    };
    // upper limit g(x) = x^k (easy: k = 1), sometimes a variable lower limit too
    const k = difficulty === 'easy' ? 1 : rng.int(2, 3);
    const lower = difficulty === 'hard' && rng.bool(0.5) ? 'x' : null;
    const flip = difficulty !== 'easy' && !lower && rng.bool(0.3);
    const a = rng.int(-2, 3);
    const g = new Poly([...Array(k).fill(0), 1]);
    const comp = (q: Poly) => P.c.reduce((acc, c, i) => acc.add(q.powInt(i).scale(c)), new Poly([]));
    const Pg = comp(g);
    const dg = g.derivative();
    const gTex = g.toTex();
    const term = (inner: Poly, d: Poly): { tex: string; poly?: Poly } => {
      if (kind === 'poly') return { tex: d.mul(inner).toTex(), poly: d.mul(inner) };
      const dt = d.degree === 0 ? '' : polyFactor(d);
      const dc = d.degree === 0 ? d.coef(0) : null;
      if (kind === 'recip') return { tex: `\\frac{${d.toTex()}}{${inner.toTex()}}` };
      const w = wrap(inner.toTex());
      return { tex: dc ? `${lead(dc)}${w}` : `${dt}${w}` };
    };
    const up = term(Pg, dg);
    const integrand = wrap(P.toTex('t'));
    let lo: string;
    let hi: string;
    let dTex: string;
    const steps: string[] = [];
    if (lower) {
      lo = 'x';
      hi = gTex;
      const low = term(P, Poly.of(1));
      if (kind === 'poly') dTex = up.poly!.sub(P).toTex();
      else dTex = `${up.tex} - ${low.tex}`;
      steps.push(`Split at a constant: $F'(x) = f(${gTex}) \\cdot ${polyFactor(dg)} - f(x)$`);
    } else if (flip) {
      lo = gTex;
      hi = String(a);
      dTex = kind === 'poly' ? up.poly!.scale(-1).toTex() : `-${up.tex}`;
      steps.push(`Reverse the limits: $F(x) = -${intTex(integrand, a, gTex, 't')}$`);
    } else {
      lo = String(a);
      hi = gTex;
      dTex = up.tex;
      steps.push(k === 1 ? 'By the FTC, $F\'(x) = f(x)$.' : `Chain rule: $F'(x) = f(${gTex}) \\cdot ${polyFactor(dg)}$`);
    }
    const answer = m(`F'(x) = ${dTex}`);
    steps.push(answer);
    const noChain = kind === 'poly' ? Pg.toTex() : kind === 'recip' ? `\\frac{1}{${Pg.toTex()}}` : wrap(Pg.toTex());
    const atX = wrap(P.toTex());
    const wrongs = [noChain, atX, dTex.startsWith('-') ? dTex.slice(1) : `-${polyFactor(dg).startsWith('(') || !dTex.includes(' ') ? dTex : `(${dTex})`}`, `${polyFactor(dg)}${atX}`].map((w) => m(`F'(x) = ${w}`));
    return {
      question: m(ds(`F(x) = ${intTex(integrand, lo, hi, 't')}`)),
      answer,
      steps,
      distractors: distinctDistractors(answer, wrongs, (q) => m(`F'(x) = ${dTex} + ${q}`)),
      check: { kind: 'calculus.ftc', pts: kind === 'exp' || kind === 'poly' ? [0.3, 0.6, 0.9, 1.2, -0.7] : undefined },
    };
  },
});

// ---------------------------------------------------------------- average value

export const averageValue = defineTopic({
  id: 'calc.average-value',
  subject: 'calculus',
  category: 'Integration',
  title: 'Average Value of a Function',
  description: 'Average value of a function on an interval, and the c guaranteed by the Mean Value Theorem for integrals.',
  instruction: (o) => (o.task === 'c' ? 'Find all values of c guaranteed by the Mean Value Theorem for integrals on the given interval.' : 'Find the average value of each function on the given interval.'),
  multipleChoice: true,
  defaultCount: 8,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Find',
      default: 'value',
      choices: [
        { value: 'value', label: 'Average value' },
        { value: 'c', label: 'Value of c (MVT for integrals)' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const findC = strOpt(ctx, 'task') === 'c';
    const steps: string[] = [];
    if (findC) {
      // f = A x² + C on [a, b] or linear f
      const linear = difficulty === 'easy';
      const A = rng.signedInt(1, 3, true);
      const C = rng.int(-6, 6);
      const a = linear ? rng.int(-4, 2) : rng.pick([0, -rng.int(1, 3)]);
      const b = linear ? a + rng.int(1, 5) : a === 0 ? rng.int(1, 4) : -a;
      const f = linear ? new Poly([C, A]) : new Poly([C, 0, A]);
      const F = f.antiderivative();
      const avg = F.eval(b).sub(F.eval(a)).div(b - a);
      let cs: string[];
      if (linear) cs = [num(new Frac(a + b, 2))];
      else {
        const q = avg.sub(C).div(A);
        const r = Math.sqrt(q.value);
        cs = [-r, r].filter((x) => x >= a && x <= b).map((x) => (x < 0 ? `-${sqrtFracTex(q)}` : sqrtFracTex(q)));
      }
      steps.push(`Average value: $\\frac{1}{${b} - ${a < 0 ? `(${a})` : a}}${intTex(`(${f.toTex()})`, a, b)} = ${num(avg)}$`, `Solve $f(c) = ${num(avg)}$.`);
      const answer = `$c = ${[...new Set(cs)].join(', ')}$`;
      return {
        question: `$f(x) = ${f.toTex()}$ on $[${a}, ${b}]$`,
        answer,
        steps: [...steps, answer],
        distractors: distinctDistractors(answer, [`$c = ${num(avg)}$`, `$c = ${num(new Frac(a + b, 2).add(linear ? 1 : 0))}$`, `$c = ${num(new Frac(b))}$`, `$c = ${num(new Frac(b - a, 2))}$`], (k) => `$c = ${num(avg.add(offset(k)))}$`),
        check: { kind: 'calculus.average', task: 'c' },
      };
    }
    let fTex: string;
    let avg: Frac;
    let a: number;
    let b: number;
    let integral: Frac;
    if (difficulty === 'hard' && rng.bool(0.6)) {
      // k√x on [p², q²] or k/x² on [p, q]
      if (rng.bool()) {
        const k = rng.int(1, 6) * 3;
        const p0 = rng.int(0, 2);
        const q0 = p0 + rng.int(1, 3);
        a = p0 * p0;
        b = q0 * q0;
        fTex = `${k}\\sqrt{x}`;
        integral = new Frac(2 * k * (q0 ** 3 - p0 ** 3), 3);
      } else {
        const k = rng.int(1, 9);
        a = rng.int(1, 3);
        b = a + rng.int(1, 3);
        fTex = `\\frac{${k}}{x^{2}}`;
        integral = new Frac(k, a).sub(new Frac(k, b));
      }
    } else {
      const p = randPoly(rng, difficulty === 'easy' ? rng.int(1, 2) : rng.int(2, 3), 6, 0.7);
      a = rng.int(-3, 2);
      b = a + rng.int(1, 4);
      fTex = p.toTex();
      const F = p.antiderivative();
      integral = F.eval(b).sub(F.eval(a));
    }
    avg = integral.div(b - a);
    steps.push(`$f_{\\text{avg}} = \\frac{1}{${b} - ${a < 0 ? `(${a})` : a}}${intTex(fTex.includes(' ') ? `(${fTex})` : fTex, a, b)}$`, `The integral equals $${num(integral)}$, so $f_{\\text{avg}} = ${num(avg)}$.`);
    const answer = m(num(avg));
    return {
      question: `$f(x) = ${fTex}$ on $[${a}, ${b}]$`,
      answer,
      steps,
      distractors: distinctDistractors(answer, [num(integral), num(avg.neg()), num(integral.div(b + a === 0 ? 2 : b + a))].map(m), (k) => m(num(avg.add(offset(k))))),
      check: { kind: 'calculus.average', task: 'value' },
    };
  },
});
