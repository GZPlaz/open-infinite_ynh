/** Differentiation: limit definition, product / quotient / chain rules. */
import { Frac } from '../../fraction';
import { attempt, boolOpt, defineTopic, strOpt } from '../../generator';
import { Poly } from '../../polynomial';
import type { Rng } from '../../rng';
import { m, num, sum } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import {
  atom,
  atomTex,
  content,
  DYDX,
  fderiv,
  fmul,
  fnorm,
  fpoly,
  fscale,
  ft,
  ftex,
  ftweak,
  lead,
  lhsDistractors,
  lin,
  polyFactor,
  randPoly,
  type Atom,
  type AtomFn,
  type FTerm,
} from './common';

const ds = (t: string) => `\\displaystyle ${t}`;

// ---------------------------------------------------------------- definition of the derivative

export const derivativeDefinition = defineTopic({
  id: 'calc.derivative-definition',
  subject: 'calculus',
  category: 'Differentiation',
  title: 'Definition of the Derivative',
  description: "Find f'(x) or f'(a) from the limit definition for polynomials, rational functions and square roots.",
  instruction: (o) =>
    o.task === 'point' ? 'Use the definition of the derivative to find the indicated value.' : 'Use the definition of the derivative to find the derivative of each function.',
  multipleChoice: true,
  defaultCount: 8,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Find',
      default: 'function',
      choices: [
        { value: 'function', label: "f'(x)" },
        { value: 'point', label: "f'(a) at a given value" },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const point = strOpt(ctx, 'task') === 'point';
    const KINDS: Record<Difficulty, string[]> = { easy: ['linear', 'quadratic', 'quadratic'], medium: ['quadratic', 'cubic', 'reciprocal'], hard: ['reciprocal', 'root', 'invsq', 'cubic'] };
    const kind = rng.pick(KINDS[difficulty]);
    const H = (s: string) => `\\lim_{h \\to 0} ${s}`;
    const steps = [m(ds(`f'(x) = ${H('\\frac{f(x + h) - f(x)}{h}')}`))];
    let fTex: string;
    let dTex: string;
    let dAt: (a: number) => Frac;
    let wrongs: string[];
    let pts: number[] | undefined;
    let domainOk: (x: number) => boolean = () => true;
    const a = rng.signedInt(1, difficulty === 'easy' ? 6 : 9, true);
    switch (kind) {
      case 'linear':
      case 'quadratic':
      case 'cubic': {
        const deg = kind === 'linear' ? 1 : kind === 'quadratic' ? 2 : 3;
        const p = new Poly([rng.int(-9, 9), rng.int(-9, 9), ...(deg >= 2 ? [deg === 3 ? rng.int(-5, 5) : a] : []), ...(deg === 3 ? [rng.signedInt(1, 4, true)] : [])].slice(0, deg + 1));
        const P = p.degree === deg ? p : p.add(new Poly([...Array(deg).fill(0), deg === 1 ? a : 1]));
        fTex = P.toTex();
        const d = P.derivative();
        dTex = d.toTex();
        dAt = (x) => d.eval(x);
        const xh = P.terms().map((t) => ({ ...t, sym: t.sym ? t.sym.replace(/^x/, '(x + h)') : '' }));
        steps.push(m(ds(H(`\\frac{${sum(xh)} - (${fTex})}{h}`))));
        // expanded numerator divided by h: P'(x) + (terms with h)
        const hTerms: string[] = [];
        if (deg >= 2) hTerms.push(sum([{ coef: P.coef(2), sym: 'h' }, ...(deg === 3 ? [{ coef: P.coef(3).mul(3), sym: 'xh' }, { coef: P.coef(3), sym: 'h^{2}' }] : [])]));
        steps.push(m(ds(H(hTerms.length ? `(${dTex} + ${hTerms[0]})`.replace('+ -', '- ') : `(${dTex})`))));
        steps.push(m(`f'(x) = ${dTex}`));
        wrongs = [new Poly(P.c.map((c, i) => c.mul(i === 0 ? 0 : 1)).slice(1)).toTex(), d.add(Poly.of(P.coef(0).isZero() ? 1 : P.coef(0))).toTex(), d.scale(-1).toTex(), P.toTex()];
        break;
      }
      case 'reciprocal': {
        // a / (x + b)
        const b = rng.pick([1, 2, 3, 4, 5, 6, -5, -6, -7]);
        const den = Poly.of(b, 1).toTex();
        fTex = `\\frac{${a}}{${den}}`;
        dTex = `-\\frac{${a}}{(${den})^{2}}`.replace('-\\frac{-', '\\frac{');
        dAt = (x) => new Frac(-a, (x + b) ** 2 || 1);
        steps.push(m(ds(H(`\\frac{1}{h}\\left(\\frac{${a}}{${Poly.of(b, 1).toTex().replace('x', 'x + h')}} - \\frac{${a}}{${den}}\\right)`))));
        steps.push(m(ds(H(`\\frac{${-a}}{(${Poly.of(b, 1).toTex().replace('x', 'x + h')})(${den})}`))));
        steps.push(m(ds(`f'(x) = ${dTex}`)));
        wrongs = [`\\frac{${a}}{(${den})^{2}}`, `-\\frac{${a}}{${den}}`, `\\frac{${a}}{2(${den})}`, `-\\frac{${2 * a}}{(${den})^{2}}`];
        pts = POS_REC(b);
        domainOk = (x) => x + b !== 0;
        break;
      }
      case 'invsq': {
        // a / x^2
        fTex = `\\frac{${a}}{x^{2}}`;
        dTex = `-\\frac{${2 * a}}{x^{3}}`.replace('-\\frac{-', '\\frac{');
        dAt = (x) => new Frac(-2 * a, x ** 3);
        steps.push(m(ds(H(`\\frac{1}{h}\\left(\\frac{${a}}{(x + h)^{2}} - \\frac{${a}}{x^{2}}\\right)`))));
        steps.push(m(ds(H(`\\frac{${lead(-a)}(2x + h)}{x^{2}(x + h)^{2}}`))));
        steps.push(m(ds(`f'(x) = ${dTex}`)));
        wrongs = [`\\frac{${2 * a}}{x^{3}}`, `-\\frac{${a}}{x^{3}}`, `\\frac{${2 * a}}{x}`, `-\\frac{${2 * a}}{x^{2}}`];
        domainOk = (x) => x !== 0;
        break;
      }
      case 'root':
      default: {
        // k√(x + b)
        const k = rng.int(1, 4) * 2;
        const b = rng.int(0, 9);
        const inside = Poly.of(b, 1).toTex();
        fTex = `${k}\\sqrt{${inside}}`;
        dTex = `\\frac{${k / 2 === 1 ? '1' : k / 2}}{\\sqrt{${inside}}}`;
        dAt = (x) => new Frac(k / 2, Math.round(Math.sqrt(x + b)));
        domainOk = (x) => [1, 4, 9, 16].includes(x + b);
        steps.push(m(ds(H(`\\frac{${k}\\sqrt{${inside.replace('x', 'x + h')}} - ${k}\\sqrt{${inside}}}{h}`))));
        steps.push(`Multiply by the conjugate: $${ds(H(`\\frac{${k}}{\\sqrt{${inside.replace('x', 'x + h')}} + \\sqrt{${inside}}}`))}$`);
        steps.push(m(ds(`f'(x) = ${dTex}`)));
        wrongs = [`\\frac{${k}}{\\sqrt{${inside}}}`, `\\frac{${k / 2 === 1 ? '1' : k / 2}}{2\\sqrt{${inside}}}`, `${k / 2 === 1 ? '' : k / 2}\\sqrt{${inside}}`, `-\\frac{${k / 2 === 1 ? '1' : k / 2}}{\\sqrt{${inside}}}`];
        break;
      }
    }
    if (point) {
      const x0 = attempt('def-point', () => {
        const x = rng.int(-3, 6);
        return domainOk(x) ? x : null;
      });
      const value = dAt(x0);
      const ans = `f'(${x0}) = ${num(value)}`;
      steps.push(m(ans));
      return {
        question: `$f(x) = ${fTex}$; find $f'(${x0})$`,
        answer: m(ans),
        steps,
        distractors: lhsDistractors(`f'(${x0})`, num(value), [num(value.neg()), num(value.add(1)), num(value.mul(2)), num(value.sub(2))], (k) => num(value.add(k + 2))),
        check: { kind: 'calculus.deriv' },
      };
    }
    return {
      question: m(ds(`f(x) = ${fTex}`)),
      answer: m(ds(`f'(x) = ${dTex}`)),
      steps,
      distractors: lhsDistractors("f'(x)", dTex, wrongs, (k) => `${dTex} + ${k}`),
      check: { kind: 'calculus.deriv', pts },
    };
  },
});

