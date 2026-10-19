/** Logarithm basics: forms, evaluating, inverse properties. */
import { Frac } from '../../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, offset, pickVar, strOpt } from '../../../generator';
import type { Rng } from '../../../rng';
import { decimal, linear, m, num, term } from '../../../tex';
import type { Difficulty, ProblemContent } from '../../../types';
import { CATEGORY, fr, isAtomic, isRationalLog, powBase } from './common';
import { inverseProblem, pickInvFn } from './inverses';

const MAXPOW: Record<number, number> = { 2: 9, 3: 6, 4: 4, 5: 4, 6: 3, 7: 3, 8: 3, 9: 3, 10: 4 };

// ------------------------------------------------------------ exponential ↔ logarithmic form

/** b^c = a, each part as LaTeX. `b` is 'e', '10' or any other base. */
interface Triple {
  b: string;
  a: string;
  c: string;
}

function logBase(b: string): string {
  if (b === 'e') return '\\ln';
  if (b === '10') return '\\log';
  return `\\log_{${b}}`;
}

function logForm(t: Triple): string {
  return `${logBase(t.b)} ${isAtomic(t.a) ? t.a : `(${t.a})`} = ${t.c}`;
}

function expForm(t: Triple): string {
  return `${powBase(t.b)}^{${t.c}} = ${t.a}`;
}

const recip = (n: number) => `\\frac{1}{${n}}`;

function pickTriple(rng: Rng, d: Difficulty, v: string): Triple {
  return attempt('forms', () => {
    const intBase = () => rng.int(2, 9);
    const kind = rng.pick(
      d === 'easy' ? ['int', 'int', 'int'] : d === 'medium' ? ['neg', 'ten', 'frac', 'var', 'int'] : ['rational', 'rational', 'lnVar', 'nonperfect', 'varBase', 'neg'],
    );
    switch (kind) {
      case 'int': {
        const b = rng.int(2, 13);
        const c = rng.int(2, 5);
        if (b ** c > 1000) return null;
        return { b: String(b), a: String(b ** c), c: String(c) };
      }
      case 'neg': {
        const b = intBase();
        const c = rng.int(1, 3);
        if (b ** c > 1000) return null;
        return { b: String(b), a: recip(b ** c), c: String(-c) };
      }
      case 'ten': {
        const c = rng.intExcept(-3, 4, [0, 1]);
        return { b: '10', a: c > 0 ? String(10 ** c) : (10 ** c).toFixed(-c), c: String(c) };
      }
      case 'frac': {
        const b = rng.int(2, 5);
        const c = rng.intExcept(-3, 3, [0, 1, -1]);
        if (b ** Math.abs(c) > 1000) return null;
        return { b: recip(b), a: c > 0 ? recip(b ** c) : String(b ** -c), c: String(c) };
      }
      case 'var': {
        const b = intBase();
        return { b: String(b), a: v, c: String(rng.int(2, 6)) };
      }
      case 'rational': {
        const cBase = rng.pick([2, 3, 2, 5]);
        const den = rng.int(2, cBase === 2 ? 4 : 3);
        const B = cBase ** den;
        const nn = rng.signedInt(1, den + 2, true);
        if (nn % den === 0 || B > 625) return null;
        const A = cBase ** Math.abs(nn);
        if (A > 1000) return null;
        return { b: String(B), a: nn > 0 ? String(A) : recip(A), c: new Frac(nn, den).toTex() };
      }
      case 'lnVar':
        return rng.bool() ? { b: 'e', a: v, c: String(rng.intExcept(-4, 7, [0, 1])) } : { b: 'e', a: String(rng.int(2, 60)), c: v };
      case 'nonperfect': {
        const b = intBase();
        const n = rng.int(2, 99);
        if (isRationalLog(n, b)) return null;
        return { b: String(b), a: String(n), c: v };
      }
      default: {
        const base = rng.int(2, 6);
        const c = rng.int(2, 4);
        if (base ** c > 1000) return null;
        return { b: v, a: String(base ** c), c: String(c) };
      }
    }
  });
}

