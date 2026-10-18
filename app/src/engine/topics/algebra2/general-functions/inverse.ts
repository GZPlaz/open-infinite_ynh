/** Inverse functions: find f⁻¹, or decide whether two functions are inverses. */
import { attempt, boolOpt, defineTopic, distinctDistractors, strOpt } from '../../../generator';
import type { Rng } from '../../../rng';
import { linear, m, scaled, sum } from '../../../tex';
import type { Difficulty, ProblemContent } from '../../../types';
import { CATEGORY_FUNC, Frac } from './common';

/** A function of x as LaTeX plus a numeric version (for screening distractors). */
interface F {
  tex: string;
  f: (x: number) => number;
}

interface Problem {
  fn: F;
  inv: F;
  wrong: F[];
  /** inverse valid only for x ≥ lo (radical functions) */
  lo?: number;
  steps: string[];
  /** bijective on the reals (or its natural domain): usable for "are these inverses?" */
  verifiable: boolean;
}

const tail = (c: number) => (c === 0 ? '' : ` ${c > 0 ? '+' : '-'} ${Math.abs(c)}`);
const shift = (h: number) => (h === 0 ? 'x' : `(${linear(1, -h)})`);
const cbrt = (x: number) => Math.sign(x) * Math.abs(x) ** (1 / 3);

/** (x − b)/a as LaTeX. */
function linInv(a: number, b: number): F {
  let tex: string;
  const top = linear(1, -b);
  if (a === 1) tex = top;
  else if (a === -1) tex = linear(-1, b);
  else if (b === 0) tex = a > 0 ? `\\frac{x}{${a}}` : `-\\frac{x}{${-a}}`;
  else tex = a > 0 ? `\\frac{${top}}{${a}}` : `-\\frac{${top}}{${-a}}`;
  return { tex, f: (x) => (x - b) / a };
}

type Kind = 'linear' | 'linear-div' | 'linear-frac' | 'cube' | 'cbrt' | 'recip' | 'sqrt' | 'rational';

const KINDS: Record<Difficulty, Kind[]> = {
  easy: ['linear', 'linear', 'linear-div'],
  medium: ['linear-frac', 'cube', 'cbrt', 'recip', 'sqrt'],
  hard: ['rational', 'cube', 'sqrt', 'rational', 'linear-frac'],
};

