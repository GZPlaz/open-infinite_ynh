/** Limits at infinity, one-sided limits, trigonometric limits and continuity. */
import { Frac } from '../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, offset, strOpt } from '../../generator';
import { Poly } from '../../polynomial';
import type { Rng } from '../../rng';
import { m, num, pow, sum, term } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { lin, randPoly } from './common';

type LVal = Frac | 'inf' | '-inf' | 'dne';

const limTex = (pt: string, v = 'x') => `\\lim_{${v} \\to ${pt}}`;
const fr = (n: string, d: string) => `\\frac{${n}}{${d}}`;

function showL(v: LVal): string {
  if (v === 'dne') return 'Does not exist';
  return m(v === 'inf' ? '\\infty' : v === '-inf' ? '-\\infty' : num(v));
}

function limitDistractors(answer: LVal, wrong: LVal[]): string[] {
  const base = answer instanceof Frac ? answer : Frac.ZERO;
  return distinctDistractors(showL(answer), wrong.map(showL), (k) => showL(base.add(offset(k))));
}

const cases = (rows: Array<[string, string]>) => `\\begin{cases} ${rows.map(([e, c]) => `${e}, & ${c}`).join(' \\\\ ')} \\end{cases}`;

/** x − a written tidily. */
const xm = (a: number, v = 'x') => (a === 0 ? v : `${v} ${a > 0 ? '-' : '+'} ${Math.abs(a)}`);

// ---------------------------------------------------------------- limits at infinity

export const limitsAtInfinity = defineTopic({
  id: 'calc.limits-infinity',
  subject: 'calculus',
  category: 'Limits and Continuity',
  title: 'Limits at Infinity',
  description: 'End behavior of rational functions and of quotients involving radicals, as x → ∞ or x → −∞.',
  instruction: 'Evaluate each limit.',
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'type',
      label: 'Functions',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'rational', label: 'Rational functions' },
        { value: 'radical', label: 'Radicals' },
      ],
    },
    { type: 'boolean', id: 'negInf', label: 'Include x → −∞', default: true },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const tOpt = strOpt(ctx, 'type');
    const kind = tOpt === 'any' ? (difficulty === 'easy' ? 'rational' : rng.pick(['rational', 'radical'])) : tOpt;
    const dir: 1 | -1 = boolOpt(ctx, 'negInf') && rng.bool(difficulty === 'easy' ? 0.25 : 0.45) ? -1 : 1;
    const pt = dir === 1 ? '\\infty' : '-\\infty';
    const steps: string[] = [];
    let expr: string;
    let value: LVal;
    let wrong: LVal[];
    const flip = (v: LVal): LVal => (v === 'inf' ? '-inf' : v === '-inf' ? 'inf' : v instanceof Frac ? v.neg() : v);

    if (kind === 'rational') {
      const maxDeg = difficulty === 'easy' ? 2 : 4;
      const dn = rng.int(1, maxDeg - 1);
      const rel = rng.pick(['equal', 'lower', 'higher', 'equal']);
      const dd = rel === 'equal' ? dn : rel === 'lower' ? dn + 1 : Math.max(1, dn - rng.int(1, 2));
      const pdeg = rel === 'higher' ? Math.max(dd + 1, dn) : dn;
      const max = difficulty === 'hard' ? 12 : 8;
      const p = randPoly(rng, pdeg, max, difficulty === 'easy' ? 0.5 : 0.7);
      const q = randPoly(rng, dd, max, difficulty === 'easy' ? 0.5 : 0.7);
      expr = fr(p.toTex(), q.toTex());
      const ratio = p.lead().div(q.lead());
      if (p.degree === q.degree) {
        value = ratio;
        steps.push(`The degrees are equal, so the limit is the ratio of leading coefficients: $${fr(num(p.lead()), num(q.lead()))}${ratio.d !== q.lead().value ? ` = ${num(ratio)}` : ''}$`);
        wrong = [Frac.ZERO, 'inf', ratio.neg(), ratio.eq(0) ? Frac.ONE : ratio.inv()];
      } else if (p.degree < q.degree) {
        value = Frac.ZERO;
        steps.push('The denominator has the higher degree, so the fraction approaches $0$.');
        wrong = [ratio, 'inf', '-inf', Frac.ONE];
      } else {
        const sign = ratio.sign * (dir === -1 && (p.degree - q.degree) % 2 === 1 ? -1 : 1);
        value = sign > 0 ? 'inf' : '-inf';
        steps.push(`The numerator has the higher degree; the quotient behaves like $${fr(term(p.lead(), pow('x', p.degree)), term(q.lead(), pow('x', q.degree)))}$ for large $|x|$.`);
        wrong = [flip(value), ratio, Frac.ZERO];
      }
    } else {
      // √(a²x^{2k} + …) over a polynomial of degree k
      const k = difficulty === 'hard' ? rng.int(1, 2) : 1;
      const a = rng.int(1, difficulty === 'easy' ? 4 : 6);
      const c = rng.signedInt(1, 9, true);
      const b = difficulty === 'easy' || k === 2 ? 0 : rng.int(-6, 6);
      const inner = new Poly(k === 1 ? [c, b, a * a] : [c, 0, b, 0, a * a]);
      const d = rng.signedInt(1, 6, true);
      const e = rng.int(-9, 9);
      const den = k === 1 ? Poly.of(e, d) : Poly.of(e, 0, d);
      const radical = `\\sqrt{${inner.toTex()}}`;
      const upside = rng.bool(0.3);
      expr = upside ? fr(den.toTex(), radical) : fr(radical, den.toTex());
      // √(a²x^{2k}) = a|x|^k: the sign flips for x → −∞ when k is odd
      const s = dir === -1 && k % 2 === 1 ? -1 : 1;
      value = upside ? new Frac(d * s, a) : new Frac(a * s, d);
      steps.push(`For large $|x|$, $${radical} \\approx ${k === 1 ? `${a === 1 ? '' : a}|x|` : `${a === 1 ? '' : a}x^{2}`}$${s < 0 ? ', and $|x| = -x$ when $x < 0$' : ''}.`);
      steps.push(`So the limit is $${num(value)}$.`);
      const v = value;
      wrong = [v.neg(), upside ? new Frac(d, a * a) : new Frac(a * a, d), Frac.ZERO, upside ? v.inv() : 'inf'];
    }
    const answer = showL(value);
    return {
      question: m(`\\displaystyle ${limTex(pt)} ${expr}`),
      answer,
      steps,
      distractors: limitDistractors(value, wrong),
      check: { kind: 'calculus.limit' },
    };
  },
});

