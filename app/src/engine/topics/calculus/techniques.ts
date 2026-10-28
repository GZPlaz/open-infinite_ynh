/** Techniques of integration: partial fractions, trigonometric integrals, trigonometric substitution, improper integrals. */
import { Frac, type FracLike } from '../../fraction';
import { attempt, defineTopic, distinctDistractors, offset, strOpt } from '../../generator';
import { Poly } from '../../polynomial';
import { m, num } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { joinSigned, lead, piTex, type Signed } from './common';

const ds = (t: string) => `\\displaystyle ${t}`;
const intTex = (body: string, lo?: string | number, hi?: string | number) => (lo === undefined ? `\\int ${body}\\,dx` : `\\int_{${lo}}^{${hi}} ${body}\\,dx`);
const plusC = (t: string) => `${t} + C`;
const xm = (a: number) => (a === 0 ? 'x' : `x ${a > 0 ? '-' : '+'} ${Math.abs(a)}`);
/** Signed term c·part, `part` never starting with a digit. */
const st = (c: Frac, part: string): Signed => ({ neg: c.sign < 0, body: c.abs().eq(1) ? part : `${num(c.abs())}${part}` });
/** Signed term c/den. */
const sfrac = (c: Frac, den: string): Signed => ({ neg: c.sign < 0, body: `\\frac{${c.abs().n}}{${c.abs().d === 1 ? '' : c.abs().d}${den}}` });

// ---------------------------------------------------------------- partial fractions

export const partialFractions = defineTopic({
  id: 'calc.partial-fractions',
  subject: 'calculus',
  category: 'Techniques of Integration',
  title: 'Integration by Partial Fractions',
  description: 'Integrate rational functions by decomposing into distinct linear, repeated linear and irreducible quadratic factors.',
  instruction: 'Evaluate each integral using partial fractions.',
  multipleChoice: true,
  defaultCount: 8,
  options: [],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const kind = rng.pick(difficulty === 'easy' ? ['distinct'] : difficulty === 'medium' ? ['distinct', 'repeated', 'three'] : ['quadratic', 'repeated', 'three']);
    const coef = () => new Frac(rng.signedInt(1, 5, true));
    const roots = attempt('pf-roots', () => {
      const rs = rng.sample([-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5], kind === 'three' ? 3 : 2);
      return rs;
    });
    let N: Poly;
    let D: Poly;
    let answer: Signed[];
    let wrongs: Signed[][];
    let decomposition: string;
    const lnT = (c: Frac, r: number) => st(c, `\\ln|${xm(r)}|`);
    switch (kind) {
      case 'distinct':
      case 'three': {
        const cs = roots.map(() => coef());
        D = Poly.fromRoots(roots);
        N = roots.reduce((acc, _, i) => acc.add(Poly.fromRoots(roots.filter((__, j) => j !== i)).scale(cs[i]!)), new Poly([]));
        answer = roots.map((r, i) => lnT(cs[i]!, r));
        decomposition = joinSigned(roots.map((r, i) => sfrac(cs[i]!, xm(r).length > 1 ? `(${xm(r)})` : xm(r)))).replace(/\{\((x[^)]*)\)\}/g, '{$1}');
        wrongs = [roots.map((r, i) => lnT(cs[(i + 1) % cs.length]!, r)), roots.map((r, i) => lnT(cs[i]!.neg(), r)), roots.map((r, i) => lnT(cs[i]!, -r)), roots.map((r, i) => sfrac(cs[i]!.neg(), `(${xm(r)})^{2}`))];
        break;
      }
      case 'repeated': {
        // A/(x − a) + B/(x − a)²  (+ C/(x − b) on hard)
        const [a, b] = roots as [number, number];
        const A = coef();
        const B = coef();
        const withB = difficulty === 'hard';
        const Cc = coef();
        D = Poly.fromRoots(withB ? [a, a, b] : [a, a]);
        N = withB ? Poly.fromRoots([a, b]).scale(A).add(Poly.fromRoots([b]).scale(B)).add(Poly.fromRoots([a, a]).scale(Cc)) : Poly.fromRoots([a]).scale(A).add(Poly.of(B));
        answer = [lnT(A, a), sfrac(B.neg(), xm(a)), ...(withB ? [lnT(Cc, b)] : [])];
        decomposition = joinSigned([sfrac(A, xm(a)), sfrac(B, `(${xm(a)})^{2}`), ...(withB ? [sfrac(Cc, xm(b))] : [])]);
        wrongs = [
          [lnT(A, a), sfrac(B, xm(a)), ...(withB ? [lnT(Cc, b)] : [])],
          [lnT(A, a), st(B, `\\ln|${xm(a)}|^{2}`), ...(withB ? [lnT(Cc, b)] : [])],
          [lnT(B, a), sfrac(A.neg(), xm(a)), ...(withB ? [lnT(Cc, b)] : [])],
        ];
        break;
      }
      case 'quadratic':
      default: {
        // A/(x − a) + (Bx + Ck)/(x² + k²)
        const a = roots[0]!;
        const k = rng.int(1, 3);
        const A = coef();
        const B = new Frac(rng.signedInt(1, 3, true) * 2);
        const Ck = coef();
        const Q = Poly.of(k * k, 0, 1);
        D = Poly.fromRoots([a]).mul(Q);
        N = Q.scale(A).add(Poly.of(Ck.mul(k), B).mul(Poly.fromRoots([a])));
        const atan = k === 1 ? '\\tan^{-1} x' : `\\tan^{-1}\\left(\\frac{x}{${k}}\\right)`;
        answer = [lnT(A, a), st(B.div(2), `\\ln(x^{2} + ${k * k})`), st(Ck, atan)];
        decomposition = `${joinSigned([sfrac(A, xm(a))])} + \\frac{${Poly.of(Ck.mul(k), B).toTex()}}{x^{2} + ${k * k}}`.replace('+ -', '- ');
        wrongs = [[lnT(A, a), st(B, `\\ln(x^{2} + ${k * k})`), st(Ck, atan)], [lnT(A, a), st(B.div(2), `\\ln(x^{2} + ${k * k})`), st(Ck.mul(k), atan)], [lnT(A, a), st(B.div(2), `\\ln(x^{2} + ${k * k})`)]];
        break;
      }
    }
    const integrand = `\\frac{${N.toTex()}}{${D.toTex()}}`;
    const aTex = joinSigned(answer);
    const ans = m(plusC(aTex));
    return {
      question: m(ds(intTex(integrand))),
      answer: ans,
      steps: [`Decompose: $${ds(`${integrand} = ${decomposition}`)}$`, ans],
      distractors: distinctDistractors(ans, wrongs.map((w) => m(plusC(joinSigned(w)))), (q) => m(plusC(joinSigned([...answer, { neg: false, body: `${Math.abs(offset(q)) === 1 ? '' : Math.abs(offset(q))}x` }])))),
      check: { kind: 'calculus.integral' },
    };
  },
});