function build(rng: Rng, kind: Kind, d: Difficulty): Problem {
  const s = (n: number) => rng.signedInt(1, n, true);
  switch (kind) {
    case 'linear': {
      const a = rng.bool(0.15) ? rng.pick([1, -1]) : s(9);
      const b = s(10);
      const inv = linInv(a, b);
      return {
        fn: { tex: linear(a, b), f: (x) => a * x + b },
        inv,
        wrong: [linInv(a, -b), { tex: `\\frac{1}{${linear(a, b)}}`, f: (x) => 1 / (a * x + b) }, { tex: linear(new Frac(1, a), -b), f: (x) => x / a - b }, linInv(-a, b)],
        steps: [`Write $y = ${linear(a, b)}$ and swap $x$ and $y$: $x = ${linear(a, b, 'y')}$`, `Solve for $y$: $y = ${inv.tex}$`],
        verifiable: true,
      };
    }
    case 'linear-div': {
      const a = rng.int(2, 9);
      const b = s(10);
      const tex = `\\frac{${linear(1, b)}}{${a}}`;
      const inv = { tex: linear(a, -b), f: (x: number) => a * x - b };
      return {
        fn: { tex, f: (x) => (x + b) / a },
        inv,
        wrong: [{ tex: linear(a, b), f: (x) => a * x + b }, linInv(a, -b), { tex: `\\frac{${a}}{${linear(1, b)}}`, f: (x) => a / (x + b) }, { tex: linear(new Frac(1, a), -b), f: (x) => x / a - b }],
        steps: [`Swap $x$ and $y$: $x = \\frac{${linear(1, b, 'y')}}{${a}}$`, `Multiply by $${a}$: $${a}x = ${linear(1, b, 'y')}$`, `Solve for $y$: $y = ${inv.tex}$`],
        verifiable: true,
      };
    }
    case 'linear-frac': {
      const q = rng.pick([2, 3, 4, 5]);
      const p = attempt('frac-coef', () => {
        const x = s(7);
        return Math.abs(x) === q || new Frac(x, q).isInt() || new Frac(x, q).d !== q ? null : x;
      });
      const b = s(9);
      const c = new Frac(p, q);
      const ci = c.inv();
      const inv = { tex: scaled(ci, linear(1, -b)), f: (x: number) => (x - b) / c.value };
      return {
        fn: { tex: linear(c, b), f: (x) => c.value * x + b },
        inv,
        wrong: [
          { tex: scaled(c, linear(1, -b)), f: (x) => c.value * (x - b) },
          { tex: scaled(ci, linear(1, b)), f: (x) => ci.value * (x + b) },
          { tex: linear(ci, -b), f: (x) => ci.value * x - b },
          { tex: scaled(ci.neg(), linear(1, -b)), f: (x) => -ci.value * (x - b) },
        ],
        steps: [`Swap $x$ and $y$: $x = ${linear(c, b, 'y')}$`, `${b > 0 ? 'Subtract' : 'Add'} $${Math.abs(b)}$: $${linear(1, -b)} = ${linear(c, 0, 'y')}$`, `Multiply by $${ci.toTex()}$: $y = ${inv.tex}$`],
        verifiable: true,
      };
    }
    case 'cube': {
      const a = d === 'hard' ? rng.pick([1, -1, 2, 3, -2, 4]) : rng.pick([1, 1, -1]);
      const h = d === 'medium' && rng.bool(0.5) ? 0 : s(6);
      const k = d === 'medium' && h !== 0 ? 0 : s(9);
      const lead = a === 1 ? '' : a === -1 ? '-' : String(a);
      const tex = `${lead}${shift(h)}^{3}${tail(k)}`;
      const inner = (kk: number, aa: number) =>
        aa === 1 ? linear(1, -kk) : aa === -1 ? linear(-1, kk) : aa > 0 ? `\\frac{${linear(1, -kk)}}{${aa}}` : `\\frac{${linear(-1, kk)}}{${-aa}}`;
      const mk = (kk: number, aa: number, hh: number): F => ({ tex: `\\sqrt[3]{${inner(kk, aa)}}${tail(hh)}`, f: (x) => cbrt((x - kk) / aa) + hh });
      const inv = mk(k, a, h);
      const wrong = [mk(-k, a, h), mk(k, a, -h), { tex: `${shift(k)}^{3}${tail(h)}`.replace(/^\(x\)/, 'x'), f: (x: number) => (x - k) ** 3 + h }];
      if (a !== 1) wrong.push(mk(k, 1, h));
      wrong.push(mk(-k, a, -h));
      return {
        fn: { tex, f: (x) => a * (x - h) ** 3 + k },
        inv,
        wrong,
        steps: [
          `Swap $x$ and $y$: $x = ${tex.replace(/x/g, 'y')}$`,
          `Isolate the cube: $${shift(h).replace(/x/g, 'y')}^{3} = ${inner(k, a)}$`,
          `Take the cube root${h === 0 ? '' : ` and ${h > 0 ? 'add' : 'subtract'} $${Math.abs(h)}$`}: $y = ${inv.tex}$`,
        ],
        verifiable: true,
      };
    }
    case 'cbrt': {
      const h = s(8);
      const k = rng.bool(0.6) ? s(6) : 0;
      const tex = `\\sqrt[3]{${linear(1, -h)}}${tail(k)}`;
      const mk = (kk: number, hh: number): F => ({ tex: `${shift(kk)}^{3}${tail(hh)}`, f: (x) => (x - kk) ** 3 + hh });
      const inv = mk(k, h);
      return {
        fn: { tex, f: (x) => cbrt(x - h) + k },
        inv,
        wrong: [mk(-k, h), mk(k, -h), mk(h, k), { tex: `\\sqrt[3]{${linear(1, -k)}}${tail(h)}`, f: (x) => cbrt(x - k) + h }],
        steps: [`Swap $x$ and $y$: $x = ${tex.replace(/x/g, 'y')}$`, `Isolate the root and cube both sides: $${linear(1, -h, 'y')} = ${shift(k)}^{3}$`, `$y = ${inv.tex}$`],
        verifiable: true,
      };
    }
    case 'recip': {
      const h = s(7);
      const k = s(7);
      const mk = (hh: number, kk: number): F => ({ tex: `\\frac{1}{${linear(1, -hh)}}${tail(kk)}`, f: (x) => 1 / (x - hh) + kk });
      const fn = mk(h, k);
      const inv = mk(k, h);
      return {
        fn,
        inv,
        wrong: [mk(-k, h), mk(k, -h), mk(-h, -k), { tex: linear(1, h - k), f: (x) => x + h - k }],
        steps: [
          `Swap $x$ and $y$: $x = \\frac{1}{${linear(1, -h, 'y')}}${tail(k)}$`,
          `${k > 0 ? 'Subtract' : 'Add'} $${Math.abs(k)}$: $${linear(1, -k)} = \\frac{1}{${linear(1, -h, 'y')}}$`,
          `Take reciprocals: $${linear(1, -h, 'y')} = \\frac{1}{${linear(1, -k)}}$`,
          `$y = ${inv.tex}$`,
        ],
        verifiable: true,
      };
    }
    case 'sqrt': {
      const a = d === 'hard' ? rng.pick([1, 2, 3]) : 1;
      const h = s(8);
      const k = rng.bool(0.7) ? s(6) : 0;
      const tex = `${a === 1 ? '' : a}\\sqrt{${linear(1, -h)}}${tail(k)}`;
      const sq = (kk: number) => `${shift(kk)}^{2}`;
      const mk = (kk: number, hh: number, aa: number): F => ({
        tex: aa === 1 ? `${sq(kk)}${tail(hh)}` : `\\frac{${sq(kk)}}{${aa * aa}}${tail(hh)}`,
        f: (x) => ((x - kk) / aa) ** 2 + hh,
      });
      const inv = mk(k, h, a);
      const wrong = [mk(-k, h, a), mk(k, -h, a), mk(h, k, a)];
      if (a !== 1) wrong.push({ tex: `\\frac{${sq(k)}}{${a}}${tail(h)}`, f: (x) => (x - k) ** 2 / a + h });
      wrong.push(mk(-k, -h, a));
      return {
        fn: { tex, f: (x) => a * Math.sqrt(x - h) + k },
        inv,
        wrong,
        lo: k,
        steps: [
          `The range of the function is $y \\ge ${k}$, so the inverse has domain $x \\ge ${k}$.`,
          `Swap $x$ and $y$: $x = ${tex.replace(/x/g, 'y')}$`,
          `Isolate the root and square both sides: $${linear(1, -h, 'y')} = ${a === 1 ? sq(k) : `\\frac{${sq(k)}}{${a * a}}`}$`,
          `$y = ${inv.tex}$, for $x \\ge ${k}$`,
        ],
        verifiable: false,
      };
    }
    case 'rational': {
      const [a, b, c, dd] = attempt('rational-inverse', () => {
        const t = [s(6), rng.int(-9, 9), rng.int(1, 4), s(9)] as const;
        return t[0] * t[3] - t[1] * t[2] === 0 || t[0] === -t[3] ? null : t;
      });
      const fr = (p: number, q: number, r: number, w: number): F => ({ tex: `\\frac{${linear(p, q)}}{${linear(r, w)}}`, f: (x) => (p * x + q) / (r * x + w) });
      const inv = fr(-dd, b, c, -a);
      return {
        fn: fr(a, b, c, dd),
        inv,
        wrong: [fr(dd, b, c, -a), fr(c, dd, a, b), fr(-dd, b, c, a), fr(-dd, -b, c, -a)],
        steps: [
          `Swap $x$ and $y$: $x = \\frac{${linear(a, b, 'y')}}{${linear(c, dd, 'y')}}$`,
          `Multiply: $${sum([{ coef: c, sym: 'xy' }, { coef: dd, sym: 'x' }])} = ${linear(a, b, 'y')}$`,
          `Collect the $y$ terms: $${sum([{ coef: c, sym: 'xy' }, { coef: -a, sym: 'y' }])} = ${linear(-dd, b)}$`,
          `Factor and divide: $y = ${inv.tex}$`,
        ],
        verifiable: true,
      };
    }
  }
}

