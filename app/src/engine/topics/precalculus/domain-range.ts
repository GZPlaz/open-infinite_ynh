/** Domain and range of functions given by equations, in interval notation. */
import { Frac } from '../../fraction';
import { defineTopic, distinctDistractors, strOpt } from '../../generator';
import { Poly } from '../../polynomial';
import type { Rng } from '../../rng';
import { linear, m, sum } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { ALL, INF, NINF, allExcept, end, intervalTex, iv, signedFrac, type Interval } from './common';

interface Fam {
  tex: string;
  domain: Interval[];
  range?: Interval[];
  wrongD: Interval[][];
  wrongR: Interval[][];
  /** x-values worth sampling (domain endpoints, vertices). */
  hints: number[];
  dStep: string;
  rStep?: string;
}

type FamName = 'sqrt' | 'rational' | 'abs' | 'quad' | 'exp' | 'log' | 'cbrt' | 'ratQuad' | 'sqrtOut' | 'sqrtIn' | 'invSqrt' | 'sqrtOverLin' | 'logQuad';

const POOLS: Record<Difficulty, FamName[]> = {
  easy: ['sqrt', 'rational', 'abs', 'quad'],
  medium: ['sqrt', 'rational', 'exp', 'log', 'cbrt', 'ratQuad'],
  hard: ['sqrtOut', 'sqrtIn', 'invSqrt', 'sqrtOverLin', 'logQuad', 'ratQuad'],
};
const WITH_RANGE: ReadonlySet<FamName> = new Set(['sqrt', 'rational', 'abs', 'quad', 'exp', 'log', 'cbrt', 'sqrtOut', 'sqrtIn', 'invSqrt', 'logQuad']);

const lin = (h: number) => linear(1, -h);
const plusK = (main: string, k: number) => (k === 0 ? main : `${main} ${k < 0 ? '-' : '+'} ${Math.abs(k)}`);
const up = (k: number, closed = true) => [iv(end(k), INF, closed)];
const down = (k: number, closed = true) => [iv(NINF, end(k), false, closed)];