/** Sample points away from the pole x = −b. */
function POS_REC(b: number): number[] {
  return [0.7, 1.3, 1.9, 2.6, 3.4].map((x) => (Math.abs(x + b) < 0.5 ? x + 1.1 : x));
}

// ---------------------------------------------------------------- product rule

const TRANS: AtomFn[] = ['sin', 'cos', 'exp', 'ln'];

function randAtom(rng: Rng, fn?: AtomFn, max = 5): Atom {
  const f = fn ?? rng.pick(TRANS);
  return atom(f, f === 'ln' ? 1 : f === 'exp' ? rng.signedInt(1, max, true) : rng.int(1, max));
}

const pFactor = (ts: FTerm[]) => (fnorm(ts).length > 1 || ftex(ts).startsWith('-') ? `(${ftex(ts)})` : ftex(ts));

export const productRule = defineTopic({
  id: 'calc.product-rule',
  subject: 'calculus',
  category: 'Differentiation',
  title: 'The Product Rule',
  description: 'Differentiate products of polynomials, powers, and trig, exponential and log functions.',
  instruction: 'Differentiate each function with respect to x.',
  multipleChoice: true,
  defaultCount: 10,
  options: [{ type: 'boolean', id: 'transcendental', label: 'Include trig, exponential and log factors', default: true }],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const trans = boolOpt(ctx, 'transcendental');
    const KINDS: Record<Difficulty, string[]> = trans
      ? { easy: ['poly', 'mono'], medium: ['poly', 'mono', 'binom'], hard: ['pair', 'binom', 'mono'] }
      : { easy: ['poly'], medium: ['poly', 'root'], hard: ['poly', 'root'] };
    const kind = rng.pick(KINDS[difficulty]);
    let u: FTerm[];
    let v: FTerm[];
    let qTex: string;
    switch (kind) {
      case 'poly': {
        const d1 = difficulty === 'easy' ? 1 : rng.int(1, 2);
        const d2 = difficulty === 'hard' ? rng.int(2, 3) : rng.int(1, 2);
        const P = randPoly(rng, d1, 6, 0.8);
        const Q = randPoly(rng, d2, 6, 0.6);
        u = fpoly(P);
        v = fpoly(Q);
        qTex = `(${P.toTex()})(${Q.toTex()})`;
        break;
      }
      case 'root': {
        // c√x · polynomial or x^{-1} · polynomial
        const c = rng.signedInt(1, 6, true);
        u = [ft(c, rng.pick([new Frac(1, 2), new Frac(-1), new Frac(3, 2)]))];
        v = fpoly(randPoly(rng, rng.int(1, 2), 6, 0.8));
        qTex = `${ftex(u)}${pFactor(v)}`;
        if (u[0]!.p.sign < 0) qTex = `${ftex(u)} \\cdot ${pFactor(v)}`;
        break;
      }
      case 'mono': {
        const n = rng.int(difficulty === 'easy' ? 1 : 2, difficulty === 'easy' ? 3 : 5);
        const c = rng.signedInt(1, difficulty === 'easy' ? 3 : 6, true);
        u = [ft(c, n)];
        v = [ft(1, 0, [randAtom(rng, undefined, difficulty === 'easy' ? 1 : 4)])];
        qTex = ftex(fmul(u, v));
        break;
      }
      case 'binom': {
        const P = randPoly(rng, rng.int(1, 2), 6, 1);
        u = fpoly(P);
        const at = randAtom(rng, undefined, 4);
        v = [ft(1, 0, [at])];
        qTex = `(${P.toTex()})${atomTex(at)}`;
        break;
      }
      case 'pair':
      default: {
        const pair = rng.pick<[AtomFn, AtomFn]>([
          ['exp', 'sin'],
          ['exp', 'cos'],
          ['exp', 'ln'],
          ['sin', 'ln'],
          ['cos', 'ln'],
        ]);
        u = [ft(rng.signedInt(1, 4, true), 0, [randAtom(rng, pair[0], 4)])];
        v = [ft(1, 0, [randAtom(rng, pair[1], 4)])];
        qTex = ftex(fmul(u, v));
        break;
      }
    }
    const du = fderiv(u);
    const dv = fderiv(v);
    let d = fnorm([...fmul(du, v), ...fmul(u, dv)]);
    if (d.every((t) => !t.atoms.length)) d = [...d].sort((x, y) => y.p.cmp(x.p));
    const dTex = ftex(d);
    const steps = [
      `$u = ${ftex(u)}$, $u' = ${ftex(du)}$; $v = ${ftex(v)}$, $v' = ${ftex(dv)}$`,
      m(ds(`${DYDX} = u'v + uv' = (${ftex(du)})(${ftex(v)}) + (${ftex(u)})(${ftex(dv)})`)),
      m(ds(`${DYDX} = ${dTex}`)),
    ];
    const wrongs = [ftex(fmul(du, dv)), ftex([...fmul(du, v), ...fscale(fmul(u, dv), -1)]), ftex(fmul(du, v)), ftex([...fmul(du, v), ...fmul(u, dv), ...fmul(du, dv)])];
    return {
      question: m(ds(`y = ${qTex}`)),
      answer: m(ds(`${DYDX} = ${dTex}`)),
      steps,
      distractors: lhsDistractors(DYDX, dTex, wrongs, (k) => ftex(ftweak(d, k))),
      check: { kind: 'calculus.deriv' },
    };
  },
});