export const expLogForms = defineTopic({
  id: 'alg2.explog.exp-log-forms',
  subject: 'algebra2',
  category: CATEGORY,
  title: 'Exponents and Logarithms',
  description: 'Rewrite logarithmic equations in exponential form and exponential equations in logarithmic form.',
  instruction: (o) =>
    o.direction === 'toExp'
      ? 'Rewrite each equation in exponential form.'
      : o.direction === 'toLog'
        ? 'Rewrite each equation in logarithmic form.'
        : 'Rewrite each logarithmic equation in exponential form and each exponential equation in logarithmic form.',
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
        { value: 'toExp', label: 'Logarithmic → exponential' },
        { value: 'toLog', label: 'Exponential → logarithmic' },
      ],
    },
    { type: 'boolean', id: 'variedVars', label: 'Vary the variable letter', default: false },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty: d } = ctx;
    const v = pickVar(rng, boolOpt(ctx, 'variedVars'));
    const dir = strOpt(ctx, 'direction');
    const toExp = dir === 'toExp' ? true : dir === 'toLog' ? false : rng.bool();
    const t = pickTriple(rng, d, v);
    const [qf, af] = toExp ? [logForm, expForm] : [expForm, logForm];
    const answer = m(af(t));
    const swaps: Triple[] = toExp
      ? [{ b: t.c, a: t.a, c: t.b }, { b: t.a, a: t.b, c: t.c }, { b: t.b, a: t.c, c: t.a }]
      : [{ b: t.a, a: t.b, c: t.c }, { b: t.b, a: t.c, c: t.a }, { b: t.c, a: t.a, c: t.b }];
    const distractors = distinctDistractors(
      answer,
      swaps.map((s) => m(af(s))),
      (k) => m(af({ ...t, c: `${t.c} ${offset(k) > 0 ? '+' : '-'} ${Math.abs(offset(k))}` })),
    );
    const steps = toExp
      ? [`${m(`${logBase(t.b)} a = c`)} means ${m(`${powBase(t.b)}^{c} = a`)}: the base raised to the logarithm gives the argument.`, answer]
      : [`${m(`${powBase(t.b)}^{c} = a`)} means ${m(`${logBase(t.b)} a = c`)}: the logarithm is the exponent.`, answer];
    return { question: m(qf(t)), answer, steps, distractors, check: { kind: 'alg2-explog.forms' } };
  },
});

// ------------------------------------------------------------ evaluating logarithms

/** c^n as an argument: integer, fraction, decimal (base 10) or root. */
function powerArg(c: number | 'e', n: Frac): string {
  const p = n.n;
  const q = n.d;
  if (c === 'e') {
    const core = Math.abs(p) === 1 ? 'e' : `e^{${Math.abs(p)}}`;
    const root = q === 1 ? core : q === 2 ? `\\sqrt{${core}}` : `\\sqrt[${q}]{${core}}`;
    return p > 0 ? root : `\\frac{1}{${root}}`;
  }
  const big = c ** Math.abs(p);
  if (q === 1) {
    if (p >= 0) return String(big);
    return c === 10 ? (10 ** p).toFixed(-p) : recip(big);
  }
  const root = q === 2 ? `\\sqrt{${big}}` : `\\sqrt[${q}]{${big}}`;
  return p > 0 ? root : `\\frac{1}{${root}}`;
}