// ---------------------------------------------------------------- one-sided limits

export const oneSidedLimits = defineTopic({
  id: 'calc.one-sided-limits',
  subject: 'calculus',
  category: 'Limits and Continuity',
  title: 'One-Sided Limits',
  description: 'Left- and right-hand limits of piecewise functions, absolute-value quotients and vertical asymptotes; deciding whether a limit exists.',
  instruction: 'Evaluate each limit. Write "Does not exist" if appropriate.',
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'type',
      label: 'Functions',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed (by difficulty)' },
        { value: 'piecewise', label: 'Piecewise functions' },
        { value: 'abs', label: 'Absolute value quotients' },
        { value: 'asymptote', label: 'Vertical asymptotes (±∞)' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const tOpt = strOpt(ctx, 'type');
    const KIND: Record<Difficulty, string[]> = { easy: ['piecewise', 'piecewise', 'abs'], medium: ['piecewise', 'abs', 'asymptote'], hard: ['piecewise', 'abs', 'asymptote'] };
    const kind = tOpt === 'any' ? rng.pick(KIND[difficulty]) : tOpt;
    const side = rng.pick<'-' | '+' | ''>(difficulty === 'easy' ? ['-', '+'] : ['-', '+', '']);
    const a = rng.int(-4, 5);
    const pt = side ? `${a}^{${side}}` : String(a);
    const steps: string[] = [];
    let question: string;
    let value: LVal;
    let wrong: LVal[];

    if (kind === 'piecewise') {
      const deg = () => (difficulty === 'easy' ? 1 : rng.int(1, 2));
      const { p1, p2 } = attempt('piecewise-limit', () => {
        const p1 = randPoly(rng, deg(), 5);
        const p2 = randPoly(rng, deg(), 5);
        if (p1.eq(p2)) return null;
        // sometimes the pieces meet, so the two-sided limit exists
        if (!side && rng.bool(0.4)) {
          const fix = p1.eval(a).sub(p2.eval(a));
          return { p1, p2: p2.add(Poly.of(fix)) };
        }
        return p1.eval(a).eq(p2.eval(a)) && side ? null : { p1, p2 };
      });
      const strictLeft = rng.bool();
      const def = cases([
        [p1.toTex(), `x ${strictLeft ? '<' : '\\le'} ${a}`],
        [p2.toTex(), `x ${strictLeft ? '\\ge' : '>'} ${a}`],
      ]);
      question = `Given $f(x) = ${def}$, find $\\displaystyle ${limTex(pt)} f(x)$.`;
      const L = p1.eval(a);
      const R = p2.eval(a);
      if (side === '-') {
        value = L;
        steps.push(`To the left of $${a}$, $f(x) = ${p1.toTex()}$, so the limit is $${num(L)}$.`);
        wrong = [R, 'dne', L.neg(), p1.eval(a + 1)];
      } else if (side === '+') {
        value = R;
        steps.push(`To the right of $${a}$, $f(x) = ${p2.toTex()}$, so the limit is $${num(R)}$.`);
        wrong = [L, 'dne', R.neg(), p2.eval(a + 1)];
      } else {
        steps.push(`Left-hand limit: $${num(L)}$; right-hand limit: $${num(R)}$.`);
        value = L.eq(R) ? L : 'dne';
        steps.push(L.eq(R) ? `They agree, so the limit is $${num(L)}$.` : 'They differ, so the limit does not exist.');
        wrong = L.eq(R) ? ['dne', L.neg(), L.add(1), Frac.ZERO] : [L, R, L.add(R)];
      }
    } else if (kind === 'abs') {
      const k = rng.signedInt(1, difficulty === 'easy' ? 5 : 9, true);
      const useQuad = difficulty !== 'easy' && rng.bool(0.5);
      let body: string;
      let rightVal: Frac;
      if (useQuad) {
        // (x − a)(x − b) / |x − a| → ±(a − b)
        const b = attempt('abs-b', () => {
          const b = rng.int(-6, 6);
          return b === a ? null : b;
        });
        const top = Poly.fromRoots([a, b]);
        body = fr(top.toTex(), `|${xm(a)}|`);
        rightVal = new Frac(a - b);
        steps.push(`Factor: $${fr(`(${xm(a)})(${xm(b)})`, `|${xm(a)}|`)}$; $\\frac{${xm(a)}}{|${xm(a)}|} = 1$ for $x > ${a}$ and $-1$ for $x < ${a}$.`);
      } else {
        const c = k === 1 ? '' : k === -1 ? '-' : String(k);
        body = rng.bool() ? fr(`${c}|${xm(a)}|`, xm(a)) : fr(`${c}(${xm(a)})`, `|${xm(a)}|`);
        rightVal = new Frac(k);
        steps.push(`$|${xm(a)}| = ${xm(a)}$ when $x > ${a}$ and $-(${xm(a)})$ when $x < ${a}$.`);
      }
      question = m(`\\displaystyle ${limTex(pt)} ${body}`);
      if (side === '+') value = rightVal;
      else if (side === '-') value = rightVal.neg();
      else value = rightVal.isZero() ? Frac.ZERO : 'dne';
      steps.push(side ? `So the limit is $${num(value as Frac)}$.` : rightVal.isZero() ? 'Both one-sided limits are $0$.' : `The one-sided limits are $${num(rightVal.neg())}$ and $${num(rightVal)}$, so the limit does not exist.`);
      wrong = side ? [(value as Frac).neg(), 'dne', Frac.ZERO, Frac.ONE] : value === 'dne' ? [rightVal, rightVal.neg(), Frac.ZERO] : ['dne', Frac.ONE, Frac.of(-1)];
    } else {
      // c(x − b) / (x − a)^n with n = 1 or 2
      const n = difficulty === 'medium' ? rng.pick([1, 1, 2]) : rng.pick([1, 2]);
      const { b, c } = attempt('asym', () => {
        const b = difficulty === 'hard' ? rng.int(-6, 6) : null;
        const c = rng.signedInt(1, 7, true);
        return b === a ? null : { b, c };
      });
      const numer = b === null ? Poly.of(c) : Poly.of(-c * b, c);
      const den = n === 1 ? xm(a) : `(${xm(a)})^{2}`;
      const denPoly = Poly.fromRoots(Array(n).fill(a));
      question = m(`\\displaystyle ${limTex(pt)} ${fr(numer.toTex(), difficulty === 'hard' && rng.bool(0.5) ? denPoly.toTex() : den)}`);
      const s = numer.eval(a).sign;
      const sideSign = (dir: 1 | -1) => s * (n === 2 ? 1 : dir);
      const toVal = (sg: number): LVal => (sg > 0 ? 'inf' : '-inf');
      steps.push(`At $x = ${a}$ the numerator is $${num(numer.eval(a))}$ and the denominator is $0$, so the function is unbounded.`);
      if (side) {
        value = toVal(sideSign(side === '+' ? 1 : -1));
        steps.push(`For $x$ ${side === '+' ? 'slightly greater' : 'slightly less'} than $${a}$ the quotient is ${value === 'inf' ? 'positive' : 'negative'}.`);
        wrong = [value === 'inf' ? '-inf' : 'inf', 'dne', Frac.ZERO];
      } else {
        const l = toVal(sideSign(-1));
        const r = toVal(sideSign(1));
        value = l === r ? l : 'dne';
        steps.push(value === 'dne' ? 'The quotient has opposite signs on the two sides, so the limit does not exist.' : `The quotient has the same sign on both sides, so the limit is $${value === 'inf' ? '\\infty' : '-\\infty'}$.`);
        wrong = value === 'dne' ? ['inf', '-inf', Frac.ZERO] : [value === 'inf' ? '-inf' : 'inf', 'dne', Frac.ZERO];
      }
    }
    return {
      question,
      answer: showL(value),
      steps,
      distractors: limitDistractors(value, wrong),
      check: { kind: 'calculus.limit' },
    };
  },
});