// ---------------------------------------------------------------- quotient rule

export const quotientRule = defineTopic({
  id: 'calc.quotient-rule',
  subject: 'calculus',
  category: 'Differentiation',
  title: 'The Quotient Rule',
  description: 'Differentiate quotients of polynomials and of powers with trig, exponential and log functions.',
  instruction: 'Differentiate each function with respect to x.',
  multipleChoice: true,
  defaultCount: 10,
  options: [{ type: 'boolean', id: 'transcendental', label: 'Include trig, exponential and log functions', default: true }],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const trans = boolOpt(ctx, 'transcendental');
    const KINDS: Record<Difficulty, string[]> = {
      easy: ['linear'],
      medium: trans ? ['linear', 'poly', 'trans'] : ['linear', 'poly'],
      hard: trans ? ['poly', 'trans', 'exp'] : ['poly'],
    };
    const kind = rng.pick(KINDS[difficulty]);
    let qTex: string;
    let dTex: string;
    let wrongs: string[];
    const steps: string[] = [];
    let pts: number[] | undefined;
    if (kind === 'linear' || kind === 'poly') {
      const { N, D } = attempt('quot', () => {
        const N = randPoly(rng, kind === 'linear' ? 1 : rng.int(1, 2), 7, 1);
        const D = randPoly(rng, kind === 'linear' ? 1 : N.degree === 2 ? 1 : rng.int(1, 2), 7, 1);
        const top = N.derivative().mul(D).sub(N.mul(D.derivative()));
        if (top.isZero() || D.c.filter((c) => !c.isZero()).length < 2) return null;
        // keep the pole away from the sample points
        for (const x of [0.7, 1.3, 1.9, 2.6, 3.4]) if (Math.abs(D.evalNum(x)) < 0.3) return null;
        return { N, D };
      });
      const top = N.derivative().mul(D).sub(N.mul(D.derivative()));
      qTex = `\\frac{${N.toTex()}}{${D.toTex()}}`;
      dTex = `\\frac{${top.toTex()}}{(${D.toTex()})^{2}}`;
      steps.push(m(ds(`${DYDX} = \\frac{(${D.toTex()})(${N.derivative().toTex()}) - (${N.toTex()})(${D.derivative().toTex()})}{(${D.toTex()})^{2}}`)));
      const swapped = top.scale(-1);
      wrongs = [`\\frac{${swapped.toTex()}}{(${D.toTex()})^{2}}`, `\\frac{${top.toTex()}}{${D.toTex()}}`, N.derivative().degree === 0 ? num(N.derivative().coef(0).div(D.derivative().coef(0))) : `\\frac{${N.derivative().toTex()}}{${D.derivative().toTex()}}`, `\\frac{${N.derivative().mul(D).add(N.mul(D.derivative())).toTex()}}{(${D.toTex()})^{2}}`];
    } else if (kind === 'trans') {
      // (c·atom or c·x^k) / x^n
      const n = rng.int(1, 3);
      const c = rng.signedInt(1, 6, true);
      const U: FTerm[] = [ft(c, 0, [randAtom(rng, undefined, 4)])];
      const V: FTerm[] = [ft(1, n)];
      const dU = fderiv(U);
      const Nterms = fnorm([...fmul(dU, V), ...fscale(fmul(U, fderiv(V)), -1)]);
      const minP = Nterms.reduce((mn, t) => (t.p.cmp(mn) < 0 ? t.p : mn), Nterms[0]!.p);
      const Nc = Nterms.map((t) => ({ ...t, p: t.p.sub(minP) }));
      const denP = new Frac(2 * n).sub(minP);
      const den = denP.eq(1) ? 'x' : `x^{${denP.toTex()}}`;
      qTex = `\\frac{${ftex(U)}}{${n === 1 ? 'x' : `x^{${n}}`}}`;
      dTex = `\\frac{${ftex(Nc)}}{${den}}`;
      const Vt = n === 1 ? 'x' : `x^{${n}}`;
      const dVt = n === 1 ? '1' : n === 2 ? '2x' : `${n}x^{${n - 1}}`;
      steps.push(m(ds(`${DYDX} = \\frac{${Vt}(${ftex(dU)}) - (${ftex(U)})${n === 1 ? '' : `(${dVt})`}}{x^{${2 * n}}}`)));
      steps.push(`Cancel common factors of $x$: $${ds(`${DYDX} = ${dTex}`)}$`);
      const swapped = Nc.map((t) => ({ ...t, c: t.c.neg() }));
      wrongs = [`\\frac{${ftex(swapped)}}{${den}}`, `\\frac{${ftex(Nc)}}{x^{${2 * n + 1}}}`, n === 1 ? ftex(dU) : `\\frac{${ftex(dU)}}{${dVt}}`, `\\frac{${ftex(fnorm([...fmul(dU, V), ...fmul(U, fderiv(V))]).map((t) => ({ ...t, p: t.p.sub(minP) })))}}{${den}}`];
    } else {
      // U / e^{ax} with U = c·x^k or c·sin(bx)
      const a = rng.int(1, 4);
      const c = rng.signedInt(1, 6, true);
      const U: FTerm[] = rng.bool() ? [ft(c, rng.int(1, 3))] : [ft(c, 0, [randAtom(rng, rng.pick<AtomFn>(['sin', 'cos']), 4)])];
      const dU = fderiv(U);
      const Nc = fnorm([...dU, ...fscale(U, -a)]);
      const E = `e^{${lin(a)}}`;
      qTex = `\\frac{${ftex(U)}}{${E}}`;
      dTex = `\\frac{${ftex(Nc)}}{${E}}`;
      steps.push(m(ds(`${DYDX} = \\frac{${E}(${ftex(dU)}) - (${ftex(U)})(${a === 1 ? '' : a}${E})}{e^{${lin(2 * a)}}}`)));
      steps.push(`Divide top and bottom by $${E}$: $${ds(`${DYDX} = ${dTex}`)}$`);
      wrongs = [`\\frac{${ftex(fnorm([...dU, ...fscale(U, a)]))}}{${E}}`, `\\frac{${ftex(Nc)}}{e^{${lin(2 * a)}}}`, `\\frac{${ftex(dU)}}{${a === 1 ? '' : a}${E}}`, `\\frac{${ftex(fnorm([...fscale(dU, -1), ...fscale(U, a)]))}}{${E}}`];
    }
    return {
      question: m(ds(`y = ${qTex}`)),
      answer: m(ds(`${DYDX} = ${dTex}`)),
      steps: [...steps, m(ds(`${DYDX} = ${dTex}`))].filter((s, i, arr) => arr.indexOf(s) === i),
      distractors: lhsDistractors(DYDX, dTex, wrongs, (k) => `${dTex} + ${k}`),
      check: { kind: 'calculus.deriv', pts },
    };
  },
});