export const evaluateLogs = defineTopic({
  id: 'alg2.explog.evaluate',
  subject: 'algebra2',
  category: CATEGORY,
  title: 'Evaluating Logarithms',
  description: 'Evaluate logarithms exactly (log₂ 32, log_(1/3) 9, log 0.001, ln e⁵); optionally with a calculator.',
  instruction: (o) => (o.calculator ? 'Evaluate each expression. Round to the nearest thousandth when the value is not exact.' : 'Evaluate each expression.'),
  multipleChoice: true,
  defaultCount: 12,
  options: [{ type: 'boolean', id: 'calculator', label: 'Include calculator problems (hard)', default: true }],
  generate(ctx): ProblemContent {
    const { rng, difficulty: d } = ctx;
    if (d === 'hard' && boolOpt(ctx, 'calculator') && rng.bool(0.35)) return calculatorLog(rng);
    const p = attempt('eval-log', () => {
      const kind = rng.pick(d === 'easy' ? ['int'] : d === 'medium' ? ['neg', 'fracBase', 'ten', 'ln', 'int'] : ['powBase', 'powBase', 'root', 'lnRoot', 'fracBase']);
      let c: number | 'e' = rng.pick([2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 10]);
      let mm = 1;
      let n = new Frac(rng.int(1, 5));
      if (kind === 'int') n = new Frac(rng.bool(0.08) ? 0 : rng.int(1, 6));
      else if (kind === 'neg') n = new Frac(-rng.int(1, 4));
      else if (kind === 'fracBase') {
        c = rng.int(2, 6);
        mm = -1;
        n = new Frac(rng.signedInt(1, 4, true));
      } else if (kind === 'ten') {
        c = 10;
        n = new Frac(rng.intExcept(-4, 5, [0]));
      } else if (kind === 'ln') {
        c = 'e';
        n = new Frac(rng.intExcept(-4, 8, [0]));
      } else if (kind === 'powBase') {
        c = rng.pick([2, 3, 5, 2]);
        mm = rng.int(2, c === 2 ? 4 : 3);
        n = new Frac(rng.signedInt(1, 7, true));
        if (n.n % mm === 0) return null;
      } else if (kind === 'root') {
        c = rng.pick([2, 3, 5, 7]);
        n = new Frac(rng.signedInt(1, 5, true), rng.int(2, 3));
        if (n.isInt()) return null;
      } else {
        c = 'e';
        n = new Frac(rng.signedInt(1, 4, true), rng.int(2, 3));
        if (n.isInt()) return null;
      }
      if (c !== 'e') {
        if (Math.abs(mm) > 1 && c ** mm > 125) return null;
        if (Math.abs(n.n) > (MAXPOW[c] ?? 3)) return null;
      }
      return { c, mm, n };
    });
    const { c, mm, n } = p;
    const baseT = c === 'e' ? 'e' : mm === 1 ? String(c) : mm === -1 ? recip(c) : String(c ** mm);
    const op = c === 'e' ? '\\ln' : baseT === '10' ? '\\log' : `\\log_{${baseT}}`;
    const arg = powerArg(c, n);
    const question = `${op} ${arg}`;
    const val = n.div(mm);
    const answer = m(num(val));
    const cT = c === 'e' ? 'e' : String(c);
    const steps = [
      `Write the base and the argument as powers of ${m(cT)}: ${m(`${powBase(baseT)} = ${mm === 1 ? cT : `${cT}^{${mm}}`}`)}, ${m(`${arg} = ${n.eq(1) ? cT : `${cT}^{${n.toTex()}}`}`)}`,
      `Solve ${m(`${powBase(baseT)}^{y} = ${arg}`)}: ${m(`${term(mm, 'y')} = ${n.toTex()}`)}`,
      `${m(`${question} = ${num(val)}`)}`,
    ];
    const cands = [val.neg(), val.isZero() ? fr(1) : val.inv(), val.add(1), val.sub(1), val.mul(2), fr(c === 'e' ? 3 : c)];
    const distractors = distinctDistractors(answer, cands.map((f) => m(num(f))), (k) => m(num(val.add(offset(k) + (k > 2 ? 1 : 0)))));
    return { question: m(question), answer, steps, distractors, check: { kind: 'alg2-explog.num' } };
  },
});

function calculatorLog(rng: Rng): ProblemContent {
  const p = attempt('calc-log', () => {
    const b = rng.pick<number | 'e'>([2, 3, 4, 5, 6, 7, 8, 9, 10, 'e']);
    const N = rng.bool(0.25) ? new Frac(rng.int(1, 30), rng.int(2, 9)) : new Frac(rng.int(2, 250));
    const bv = b === 'e' ? Math.E : b;
    if (N.eq(1) || isRationalLog(N.value, bv)) return null;
    return { b, N, bv };
  });
  const { b, N, bv } = p;
  const op = b === 'e' ? '\\ln' : b === 10 ? '\\log' : `\\log_{${b}}`;
  const question = `${op} ${N.toTex()}`;
  const val = Math.log(N.value) / Math.log(bv);
  const r = (x: number) => m(`\\approx ${decimal(x, 3)}`);
  const answer = r(val);
  const steps =
    b === 'e' || b === 10
      ? [`Use the ${m(b === 'e' ? '\\ln' : '\\log')} key: ${m(`${question} \\approx ${decimal(val, 3)}`)}`]
      : [`Change of base: ${m(`${question} = \\frac{\\log ${N.toTex()}}{\\log ${b}}`)}`, m(`\\approx ${decimal(val, 3)}`)];
  const distractors = distinctDistractors(
    answer,
    [r(1 / val), r(Math.log10(N.value) - Math.log10(bv)), r(Math.log(N.value)), r(N.value / bv)],
    (k) => r(val + 0.1 * offset(k)),
  );
  return { question: m(question), answer, steps, distractors, check: { kind: 'alg2-explog.num', places: 3 } };
}