// ---------------------------------------------------------------- trigonometric limits

const sinT = (fn: string, a: number) => (a === 1 ? `\\${fn} x` : `\\${fn}(${a}x)`);

export const trigLimits = defineTopic({
  id: 'calc.trig-limits',
  subject: 'calculus',
  category: 'Limits and Continuity',
  title: 'Special Trigonometric Limits',
  description: 'Limits as x → 0 built from sin x / x → 1 and (1 − cos x) / x → 0.',
  instruction: 'Evaluate each limit.',
  multipleChoice: true,
  defaultCount: 10,
  options: [],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const POOL: Record<Difficulty, number[]> = { easy: [1, 2, 3], medium: [3, 4, 5, 6, 7], hard: [5, 6, 7, 8, 9] };
    const kind = rng.pick(POOL[difficulty]);
    const a = rng.int(difficulty === 'easy' ? 1 : 2, difficulty === 'easy' ? 6 : 9);
    const b = attempt('trig-b', () => {
      const b = rng.int(1, 9);
      return b === a && kind !== 5 ? null : b;
    });
    let expr: string;
    let value: Frac;
    let wrong: Frac[];
    const steps: string[] = [];
    const bx = (k: number, p = 1) => `${k === 1 ? '' : k}x${p === 2 ? '^{2}' : ''}`;
    switch (kind) {
      case 1:
        expr = fr(sinT('sin', a), bx(b));
        value = new Frac(a, b);
        steps.push(`Rewrite: $${fr(String(a), String(b))} \\cdot ${fr(sinT('sin', a), bx(a))} \\to ${fr(String(a), String(b))} \\cdot 1$`);
        wrong = [new Frac(b, a), Frac.ONE, Frac.ZERO, new Frac(a * b)];
        break;
      case 2:
        expr = fr(bx(b), sinT('sin', a));
        value = new Frac(b, a);
        steps.push(`Rewrite: $${fr(String(b), String(a))} \\cdot ${fr(bx(a), sinT('sin', a))} \\to ${fr(String(b), String(a))} \\cdot 1$`);
        wrong = [new Frac(a, b), Frac.ONE, Frac.ZERO, new Frac(a * b)];
        break;
      case 3:
        expr = fr(sinT('tan', a), bx(b));
        value = new Frac(a, b);
        steps.push(`$${sinT('tan', a)} = ${fr(sinT('sin', a), sinT('cos', a))}$ and $${sinT('cos', a)} \\to 1$, so the limit is $${num(value)}$.`);
        wrong = [new Frac(b, a), Frac.ONE, Frac.ZERO, new Frac(a * b)];
        break;
      case 4:
        expr = fr(sinT('sin', a), sinT('sin', b));
        value = new Frac(a, b);
        steps.push(`Divide top and bottom by $x$: $${fr(`${fr(sinT('sin', a), 'x')}`, `${fr(sinT('sin', b), 'x')}`)} \\to ${fr(String(a), String(b))}$`);
        wrong = [new Frac(b, a), Frac.ONE, Frac.ZERO, new Frac(a * b)];
        break;
      case 5:
        expr = fr(`1 - ${sinT('cos', a)}`, bx(b));
        value = Frac.ZERO;
        steps.push(`$${fr(`1 - \\cos u`, 'u')} \\to 0$, so the limit is $0$.`);
        wrong = [new Frac(a, b), Frac.ONE, new Frac(a * a, 2 * b), new Frac(b, a)];
        break;
      case 6:
        expr = fr(`1 - ${sinT('cos', a)}`, bx(b, 2));
        value = new Frac(a * a, 2 * b);
        steps.push(`Multiply by $1 + ${sinT('cos', a)}$: $${fr(`\\sin^{2}(${lin(a)})`, `${bx(b, 2)}(1 + ${sinT('cos', a)})`).replace(`\\sin^{2}(x)`, '\\sin^{2} x')} \\to ${fr(String(a * a), `${b} \\cdot 2`)}$`);
        wrong = [Frac.ZERO, new Frac(a * a, b), new Frac(a, 2 * b), new Frac(a, b)];
        break;
      case 7: {
        const c = rng.signedInt(1, 9, true);
        expr = fr(sinT('sin', a), `${bx(b, 2)} ${c > 0 ? '+' : '-'} ${bx(Math.abs(c))}`);
        value = new Frac(a, c);
        steps.push(`Factor $x$ from the denominator: $${fr(sinT('sin', a), 'x')} \\cdot ${fr('1', `${bx(b)} ${c > 0 ? '+' : '-'} ${Math.abs(c)}`)} \\to ${a} \\cdot ${fr('1', String(c)).replace('\\frac{1}{-', '\\left(-\\frac{1}{').replace(/\\left\(-\\frac\{1\}\{(\d+)\}$/, '\\left(-\\frac{1}{$1}\\right)')}$`);
        wrong = [new Frac(a, b), new Frac(a, b + c === 0 ? 1 : b + c), value.neg(), Frac.ZERO];
        break;
      }
      case 8:
        expr = fr(`\\sin^{2}(${lin(a)})`.replace('\\sin^{2}(x)', '\\sin^{2} x'), bx(b, 2));
        value = new Frac(a * a, b);
        steps.push(`$${fr(`\\sin^{2}(${lin(a)})`.replace('\\sin^{2}(x)', '\\sin^{2} x'), bx(b, 2))} = ${fr('1', String(b))}\\left(${fr(sinT('sin', a), 'x')}\\right)^{2} \\to ${fr(String(a * a), String(b))}$`.replace('\\frac{1}{1}', ''));
        wrong = [new Frac(a, b), new Frac(a * a, 2 * b), Frac.ONE, Frac.ZERO];
        break;
      default: {
        // (sin(ax) + cx) / (bx)  or  (tan(ax) − sin(cx)) / (bx)
        const c = attempt('trig-c', () => {
          const c = rng.int(1, 9);
          return c === a ? null : c;
        });
        if (rng.bool()) {
          expr = fr(`${sinT('sin', a)} + ${bx(c)}`, bx(b));
          value = new Frac(a + c, b);
          steps.push(`Split: $${fr(sinT('sin', a), bx(b))} + ${fr(bx(c), bx(b))} \\to ${fr(String(a), String(b))} + ${fr(String(c), String(b))}$`);
          wrong = [new Frac(a, b), new Frac(c, b), new Frac(a * c, b), new Frac(b, a + c)];
        } else {
          expr = fr(`${sinT('tan', a)} - ${sinT('sin', c)}`, bx(b));
          value = new Frac(a - c, b);
          steps.push(`Split: $${fr(sinT('tan', a), bx(b))} - ${fr(sinT('sin', c), bx(b))} \\to ${fr(String(a), String(b))} - ${fr(String(c), String(b))}$`);
          wrong = [new Frac(a + c, b), new Frac(c - a, b), Frac.ZERO, new Frac(a, b)];
        }
      }
    }
    return {
      question: m(`\\displaystyle ${limTex('0')} ${expr}`),
      answer: showL(value),
      steps,
      distractors: limitDistractors(value, wrong),
      check: { kind: 'calculus.limit' },
    };
  },
});