// ---------------------------------------------------------------- chain rule

/** Inner polynomial for the chain rule; `positive` keeps it > 0 for x > 0. */
function innerPoly(rng: Rng, d: Difficulty, positive: boolean): Poly {
  return attempt('inner', () => {
    const k = d === 'easy' ? 1 : rng.int(1, d === 'hard' ? 3 : 2);
    const a = positive ? rng.int(1, 5) : rng.signedInt(1, 5, true);
    const b = positive ? rng.int(1, 9) : rng.signedInt(1, 9, true);
    const c = Array(k + 1).fill(0);
    c[0] = b;
    c[k] = a;
    if (d === 'hard' && k >= 2 && rng.bool(0.5)) c[1] = positive ? rng.int(1, 5) : rng.signedInt(1, 5, true);
    const p = new Poly(c);
    if (!positive) for (const x of [0.7, 1.3, 1.9, 2.6, 3.4]) if (Math.abs(p.evalNum(x)) < 0.3) return null;
    return p;
  });
}

/** p' as `g·prim` pieces: lead coefficient text and bracketed primitive part ('' when constant). */
function derivParts(p: Poly, factor: number): { coef: Frac; prim: string; primPoly: Poly } {
  const dp = p.derivative();
  const g = content(dp);
  const prim = dp.scale(new Frac(1, g));
  const primTex = prim.degree === 0 ? '' : polyFactor(prim);
  return { coef: new Frac(g * factor), prim: primTex, primPoly: prim };
}