const SAMPLES = [-2.7, -1.3, 0.6, 1.7, 3.1];

function differs(a: F, b: F, lo: number | undefined): boolean {
  const pts = lo === undefined ? SAMPLES : [lo + 0.5, lo + 1.3, lo + 2.9];
  return pts.some((t) => {
    const x = a.f(t);
    const y = b.f(t);
    if (!Number.isFinite(y)) return false;
    return !Number.isFinite(x) || Math.abs(x - y) > 1e-6;
  });
}

export const inverseFunctions = defineTopic({
  id: 'alg2.func.inverse',
  subject: 'algebra2',
  category: CATEGORY_FUNC,
  title: 'Inverse Functions',
  description: 'Find inverses of linear, rational, cubic and radical functions, or decide whether two functions are inverses.',
  instruction: (o) =>
    o.task === 'verify'
      ? 'State whether the given functions are inverses.'
      : o.task === 'mixed'
        ? 'Find the inverse of each function, or state whether the given functions are inverses.'
        : 'Find the inverse of each function.',
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Task',
      default: 'find',
      choices: [
        { value: 'find', label: 'Find the inverse' },
        { value: 'verify', label: 'Are they inverses?' },
        { value: 'mixed', label: 'Mixed' },
      ],
    },
    { type: 'boolean', id: 'names', label: 'Vary the function name', default: false },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const task = strOpt(ctx, 'task');
    const verify = task === 'verify' || (task === 'mixed' && rng.bool(0.35));
    const name = boolOpt(ctx, 'names') && !verify ? rng.pick(['f', 'g', 'h']) : 'f';
    const kinds = verify ? KINDS[difficulty].filter((k) => k !== 'sqrt') : KINDS[difficulty];
    const prob = build(rng, rng.pick(kinds), difficulty);
    if (verify) return verifyProblem(rng, prob);

    const restrict = prob.lo === undefined ? '' : `, for $x \\ge ${prob.lo}$`;
    const show = (g: F) => `${m(`${name}^{-1}\\left(x\\right) = ${g.tex}`)}${restrict}`;
    const answer = show(prob.inv);
    const wrong = prob.wrong.filter((w) => differs(w, prob.inv, prob.lo));
    const distractors = distinctDistractors(answer, wrong.map(show), (k) => show({ tex: `${prob.inv.tex}${tail(k)}`, f: (x) => prob.inv.f(x) + k }));
    return {
      question: m(`${name}(x) = ${prob.fn.tex}`),
      answer,
      steps: prob.steps,
      distractors,
      check: { kind: 'alg2-quadratics-functions.inverse' },
    };
  },
});