// ---------------------------------------------------------------- continuity

type CTask = 'find' | 'classify' | 'constant';

function findDiscontinuities(rng: Rng, d: Difficulty): ProblemContent {
  return attempt('discont', () => {
    const r1 = rng.int(-6, 6);
    const r2 = d === 'easy' ? null : rng.int(-6, 6);
    if (r2 === r1) return null;
    const dRoots = r2 === null ? [r1] : [r1, r2];
    const share = rng.bool(d === 'easy' ? 0.6 : 0.75) ? rng.pick(dRoots) : null;
    const other = rng.int(-6, 6);
    if (dRoots.includes(other)) return null;
    const k = rng.signedInt(1, d === 'hard' ? 4 : 2, true);
    const nRootsAll = share === null ? (d === 'easy' ? [other] : [other, rng.int(-6, 6)]) : [share, other];
    const numer = Poly.fromRoots(nRootsAll).scale(k);
    // the second numerator root must not hit the denominator either
    const removable = dRoots.filter((r) => numer.eval(r).isZero());
    if (share === null && removable.length) return null;
    const infinite = dRoots.filter((r) => !removable.includes(r));
    const den = Poly.fromRoots(dRoots);
    const f = fr(numer.toTex(), den.toTex());
    const list = (xs: number[]) => `$x = ${[...xs].sort((p, q) => p - q).join(', ')}$`;
    const part = (word: string, xs: number[]) => (xs.length ? `${word} discontinuit${xs.length > 1 ? 'ies' : 'y'} at ${list(xs)}` : null);
    const render = (rem: number[], inf: number[]) => {
      const s = [part('Removable', rem), part('Infinite', inf)].filter(Boolean).join('; ');
      return s.replace('; Infinite', '; infinite');
    };
    const answer = render(removable, infinite);
    const wrap = (r: number) => (r === 0 ? 'x' : `(${xm(r)})`);
    const factored = fr(`${k === 1 ? '' : k === -1 ? '-' : k}${nRootsAll.map(wrap).join('')}`, dRoots.length === 1 ? xm(dRoots[0]!) : dRoots.map(wrap).join(''));
    return {
      question: `$\\displaystyle f(x) = ${f}$`,
      answer,
      steps: [
        `Factor: $\\displaystyle f(x) = ${factored}$`,
        `The denominator is $0$ at ${list(dRoots)}, so $f$ is not defined there.`,
        removable.length ? `$${removable.map((r) => xm(r)).join(', ')}$ cancels, so that is a removable discontinuity${infinite.length ? '; the other zero of the denominator gives a vertical asymptote' : ''}.` : 'Nothing cancels, so each is an infinite discontinuity (vertical asymptote).',
      ],
      distractors: distinctDistractors(answer, [render(infinite, removable), render([], dRoots), render(dRoots, []), render([], [...infinite, other])], (q) => render([], [...dRoots, r1 + offset(q) * 7].filter((v, i, arr) => arr.indexOf(v) === i))),
      check: { kind: 'calculus.discontinuities' },
    };
  });
}

