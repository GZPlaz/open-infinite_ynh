/** Rational exponents: converting to and from radicals, evaluating, and the exponent properties. */
import { Frac, gcd } from '../../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, offset, strOpt } from '../../../generator';
import type { Rng } from '../../../rng';
import { m, num } from '../../../tex';
import type { ProblemContent } from '../../../types';
import { qpow, radTex, type QMono } from './common';

const CATEGORY = 'Radical Functions and Rational Exponents';

// ---------------------------------------------------------------- converting

interface Base {
  /** LaTeX of the base as written with an exponent (parenthesized if compound). */
  pow: string;
  /** LaTeX of the base inside a radical. */
  inner: string;
  vars: string[];
}

function pickBase(rng: Rng, variables: boolean, hard: boolean): Base {
  const kind = variables ? rng.weighted<'var' | 'num' | 'prod'>([['var', 3], ['num', 1], ['prod', hard ? 2 : 1]]) : 'num';
  if (kind === 'num') {
    const b = rng.pick([2, 3, 5, 6, 7, 10, 11, 12, 13, 15]);
    return { pow: String(b), inner: String(b), vars: [] };
  }
  const v = rng.pick(['x', 'a', 'n', 'k', 'm', 'v']);
  if (kind === 'var') return { pow: v, inner: v, vars: [v] };
  const c = rng.pick([2, 3, 5, 6, 7]);
  return { pow: `(${c}${v})`, inner: `${c}${v}`, vars: [v] };
}

type Dir = 'toExponent' | 'toRadical';

export const convertRationalExponents = defineTopic({
  id: 'alg2.radical.convert',
  subject: 'algebra2',
  title: 'Radicals and Rational Exponents',
  description: 'Rewrite radicals in exponential form and rational exponents in radical form.',
  category: CATEGORY,
  instruction: (o) =>
    o.direction === 'toExponent'
      ? 'Write each expression in exponential form. Assume all variables are positive.'
      : o.direction === 'toRadical'
        ? 'Write each expression in radical form. Assume all variables are positive.'
        : 'Write each radical in exponential form and each exponential expression in radical form. Assume all variables are positive.',
  multipleChoice: true,
  defaultCount: 12,
  options: [
    {
      type: 'select',
      id: 'direction',
      label: 'Direction',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'Both directions' },
        { value: 'toExponent', label: 'Radical → exponent' },
        { value: 'toRadical', label: 'Exponent → radical' },
      ],
    },
    { type: 'boolean', id: 'variables', label: 'Include variables', default: true },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const dirOpt = strOpt(ctx, 'direction');
    const dir: Dir = dirOpt === 'toExponent' || dirOpt === 'toRadical' ? dirOpt : rng.bool() ? 'toExponent' : 'toRadical';
    const variables = boolOpt(ctx, 'variables');
    const built = attempt('convert', () => {
      const base = pickBase(rng, variables, difficulty === 'hard');
      const n = rng.int(2, difficulty === 'easy' ? 4 : difficulty === 'medium' ? 6 : 7);
      const p = rng.int(1, difficulty === 'easy' ? 3 : 7);
      if (gcd(p, n) !== 1) return null;
      const neg = difficulty !== 'easy' && rng.bool(difficulty === 'hard' ? 0.45 : 0.3);
      const coef = difficulty === 'hard' && base.vars.length > 0 && base.pow === base.inner && rng.bool(0.3) ? rng.int(2, 7) : 1;
      return { base, n, p, neg, coef };
    });
    const { base, n, p, neg, coef } = built;
    const e = new Frac(neg ? -p : p, n);
    const pre = coef === 1 ? '' : String(coef);
    const expForm = (ex: Frac) => `${pre}${qpow(base.pow, ex)}`;
    const radForm = (pp: number, nn: number, negative: boolean) => {
      const body = pp === 1 ? base.inner : `${base.pow}^{${pp}}`;
      const r = nn === 1 ? (pp === 1 ? base.pow : `${base.pow}^{${pp}}`) : radTex(nn, body);
      return negative ? `\\frac{${coef}}{${r}}` : `${pre}${r}`;
    };
    const expTexStr = expForm(e);
    const radTexStr = radForm(p, n, neg);
    const question = dir === 'toExponent' ? radTexStr : expTexStr;
    const answerTex = dir === 'toExponent' ? expTexStr : radTexStr;
    const steps = [
      dir === 'toExponent' ? `$\\sqrt[n]{b^{m}} = b^{\\frac{m}{n}}$: the index ${n} becomes the denominator.` : `$b^{\\frac{m}{n}} = \\sqrt[n]{b^{m}}$: the denominator ${n} becomes the index.`,
      ...(neg ? [`A negative exponent means a reciprocal.`] : []),
      m(`${question} = ${answerTex}`),
    ];
    let wrongs: string[];
    if (dir === 'toExponent') {
      wrongs = [expForm(new Frac(neg ? -n : n, p)), expForm(e.neg()), expForm(new Frac(neg ? -p * n : p * n)), expForm(new Frac(neg ? -(p + n) : p + n, n))];
    } else {
      wrongs = [radForm(n, p, neg), radForm(p, n, !neg), radForm(p * n, 1, neg), radForm(p + 1, n, neg)];
    }
    const answer = m(answerTex);
    const distractors = distinctDistractors(
      answer,
      wrongs.map((w) => m(w)),
      (k) => m(dir === 'toExponent' ? expForm(new Frac(neg ? -(p + k) : p + k, n)) : radForm(p + k + 1, n, neg)),
    );
    return {
      question: m(question),
      answer,
      steps,
      distractors,
      check: { kind: 'alg2-radicals-rational.convert', vars: base.vars, to: dir === 'toExponent' ? 'exponent' : 'radical' },
    };
  },
});