// ------------------------------------------------------------ logarithms and exponents as inverses

interface Simp {
  q: string;
  a: string;
  wrong: string[];
}

function simplifyForm(rng: Rng, d: Difficulty, v: string): Simp {
  const b = rng.int(2, 9);
  const lin = () => linear(rng.int(2, 6), rng.signedInt(1, 9, true), v);
  const forms: Array<() => Simp> =
    d === 'easy'
      ? [
          () => ({ q: `${b}^{\\log_{${b}} ${v}}`, a: v, wrong: [`${b}^{${v}}`, `${b}${v}`, `\\log_{${b}} ${v}`] }),
          () => ({ q: `\\log_{${b}} ${b}^{${v}}`, a: v, wrong: [`${b}${v}`, `${b}^{${v}}`, `\\frac{${v}}{${b}}`] }),
          () => {
            const N = rng.int(2, 40);
            return { q: `${b}^{\\log_{${b}} ${N}}`, a: String(N), wrong: [String(b * N), String(N + b), `\\log_{${b}} ${N}`] };
          },
          () => {
            const N = rng.int(2, 12);
            return { q: `\\log_{${b}} ${b}^{${N}}`, a: String(N), wrong: [String(b * N), String(b), String(N + 1)] };
          },
          () => {
            const L = lin();
            return { q: `\\log_{${b}} ${b}^{${L}}`, a: L, wrong: [`${b}(${L})`, `${b}^{${L}}`, linear(1, 0, v)] };
          },
        ]
      : d === 'medium'
        ? [
            () => {
              const c = rng.pick([2, 3, 5]);
              const k = rng.int(2, c === 2 ? 5 : 3);
              return { q: `\\log_{${c}} ${c ** k}^{${v}}`, a: term(k, v), wrong: [term(c ** k, v), `${v}^{${k}}`, term(c, v), term(c ** k / c, v)] };
            },
            () => {
              const c = rng.pick([2, 3, 5]);
              const k = rng.int(2, 3);
              return { q: `${c ** k}^{\\log_{${c}} ${v}}`, a: `${v}^{${k}}`, wrong: [term(k, v), term(c ** k, v), `${v}^{${c}}`] };
            },
            () => {
              const p = rng.int(2, 9);
              return { q: `\\ln e^{${p}${v}}`, a: term(p, v), wrong: [`e^{${p}${v}}`, `${p}e${v}`, `${v}^{${p}}`] };
            },
            () => {
              const N = rng.int(2, 50);
              return rng.bool()
                ? { q: `e^{\\ln ${N}}`, a: String(N), wrong: [`\\ln ${N}`, `e^{${N}}`, `${N}e`] }
                : { q: `10^{\\log ${N}}`, a: String(N), wrong: [String(10 * N), `\\log ${N}`, String(N + 10)] };
            },
            () => {
              const c = rng.pick([2, 3]);
              const k = rng.int(2, 3);
              const p = rng.int(1, 3);
              const q = rng.signedInt(1, 5, true);
              return {
                q: `\\log_{${c}} ${c ** k}^{${linear(p, q, v)}}`,
                a: linear(k * p, k * q, v),
                wrong: [linear(k * p, q, v), linear(p, k * q, v), linear(c ** k * p, c ** k * q, v)],
              };
            },
          ]
        : [
            () => {
              const c = rng.pick([2, 3]);
              const k = rng.int(2, 3);
              const q = rng.signedInt(1, 6, true);
              const L = linear(1, q, v);
              return { q: `${c ** k}^{\\log_{${c}} (${L})}`, a: `(${L})^{${k}}`, wrong: [scaledLin(k, L), `${L}`, `(${L})^{${c ** k}}`] };
            },
            () => {
              const c = rng.pick([2, 3]);
              const k = rng.int(2, 3);
              const p = rng.pick([1, 3, 5, 7, -1, -3, 5].filter((x) => x % k !== 0));
              return { q: `\\log_{${c ** k}} ${c}^{${term(p, v)}}`, a: term(new Frac(p, k), v), wrong: [term(new Frac(k, p), v), term(k * p, v), term(p, v)] };
            },
            () => {
              const k = rng.int(2, 5);
              return rng.bool()
                ? { q: `e^{${k}\\ln ${v}}`, a: `${v}^{${k}}`, wrong: [term(k, v), `${v}^{${k}e}`, `e^{${k}}${v}`] }
                : { q: `${b}^{${k}\\log_{${b}} ${v}}`, a: `${v}^{${k}}`, wrong: [term(k, v), term(b * k, v), `${v}^{${b}}`] };
            },
            () => {
              const p = rng.int(2, 7);
              const q = rng.int(1, 4);
              return { q: `\\log_{${b}} (${b}^{${p}${v}} \\cdot ${b ** q})`, a: linear(p, q, v), wrong: [linear(p, b ** q, v), term(p * q, v), linear(p, -q, v)] };
            },
            () => {
              const p = rng.intExcept(1, 7, [2, 4, 6]);
              return { q: `\\log_{${b}} \\sqrt{${b}^{${p}${v}}}`, a: term(new Frac(p, 2), v), wrong: [term(2 * p, v), term(p, v), term(new Frac(2, p), v)] };
            },
            () => {
              const N = rng.int(2, 12);
              return { q: `e^{\\ln ${v} + \\ln ${N}}`, a: term(N, v), wrong: [linear(1, N, v), `${v}^{${N}}`, `e^{${N}}${v}`] };
            },
          ];
  return rng.pick(forms)();
}

