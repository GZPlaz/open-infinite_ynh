/** Derivatives of trig, exponential, log and inverse trig functions; implicit and higher-order derivatives. */
import { Frac, gcdAll } from '../../fraction';
import { attempt, defineTopic, offset, strOpt } from '../../generator';
import { Poly } from '../../polynomial';
import type { Rng } from '../../rng';
import { m } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { atom, DYDX, fderiv, fnorm, ft, ftex, ftweak, joinSigned, lead, lhsDistractors, lin, polyFactor, randPoly, type AtomFn, type FTerm, type Signed } from './common';

const ds = (t: string) => `\\displaystyle ${t}`;

/** Glue coefficient magnitude, x-power and factors into one term. */
function termMag(c: number, xp: number, parts: string[]): string {
  const x = xp === 0 ? '' : xp === 1 ? 'x' : `x^{${xp}}`;
  const rest = x + parts.join('');
  const a = Math.abs(c);
  if (!rest) return String(a);
  if (a === 1) return rest;
  return /^\d/.test(rest) ? `${a} \\cdot ${rest}` : `${a}${rest}`;
}
const sterm = (c: number, xp: number, parts: string[]): Signed => ({ neg: c < 0, body: termMag(c, xp, parts) });

// ---------------------------------------------------------------- trigonometric

type Trig = 'sin' | 'cos' | 'tan' | 'sec' | 'csc' | 'cot';
const TRIGS: Trig[] = ['sin', 'cos', 'tan', 'sec', 'csc', 'cot'];

/** `\sin x`, `\sec^{2}(3x)`. */
function trigTex(f: string, u: string, power = 1): string {
  const p = power === 1 ? '' : `^{${power}}`;
  return u === 'x' ? `\\${f}${p} x` : `\\${f}${p}(${u})`;
}

/** d/du of T(u): sign and factors. */
function trigDeriv(f: Trig, u: string): { sign: number; parts: string[] } {
  switch (f) {
    case 'sin':
      return { sign: 1, parts: [trigTex('cos', u)] };
    case 'cos':
      return { sign: -1, parts: [trigTex('sin', u)] };
    case 'tan':
      return { sign: 1, parts: [trigTex('sec', u, 2)] };
    case 'sec':
      return { sign: 1, parts: [trigTex('sec', u), trigTex('tan', u)] };
    case 'csc':
      return { sign: -1, parts: [trigTex('csc', u), trigTex('cot', u)] };
    default:
      return { sign: -1, parts: [trigTex('csc', u, 2)] };
  }
}

/** A plausible wrong derivative of T(u) (sign or function mix-up). */
function trigWrong(f: Trig, u: string): { sign: number; parts: string[] } {
  const r = trigDeriv(f, u);
  const swap: Record<Trig, string[]> = {
    sin: [trigTex('cos', u)],
    cos: [trigTex('sin', u)],
    tan: [trigTex('sec', u), trigTex('tan', u)],
    sec: [trigTex('sec', u, 2)],
    csc: [trigTex('csc', u, 2)],
    cot: [trigTex('csc', u), trigTex('cot', u)],
  };
  return f === 'sin' || f === 'cos' ? { sign: -r.sign, parts: r.parts } : { sign: r.sign, parts: swap[f] };
}

const TRIG_PTS = [0.13, 0.27, 0.41, -0.19, -0.33];