// ---------------------------------------------------------------- trigonometric integrals

const powTrig = (f: string, j: number) => (j === 1 ? `\\${f} x` : `\\${f}^{${j}} x`);

/** Σ cⱼ·f^j(x) for the non-zero coefficients of p (highest power first). */
function trigPolyTerms(p: Poly, f: string): Signed[] {
  const out: Signed[] = [];
  for (let j = p.degree; j >= 1; j--) if (!p.coef(j).isZero()) out.push(st(p.coef(j), powTrig(f, j)));
  return out;
}

export const trigIntegrals = defineTopic({
  id: 'calc.trig-integrals',
  subject: 'calculus',
  category: 'Techniques of Integration',
  title: 'Trigonometric Integrals',
  description: 'Products of powers of sine and cosine (odd and even powers) and of secant and tangent.',
  instruction: 'Evaluate each integral.',
  multipleChoice: true,
  defaultCount: 8,
  options: [
    {
      type: 'select',
      id: 'family',
      label: 'Functions',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'sincos', label: 'Powers of sin and cos' },
        { value: 'sectan', label: 'Powers of sec and tan' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const fam = strOpt(ctx, 'family');
    const family = fam === 'any' ? rng.pick(['sincos', 'sincos', 'sectan']) : fam;
    const steps: string[] = [];
    let integrand: string;
    let answer: Signed[];
    let wrongs: Signed[][];
    const c = new Frac(rng.signedInt(1, difficulty === 'easy' ? 1 : 4, true));
    if (family === 'sincos') {
      const even = difficulty !== 'easy' && rng.bool(difficulty === 'hard' ? 0.5 : 0.3);
      if (!even) {
        // one odd power: substitute the other function
        const oddSin = rng.bool();
        const k = rng.int(1, difficulty === 'easy' ? 1 : 2);
        const odd = 2 * k + 1;
        const other = rng.int(difficulty === 'easy' ? 0 : 1, difficulty === 'hard' ? 4 : 3);
        const [f, g] = oddSin ? ['sin', 'cos'] : ['cos', 'sin'];
        integrand = `${lead(c)}${powTrig(f, odd)}${other ? powTrig(g, other) : ''}`;
        // sin^{2k+1} g^n dx = −(1 − u²)^k uⁿ du with u = cos (sign + for odd cos, u = sin)
        const integrandU = Poly.of(1, 0, -1).powInt(k).mul(new Poly([...Array(other).fill(0), 1])).scale(oddSin ? c.neg() : c);
        const F = integrandU.antiderivative();
        answer = trigPolyTerms(F, g);
        steps.push(`Let $u = \\${g} x$, $du = ${oddSin ? '-' : ''}\\${f} x\\,dx$, and write $${powTrig(f, 2 * k)} = (1 - u^{2})${k === 1 ? '' : `^{${k}}`}$.`);
        wrongs = [trigPolyTerms(F.scale(-1), g), trigPolyTerms(F, f), trigPolyTerms(new Poly(F.c.map((q, i) => (i === F.degree ? q : q.mul(2)))), g)];
      } else {
        // even powers via half-angle identities
        const form = rng.pick(['s2', 'c2', 's2c2', 's4', 'c4']);
        const F: Array<[Frac, string]> = [];
        const s = (n: number, d: number) => c.mul(new Frac(n, d));
        const sinK = (k: number) => `\\sin ${k}x`;
        switch (form) {
          case 's2':
            integrand = `${lead(c)}\\sin^{2} x`;
            F.push([s(1, 2), 'x'], [s(-1, 4), sinK(2)]);
            break;
          case 'c2':
            integrand = `${lead(c)}\\cos^{2} x`;
            F.push([s(1, 2), 'x'], [s(1, 4), sinK(2)]);
            break;
          case 's2c2':
            integrand = `${lead(c)}\\sin^{2} x\\cos^{2} x`;
            F.push([s(1, 8), 'x'], [s(-1, 32), sinK(4)]);
            break;
          case 's4':
            integrand = `${lead(c)}\\sin^{4} x`;
            F.push([s(3, 8), 'x'], [s(-1, 4), sinK(2)], [s(1, 32), sinK(4)]);
            break;
          default:
            integrand = `${lead(c)}\\cos^{4} x`;
            F.push([s(3, 8), 'x'], [s(1, 4), sinK(2)], [s(1, 32), sinK(4)]);
            break;
        }
        answer = F.map(([q, part]) => st(q, part));
        steps.push('Use $\\sin^{2} x = \\frac{1 - \\cos 2x}{2}$ and $\\cos^{2} x = \\frac{1 + \\cos 2x}{2}$.');
        wrongs = [F.map(([q, part], i) => st(i === 0 ? q : q.neg(), part)), F.map(([q, part]) => st(q.mul(2), part)), F.slice(0, 1).map(([q, part]) => st(q, part)).concat(F.slice(1).map(([q, part]) => st(q, part.replace('\\sin', '\\cos'))))];
      }
    } else {
      const form = difficulty === 'easy' ? rng.pick(['tan2', 'secEven']) : rng.pick(['secEven', 'tanOdd', 'tanOdd', 'secEven']);
      if (form === 'tan2') {
        integrand = `${lead(c)}\\tan^{2} x`;
        answer = [st(c, '\\tan x'), st(c.neg(), 'x')];
        steps.push('$\\tan^{2} x = \\sec^{2} x - 1$');
        wrongs = [[st(c, '\\sec x')], [st(c, '\\tan x'), st(c, 'x')], [st(c.mul(new Frac(1, 3)), '\\tan^{3} x')]];
      } else if (form === 'secEven') {
        // tan^m sec^{2j}: u = tan x
        const j = rng.int(1, difficulty === 'hard' ? 3 : 2);
        const mm = rng.int(j === 1 ? 1 : 0, 4);
        integrand = `${lead(c)}${mm ? powTrig('tan', mm) : ''}${powTrig('sec', 2 * j)}`;
        const U = Poly.of(1, 0, 1).powInt(j - 1).mul(new Poly([...Array(mm).fill(0), 1])).scale(c);
        const F = U.antiderivative();
        answer = trigPolyTerms(F, 'tan');
        steps.push(`Let $u = \\tan x$, $du = \\sec^{2} x\\,dx$${j > 1 ? `, and $\\sec^{2} x = 1 + u^{2}$` : ''}.`);
        wrongs = [trigPolyTerms(F, 'sec'), trigPolyTerms(F.scale(-1), 'tan'), trigPolyTerms(U, 'tan')];
      } else {
        // tan^{2k+1} sec^n with n ≥ 1: u = sec x
        const k = rng.int(1, 2);
        const n = rng.int(1, 4);
        integrand = `${lead(c)}${powTrig('tan', 2 * k + 1)}${powTrig('sec', n)}`;
        const U = Poly.of(-1, 0, 1).powInt(k).mul(new Poly([...Array(n - 1).fill(0), 1])).scale(c);
        const F = U.antiderivative();
        answer = trigPolyTerms(F, 'sec');
        steps.push(`Let $u = \\sec x$, $du = \\sec x\\tan x\\,dx$, and $\\tan^{2} x = u^{2} - 1$.`);
        wrongs = [trigPolyTerms(F, 'tan'), trigPolyTerms(F.scale(-1), 'sec'), trigPolyTerms(U, 'sec')];
      }
    }
    const aTex = joinSigned(answer);
    const ans = m(plusC(aTex));
    steps.push(ans);
    return {
      question: m(ds(intTex(integrand))),
      answer: ans,
      steps,
      distractors: distinctDistractors(ans, wrongs.map((w) => m(plusC(joinSigned(w)))), (q) => m(plusC(`${aTex} + ${Math.abs(offset(q)) === 1 ? '' : Math.abs(offset(q))}x`))),
      check: { kind: 'calculus.integral', pts: [0.13, 0.27, 0.41, 0.33, 0.21] },
    };
  },
});

// ---------------------------------------------------------------- trigonometric substitution

export const trigSubstitution = defineTopic({
  id: 'calc.trig-substitution',
  subject: 'calculus',
  category: 'Techniques of Integration',
  title: 'Trigonometric Substitution',
  description: 'Integrals with √(a² − x²), √(a² + x²) and √(x² − a²) by x = a sin θ, a tan θ, a sec θ.',
  instruction: 'Evaluate each integral using a trigonometric substitution.',
  multipleChoice: true,
  defaultCount: 8,
  options: [],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const POOL: Record<Difficulty, string[]> = { easy: ['asin', 'atan', 'atanFrac'], medium: ['sqrtArea', 'invX2', 'x2over', 'atanFrac'], hard: ['pow32', 'lnSqrt', 'secForm', 'invX2', 'x2over'] };
    const kind = rng.pick(POOL[difficulty]);
    const a = rng.int(1, difficulty === 'easy' ? 4 : 5);
    const a2 = a * a;
    const c = new Frac(rng.signedInt(1, difficulty === 'easy' ? 1 : 3, true));
    const asin = a === 1 ? '\\sin^{-1} x' : `\\sin^{-1}\\left(\\frac{x}{${a}}\\right)`;
    const atan = a === 1 ? '\\tan^{-1} x' : `\\tan^{-1}\\left(\\frac{x}{${a}}\\right)`;
    const R = (s: string) => `\\sqrt{${s}}`;
    const minus = `${a2} - x^{2}`;
    const plus = `x^{2} + ${a2}`;
    const xmin = `x^{2} - ${a2}`;
    let integrand: string;
    let answer: Signed[];
    let wrongs: Signed[][];
    let sub: string;
    let pts = [0.21, 0.43, 0.65, -0.37, 0.8].map((t) => t * a);
    switch (kind) {
      case 'asin':
        integrand = `\\frac{${c.n === 1 ? 1 : c.n}}{${R(minus)}}`.replace('{-1}', '{-1}');
        answer = [st(c, asin)];
        sub = `x = ${a === 1 ? '' : a}\\sin\\theta`;
        wrongs = [[st(c, atan)], [st(c.div(a), asin)], [st(c.neg(), asin)]];
        break;
      case 'atan':
      case 'atanFrac':
        integrand = `\\frac{${c.n}}{${plus}}`;
        answer = [st(c.div(a), atan)];
        sub = `x = ${a === 1 ? '' : a}\\tan\\theta`;
        wrongs = [[st(c, atan)], [st(c.div(a), asin)], [st(c.div(2), `\\ln(${plus})`)]];
        if (a === 1) wrongs[0] = [st(c.mul(2), atan)];
        break;
      case 'sqrtArea':
        // ∫ √(a² − x²) dx = (x/2)√(a² − x²) + (a²/2) sin⁻¹(x/a)
        integrand = `${lead(c)}${R(minus)}`;
        answer = [st(c.div(2), `x${R(minus)}`), st(c.mul(a2).div(2), asin)];
        sub = `x = ${a === 1 ? '' : a}\\sin\\theta`;
        wrongs = [[st(c.div(2), `x${R(minus)}`), st(c.mul(a2).div(2).neg(), asin)], [st(c.mul(a2).div(2), asin)], [st(c, `x${R(minus)}`), st(c.mul(a2), asin)]];
        break;
      case 'invX2':
        // ∫ dx/(x²√(a² − x²)) = −√(a² − x²)/(a² x)
        integrand = `\\frac{${c.n}}{x^{2}${R(minus)}}`;
        answer = [{ neg: c.sign > 0, body: `\\frac{${c.abs().eq(1) ? '' : c.abs().n}${R(minus)}}{${a2 === 1 ? '' : a2}x}` }];
        sub = `x = ${a === 1 ? '' : a}\\sin\\theta`;
        wrongs = [[{ neg: c.sign < 0, body: answer[0]!.body }], [{ neg: c.sign > 0, body: `\\frac{${c.abs().eq(1) ? '' : c.abs().n}${R(minus)}}{x}` }], [{ neg: c.sign > 0, body: `\\frac{${c.abs().eq(1) ? '' : c.abs().n}x}{${a2 === 1 ? '' : a2}${R(minus)}}`.replace('{x}{}', '{x}{1}') }]];
        pts = [0.21, 0.43, 0.65, -0.37, 0.8].map((t) => t * a);
        break;
      case 'x2over':
        // ∫ x²/√(a² − x²) dx = (a²/2) sin⁻¹(x/a) − (x/2)√(a² − x²)
        integrand = `\\frac{${lead(c)}x^{2}}{${R(minus)}}`.replace('{-x', '{-x');
        answer = [st(c.mul(a2).div(2), asin), st(c.neg().div(2), `x${R(minus)}`)];
        sub = `x = ${a === 1 ? '' : a}\\sin\\theta`;
        wrongs = [[st(c.mul(a2).div(2), asin), st(c.div(2), `x${R(minus)}`)], [st(c.mul(a2), asin), st(c.neg(), `x${R(minus)}`)], [st(c.neg().div(2), `x${R(minus)}`)]];
        break;
      case 'pow32':
        // ∫ dx/(x² + a²)^{3/2} = x/(a²√(x² + a²))
        integrand = `\\frac{${c.n}}{(${plus})^{\\frac{3}{2}}}`;
        answer = [{ neg: c.sign < 0, body: `\\frac{${c.abs().eq(1) ? '' : c.abs().n}x}{${a2 === 1 ? '' : a2}${R(plus)}}` }];
        sub = `x = ${a === 1 ? '' : a}\\tan\\theta`;
        wrongs = [[{ neg: c.sign < 0, body: `\\frac{${c.abs().eq(1) ? '' : c.abs().n}x}{${R(plus)}}` }], [{ neg: c.sign > 0, body: answer[0]!.body }], [{ neg: c.sign < 0, body: `\\frac{${c.abs().eq(1) ? '' : c.abs().n}${R(plus)}}{${a2 === 1 ? '' : a2}x}` }]];
        pts = [0.3, 0.7, 1.4, -0.9, 2.2];
        break;
      case 'lnSqrt':
        // ∫ dx/√(x² + a²) = ln|x + √(x² + a²)|
        integrand = `\\frac{${c.n}}{${R(plus)}}`;
        answer = [st(c, `\\ln\\left|x + ${R(plus)}\\right|`)];
        sub = `x = ${a === 1 ? '' : a}\\tan\\theta`;
        wrongs = [[st(c, atan)], [st(c.div(a), atan)], [st(c, R(plus))]];
        pts = [0.3, 0.7, 1.4, -0.9, 2.2];
        break;
      case 'secForm':
      default:
        // ∫ √(x² − a²)/x dx = √(x² − a²) − a·sec⁻¹(x/a), with sec⁻¹(x/a) = cos⁻¹(a/x) for x > a
        integrand = `\\frac{${lead(c)}${R(xmin)}}{x}`;
        answer = [st(c, R(xmin)), st(c.mul(-a), `\\cos^{-1}\\left(\\frac{${a}}{x}\\right)`)];
        sub = `x = ${a === 1 ? '' : a}\\sec\\theta`;
        wrongs = [[st(c, R(xmin)), st(c.mul(a), `\\cos^{-1}\\left(\\frac{${a}}{x}\\right)`)], [st(c, R(xmin))], [st(c, R(xmin)), st(c.mul(-a), `\\sin^{-1}\\left(\\frac{${a}}{x}\\right)`)]];
        pts = [1.3, 1.7, 2.2, 2.9, 3.6].map((t) => t * a);
        break;
    }
    const aTex = joinSigned(answer);
    const ans = m(plusC(aTex));
    return {
      question: m(ds(intTex(integrand))),
      answer: ans,
      steps: [`Substitute $${sub}$.`, ans],
      distractors: distinctDistractors(ans, wrongs.map((w) => m(plusC(joinSigned(w)))), (q) => m(plusC(`${aTex} + ${Math.abs(offset(q)) === 1 ? '' : Math.abs(offset(q))}x`))),
      check: { kind: 'calculus.integral', pts },
    };
  },
});