function classify(rng: Rng, d: Difficulty): ProblemContent {
  const a = rng.int(-4, 4);
  const type = rng.pick(['continuous', 'jump', 'removable', d === 'easy' ? 'jump' : 'infinite']);
  const deg = () => (d === 'easy' ? 1 : rng.int(1, 2));
  const p1 = randPoly(rng, deg(), 5);
  let rows: Array<[string, string]>;
  if (type === 'continuous' || type === 'jump') {
    let p2 = randPoly(rng, deg(), 5);
    const gap = p1.eval(a).sub(p2.eval(a));
    p2 = p2.add(Poly.of(type === 'continuous' ? gap : gap.isZero() ? rng.signedInt(1, 4, true) : 0));
    const strict = rng.bool();
    rows = [
      [p1.toTex(), `x ${strict ? '<' : '\\le'} ${a}`],
      [p2.toTex(), `x ${strict ? '\\ge' : '>'} ${a}`],
    ];
  } else if (type === 'removable') {
    const c = p1.eval(a).add(rng.signedInt(1, 5, true));
    rows = rng.bool(0.7)
      ? [
          [p1.toTex(), `x \\ne ${a}`],
          [num(c), `x = ${a}`],
        ]
      : [
          [p1.toTex(), `x < ${a}`],
          [num(c), `x = ${a}`],
          [p1.toTex(), `x > ${a}`],
        ];
  } else {
    const k = rng.signedInt(1, 6, true);
    rows = [
      [fr(String(k), xm(a)), `x < ${a}`],
      [p1.toTex(), `x \\ge ${a}`],
    ];
    if (rng.bool()) rows = [[p1.toTex(), `x \\le ${a}`], [fr(String(k), xm(a)), `x > ${a}`]];
  }
  const labels: Record<string, string> = { continuous: 'Continuous', jump: 'Jump discontinuity', removable: 'Removable discontinuity', infinite: 'Infinite discontinuity' };
  const answer = labels[type]!;
  const steps: string[] = [];
  if (type === 'infinite') steps.push(`One piece has a vertical asymptote at $x = ${a}$, so a one-sided limit is infinite.`);
  else if (type === 'removable') steps.push(`$\\displaystyle \\lim_{x \\to ${a}} f(x) = ${num(p1.eval(a))}$, but $f(${a})$ has a different value.`);
  else steps.push(`Left-hand limit: $${num(p1.eval(a))}$; right-hand limit: evaluate the other piece at $x = ${a}$.`, type === 'continuous' ? `The limits agree with $f(${a})$, so $f$ is continuous at $x = ${a}$.` : 'The one-sided limits differ: a jump.');
  return {
    question: `$f(x) = ${cases(rows)}$ at $x = ${a}$`,
    answer,
    steps,
    distractors: distinctDistractors(answer, Object.values(labels), () => null),
    check: { kind: 'calculus.classify' },
  };
}