// ---------------------------------------------------------------- evaluating

export const evaluateRationalExponents = defineTopic({
  id: 'alg2.radical.evaluate',
  subject: 'algebra2',
  title: 'Evaluating Rational Exponents',
  description: 'Evaluate powers with rational exponents such as 27^(2/3) and (16/81)^(-3/4).',
  category: CATEGORY,
  instruction: 'Evaluate.',
  multipleChoice: true,
  defaultCount: 12,
  options: [
    { type: 'boolean', id: 'negExp', label: 'Negative exponents (medium/hard)', default: true },
    { type: 'boolean', id: 'fractionBase', label: 'Fraction bases (medium/hard)', default: true },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const allowNeg = boolOpt(ctx, 'negExp') && difficulty !== 'easy';
    const allowFrac = boolOpt(ctx, 'fractionBase') && difficulty !== 'easy';
    const one = (r: Rng) =>
      attempt('evaluate', () => {
        const q = r.int(2, difficulty === 'easy' ? 3 : difficulty === 'medium' ? 4 : 5);
        const p = r.int(1, difficulty === 'easy' ? 3 : 4);
        if (gcd(p, q) !== 1 || p === q) return null;
        const fracBase = allowFrac && r.bool(0.4);
        const top = r.int(fracBase ? 1 : 2, q >= 4 ? 3 : q === 3 ? 5 : 9);
        const bottom = fracBase ? r.int(2, q >= 4 ? 3 : 5) : 1;
        if (gcd(top, bottom) !== 1) return null;
        const neg = allowNeg && r.bool(0.45);
        const base = new Frac(top ** q, bottom ** q);
        if (base.n > 1500 || base.d > 1500) return null;
        const root = new Frac(top, bottom);
        const value = root.pow(neg ? -p : p);
        if (value.n > 1500 || value.d > 1500) return null;
        const ex = new Frac(neg ? -p : p, q);
        const baseTex = base.isInt() ? String(base.n) : `\\left(${base.toTex()}\\right)`;
        return { q, p, neg, base, root, value, ex, tex: `${baseTex}^{${ex.toTex()}}` };
      });
    const a = one(rng);
    const product = difficulty === 'hard' && rng.bool(0.3);
    const b = product
      ? attempt('evaluate-product', () => {
          const t = one(rng);
          return t.tex === a.tex ? null : t;
        })
      : null;
    const value = b ? a.value.mul(b.value) : a.value;
    const question = b ? `${a.tex} \\cdot ${b.tex}` : a.tex;
    const stepFor = (t: typeof a) => {
      const baseTex = t.base.isInt() ? String(t.base.n) : `\\left(${t.base.toTex()}\\right)`;
      const rootTex = radTex(t.q, t.base.toTex());
      const rootVal = t.root.isInt() ? String(t.root.n) : `\\left(${t.root.toTex()}\\right)`;
      const powed = (b: string, k: number) => (k === 1 ? b : `${b}^{${k}}`);
      const lines: string[] = [];
      if (t.neg) lines.push(m(`${t.tex} = \\frac{1}{${baseTex}^{${new Frac(t.p, t.q).toTex()}}}`));
      const rootPow = t.p === 1 ? rootTex : `\\left(${rootTex}\\right)^{${t.p}}`;
      lines.push(m(t.neg ? `= \\frac{1}{${rootPow}} = \\frac{1}{${powed(rootVal, t.p)}}` : `${t.tex} = ${rootPow}${t.p === 1 ? '' : ` = ${powed(rootVal, t.p)}`}`));
      lines.push(m(`= ${num(t.value)}`));
      return lines;
    };
    const steps = [...stepFor(a), ...(b ? [...stepFor(b), m(`${num(a.value)} \\cdot ${parenIfNeeded(b.value)} = ${num(value)}`)] : [])];
    const answer = m(num(value));
    const naive = a.base.mul(new Frac(a.neg ? -a.p : a.p, a.q));
    const wrongs = [
      naive.isZero() ? null : num(b ? naive.mul(b.value) : naive),
      num(value.inv()),
      num(value.neg()),
      num(b ? a.root.mul(b.root) : a.neg ? a.root.inv() : a.root),
      num(b ? a.value.add(b.value) : a.root.pow(a.neg ? -(a.p + 1) : a.p + 1)),
    ];
    const distractors = distinctDistractors(
      answer,
      wrongs.map((w) => (w ? m(w) : null)),
      (k) => {
        const v = value.add(offset(k));
        return v.isZero() ? null : m(num(v));
      },
    );
    return {
      question: m(question),
      answer,
      steps,
      distractors,
      check: { kind: 'value', value: value.value },
    };
  },
});