function family(rng: Rng, name: FamName, d: Difficulty): Fam {
  const h = rng.int(-6, 6);
  const k = rng.int(-6, 6);
  const coefs = d === 'easy' ? [1, -1] : [1, -1, 2, -2, 3, -3];
  switch (name) {
    case 'sqrt': {
      const a = rng.pick(coefs);
      const s = d === 'easy' || rng.bool(0.6) ? 1 : -1;
      const inner = s > 0 ? lin(h) : sum([{ coef: h }, { coef: -1, sym: 'x' }]);
      const D = s > 0 ? up(h) : down(h);
      const R = a > 0 ? up(k) : down(k);
      return {
        tex: plusK(sum([{ coef: a, sym: `\\sqrt{${inner}}` }]), k),
        domain: D,
        range: R,
        wrongD: [s > 0 ? up(-h) : down(-h), s > 0 ? up(h, false) : down(h, false), s > 0 ? down(h) : up(h)],
        wrongR: [a > 0 ? up(-k) : down(-k), a > 0 ? down(k) : up(k), a > 0 ? up(k, false) : down(k, false), up(h)],
        hints: [h],
        dStep: `The radicand must be non-negative: $${inner} \\ge 0$, so $x ${s > 0 ? '\\ge' : '\\le'} ${h}$.`,
        rStep: `The square root is at least $0$, so $f(x) ${a > 0 ? '\\ge' : '\\le'} ${k}$.`,
      };
    }
    case 'rational': {
      const a = rng.signedInt(1, d === 'easy' ? 4 : 8, true);
      return {
        tex: plusK(signedFrac(a, lin(h)), k),
        domain: allExcept([end(h)]),
        range: allExcept([end(k)]),
        wrongD: [allExcept([end(-h)]), ALL, allExcept([end(k)])],
        wrongR: [allExcept([end(-k)]), allExcept([end(h)]), ALL],
        hints: [h],
        dStep: `The denominator is zero at $x = ${h}$.`,
        rStep: `The horizontal asymptote is $y = ${k}$; the function never takes that value.`,
      };
    }
    case 'abs':
    case 'quad': {
      const a = rng.pick(d === 'easy' ? [1, -1, 2, -2] : coefs);
      const sym = name === 'abs' ? `\\left|${lin(h)}\\right|` : h === 0 ? 'x^{2}' : `(${lin(h)})^{2}`;
      const R = a > 0 ? up(k) : down(k);
      return {
        tex: plusK(sum([{ coef: a, sym }]), k),
        domain: ALL,
        range: R,
        wrongD: [up(h), down(h), allExcept([end(h)])],
        wrongR: [a > 0 ? up(-k) : down(-k), a > 0 ? down(k) : up(k), a > 0 ? up(k, false) : down(k, false), ALL],
        hints: [h],
        dStep: 'Any real number can be substituted for $x$.',
        rStep: `The vertex is $(${h}, ${k})$ and the graph opens ${a > 0 ? 'up' : 'down'}, so $f(x) ${a > 0 ? '\\ge' : '\\le'} ${k}$.`,
      };
    }
    case 'exp': {
      const base = rng.pick(['2', '3', 'e', '\\left(\\frac{1}{2}\\right)']);
      const a = rng.pick([1, -1, 2, -2, 3]);
      const shift = rng.int(-3, 3);
      const power = `${base}^{${lin(shift)}}`;
      const main = a === 1 ? power : a === -1 ? `-${power}` : base === 'e' ? `${a}${power}` : `${a} \\cdot ${power}`;
      return {
        tex: plusK(main, k),
        domain: ALL,
        range: a > 0 ? up(k, false) : down(k, false),
        wrongD: [up(shift, false), up(0, false), allExcept([end(shift)])],
        wrongR: [a > 0 ? up(k) : down(k), a > 0 ? down(k, false) : up(k, false), a > 0 ? up(-k, false) : down(-k, false), ALL],
        hints: [shift],
        dStep: 'Any real number can be used as an exponent.',
        rStep: `The exponential term is ${a > 0 ? 'always positive' : 'always negative'}, so the graph approaches $y = ${k}$ without reaching it.`,
      };
    }
    case 'log': {
      const fn = rng.pick(['\\ln', '\\log', '\\log_{2}', '\\log_{3}']);
      const a = rng.pick([1, 1, -1, 2, 3]);
      const s = rng.bool(0.65) ? 1 : -1;
      const inner = s > 0 ? lin(h) : sum([{ coef: h }, { coef: -1, sym: 'x' }]);
      return {
        tex: plusK(sum([{ coef: a, sym: `${fn}(${inner})` }]), k),
        domain: s > 0 ? up(h, false) : down(h, false),
        range: ALL,
        wrongD: [s > 0 ? up(h) : down(h), s > 0 ? up(-h, false) : down(-h, false), s > 0 ? down(h, false) : up(h, false)],
        wrongR: [up(k, false), up(0, false), up(k)],
        hints: [h],
        dStep: `The argument of a logarithm must be positive: $${inner} > 0$, so $x ${s > 0 ? '>' : '<'} ${h}$.`,
        rStep: 'A logarithm takes every real value.',
      };
    }
    case 'cbrt': {
      const a = rng.pick(coefs);
      return {
        tex: plusK(sum([{ coef: a, sym: `\\sqrt[3]{${lin(h)}}` }]), k),
        domain: ALL,
        range: ALL,
        wrongD: [up(h), allExcept([end(h)]), up(0)],
        wrongR: [up(k), down(k), allExcept([end(k)])],
        hints: [h],
        dStep: 'A cube root is defined for every real number.',
        rStep: 'A cube root takes every real value.',
      };
    }
    case 'ratQuad': {
      if (rng.bool(0.25)) {
        const p = rng.int(1, 6);
        const c = rng.int(-6, 6);
        const numer = c === 0 ? 'x' : linear(1, c);
        return {
          tex: `\\frac{${numer}}{x^{2} + ${p * p}}`,
          domain: ALL,
          wrongD: [allExcept([end(-p), end(p)]), allExcept([end(-c)]), allExcept([end(-p * p)])],
          wrongR: [],
          hints: [],
          dStep: `$x^{2} + ${p * p} > 0$ for every $x$, so the denominator is never zero.`,
        };
      }
      const r1 = rng.int(-7, 6);
      const r2 = rng.intExcept(r1 + 1, 7, [-r1]);
      const c = rng.intExcept(-7, 7, [-r1, -r2, 0]);
      const den = Poly.fromRoots([r1, r2]).toTex();
      return {
        tex: `\\frac{${linear(1, c)}}{${den}}`,
        domain: allExcept([end(r1), end(r2)]),
        wrongD: [allExcept([end(-r1), end(-r2)]), allExcept([end(-c)]), ALL, allExcept([end(r2)])],
        wrongR: [],
        hints: [r1, r2],
        dStep: `Factor the denominator: $(${lin(r1)})(${lin(r2)}) = 0$ when $x = ${r1}$ or $x = ${r2}$.`,
      };
    }
    case 'sqrtOut':
    case 'sqrtIn': {
      const p = rng.int(1, 6);
      const a = rng.pick([1, -1, 2]);
      const outer = name === 'sqrtOut';
      const inner = outer ? `x^{2} - ${p * p}` : `${p * p} - x^{2}`;
      const D = outer ? [iv(NINF, end(-p), false, true), iv(end(p), INF, true)] : [iv(end(-p), end(p), true, true)];
      const R = outer ? (a > 0 ? up(k) : down(k)) : a > 0 ? [iv(end(k), end(k + a * p), true, true)] : [iv(end(k + a * p), end(k), true, true)];
      const altD = outer ? [iv(end(-p), end(p), true, true)] : [iv(NINF, end(-p), false, true), iv(end(p), INF, true)];
      return {
        tex: plusK(sum([{ coef: a, sym: `\\sqrt{${inner}}` }]), k),
        domain: D,
        range: R,
        wrongD: [altD, outer ? [iv(NINF, end(-p)), iv(end(p), INF)] : [iv(end(-p), end(p))], outer ? up(p) : [iv(end(0), end(p), true, true)]],
        wrongR: outer
          ? [a > 0 ? up(-k) : down(-k), a > 0 ? up(k + p) : down(k - p), a > 0 ? down(k) : up(k)]
          : [[iv(end(k), end(k + a * p * p), true, true)], [iv(end(-p), end(p), true, true)], a > 0 ? up(k) : down(k)],
        hints: [-p, 0, p],
        dStep: `Solve $${inner} \\ge 0$: ${outer ? `$x \\le ${-p}$ or $x \\ge ${p}$` : `$${-p} \\le x \\le ${p}$`}.`,
        rStep: outer
          ? `The square root takes every value $\\ge 0$, so $f(x) ${a > 0 ? '\\ge' : '\\le'} ${k}$.`
          : `The square root ranges from $0$ to $${p}$ (at $x = 0$).`,
      };
    }
    case 'invSqrt': {
      const a = rng.signedInt(1, 3, true);
      return {
        tex: plusK(signedFrac(a, `\\sqrt{${lin(h)}}`), k),
        domain: up(h, false),
        range: a > 0 ? up(k, false) : down(k, false),
        wrongD: [up(h), allExcept([end(h)]), up(-h, false)],
        wrongR: [a > 0 ? up(k) : down(k), allExcept([end(k)]), a > 0 ? down(k, false) : up(k, false)],
        hints: [h],
        dStep: `The radicand must be positive (it is in a denominator): $x > ${h}$.`,
        rStep: `$\\frac{${Math.abs(a)}}{\\sqrt{${lin(h)}}}$ takes every positive value, so $f(x) ${a > 0 ? '>' : '<'} ${k}$.`,
      };
    }
    case 'sqrtOverLin': {
      const a = rng.int(-6, 4);
      const b = rng.int(a + 1, a + 5);
      return {
        tex: `\\frac{\\sqrt{${lin(a)}}}{${lin(b)}}`,
        domain: [iv(end(a), end(b), true), iv(end(b), INF)],
        wrongD: [up(a), [iv(end(a), end(b)), iv(end(b), INF)], allExcept([end(b)])],
        wrongR: [],
        hints: [a, b],
        dStep: `Need $${lin(a)} \\ge 0$ and $${lin(b)} \\ne 0$: $x \\ge ${a}$, $x \\ne ${b}$.`,
      };
    }
    case 'logQuad':
    default: {
      const p = rng.int(1, 6);
      const fn = rng.pick(['\\ln', '\\log']);
      return {
        tex: plusK(`${fn}(x^{2} - ${p * p})`, k),
        domain: [iv(NINF, end(-p)), iv(end(p), INF)],
        range: ALL,
        wrongD: [[iv(NINF, end(-p), false, true), iv(end(p), INF, true)], [iv(end(-p), end(p))], up(p, false)],
        wrongR: [up(k, false), up(0, false), up(k)],
        hints: [-p, p],
        dStep: `Solve $x^{2} - ${p * p} > 0$: $x < ${-p}$ or $x > ${p}$.`,
        rStep: `$x^{2} - ${p * p}$ takes every positive value, so the logarithm takes every real value.`,
      };
    }
  }
}