function constantProblem(rng: Rng, d: Difficulty, fractions: boolean): ProblemContent {
  if (d === 'hard') {
    // P1 on x < r1, ax + b on [r1, r2), P3 on x ≥ r2
    const r1 = rng.int(-3, 1);
    const r2 = r1 + rng.int(1, 3);
    const A = rng.signedInt(1, 6, true);
    const B = rng.int(-8, 8);
    const line = (x: number) => A * x + B;
    let P1 = randPoly(rng, 2, 4);
    let P3 = randPoly(rng, rng.int(1, 2), 4);
    P1 = P1.add(Poly.of(new Frac(line(r1)).sub(P1.eval(r1))));
    P3 = P3.add(Poly.of(new Frac(line(r2)).sub(P3.eval(r2))));
    const rows: Array<[string, string]> = [
      [P1.toTex(), `x < ${r1}`],
      ['ax + b', `${r1} \\le x < ${r2}`],
      [P3.toTex(), `x \\ge ${r2}`],
    ];
    const answer = `$a = ${A}$, $b = ${B}$`;
    const y1 = P1.eval(r1);
    const y2 = P3.eval(r2);
    return {
      question: `$f(x) = ${cases(rows)}$`,
      answer,
      steps: [
        `At $x = ${r1}$: $${sum([{ coef: r1, sym: 'a' }, { coef: 1, sym: 'b' }])} = ${num(y1)}$`,
        `At $x = ${r2}$: $${sum([{ coef: r2, sym: 'a' }, { coef: 1, sym: 'b' }])} = ${num(y2)}$`,
        `Solve the system: $a = ${A}$, $b = ${B}$`,
      ],
      distractors: distinctDistractors(answer, [`$a = ${-A}$, $b = ${B}$`, `$a = ${B}$, $b = ${A}$`, `$a = ${A}$, $b = ${-B}$`], (k) => `$a = ${A + offset(k)}$, $b = ${B}$`),
      check: { kind: 'calculus.makeContinuous' },
    };
  }
  return attempt('k-continuity', () => {
    const a = rng.signedInt(1, 4, true);
    const i = d === 'easy' ? 1 : rng.int(1, 2);
    const alpha = rng.signedInt(1, 3, true);
    const beta = d === 'easy' ? 0 : rng.signedInt(1, 3, true);
    const coefK = alpha * a ** i - beta;
    if (coefK === 0) return null;
    const k = fractions && rng.bool(0.5) ? new Frac(rng.signedInt(1, 9, true), rng.pick([2, 3])) : new Frac(rng.signedInt(1, 8, true));
    const q = randPoly(rng, d === 'easy' ? 0 : 1, 6);
    // left: α k x^i + q(x); right: r(x) + β k with r(a) fixed by continuity
    let r = randPoly(rng, rng.int(1, 2), 5);
    const target = k.mul(coefK).add(q.eval(a));
    r = r.add(Poly.of(target.sub(r.eval(a))));
    if (!r.isIntegral() || r.c.some((c) => Math.abs(c.value) > 40)) return null;
    const left = sum([{ coef: alpha, sym: `k${i === 1 ? 'x' : `x^{${i}}`}` }, ...q.terms()]);
    const right = sum([...r.terms(), { coef: beta }].map((t, idx, arr) => (idx === arr.length - 1 ? { coef: beta, sym: 'k' } : t)));
    const strict = rng.bool();
    const rows: Array<[string, string]> = [
      [left, `x ${strict ? '<' : '\\le'} ${a}`],
      [right, `x ${strict ? '\\ge' : '>'} ${a}`],
    ];
    const answer = `$k = ${num(k)}$`;
    const lhsEq = sum([{ coef: alpha * a ** i, sym: 'k' }, { coef: q.eval(a) }]);
    const rhsEq = sum([{ coef: r.eval(a) }, { coef: beta, sym: 'k' }]);
    return {
      question: `$f(x) = ${cases(rows)}$`,
      answer,
      steps: [`Set the pieces equal at $x = ${a}$: $${lhsEq} = ${rhsEq}$`, `Solve: $k = ${num(k)}$`],
      distractors: distinctDistractors(answer, [`$k = ${num(k.neg())}$`, `$k = ${num(r.eval(a).sub(q.eval(a)).div(alpha * a ** i + beta === 0 ? 1 : alpha * a ** i + beta))}$`, `$k = ${num(r.eval(-a).sub(q.eval(-a)).div(alpha * (-a) ** i - beta === 0 ? 1 : alpha * (-a) ** i - beta))}$`], (j) => `$k = ${num(k.add(offset(j)))}$`),
      check: { kind: 'calculus.makeContinuous' },
    };
  });
}