function parenIfNeeded(f: Frac): string {
  return f.isInt() ? num(f) : `\\left(${num(f)}\\right)`;
}

// ---------------------------------------------------------------- properties

function qmono(coef: number | Frac, exps: Record<string, Frac>): QMono {
  return { coef: Frac.of(coef), exps };
}
function qmul(a: QMono, b: QMono): QMono {
  const exps = { ...a.exps };
  for (const [v, e] of Object.entries(b.exps)) exps[v] = (exps[v] ?? Frac.ZERO).add(e);
  return { coef: a.coef.mul(b.coef), exps };
}
function qinv(a: QMono): QMono {
  return { coef: a.coef.inv(), exps: Object.fromEntries(Object.entries(a.exps).map(([v, e]) => [v, e.neg()])) };
}
/** Raise to k; the coefficient must be a perfect power when k is fractional. */
function qpowM(a: QMono, k: Frac, coefRoot?: number): QMono {
  let coef: Frac;
  if (k.isInt()) coef = a.coef.pow(k.n);
  else coef = Frac.of(coefRoot ?? 1).pow(k.n);
  return { coef, exps: Object.fromEntries(Object.entries(a.exps).map(([v, e]) => [v, e.mul(k)])) };
}

function varsQ(exps: Record<string, Frac>, sign: 1 | -1 | 0): string {
  return Object.keys(exps)
    .sort()
    .filter((v) => (sign === 0 ? !exps[v]!.isZero() : exps[v]!.sign === sign))
    .map((v) => qpow(v, sign === -1 ? exps[v]!.neg() : exps[v]!))
    .join('');
}

function rawQ(a: QMono): string {
  const vars = varsQ(a.exps, 0);
  const c = a.coef;
  if (!vars) return c.toTex();
  if (c.eq(1)) return vars;
  if (c.eq(-1)) return `-${vars}`;
  return `${c.toTex()}${vars}`;
}