export const domainRange = defineTopic({
  id: 'precalc.functions.domain-range',
  subject: 'precalculus',
  category: 'Functions',
  title: 'Domain and Range',
  description: 'Find the domain and range of radical, rational, logarithmic and other functions in interval notation.',
  instruction: (o) =>
    o.task === 'domain' ? 'Find the domain of each function. Use interval notation.' : o.task === 'range' ? 'Find the range of each function. Use interval notation.' : 'Find the domain and range of each function. Use interval notation.',
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Find',
      default: 'both',
      choices: [
        { value: 'both', label: 'Domain and range' },
        { value: 'domain', label: 'Domain only' },
        { value: 'range', label: 'Range only' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const task = strOpt(ctx, 'task');
    let pool = POOLS[difficulty];
    if (task !== 'domain') pool = pool.filter((n) => WITH_RANGE.has(n));
    const name = rng.pick(pool);
    const f = family(rng, name, difficulty);
    const wantD = task !== 'range';
    const wantR = task !== 'domain' && f.range !== undefined;
    const fmt = (D: Interval[] | null, R: Interval[] | null) =>
      [D ? `Domain: ${m(intervalTex(D))}` : '', R ? `Range: ${m(intervalTex(R))}` : ''].filter(Boolean).join('; ');
    const D = wantD ? f.domain : null;
    const R = wantR ? f.range! : null;
    const answer = fmt(D, R);
    const steps: string[] = [];
    if (wantD) steps.push(f.dStep, `Domain: ${m(intervalTex(f.domain))}`);
    if (wantR) steps.push(f.rStep!, `Range: ${m(intervalTex(f.range!))}`);
    const cands: string[] = [];
    if (wantD && wantR) {
      cands.push(fmt(f.wrongD[0]!, f.range!), fmt(f.domain, f.wrongR[0]!), fmt(f.range!, f.domain), fmt(f.wrongD[1]!, f.wrongR[1]!));
    } else if (wantD) cands.push(...f.wrongD.map((w) => fmt(w, null)));
    else cands.push(...f.wrongR.map((w) => fmt(null, w)), fmt(null, f.domain));
    const pool2 = [...f.wrongD, ...f.wrongR, ALL];
    const distractors = distinctDistractors(answer, cands, (k) => {
      const w = pool2[(k - 1) % pool2.length]!;
      const shift = Math.floor((k - 1) / pool2.length) + 1;
      const moved = (list: Interval[]) =>
        list.map((i) => iv(Number.isFinite(i.lo.v) ? end(new Frac(Math.round(i.lo.v * 12), 12).add(shift)) : i.lo, Number.isFinite(i.hi.v) ? end(new Frac(Math.round(i.hi.v * 12), 12).add(shift)) : i.hi, i.loC, i.hiC));
      return fmt(D ? (k % 2 ? w : moved(f.domain)) : null, R ? (k % 2 ? moved(f.range!) : w) : null);
    });
    return {
      question: m(`f(x) = ${f.tex}`),
      answer,
      steps,
      distractors,
      check: { kind: 'precalculus.domainRange', hints: f.hints },
    };
  },
});