export const continuity = defineTopic({
  id: 'calc.continuity',
  subject: 'calculus',
  category: 'Limits and Continuity',
  title: 'Continuity',
  description: 'Find and classify discontinuities (removable, jump, infinite) and choose constants that make a piecewise function continuous.',
  instruction: (o) =>
    o.task === 'find'
      ? 'Find and classify the discontinuities of each function.'
      : o.task === 'classify'
        ? 'Determine whether each function is continuous at the given value. If not, classify the discontinuity.'
        : o.task === 'constant'
          ? 'Find the value(s) of the constant(s) that make each function continuous everywhere.'
          : 'Answer each question about continuity.',
  multipleChoice: true,
  defaultCount: 8,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Task',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'find', label: 'Find and classify discontinuities' },
        { value: 'classify', label: 'Continuity of a piecewise function at a point' },
        { value: 'constant', label: 'Make a piecewise function continuous' },
      ],
    },
    { type: 'boolean', id: 'fractions', label: 'Allow fractional constants', default: false },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const tOpt = strOpt(ctx, 'task');
    const task = (tOpt === 'any' ? rng.pick(['find', 'classify', 'constant']) : tOpt) as CTask;
    const p = task === 'find' ? findDiscontinuities(rng, difficulty) : task === 'classify' ? classify(rng, difficulty) : constantProblem(rng, difficulty, boolOpt(ctx, 'fractions'));
    if (tOpt === 'any') {
      const lead = task === 'find' ? 'Find and classify the discontinuities: ' : task === 'classify' ? 'Is the function continuous at the given value? Classify any discontinuity: ' : 'Find the constants that make the function continuous: ';
      return { ...p, question: lead + p.question };
    }
    return p;
  },
});