// ---------------------------------------------------------------- improper integrals

type IV = { value: string; num: number; times?: (k: FracLike) => string } | 'div';

export const improperIntegrals = defineTopic({
  id: 'calc.improper-integrals',
  subject: 'calculus',
  category: 'Techniques of Integration',
  title: 'Improper Integrals',
  description: 'Infinite limits of integration and infinite integrands: decide convergence and find the value.',
  instruction: 'Evaluate each improper integral or state that it diverges.',
  multipleChoice: true,
  defaultCount: 8,
  options: [
    {
      type: 'select',
      id: 'type',
      label: 'Type',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'infinite', label: 'Infinite limits' },
        { value: 'integrand', label: 'Infinite integrands' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const tOpt = strOpt(ctx, 'type');
    const type = tOpt === 'any' ? rng.pick(['infinite', 'integrand']) : tOpt;
    const steps: string[] = [];
    let integrand: string;
    let lo: string;
    let hi: string;
    let value: IV;
    let split: number[] | undefined;
    const c = rng.int(1, 6);
    const fv = (f: Frac): IV => ({ value: num(f), num: f.value, times: (k) => num(f.mul(k)) });
    const fpi = (f: Frac): IV => ({ value: piTex(f), num: f.value * Math.PI, times: (k) => piTex(f.mul(k)) });
    if (type === 'infinite') {
      const kind = rng.pick(difficulty === 'easy' ? ['pow', 'exp'] : difficulty === 'medium' ? ['pow', 'exp', 'atan', 'pow'] : ['xexp', 'atanFull', 'lnx', 'pow']);
      switch (kind) {
        case 'pow': {
          // ∫_b^∞ c/x^p dx
          const p = rng.pick([new Frac(1, 2), new Frac(1), new Frac(3, 2), new Frac(2), new Frac(3), new Frac(4)]);
          const b = rng.int(1, 3);
          integrand = p.eq(1) ? `\\frac{${c}}{x}` : p.eq(new Frac(1, 2)) ? `\\frac{${c}}{\\sqrt{x}}` : p.eq(new Frac(3, 2)) ? `\\frac{${c}}{x\\sqrt{x}}` : `\\frac{${c}}{x^{${p.n}}}`;
          lo = String(b);
          hi = '\\infty';
          if (p.cmp(1) <= 0) {
            value = 'div';
            steps.push(`$p = ${num(p)} \\le 1$: the integral diverges.`);
          } else if (p.isInt()) {
            value = fv(new Frac(c, (p.n - 1) * b ** (p.n - 1)));
            steps.push(`$\\displaystyle \\lim_{t \\to \\infty} \\left[-\\frac{${c}}{${p.n - 1 === 1 ? '' : p.n - 1}x^{${p.n - 1}}}\\right]_{${b}}^{t}$`.replace('x^{1}', 'x'));
          } else {
            // p = 3/2: 2c/√b
            const r = Math.sqrt(b);
            const k = new Frac(2 * c, b);
            value = Number.isInteger(r) ? fv(new Frac(2 * c, r)) : { value: k.d === 1 ? `${k.n}\\sqrt{${b}}` : `\\frac{${k.n === 1 ? '' : k.n}\\sqrt{${b}}}{${k.d}}`, num: (2 * c) / r };
            steps.push(`$\\displaystyle \\lim_{t \\to \\infty} \\left[-\\frac{${2 * c}}{\\sqrt{x}}\\right]_{${b}}^{t}$`);
          }
          break;
        }
        case 'exp': {
          const a = rng.int(1, 4);
          const b = rng.int(0, 2);
          integrand = `${c === 1 ? '' : c}e^{-${a === 1 ? '' : a}x}`;
          lo = String(b);
          hi = '\\infty';
          const q = new Frac(c, a);
          const den = `${q.d === 1 ? '' : q.d}e${a * b === 1 ? '' : `^{${a * b}}`}`;
          value = b === 0 ? fv(q) : { value: `\\frac{${q.n}}{${den}}`, num: (c / a) * Math.exp(-a * b) };
          steps.push(`$\\displaystyle \\lim_{t \\to \\infty} \\left[${lead(new Frac(-c, a))}e^{-${a === 1 ? '' : a}x}\\right]_{${b}}^{t}$`);
          break;
        }
        case 'atan': {
          const a = rng.int(1, 4);
          integrand = `\\frac{${c}}{x^{2} + ${a * a}}`;
          lo = '0';
          hi = '\\infty';
          value = fpi(new Frac(c, 2 * a));
          steps.push(`$\\displaystyle \\lim_{t \\to \\infty} \\left[${lead(new Frac(c, a))}\\tan^{-1}${a === 1 ? ' x' : `\\frac{x}{${a}}`}\\right]_{0}^{t}$`);
          break;
        }
        case 'atanFull': {
          const a = rng.int(1, 4);
          integrand = `\\frac{${c}}{x^{2} + ${a * a}}`;
          lo = '-\\infty';
          hi = '\\infty';
          value = fpi(new Frac(c, a));
          steps.push('Split at $0$; each half converges.');
          break;
        }
        case 'xexp': {
          const a = rng.int(1, 3);
          integrand = `${c === 1 ? '' : c}xe^{-${a === 1 ? '' : a}x}`;
          lo = '0';
          hi = '\\infty';
          value = fv(new Frac(c, a * a));
          steps.push('Integrate by parts, then take the limit: $\\lim_{t \\to \\infty} te^{-t} = 0$.');
          break;
        }
        case 'lnx':
        default: {
          const lnDiv = rng.bool(0.4);
          integrand = lnDiv ? `\\frac{${c === 1 ? '' : c}\\ln x}{x}` : `\\frac{${c === 1 ? '' : c}\\ln x}{x^{2}}`;
          lo = '1';
          hi = '\\infty';
          value = lnDiv ? 'div' : fv(new Frac(c));
          steps.push(lnDiv ? '$\\int \\frac{\\ln x}{x}\\,dx = \\frac{(\\ln x)^{2}}{2}$, which grows without bound.' : 'By parts: $\\int \\frac{\\ln x}{x^{2}}\\,dx = -\\frac{\\ln x}{x} - \\frac{1}{x}$.');
          break;
        }
      }
    } else {
      const kind = rng.pick(difficulty === 'easy' ? ['root', 'recip'] : difficulty === 'medium' ? ['root', 'recip', 'shift'] : ['interior', 'lnx', 'shift', 'asin']);
      switch (kind) {
        case 'root':
        case 'recip': {
          // ∫_0^b c/x^p, p = 1/2, 1, 2
          const p = kind === 'root' ? rng.pick([new Frac(1, 2), new Frac(1, 3)]) : rng.pick([new Frac(1), new Frac(2)]);
          const b = p.eq(new Frac(1, 3)) ? rng.pick([1, 8]) : rng.pick([1, 4, 9]);
          integrand = p.eq(new Frac(1, 2)) ? `\\frac{${c}}{\\sqrt{x}}` : p.eq(new Frac(1, 3)) ? `\\frac{${c}}{\\sqrt[3]{x}}` : p.eq(1) ? `\\frac{${c}}{x}` : `\\frac{${c}}{x^{2}}`;
          lo = '0';
          hi = String(b);
          if (p.cmp(1) >= 0) {
            value = 'div';
            steps.push(`$p = ${num(p)} \\ge 1$: the integral diverges at $x = 0$.`);
          } else {
            // c·b^{1−p}/(1 − p), with b a perfect power so b^{1−p} is an integer
            const root = Math.round(b ** (1 - p.value));
            value = fv(new Frac(c * root).div(new Frac(1).sub(p)));
            steps.push(`$\\displaystyle \\lim_{t \\to 0^{+}} \\left[${num(new Frac(c).div(new Frac(1).sub(p)))}x^{${num(new Frac(1).sub(p))}}\\right]_{t}^{${b}}$`);
          }
          break;
        }
        case 'shift': {
          // ∫_a^{a+k²} c/√(x − a) dx = 2ck
          const a = rng.int(1, 5);
          const k = rng.int(1, 3);
          integrand = `\\frac{${c}}{\\sqrt{x - ${a}}}`;
          lo = String(a);
          hi = String(a + k * k);
          value = fv(new Frac(2 * c * k));
          steps.push(`$\\displaystyle \\lim_{t \\to ${a}^{+}} \\left[${2 * c}\\sqrt{x - ${a}}\\right]_{t}^{${a + k * k}}$`);
          break;
        }
        case 'interior': {
          // ∫_{a−1}^{a+2} c/(x − a)² diverges; ∫ c/∛(x − a) converges
          const a = rng.int(-2, 3);
          const conv = rng.bool();
          integrand = conv ? `\\frac{${c}}{\\sqrt[3]{x ${a < 0 ? '+' : '-'} ${Math.abs(a)}}}`.replace('x - 0', 'x').replace('x + 0', 'x') : `\\frac{${c}}{(x ${a < 0 ? '+' : '-'} ${Math.abs(a)})^{2}}`.replace('(x - 0)', 'x').replace('(x + 0)', 'x');
          if (a === 0) integrand = conv ? `\\frac{${c}}{\\sqrt[3]{x}}` : `\\frac{${c}}{x^{2}}`;
          lo = String(a - 1);
          hi = String(a + 8);
          split = [a];
          // (3c/2)[(x − a)^{2/3}] from −1 to 8 = (3c/2)(4 − 1)
          value = conv ? fv(new Frac(9 * c, 2)) : 'div';
          steps.push(`The integrand is unbounded at $x = ${a}$, inside the interval: split there.`);
          break;
        }
        case 'lnx': {
          integrand = `${c === 1 ? '' : c}\\ln x`;
          lo = '0';
          hi = '1';
          value = fv(new Frac(-c));
          steps.push('$\\int \\ln x\\,dx = x\\ln x - x$ and $\\lim_{t \\to 0^{+}} t\\ln t = 0$.');
          break;
        }
        case 'asin':
        default: {
          const a = rng.int(1, 5);
          integrand = `\\frac{${c}}{\\sqrt{${a * a} - x^{2}}}`;
          lo = '0';
          hi = String(a);
          value = fpi(new Frac(c, 2));
          steps.push(`$\\displaystyle \\lim_{t \\to ${a}^{-}} \\left[${c === 1 ? '' : c}\\sin^{-1}\\frac{x}{${a}}\\right]_{0}^{t}$`.replace('\\frac{x}{1}', 'x'));
          break;
        }
      }
    }
    const show = (v: IV) => (v === 'div' ? 'Diverges' : `Converges to $${v.value}$`);
    const answer = show(value);
    const alt = (tex: string) => `Converges to $${tex}$`;
    const wrongs =
      value === 'div'
        ? [alt(num(new Frac(c))), alt('0'), alt(num(new Frac(c, 2)))]
        : ['Diverges', alt(value.value.startsWith('-') ? value.value.slice(1) : `-${value.value}`), value.times ? alt(value.times(2)) : alt('0'), value.times ? alt(value.times(new Frac(1, 2))) : alt('1')];
    return {
      question: m(ds(intTex(integrand, lo, hi))),
      answer,
      steps: [...steps, answer],
      distractors: distinctDistractors(answer, wrongs, (q) => `Converges to $${num(new Frac(c * 3 + q))}$`),
      check: { kind: 'calculus.improper', split },
    };
  },
});