function scaledLin(k: number, L: string): string {
  return `${k}(${L})`;
}

export const logExpInverses = defineTopic({
  id: 'alg2.explog.inverse-properties',
  subject: 'algebra2',
  category: CATEGORY,
  title: 'Logarithms and Exponents as Inverses',
  description: 'Simplify b^(log_b x) and log_b b^x, and find inverses of basic exponential and logarithmic functions.',
  instruction: (o) =>
    o.task === 'simplify' ? 'Simplify each expression.' : o.task === 'inverse' ? 'Find the inverse of each function.' : 'Simplify each expression or find the inverse of each function.',
  multipleChoice: true,
  defaultCount: 12,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Problems',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'Simplify and find inverses' },
        { value: 'simplify', label: 'Simplify only' },
        { value: 'inverse', label: 'Find inverses only' },
      ],
    },
    { type: 'boolean', id: 'variedVars', label: 'Vary the variable letter (simplify problems)', default: false },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty: d } = ctx;
    const task = strOpt(ctx, 'task');
    const inverse = task === 'inverse' || (task !== 'simplify' && rng.bool(0.25));
    if (inverse) {
      const p = inverseProblem(pickInvFn(rng, d === 'hard' ? 'medium' : 'easy', rng.pick(['exp', 'log'] as const)));
      return task === 'inverse' ? p : { ...p, question: `Find the inverse: ${p.question}` };
    }
    const v = pickVar(rng, boolOpt(ctx, 'variedVars'));
    const s = simplifyForm(rng, d, v);
    const answer = m(s.a);
    const distractors = distinctDistractors(answer, s.wrong.map(m), (k) => m(`${s.a} + ${k}`));
    const steps = [
      /^\\log|^\\ln/.test(s.q)
        ? `${m(`\\log_{b} b^{u} = u`)}: the logarithm undoes the power.`
        : `${m(`b^{\\log_{b} u} = u`)}: the power undoes the logarithm.`,
      m(`${s.q} = ${s.a}`),
    ];
    return {
      question: task === 'simplify' ? m(s.q) : `Simplify: ${m(s.q)}`,
      answer,
      steps,
      distractors,
      check: { kind: 'equivalent', vars: [v], positive: true },
    };
  },
});