export const trigDerivatives = defineTopic({
  id: 'calc.trig-derivatives',
  subject: 'calculus',
  category: 'Differentiation',
  title: 'Derivatives of Trigonometric Functions',
  description: 'Differentiate sin, cos, tan, sec, csc and cot, with the chain, product and power rules.',
  instruction: 'Differentiate each function with respect to x.',
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'functions',
      label: 'Functions',
      default: 'all',
      choices: [
        { value: 'all', label: 'All six' },
        { value: 'sincos', label: 'sin and cos only' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const pool: Trig[] = strOpt(ctx, 'functions') === 'sincos' ? ['sin', 'cos'] : TRIGS;
    const KINDS: Record<Difficulty, string[]> = { easy: ['basic'], medium: ['chain'], hard: ['product', 'power', 'chain'] };
    const kind = rng.pick(KINDS[difficulty]);
    let fTex: string;
    let terms: Signed[];
    let wrongs: Signed[][];
    const steps: string[] = [];
    if (kind === 'basic') {
      const [f1, f2] = rng.sample(pool, 2) as [Trig, Trig];
      const c1 = rng.signedInt(1, 9, true);
      const c2 = rng.bool(0.7) ? rng.signedInt(1, 9, true) : 0;
      const parts = (c: number, f: Trig) => (c ? [{ c, f }] : []);
      const list = [...parts(c1, f1), ...parts(c2, f2)];
      fTex = joinSigned(list.map(({ c, f }) => sterm(c, 0, [trigTex(f, 'x')])));
      terms = list.map(({ c, f }) => {
        const d = trigDeriv(f, 'x');
        return sterm(c * d.sign, 0, d.parts);
      });
      wrongs = [
        list.map(({ c, f }) => {
          const d = trigWrong(f, 'x');
          return sterm(c * d.sign, 0, d.parts);
        }),
        list.map(({ c, f }) => {
          const d = trigDeriv(f, 'x');
          return sterm(-c * d.sign, 0, d.parts);
        }),
        list.map(({ c, f }, i) => {
          const d = i === 0 ? trigWrong(f, 'x') : trigDeriv(f, 'x');
          return sterm(c * d.sign, 0, d.parts);
        }),
      ];
      steps.push(`Differentiate term by term: ${list.map(({ f }) => `$\\frac{d}{dx}\\${f} x = ${joinSigned([sterm(trigDeriv(f, 'x').sign, 0, trigDeriv(f, 'x').parts)])}$`).join(', ')}`);
    } else if (kind === 'chain') {
      const f = rng.pick(pool);
      const c = rng.signedInt(1, difficulty === 'hard' ? 5 : 4, true);
      const b = rng.int(1, 3);
      const k = rng.int(difficulty === 'medium' ? 1 : 2, 3);
      const u = k === 1 ? lin(b) : `${b === 1 ? '' : b}x^{${k}}`;
      if (k === 1 && b === 1) return trigDerivatives.generate({ ...ctx, rng: rng.fork('b') });
      fTex = joinSigned([sterm(c, 0, [trigTex(f, u)])]);
      const d = trigDeriv(f, u);
      terms = [sterm(c * b * k * d.sign, k - 1, d.parts)];
      const w = trigWrong(f, u);
      wrongs = [[sterm(c * d.sign, 0, d.parts)], [sterm(c * b * k * w.sign, k - 1, w.parts)], [sterm(-c * b * k * d.sign, k - 1, d.parts)], [sterm(c * b * d.sign, k, d.parts)]];
      steps.push(`Chain rule with $u = ${u}$, $u' = ${termMag(b * k, k - 1, [])}$.`);
    } else if (kind === 'product') {
      const f = rng.pick(pool);
      const n = rng.int(1, 4);
      const a = rng.int(1, 3);
      const c = rng.signedInt(1, 4, true);
      const u = lin(a);
      fTex = joinSigned([sterm(c, n, [trigTex(f, u)])]);
      const d = trigDeriv(f, u);
      terms = [sterm(c * n, n - 1, [trigTex(f, u)]), sterm(c * a * d.sign, n, d.parts)];
      wrongs = [[sterm(c * n * a * d.sign, n - 1, d.parts)], [sterm(c * n, n - 1, [trigTex(f, u)]), sterm(-c * a * d.sign, n, d.parts)], [sterm(c * a * d.sign, n, d.parts)], [sterm(c * n, n - 1, [trigTex(f, u)]), sterm(c * d.sign, n, d.parts)]];
      steps.push(`Product rule with $u = ${joinSigned([sterm(c, n, [])])}$ and $v = ${trigTex(f, u)}$.`);
    } else {
      const f = rng.pick(pool.filter((t) => t !== 'csc' && t !== 'cot'));
      const n = rng.int(2, 5);
      const a = rng.int(1, 3);
      const c = rng.signedInt(1, 3, true);
      const u = lin(a);
      fTex = joinSigned([sterm(c, 0, [trigTex(f, u, n)])]);
      const d = trigDeriv(f, u);
      // T^{n-1}(u) · T'(u), with sec^{n-1}·sec tan = sec^n tan
      const parts = f === 'sec' ? [trigTex('sec', u, n), trigTex('tan', u)] : [...(n - 1 > 0 ? [trigTex(f, u, n - 1)] : []), ...d.parts];
      terms = [sterm(c * n * a * d.sign, 0, parts)];
      wrongs = [[sterm(c * n * d.sign, 0, parts)], [sterm(c * n, 0, [trigTex(f, u, n - 1)])], [sterm(-c * n * a * d.sign, 0, parts)], [sterm(c * n * a * d.sign, 0, [trigTex(f, u, n - 1)])]];
      steps.push(`Power rule then chain rule: $${ds(`${DYDX} = ${lead(c * n)}${trigTex(f, u, n - 1)} \\cdot ${d.sign < 0 ? '(-' : ''}${d.parts.join('')}${d.sign < 0 ? ')' : ''} \\cdot ${a}`)}$`.replace(/\\cdot 1\$$/, '$'));
    }
    const dTex = joinSigned(terms);
    steps.push(m(ds(`${DYDX} = ${dTex}`)));
    return {
      question: m(ds(`y = ${fTex}`)),
      answer: m(ds(`${DYDX} = ${dTex}`)),
      steps,
      distractors: lhsDistractors(DYDX, dTex, wrongs.map(joinSigned), (k) => `${dTex} + ${k}`),
      check: { kind: 'calculus.deriv', pts: TRIG_PTS },
    };
  },
});

// ---------------------------------------------------------------- exponential and logarithmic

/** c times a factor that starts with a digit: `b^{x}`, `-b^{x}`, `3 \cdot b^{x}`. */
const cdot = (c: number, rest: string) => (c === 1 ? rest : c === -1 ? `-${rest}` : `${c} \\cdot ${rest}`);

/** A polynomial that is positive for x > 0. */
function posPoly(rng: Rng, deg: number): Poly {
  const c = Array.from({ length: deg + 1 }, (_, i) => (i === deg ? rng.int(1, 5) : i === 0 ? rng.int(1, 9) : rng.bool(0.5) ? rng.int(1, 6) : 0));
  return new Poly(c);
}

function ftermDistractors(terms: FTerm[]): string[] {
  const d = fderiv(terms);
  const n = fnorm(d);
  const out: string[] = [];
  if (n.length > 1) {
    out.push(ftex(n.slice(0, 1)), ftex(n.slice(1)), ftex([n[0]!, ...n.slice(1).map((t) => ({ ...t, c: t.c.neg() }))]));
  } else out.push(ftex(n.map((t) => ({ ...t, c: t.c.neg() }))));
  return out;
}

export const expLogDerivatives = defineTopic({
  id: 'calc.explog-derivatives',
  subject: 'calculus',
  category: 'Differentiation',
  title: 'Derivatives of Exponential and Logarithmic Functions',
  description: 'Differentiate eˣ, bˣ, ln x and log_b x, alone and combined with the chain, product and quotient rules.',
  instruction: 'Differentiate each function with respect to x.',
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'base',
      label: 'Bases',
      default: 'any',
      choices: [
        { value: 'any', label: 'e and other bases' },
        { value: 'natural', label: 'e and ln only' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const natural = strOpt(ctx, 'base') === 'natural';
    const KINDS: Record<Difficulty, string[]> = {
      easy: natural ? ['sum', 'eax', 'lnax'] : ['sum', 'eax', 'bx', 'logb', 'lnax'],
      medium: natural ? ['ep', 'lnp', 'ep'] : ['ep', 'lnp', 'bax', 'logp'],
      hard: ['prod', 'quot', 'xlnx', 'elnx'],
    };
    const kind = rng.pick(KINDS[difficulty]);
    const steps: string[] = [];
    let fTex: string;
    let dTex: string;
    let wrongs: Array<string | null>;
    const b = rng.pick([2, 3, 5, 7, 10]);
    switch (kind) {
      case 'sum': {
        const c = rng.signedInt(1, 9, true);
        const k = rng.signedInt(1, 9, true);
        const n = rng.int(2, 5);
        const e = rng.bool(0.5) ? rng.signedInt(1, 6, true) : 0;
        const T: FTerm[] = [ft(c, 0, [atom('exp', 1)]), ft(k, 0, [atom('ln')]), ...(e ? [ft(e, n)] : [])];
        fTex = ftex(T);
        dTex = ftex(fderiv(T));
        const dPoly = e ? [ft(e * n, n - 1)] : [];
        wrongs = [ftex([ft(c, 0, [atom('exp', 1)]), ft(-k, -1), ...dPoly]), ftex([ft(c, 0, [atom('exp', 1)]), ft(k, 0, [atom('ln')]), ...dPoly]), ftex([ft(c, 1, [atom('exp', 1)]), ft(k, -1), ...dPoly])];
        steps.push('$\\frac{d}{dx}e^{x} = e^{x}$ and $\\frac{d}{dx}\\ln x = \\frac{1}{x}$.');
        break;
      }
      case 'eax': {
        const a = rng.signedInt(2, 9, true);
        const c = rng.signedInt(1, 5, true);
        fTex = ftex([ft(c, 0, [atom('exp', a)])]);
        dTex = ftex([ft(c * a, 0, [atom('exp', a)])]);
        wrongs = [fTex, ftex([ft(c * a, 0, [atom('exp', a - 1)])]), ftex([ft(new Frac(c, a), 0, [atom('exp', a)])]), ftex([ft(c * a, 1, [atom('exp', a)])])];
        steps.push(`Chain rule: $\\frac{d}{dx}e^{${lin(a)}} = ${a}e^{${lin(a)}}$`);
        break;
      }
      case 'lnax': {
        const a = rng.int(2, 9);
        const c = rng.signedInt(1, 6, true);
        fTex = `${lead(c)}\\ln(${a}x)`;
        dTex = c === 1 ? '\\frac{1}{x}' : c === -1 ? '-\\frac{1}{x}' : c < 0 ? `-\\frac{${-c}}{x}` : `\\frac{${c}}{x}`;
        wrongs = [`\\frac{${c * a}}{x}`.replace('{-', '{-'), `\\frac{${Math.abs(c)}}{${a}x}`, `${lead(c)}\\ln x`, `\\frac{${Math.abs(c)}}{x^{2}}`].map((w) => w.replace(/\\frac\{-(\d+)\}/, '-\\frac{$1}'));
        steps.push(`$${fTex} = ${lead(c)}(\\ln ${a} + \\ln x)$, and $\\ln ${a}$ is a constant.`);
        break;
      }
      case 'bx': {
        const c = rng.signedInt(1, 6, true);
        fTex = cdot(c, `${b}^{x}`);
        dTex = cdot(c, `${b}^{x}\\ln ${b}`);
        wrongs = [cdot(c, `x \\cdot ${b}^{x - 1}`), fTex, `\\frac{${fTex}}{\\ln ${b}}`, cdot(c, `${b}^{x}\\ln x`)];
        steps.push(`$\\frac{d}{dx}b^{x} = b^{x}\\ln b$`);
        break;
      }
      case 'logb': {
        const c = rng.signedInt(1, 6, true);
        fTex = `${lead(c)}\\log_{${b}} x`;
        const top = Math.abs(c);
        dTex = `${c < 0 ? '-' : ''}\\frac{${top}}{x\\ln ${b}}`;
        wrongs = [`${c < 0 ? '-' : ''}\\frac{${top}}{x}`, `${c < 0 ? '-' : ''}\\frac{${top}\\ln ${b}}{x}`, `${c < 0 ? '-' : ''}\\frac{${top}}{${b}x}`, `${c < 0 ? '' : '-'}\\frac{${top}}{x\\ln ${b}}`];
        steps.push(`$\\frac{d}{dx}\\log_{b} x = \\frac{1}{x\\ln b}$`);
        break;
      }
      case 'ep': {
        const p = randPoly(rng, rng.int(1, 2), 5, 0.8);
        const t = p.toTex();
        const dp = p.derivative();
        fTex = `e^{${t}}`;
        dTex = `${dp.degree === 0 ? lead(dp.coef(0)) : polyFactor(dp)}e^{${t}}`;
        const negFactor = polyFactor(dp).startsWith('-') ? polyFactor(dp).slice(1) : `-${polyFactor(dp)}`;
        wrongs = [`e^{${t}}`, `(${t})e^{${p.sub(Poly.of(1)).toTex()}}`, `${dp.degree === 0 ? lead(dp.coef(0).neg()) : negFactor}e^{${t}}`, dp.degree === 0 ? null : `${polyFactor(dp)}e^{${dp.toTex()}}`];
        steps.push(`Chain rule with $u = ${t}$: $${ds(`${DYDX} = e^{u} \\cdot u'`)}$`);
        break;
      }
      case 'lnp': {
        const p = posPoly(rng, rng.int(1, 3));
        if (p.c.filter((c) => !c.isZero()).length < 2) return expLogDerivatives.generate({ ...ctx, rng: rng.fork('p') });
        const t = p.toTex();
        const dp = p.derivative().toTex();
        fTex = `\\ln(${t})`;
        dTex = `\\frac{${dp}}{${t}}`;
        wrongs = [`\\frac{1}{${t}}`, `\\frac{${t}}{${dp}}`, `\\frac{1}{${dp}}`, `${polyFactor(p.derivative())}\\ln(${t})`];
        steps.push(`$\\frac{d}{dx}\\ln u = \\frac{u'}{u}$ with $u = ${t}$`);
        break;
      }
      case 'bax': {
        const a = rng.signedInt(2, 6, true);
        const c0 = rng.int(-5, 5);
        const u = Poly.of(c0, a).toTex();
        fTex = `${b}^{${u}}`;
        dTex = cdot(a, `${b}^{${u}}\\ln ${b}`);
        wrongs = [`${b}^{${u}}\\ln ${b}`, `(${u}) \\cdot ${b}^{${Poly.of(c0 - 1, a).toTex()}}`, `\\frac{${cdot(a, `${b}^{${u}}`)}}{\\ln ${b}}`, cdot(a, `${b}^{${u}}`)];
        steps.push(`$\\frac{d}{dx}b^{u} = b^{u}\\ln b \\cdot u'$ with $u' = ${a}$`);
        break;
      }
      case 'logp': {
        const a = rng.int(1, 6);
        const c0 = rng.int(1, 9);
        const u = Poly.of(c0, a).toTex();
        fTex = `\\log_{${b}}(${u})`;
        dTex = `\\frac{${a}}{(${u})\\ln ${b}}`;
        wrongs = [`\\frac{1}{(${u})\\ln ${b}}`, `\\frac{${a}}{${u}}`, `\\frac{${a}\\ln ${b}}{${u}}`, `-\\frac{${a}}{(${u})\\ln ${b}}`];
        steps.push(`$\\frac{d}{dx}\\log_{b} u = \\frac{u'}{u\\ln b}$ with $u = ${u}$`);
        break;
      }
      default: {
        // product / quotient forms in the term algebra
        const n = rng.int(1, 4);
        const a = rng.signedInt(1, 4, true);
        const c = rng.signedInt(1, 5, true);
        let T: FTerm[];
        if (kind === 'prod') T = [ft(c, n, [atom('exp', a)])];
        else if (kind === 'quot') T = [ft(c, -n, [atom('exp', a)])];
        else if (kind === 'xlnx') T = [ft(c, rng.int(1, 5), [atom('ln')])];
        else T = [ft(c, 0, [atom('exp', a), atom('ln')])];
        fTex = ftex(T);
        dTex = ftex(fderiv(T));
        wrongs = ftermDistractors(T);
        steps.push(kind === 'quot' ? `Write as a product: $y = ${ftex(T).replace(/\\frac\{(.*)\}\{(x(?:\^\{\d\})?)\}/, '$1')} \\cdot x^{${-n}}$` : 'Product rule: $(uv)\' = u\'v + uv\'$');
        break;
      }
    }
    steps.push(m(ds(`${DYDX} = ${dTex}`)));
    return {
      question: m(ds(`y = ${fTex}`)),
      answer: m(ds(`${DYDX} = ${dTex}`)),
      steps,
      distractors: lhsDistractors(DYDX, dTex, wrongs, (k) => `${dTex} + ${k}`),
      check: { kind: 'calculus.deriv' },
    };
  },
});

// ---------------------------------------------------------------- inverse trigonometric

type ITrig = 'sin' | 'cos' | 'tan';

export const inverseTrigDerivatives = defineTopic({
  id: 'calc.inverse-trig-derivatives',
  subject: 'calculus',
  category: 'Differentiation',
  title: 'Derivatives of Inverse Trigonometric Functions',
  description: 'Differentiate sin⁻¹, cos⁻¹ and tan⁻¹ of linear, power and quotient arguments, including products.',
  instruction: 'Differentiate each function with respect to x.',
  multipleChoice: true,
  defaultCount: 10,
  options: [],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const KINDS: Record<Difficulty, string[]> = { easy: ['ax'], medium: ['axk', 'xa', 'ax'], hard: ['prod', 'sqrt', 'square', 'axk'] };
    const kind = rng.pick(KINDS[difficulty]);
    const f: ITrig = kind === 'sqrt' || kind === 'square' ? 'tan' : rng.pick(['sin', 'cos', 'tan'] as const);
    const inv = (u: string) => (u === 'x' ? `\\${f}^{-1} x` : `\\${f}^{-1}(${u})`);
    const sgn = f === 'cos' ? '-' : '';
    const steps: string[] = [];
    let fTex: string;
    let dTex: string;
    let wrongs: string[];
    let R = 1;
    const radical = (inside: string) => `\\sqrt{${inside}}`;
    const denom = (u2: string) => (f === 'tan' ? `1 + ${u2}` : radical(`1 - ${u2}`));
    const rule = f === 'tan' ? '\\frac{u\'}{1 + u^{2}}' : `${sgn}\\frac{u'}{\\sqrt{1 - u^{2}}}`;
    switch (kind) {
      case 'ax':
      case 'axk': {
        const k = kind === 'ax' ? 1 : rng.int(2, 3);
        const a = rng.int(kind === 'ax' && difficulty === 'easy' ? 1 : 2, difficulty === 'easy' ? 9 : 5);
        const c = rng.int(1, 3);
        const u = k === 1 ? lin(a) : `${a === 1 ? '' : a}x^{${k}}`;
        const u2 = `${a * a === 1 ? '' : a * a}x^{${2 * k}}`;
        const xk = k - 1 === 0 ? '' : k - 1 === 1 ? 'x' : `x^{${k - 1}}`;
        const top = `${c * a * k === 1 && xk ? '' : c * a * k}${xk}`;
        fTex = `${c === 1 ? '' : c}${inv(u)}`;
        dTex = `${sgn}\\frac{${top}}{${denom(u2)}}`;
        wrongs = [`${sgn}\\frac{${c}}{${denom(u2)}}`, `${sgn}\\frac{${top}}{1 - ${u2}}`, `${sgn ? '' : '-'}\\frac{${top}}{${denom(u2)}}`, `${sgn}\\frac{${top}}{${f === 'tan' ? `1 + ${u}` : radical(`1 - ${u}`)}}`];
        R = (0.9 / a) ** (1 / k);
        steps.push(`$\\frac{d}{dx}${f === 'tan' ? '\\tan' : `\\${f}`}^{-1} u = ${rule}$ with $u = ${u}$, $u' = ${top}$`);
        break;
      }
      case 'xa': {
        const a = rng.int(2, 9);
        fTex = inv(`\\frac{x}{${a}}`);
        dTex = f === 'tan' ? `\\frac{${a}}{${a * a} + x^{2}}` : `${sgn}\\frac{1}{\\sqrt{${a * a} - x^{2}}}`;
        wrongs =
          f === 'tan'
            ? [`\\frac{1}{${a * a} + x^{2}}`, `\\frac{1}{1 + x^{2}}`, `\\frac{${a}}{${a} + x^{2}}`, `-\\frac{${a}}{${a * a} + x^{2}}`]
            : [`${sgn}\\frac{${a}}{\\sqrt{${a * a} - x^{2}}}`, `${sgn}\\frac{1}{\\sqrt{1 - x^{2}}}`, `${sgn}\\frac{1}{\\sqrt{${a} - x^{2}}}`, `${sgn ? '' : '-'}\\frac{1}{\\sqrt{${a * a} - x^{2}}}`];
        R = 0.9 * a;
        steps.push(`With $u = \\frac{x}{${a}}$, $u' = \\frac{1}{${a}}$; simplify $${rule}$.`);
        break;
      }
      case 'prod': {
        const n = rng.int(1, 3);
        const xn = n === 1 ? 'x' : `x^{${n}}`;
        const x1 = n - 1 === 0 ? '' : n - 1 === 1 ? 'x' : `x^{${n - 1}}`;
        fTex = `${xn}${inv('x')}`;
        const first = `${n === 1 ? '' : n}${x1}${inv('x')}`;
        const second = `\\frac{${xn}}{${denom('x^{2}')}}`;
        dTex = `${first} ${sgn ? '-' : '+'} ${second}`;
        wrongs = [`${first} ${sgn ? '+' : '-'} ${second}`, `\\frac{${n === 1 ? '1' : `${n}${x1}`}}{${denom('x^{2}')}}`, first, `${first} ${sgn ? '-' : '+'} \\frac{${xn}}{${f === 'tan' ? '1 - x^{2}' : '1 - x^{2}'}}`];
        R = 0.9;
        steps.push(`Product rule: $(${xn})' \\cdot ${inv('x')} + ${xn} \\cdot (${inv('x')})'$`);
        break;
      }
      case 'sqrt': {
        fTex = inv('\\sqrt{x}');
        dTex = '\\frac{1}{2\\sqrt{x}(1 + x)}';
        wrongs = ['\\frac{1}{1 + x}', '\\frac{1}{2\\sqrt{x}(1 + x^{2})}', '\\frac{1}{\\sqrt{x}(1 + x)}', '\\frac{\\sqrt{x}}{2(1 + x)}'];
        R = 0;
        steps.push("With $u = \\sqrt{x}$, $u' = \\frac{1}{2\\sqrt{x}}$ and $u^{2} = x$.");
        break;
      }
      default: {
        const c = rng.int(1, 4);
        fTex = `${c === 1 ? '' : c}(\\tan^{-1} x)^{2}`;
        dTex = `\\frac{${2 * c}\\tan^{-1} x}{1 + x^{2}}`;
        wrongs = [`\\frac{${2 * c}}{1 + x^{2}}`, `${2 * c}\\tan^{-1} x`, `\\frac{${c === 1 ? '' : c}\\tan^{-1} x}{1 + x^{2}}`, `\\frac{${2 * c}\\tan^{-1} x}{(1 + x^{2})^{2}}`];
        R = 0;
        steps.push(`Power rule then chain rule: $${2 * c}\\tan^{-1} x \\cdot \\frac{1}{1 + x^{2}}$`);
        break;
      }
    }
    steps.push(m(ds(`${DYDX} = ${dTex}`)));
    const pts = R === 0 ? undefined : f === 'tan' ? [0.31, 0.77, 1.2, -0.6, -1.1] : [0.12, 0.31, 0.5, 0.7, -0.45].map((t) => t * Math.min(R, 3));
    return {
      question: m(ds(`y = ${fTex}`)),
      answer: m(ds(`${DYDX} = ${dTex}`)),
      steps,
      distractors: lhsDistractors(DYDX, dTex, wrongs, (k) => `${dTex} + ${k}`),
      check: { kind: 'calculus.deriv', pts },
    };
  },
});

// ---------------------------------------------------------------- implicit differentiation

interface Mono {
  c: number;
  i: number;
  j: number;
}

function monoTex(t: Mono, first: boolean): string {
  const xs = t.i === 0 ? '' : t.i === 1 ? 'x' : `x^{${t.i}}`;
  const ys = t.j === 0 ? '' : t.j === 1 ? 'y' : `y^{${t.j}}`;
  const body = xs + ys;
  const a = Math.abs(t.c);
  const mag = body ? (a === 1 ? body : `${a}${body}`) : String(a);
  if (first) return t.c < 0 ? `-${mag}` : mag;
  return t.c < 0 ? ` - ${mag}` : ` + ${mag}`;
}

function polyXY(ts: Mono[]): string {
  const list = ts.filter((t) => t.c !== 0);
  if (!list.length) return '0';
  return list.map((t, k) => monoTex(t, k === 0)).join('');
}

/** Combine like monomials, sort by total degree then x-degree. */
function normXY(ts: Mono[]): Mono[] {
  const out: Mono[] = [];
  for (const t of ts) {
    const o = out.find((q) => q.i === t.i && q.j === t.j);
    if (o) o.c += t.c;
    else out.push({ ...t });
  }
  return out.filter((t) => t.c !== 0).sort((a, b) => b.i + b.j - (a.i + a.j) || b.i - a.i);
}

const evalXY = (ts: Mono[], x: number, y: number) => ts.reduce((s, t) => s + t.c * x ** t.i * y ** t.j, 0);

export const implicitDifferentiation = defineTopic({
  id: 'calc.implicit-differentiation',
  subject: 'calculus',
  category: 'Differentiation',
  title: 'Implicit Differentiation',
  description: 'Find dy/dx in terms of x and y for polynomial equations, including mixed xy terms.',
  instruction: 'Use implicit differentiation to find dy/dx.',
  multipleChoice: true,
  defaultCount: 8,
  options: [],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    return attempt('implicit', () => {
      const pureX = (): Mono => ({ c: rng.signedInt(1, 6, true), i: rng.int(1, 3), j: 0 });
      const pureY = (): Mono => ({ c: rng.signedInt(1, 6, true), i: 0, j: rng.int(1, 3) });
      const mixed = (): Mono => {
        const opts = difficulty === 'hard' ? [[1, 1], [2, 1], [1, 2], [2, 2], [1, 3], [3, 1]] : [[1, 1], [2, 1], [1, 2]];
        const [i, j] = rng.pick(opts) as [number, number];
        return { c: rng.signedInt(1, 5, true), i, j };
      };
      const terms: Mono[] = [pureX(), pureY()];
      if (difficulty === 'easy') {
        if (terms[1]!.j === 1) terms[1]!.j = 2;
        if (rng.bool(0.4)) terms.push(pureX());
      } else {
        terms.push(mixed());
        if (difficulty === 'hard') terms.push(rng.bool() ? mixed() : pureY());
      }
      const all = normXY(terms);
      if (all.length < 2 || !all.some((t) => t.j > 0) || !all.some((t) => t.i > 0)) return null;
      // point on the curve
      const x0 = rng.signedInt(1, 3, true);
      const y0 = rng.signedInt(1, 3, true);
      // split into the two sides of the equation
      const right = all.filter(() => rng.bool(0.35));
      const left = all.filter((t) => !right.includes(t));
      if (!left.length) return null;
      const C = evalXY(left, x0, y0) - evalXY(right, x0, y0);
      if (Math.abs(C) > 200) return null;
      // F = left − right − C
      const F = normXY([...left, ...right.map((t) => ({ ...t, c: -t.c }))]);
      const Fx = normXY(F.filter((t) => t.i > 0).map((t) => ({ c: t.c * t.i, i: t.i - 1, j: t.j })));
      const Fy = normXY(F.filter((t) => t.j > 0).map((t) => ({ c: t.c * t.j, i: t.i, j: t.j - 1 })));
      if (!Fx.length || !Fy.length) return null;
      if (Math.abs(evalXY(Fy, x0, y0)) < 1) return null;
      // dy/dx = −Fx / Fy, reduced by common integer and monomial factors
      let N = Fx.map((t) => ({ ...t, c: -t.c }));
      let D = Fy.map((t) => ({ ...t }));
      const g = gcdAll([...N, ...D].map((t) => t.c)) || 1;
      const mi = Math.min(...[...N, ...D].map((t) => t.i));
      const mj = Math.min(...[...N, ...D].map((t) => t.j));
      const s = D[0]!.c < 0 ? -1 : 1;
      const red = (t: Mono) => ({ c: (t.c / g) * s, i: t.i - mi, j: t.j - mj });
      N = normXY(N.map(red));
      D = normXY(D.map(red));
      const render = (n: Mono[], d: Mono[]) => {
        if (d.length === 1 && d[0]!.i === 0 && d[0]!.j === 0 && d[0]!.c === 1) return polyXY(n);
        if (n.length === 1 && n[0]!.c < 0) return `-\\frac{${polyXY([{ ...n[0]!, c: -n[0]!.c }])}}{${polyXY(d)}}`;
        return `\\frac{${polyXY(n)}}{${polyXY(d)}}`;
      };
      const dTex = render(N, D);
      const eq = `${polyXY(left)} = ${polyXY([...right, { c: C, i: 0, j: 0 }])}`;
      // forgetting dy/dx on the x-part of mixed terms changes Fy
      const FyWrong = normXY(F.filter((t) => t.j > 0 && t.i === 0).map((t) => ({ c: t.c * t.j, i: t.i, j: t.j - 1 })));
      const wrongs = [render(N.map((t) => ({ ...t, c: -t.c })), D), render(D.map((t) => ({ ...t, c: -t.c })), N), FyWrong.length && FyWrong.length !== Fy.length ? render(Fx.map((t) => ({ ...t, c: -t.c })), FyWrong) : null, render(N, D.map((t) => ({ ...t, j: t.j + 1 })))];
      if (render(N, D) === render(D.map((t) => ({ ...t, c: -t.c })), N)) return null;
      const lhsTerms = (ts: Mono[]) => ts.map((t) => {
        const parts: string[] = [];
        if (t.i > 0) parts.push(polyXY([{ c: t.c * t.i, i: t.i - 1, j: t.j }]));
        if (t.j > 0) parts.push(`${polyXY([{ c: t.c * t.j, i: t.i, j: t.j - 1 }])}\\frac{dy}{dx}`.replace(/^1\\frac/, '\\frac').replace(/^-1\\frac/, '-\\frac'));
        return parts.join(' + ').replace(/\+ -/g, '- ');
      });
      const diffLine = `${lhsTerms(left).join(' + ')} = ${right.length ? lhsTerms(right).join(' + ') : '0'}`.replace(/\+ -/g, '- ');
      return {
        question: m(eq),
        answer: m(ds(`${DYDX} = ${dTex}`)),
        steps: [`Differentiate both sides with respect to $x$: $${diffLine}$`, `Collect the $\\frac{dy}{dx}$ terms and solve: $${ds(`${DYDX} = ${dTex}`)}$`],
        distractors: lhsDistractors(DYDX, dTex, wrongs, (k) => render(N.map((t, q) => (q === 0 ? { ...t, c: t.c + offset(k) } : t)), D)),
        check: { kind: 'calculus.implicit', point: [x0, y0] },
      };
    });
  },
});

// ---------------------------------------------------------------- higher-order derivatives

export const higherOrderDerivatives = defineTopic({
  id: 'calc.higher-order-derivatives',
  subject: 'calculus',
  category: 'Differentiation',
  title: 'Higher-Order Derivatives',
  description: 'Second and third derivatives of polynomials, power functions and exponential, trig and log functions.',
  instruction: (o) => (o.order === 'third' ? 'Find the third derivative of each function.' : o.order === 'mixed' ? 'Find the indicated derivative of each function.' : 'Find the second derivative of each function.'),
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'order',
      label: 'Order',
      default: 'second',
      choices: [
        { value: 'second', label: 'Second derivative' },
        { value: 'third', label: 'Third derivative' },
        { value: 'mixed', label: 'Mixed' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const oOpt = strOpt(ctx, 'order');
    const order = oOpt === 'third' ? 3 : oOpt === 'mixed' ? rng.pick([2, 3]) : 2;
    let T: FTerm[];
    if (difficulty === 'easy') {
      T = attempt('ho-poly', () => {
        const p = randPoly(rng, rng.int(order + 1, order + 3), 7, 0.6);
        return p.degree > order ? [...p.c.map((c, i) => ft(c, i))].filter((t) => !t.c.isZero()).reverse() : null;
      });
    } else if (difficulty === 'medium') {
      const pool = [new Frac(-1), new Frac(-2), new Frac(1, 2), new Frac(3, 2), new Frac(-1, 2)];
      const ps = rng.sample(pool, 2);
      T = [ft(rng.signedInt(1, 5, true), rng.int(order, order + 2)), ...ps.map((p) => ft(rng.signedInt(1, 4, true) * (p.isInt() ? 1 : 4), p))];
    } else {
      const choice = rng.pick<AtomFn | 'xexp' | 'xln'>(['sin', 'cos', 'exp', 'xexp', 'ln', 'xln']);
      const a = rng.int(2, 4);
      const c = rng.signedInt(1, 4, true);
      if (choice === 'xexp') T = [ft(c, 1, [atom('exp', rng.signedInt(1, 3, true))])];
      else if (choice === 'xln') T = [ft(c, rng.int(2, 4), [atom('ln')])];
      else if (choice === 'ln') T = [ft(c, 0, [atom('ln')]), ft(rng.signedInt(1, 5, true), rng.int(2, 4))];
      else T = [ft(c, 0, [atom(choice, choice === 'exp' ? rng.signedInt(2, 4, true) : a)]), ft(rng.signedInt(1, 6, true), rng.int(order, order + 1))];
    }
    T = fnorm(T);
    const ders: FTerm[][] = [T];
    for (let k = 1; k <= order + 1; k++) ders.push(fderiv(ders[k - 1]!));
    const name = (k: number) => (k === 1 ? DYDX : `\\frac{d^{${k}}y}{dx^{${k}}}`);
    const dTex = ftex(ders[order]!);
    const steps = Array.from({ length: order }, (_, k) => m(ds(`${name(k + 1)} = ${ftex(ders[k + 1]!)}`)));
    const wrongs = [ftex(ders[order - 1]!), ftex(ders[order + 1]!), ftex(ders[order]!.map((t, i) => (i === 0 ? { ...t, c: t.c.neg() } : t))), ftex(ders[order]!.slice(0, -1))];
    const lhs = name(order);
    return {
      question: oOpt === 'mixed' ? `$${ds(`y = ${ftex(T)}`)}$; find $${lhs}$` : m(ds(`y = ${ftex(T)}`)),
      answer: m(ds(`${lhs} = ${dTex}`)),
      steps,
      distractors: lhsDistractors(lhs, dTex, wrongs.filter((w) => w !== '0' || dTex !== '0'), (k) => ftex(ftweak(ders[order]!, k))),
      check: { kind: 'calculus.deriv', order, pts: [0.7, 1.1, 1.6, 2.1, 2.7] },
    };
  },
});