export const chainRule = defineTopic({
  id: 'calc.chain-rule',
  subject: 'calculus',
  category: 'Differentiation',
  title: 'The Chain Rule',
  description: 'Differentiate powers and roots of polynomials and compositions with trig, exponential and log functions.',
  instruction: 'Differentiate each function with respect to x.',
  multipleChoice: true,
  defaultCount: 10,
  options: [{ type: 'boolean', id: 'transcendental', label: 'Include trig, exponential and log functions', default: true }],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const trans = boolOpt(ctx, 'transcendental');
    const KINDS: Record<Difficulty, string[]> = trans
      ? { easy: ['power', 'power', 'fn'], medium: ['power', 'negative', 'root', 'fn', 'fn'], hard: ['negative', 'root', 'cuberoot', 'fn', 'nested'] }
      : { easy: ['power'], medium: ['power', 'negative', 'root'], hard: ['negative', 'root', 'cuberoot', 'power'] };
    const kind = rng.pick(KINDS[difficulty]);
    const steps: string[] = [];
    let fTex: string;
    let dTex: string;
    let wrongs: string[];
    let pts: number[] | undefined;
    switch (kind) {
      case 'power':
      case 'negative': {
        const p = innerPoly(rng, difficulty, false);
        const t = p.toTex();
        const n = rng.int(2, difficulty === 'easy' ? 5 : 7);
        const c = kind === 'negative' ? rng.signedInt(1, 4, true) : difficulty === 'hard' ? rng.signedInt(1, 3, true) : 1;
        const pp = p.derivative().toTex();
        if (kind === 'power') {
          fTex = `${lead(c)}(${t})^{${n}}`;
          const { coef, prim } = derivParts(p, c * n);
          const pw = n - 1 === 1 ? `(${t})` : `(${t})^{${n - 1}}`;
          dTex = `${lead(coef)}${prim}${pw}`;
          if (!prim && coef.eq(1)) dTex = pw;
          steps.push(`Let $u = ${t}$, so $u' = ${pp}$.`);
          steps.push(m(ds(`${DYDX} = ${lead(c * n)}(${t})^{${n - 1}} \\cdot ${paren0(pp)}`.replace(`^{1}`, ''))));
          wrongs = [`${lead(c * n)}${pw}`, `${lead(coef)}${prim}(${t})^{${n}}`, `${lead(coef.neg())}${prim}${pw}`, `${lead(coef)}${prim}(${t})^{${n + 1}}`];
        } else {
          fTex = `\\frac{${c}}{(${t})^{${n}}}`;
          const { coef, prim } = derivParts(p, -c * n);
          const top = `${coef.eq(1) && prim ? '' : coef.eq(-1) && prim ? '-' : num(coef)}${prim}`;
          dTex = top.startsWith('-') ? `-\\frac{${top.slice(1)}}{(${t})^{${n + 1}}}` : `\\frac{${top}}{(${t})^{${n + 1}}}`;
          steps.push(m(ds(`y = ${lead(c)}(${t})^{-${n}}`)));
          steps.push(m(ds(`${DYDX} = ${lead(-c * n)}(${t})^{-${n + 1}} \\cdot ${paren0(pp)}`)));
          const pe = (e: number) => (e === 1 ? `(${t})` : `(${t})^{${e}}`);
          const alt = (num_: string, e: number) => (num_.startsWith('-') ? `-\\frac{${num_.slice(1)}}{${pe(e)}}` : `\\frac{${num_}}{${pe(e)}}`);
          wrongs = [alt(top, n - 1), alt(top.startsWith('-') ? top.slice(1) : `-${top}`, n + 1), alt(String(-c * n), n + 1), alt(top, n)];
        }
        break;
      }
      case 'root':
      case 'cuberoot': {
        const p = innerPoly(rng, difficulty === 'easy' ? 'medium' : difficulty, true);
        const t = p.toTex();
        const k = rng.int(1, 3);
        const idx = kind === 'root' ? 2 : 3;
        fTex = `${lead(k)}${idx === 2 ? `\\sqrt{${t}}` : `\\sqrt[3]{${t}}`}`;
        const dp = p.derivative();
        const coef = new Frac(k, idx).mul(content(dp));
        const prim = dp.scale(new Frac(1, content(dp)));
        const primTex = prim.degree === 0 ? '' : prim.toTex();
        const topTex = coef.n === 1 && primTex ? primTex : `${coef.n}${primTex.includes(' ') ? `(${primTex})` : primTex}`;
        const rad = idx === 2 ? `\\sqrt{${t}}` : `\\sqrt[3]{(${t})^{2}}`;
        dTex = `\\frac{${topTex}}{${coef.d === 1 ? '' : coef.d}${rad}}`;
        steps.push(m(ds(`y = ${lead(k)}(${t})^{\\frac{1}{${idx}}}`)));
        steps.push(m(ds(`${DYDX} = ${lead(new Frac(k, idx))}(${t})^{-\\frac{${idx - 1}}{${idx}}} \\cdot ${paren0(dp.toTex())}`)));
        const primParen = primTex.includes(' ') ? `(${primTex})` : primTex;
        wrongs = [`\\frac{${k}}{${idx}${rad}}`, `\\frac{${topTex}}{${coef.d * 2}${rad}}`, `${lead(coef)}${primParen}${idx === 2 ? `\\sqrt{${t}}` : `\\sqrt[3]{(${t})^{2}}`}`, `-${dTex}`];
        pts = undefined;
        break;
      }
      case 'fn': {
        const fn = rng.pick(['sin', 'cos', 'tan', 'exp', 'ln']);
        const p = innerPoly(rng, difficulty, fn === 'ln' || fn === 'tan');
        if (fn === 'tan') pts = [0.13, 0.27, 0.41, 0.05, 0.21];
        const t = p.toTex();
        const { coef, prim } = derivParts(p, 1);
        const dp = p.derivative().toTex();
        const lc = (k: Frac) => (prim ? lead(k) : num(k).replace(/^1$/, '').replace(/^-1$/, '-'));
        switch (fn) {
          case 'sin':
            fTex = `\\sin(${t})`;
            dTex = `${lc(coef)}${prim}\\cos(${t})`;
            wrongs = [`\\cos(${t})`, `${lc(coef.neg())}${prim}\\cos(${t})`, `${lc(coef)}${prim}\\sin(${t})`, `-\\cos(${t})`];
            break;
          case 'cos':
            fTex = `\\cos(${t})`;
            dTex = `${lc(coef.neg())}${prim}\\sin(${t})`;
            wrongs = [`-\\sin(${t})`, `${lc(coef)}${prim}\\sin(${t})`, `${lc(coef.neg())}${prim}\\cos(${t})`, `\\sin(${t})`];
            break;
          case 'tan':
            fTex = `\\tan(${t})`;
            dTex = `${lc(coef)}${prim}\\sec^{2}(${t})`;
            wrongs = [`\\sec^{2}(${t})`, `${lc(coef)}${prim}\\sec(${t})\\tan(${t})`, `${lc(coef.neg())}${prim}\\sec^{2}(${t})`, `${lc(coef)}${prim}\\tan^{2}(${t})`];
            break;
          case 'exp':
            fTex = `e^{${t}}`;
            dTex = `${lc(coef)}${prim}e^{${t}}`;
            wrongs = [`e^{${t}}`, `(${t})e^{${p.sub(Poly.of(1)).toTex()}}`, p.derivative().degree === 0 ? `${lc(coef)}${prim}e^{${t}} + 1` : `${lc(coef)}${prim}e^{${dp}}`, `${lc(coef.neg())}${prim}e^{${t}}`];
            break;
          default:
            fTex = `\\ln(${t})`;
            dTex = `\\frac{${dp}}{${t}}`;
            wrongs = [`\\frac{1}{${t}}`, `\\frac{${t}}{${dp}}`, `${lc(coef)}${prim}\\ln(${t})`, `-\\frac{${dp}}{${t}}`];
            break;
        }
        steps.push(`Let $u = ${t}$, so $u' = ${dp}$.`);
        break;
      }
      case 'nested':
      default: {
        const a = rng.int(2, 5);
        const n = rng.int(2, 5);
        const u = `${a}x`;
        const choice = rng.pick(['sinpow', 'cospow', 'expsin', 'lncos']);
        pts = [0.11, 0.23, 0.29, 0.07, 0.17];
        if (choice === 'sinpow' || choice === 'cospow') {
          const f = choice === 'sinpow' ? 'sin' : 'cos';
          const g = f === 'sin' ? 'cos' : 'sin';
          const k = new Frac(n * a * (f === 'sin' ? 1 : -1));
          fTex = `\\${f}^{${n}}(${u})`;
          dTex = `${lead(k)}\\${f}${n - 1 === 1 ? '' : `^{${n - 1}}`}(${u})\\${g}(${u})`;
          const pw = n - 1 === 1 ? '' : `^{${n - 1}}`;
          steps.push(`Power rule, then the chain rule: $${ds(`${DYDX} = ${n}\\${f}${pw}(${u}) \\cdot ${f === 'sin' ? `\\cos(${u})` : `(-\\sin(${u}))`} \\cdot ${a}`)}$`);
          wrongs = [`${lead(n)}\\${f}${pw}(${u})`, `${lead(k.neg())}\\${f}${pw}(${u})\\${g}(${u})`, `${lead(n * a)}\\${g}${pw}(${u})`, `${lead(new Frac(n).mul(f === 'sin' ? 1 : -1))}\\${f}${pw}(${u})\\${g}(${u})`];
        } else if (choice === 'expsin') {
          fTex = `e^{\\sin(${u})}`;
          dTex = `${a}\\cos(${u})e^{\\sin(${u})}`;
          steps.push(`Let $w = \\sin(${u})$, so $w' = ${a}\\cos(${u})$.`);
          wrongs = [`e^{\\sin(${u})}`, `\\cos(${u})e^{\\sin(${u})}`, `${a}\\cos(${u})e^{\\cos(${u})}`, `-${a}\\cos(${u})e^{\\sin(${u})}`];
        } else {
          fTex = `\\ln(\\cos(${u}))`;
          dTex = `-${a}\\tan(${u})`;
          steps.push(`$${ds(`${DYDX} = \\frac{-${a}\\sin(${u})}{\\cos(${u})}`)}$`);
          wrongs = [`${a}\\tan(${u})`, `-\\tan(${u})`, `\\frac{1}{\\cos(${u})}`, `-${a}\\cot(${u})`];
        }
        break;
      }
    }
    steps.push(m(ds(`${DYDX} = ${dTex}`)));
    return {
      question: m(ds(`y = ${fTex}`)),
      answer: m(ds(`${DYDX} = ${dTex}`)),
      steps,
      distractors: lhsDistractors(DYDX, dTex, wrongs, (k) => `${dTex} + ${k}`),
      check: { kind: 'calculus.deriv', pts },
    };
  },
});

/** Parenthesise a polynomial factor that has several terms or a leading minus. */
function paren0(t: string): string {
  return / [+-] /.test(t) || t.startsWith('-') ? `(${t})` : t;
}