const YES = `Yes; ${m('f(g(x)) = x')} and ${m('g(f(x)) = x')}`;

function verifyProblem(rng: Rng, prob: Problem): ProblemContent {
  const linearF = rng.bool(0.5);
  let fTex: string;
  let gTex: string;
  let answer: string;
  const no = (alpha: Frac, beta: Frac) => `No; ${m(`f(g(x)) = ${linear(alpha, beta)}`)}`;
  const candidates: string[] = [];
  const steps: string[] = [];
  if (linearF && rng.bool(0.6)) {
    // a wrong "inverse" of f(x) = ax + b
    const a = rng.signedInt(2, 9, true);
    const b = rng.signedInt(1, 10, true);
    const choice = rng.int(0, 2);
    const g = choice === 0 ? linInv(a, -b) : choice === 1 ? { tex: linear(new Frac(1, a), -b), f: (x: number) => x / a - b } : linInv(-a, b);
    const alpha = choice === 2 ? new Frac(-1) : new Frac(1);
    const beta = choice === 0 ? new Frac(2 * b) : choice === 1 ? new Frac(b - a * b) : new Frac(2 * b);
    fTex = linear(a, b);
    gTex = g.tex;
    answer = no(alpha, beta);
    steps.push(`$f(g(x)) = ${a}\\left(${g.tex}\\right)${tail(b)} = ${linear(alpha, beta)}$`, `Since $f(g(x)) \\ne x$, the functions are not inverses.`);
    candidates.push(YES, no(alpha, beta.neg()), no(alpha.neg(), beta), no(new Frac(1), new Frac(b)));
  } else {
    fTex = prob.fn.tex;
    gTex = prob.inv.tex;
    answer = YES;
    steps.push(`Substitute $g$ into $f$ and simplify: $f(g(x)) = x$`, `Substitute $f$ into $g$ and simplify: $g(f(x)) = x$`, 'Both compositions give $x$, so the functions are inverses.');
    const k = rng.signedInt(1, 6, true);
    candidates.push(no(new Frac(1), new Frac(k)), no(new Frac(-1), new Frac(0)), no(new Frac(2), new Frac(-k)), no(new Frac(1), new Frac(2 * k)));
  }
  const distractors = distinctDistractors(answer, candidates, (n) => no(new Frac(1), new Frac(n * 7)));
  return {
    question: `Are ${m(`f(x) = ${fTex}`)} and ${m(`g(x) = ${gTex}`)} inverses?`,
    answer,
    steps,
    distractors,
    check: { kind: 'alg2-quadratics-functions.inverseVerify' },
  };
}