function simplifiedQ(a: QMono): string {
  const top = varsQ(a.exps, 1);
  const bottom = varsQ(a.exps, -1);
  const n = Math.abs(a.coef.n);
  const d = a.coef.d;
  const sign = a.coef.sign < 0 ? '-' : '';
  const numer = top ? (n === 1 ? top : `${n}${top}`) : String(n);
  const denom = bottom ? (d === 1 ? bottom : `${d}${bottom}`) : d === 1 ? '' : String(d);
  return denom ? `${sign}\\frac{${numer}}{${denom}}` : `${sign}${numer}`;
}

type Shape = 'product' | 'quotient' | 'power' | 'power-product' | 'power-quotient' | 'quotient-power';

export const rationalExponentProperties = defineTopic({
  id: 'alg2.radical.exponent-properties',
  subject: 'algebra2',
  title: 'Properties of Rational Exponents',
  description: 'Simplify products, quotients and powers of monomials with rational and negative exponents.',
  category: CATEGORY,
  instruction: 'Simplify. Your answer should contain only positive exponents. Assume all variables are positive.',
  multipleChoice: true,
  defaultCount: 12,
  options: [
    { type: 'boolean', id: 'negExp', label: 'Negative exponents in problems', default: true },
    { type: 'boolean', id: 'twoVars', label: 'Two variables (medium/hard)', default: true },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const negExp = boolOpt(ctx, 'negExp') && difficulty !== 'easy';
    const vars = boolOpt(ctx, 'twoVars') && difficulty !== 'easy' ? rng.pick([['x', 'y'], ['a', 'b'], ['m', 'n'], ['u', 'v']]) : [rng.pick(['x', 'a', 'n', 'k', 'p', 'v'])];
    const shapes: Shape[] =
      difficulty === 'easy' ? ['product', 'quotient', 'power'] : difficulty === 'medium' ? ['product', 'quotient', 'power', 'power-product'] : ['power-product', 'power-quotient', 'quotient-power', 'product'];
    const dens = difficulty === 'easy' ? [2, 3, 4] : [2, 3, 4, 5, 6];

    const built = attempt('rational-exponents', () => {
      const shape = rng.pick(shapes);
      const sameDen = difficulty === 'easy' ? rng.pick(dens) : 0;
      const randExp = (r: Rng): Frac => {
        const d = sameDen || r.pick([1, ...dens]);
        const e = new Frac(r.int(1, d === 1 ? 5 : 2 * d + 1), d);
        return negExp && r.bool(0.35) ? e.neg() : e;
      };
      const randMono = (coefMax: number, signed: boolean): QMono =>
        qmono(rng.signedInt(1, coefMax, signed && difficulty !== 'easy'), Object.fromEntries(vars.map((v) => [v, randExp(rng)])));
      // outer power k = p/q; a coefficient under a fractional power is a perfect q-th power
      const kq = rng.pick([2, 3, 4]);
      const kp = rng.int(1, kq === 2 ? 3 : 4);
      let k = new Frac(kp, kq);
      if (k.isInt() || k.eq(1)) k = new Frac(rng.int(2, 3));
      if (negExp && difficulty === 'hard' && rng.bool(0.3)) k = k.neg();
      const root = difficulty === 'easy' ? 1 : rng.pick([1, 2, 2, 3]);
      const powBase = (): { mono: QMono; root: number } => {
        const r = k.isInt() ? rng.int(1, 3) : root;
        const coef = k.isInt() ? r : r ** k.d;
        const mono = qmono(coef, Object.fromEntries(vars.map((v) => [v, randExp(rng)])));
        return { mono, root: r };
      };
      const a = randMono(6, true);
      const b = randMono(6, true);
      const paren = (x: QMono) => `\\left(${rawQ(x)}\\right)`;
      const factor = (x: QMono) => (x.coef.sign < 0 ? paren(x) : rawQ(x));
      let question: string;
      let result: QMono;
      let naive: QMono;
      let expanded: string | null = null;
      switch (shape) {
        case 'product':
          question = `${rawQ(a)} \\cdot ${factor(b)}`;
          result = qmul(a, b);
          naive = { coef: result.coef, exps: Object.fromEntries(vars.map((v) => [v, a.exps[v]!.mul(b.exps[v]!)])) };
          break;
        case 'quotient':
          if (!a.coef.div(b.coef).isInt() && rng.bool(0.6)) return null;
          question = `\\frac{${rawQ(a)}}{${rawQ(b)}}`;
          result = qmul(a, qinv(b));
          naive = { coef: result.coef, exps: Object.fromEntries(vars.map((v) => [v, a.exps[v]!.add(b.exps[v]!)])) };
          break;
        case 'power': {
          const pb = powBase();
          question = `${paren(pb.mono)}^{${k.toTex()}}`;
          result = qpowM(pb.mono, k, pb.root);
          naive = { coef: result.coef, exps: Object.fromEntries(vars.map((v) => [v, pb.mono.exps[v]!.add(k)])) };
          break;
        }
        case 'power-product': {
          const pb = powBase();
          const pa = qpowM(pb.mono, k, pb.root);
          question = `${paren(pb.mono)}^{${k.toTex()}} \\cdot ${factor(b)}`;
          expanded = `${rawQ(pa)} \\cdot ${factor(b)}`;
          result = qmul(pa, b);
          naive = qmul({ coef: pa.coef, exps: Object.fromEntries(vars.map((v) => [v, pb.mono.exps[v]!.add(k)])) }, b);
          break;
        }
        case 'power-quotient': {
          const pb = powBase();
          const pa = qpowM(pb.mono, k, pb.root);
          question = `\\frac{${paren(pb.mono)}^{${k.toTex()}}}{${rawQ(b)}}`;
          expanded = `\\frac{${rawQ(pa)}}{${rawQ(b)}}`;
          result = qmul(pa, qinv(b));
          naive = qmul(pa, b);
          break;
        }
        case 'quotient-power':
        default: {
          const kk = k.isInt() ? k : new Frac(k.sign * 2);
          const pa = qmono(rng.int(1, 3), Object.fromEntries(vars.map((v) => [v, randExp(rng)])));
          const pb = qmono(rng.int(1, 3), Object.fromEntries(vars.map((v) => [v, randExp(rng)])));
          question = `\\left(\\frac{${rawQ(pa)}}{${rawQ(pb)}}\\right)^{${kk.toTex()}}`;
          result = qpowM(qmul(pa, qinv(pb)), kk);
          expanded = `\\frac{${rawQ(qpowM(pa, kk))}}{${rawQ(qpowM(pb, kk))}}`;
          naive = qmul(qpowM(pa, kk), qinv(pb));
          break;
        }
      }
      if (Math.abs(result.coef.n) > 2000 || result.coef.d > 2000) return null;
      if (Object.values(result.exps).every((e) => e.isZero())) return null;
      if (Object.values(result.exps).some((e) => e.d > 12 || Math.abs(e.n) > 40)) return null;
      if (!Object.values(result.exps).some((e) => !e.isInt()) && rng.bool(0.7)) return null;
      return { question, result, naive, expanded };
    });
    const { question, result, naive, expanded } = built;
    const steps: string[] = [];
    if (expanded) steps.push(m(`= ${expanded}`));
    const raw = rawQ(result);
    if (raw !== simplifiedQ(result)) steps.push(m(`= ${raw}`));
    steps.push(m(`= ${simplifiedQ(result)}`));
    const answer = m(simplifiedQ(result));
    const flipped = (v: string): QMono => ({ coef: result.coef, exps: { ...result.exps, [v]: result.exps[v]!.neg() } });
    const bumped = (v: string, d: number): QMono => ({ coef: result.coef, exps: { ...result.exps, [v]: result.exps[v]!.add(new Frac(d, Math.max(2, result.exps[v]!.d))) } });
    const distractors = distinctDistractors(
      answer,
      [m(simplifiedQ(naive)), m(simplifiedQ(flipped(vars[0]!))), m(simplifiedQ(bumped(vars[vars.length - 1]!, 1))), m(simplifiedQ({ ...result, coef: result.coef.neg() }))],
      (n) => m(simplifiedQ(bumped(vars[0]!, n % 2 ? n : -n))),
    );
    return {
      question: m(question),
      answer,
      steps,
      distractors,
      check: { kind: 'equivalent', vars, positive: true },
    };
  },
});
