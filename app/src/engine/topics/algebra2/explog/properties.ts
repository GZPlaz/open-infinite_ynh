/** Properties of logarithms: expanding, condensing, and writing logs in terms of others. */
import { Frac, lcm } from '../../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, offset, strOpt } from '../../../generator';
import type { Rng } from '../../../rng';
import { sum, type Term } from '../../../tex';
import type { Difficulty, ProblemContent } from '../../../types';
import { CATEGORY, fr, logOp, type Base } from './common';

// ------------------------------------------------------------ expand / condense

interface LogSum {
  b: Base;
  /** coefficient of log_b of each variable */
  coefs: Array<{ v: string; c: Frac }>;
  /** integer constant (log_b of b^K) */
  K: number;
}

function expandedTex(s: LogSum): string {
  const terms: Term[] = [{ coef: s.K }, ...s.coefs.map((t) => ({ coef: t.c, sym: `${logOp(s.b)} ${t.v}` }))];
  return sum(terms);
}

/** Single logarithm: log_b of (product / product), under a root when the coefficients share a denominator. */
function condensedTex(s: LogSum): string {
  const n = s.coefs.reduce((acc, t) => lcm(acc, t.c.d), 1);
  const powF = (v: string, e: number) => (e === 1 ? v : `${v}^{${e}}`);
  const numer: string[] = [];
  const denom: string[] = [];
  const bv = s.b === 'e' ? null : s.b.value;
  if (s.K !== 0 && bv !== null) (s.K > 0 ? numer : denom).push(String(bv ** Math.abs(s.K)));
  for (const t of s.coefs) {
    const e = t.c.mul(n).value;
    if (e > 0) numer.push(powF(t.v, e));
    else if (e < 0) denom.push(powF(t.v, -e));
  }
  const join = (fs: string[]) => fs.reduce((acc, f) => (acc === '' ? f : /\d$/.test(acc) && /^[a-z]/.test(f) ? `${acc}${f}` : `${acc} ${f}`), '');
  const top = numer.length ? join(numer) : '1';
  let inner = denom.length ? `\\frac{${top}}{${join(denom)}}` : top;
  let wrap = !denom.length && numer.length > 1;
  if (n > 1) {
    inner = n === 2 ? `\\sqrt{${inner}}` : `\\sqrt[${n}]{${inner}}`;
    wrap = false;
  }
  return `${logOp(s.b)} ${wrap ? `(${inner})` : inner}`;
}

function pickLogSum(rng: Rng, d: Difficulty): LogSum {
  return attempt('log-sum', () => {
    const bases: Base[] = [fr(2), fr(3), fr(4), fr(5), fr(6), fr(7), fr(8), fr(9), fr(10)];
    if (d !== 'easy') bases.push('e', fr(10));
    const b = rng.pick(bases);
    const nv = d === 'easy' ? 2 : rng.int(2, 3);
    const vars = ['x', 'y', 'z'].slice(0, nv);
    const n = d === 'hard' && rng.bool(0.6) ? rng.pick([2, 3]) : 1;
    const coefs = vars.map((v) => {
      const e = d === 'easy' ? rng.int(1, 5) * (rng.bool(0.3) ? -1 : 1) : rng.signedInt(1, 6, true);
      return { v, c: new Frac(e, n) };
    });
    if (n > 1 && coefs.every((t) => t.c.isInt())) return null;
    if (coefs[0]!.c.sign < 0) return null;
    let K = 0;
    if (d !== 'easy' && b !== 'e' && n === 1 && rng.bool(0.45)) {
      K = rng.signedInt(1, b.value <= 3 ? 3 : 2, true);
      if (b.value ** Math.abs(K) > 1000) return null;
    }
    if (d === 'easy' && coefs.every((t) => t.c.eq(1))) return null;
    return { b, coefs, K };
  });
}

export const logProperties = defineTopic({
  id: 'alg2.explog.properties',
  subject: 'algebra2',
  category: CATEGORY,
  title: 'Properties of Logarithms',
  description: 'Expand logarithms with the product, quotient and power rules, or condense sums of logs into one logarithm.',
  instruction: (o) =>
    o.task === 'expand' ? 'Expand each logarithm.' : o.task === 'condense' ? 'Condense each expression to a single logarithm.' : 'Expand or condense each expression as indicated.',
  multipleChoice: true,
  defaultCount: 12,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Task',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'Expand and condense' },
        { value: 'expand', label: 'Expand only' },
        { value: 'condense', label: 'Condense only' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty: d } = ctx;
    const task = strOpt(ctx, 'task');
    const expand = task === 'expand' ? true : task === 'condense' ? false : rng.bool();
    const s = pickLogSum(rng, d);
    const [qf, af] = expand ? [condensedTex, expandedTex] : [expandedTex, condensedTex];
    const answer = m$(af(s));
    const n = s.coefs.reduce((acc, t) => lcm(acc, t.c.d), 1);
    const variants: LogSum[] = [
      { ...s, coefs: s.coefs.map((t) => ({ ...t, c: t.c.abs() })) },
      { ...s, coefs: s.coefs.map((t) => ({ ...t, c: t.c.mul(n > 1 ? n : 1).mul(n > 1 ? 1 : -1) })) },
      { ...s, coefs: s.coefs.map((t) => ({ ...t, c: new Frac(t.c.sign) })) },
      { ...s, coefs: s.coefs.map((t, i, all) => ({ ...t, c: all[(i + 1) % all.length]!.c })) },
      { ...s, K: -s.K },
    ];
    const distractors = distinctDistractors(
      answer,
      variants.map((x) => m$(af(x))),
      (k) => m$(af({ ...s, coefs: s.coefs.map((t, i) => (i === 0 ? { ...t, c: t.c.add(offset(k)).isZero() ? t.c.add(5) : t.c.add(offset(k)) } : t)) })),
    );
    const steps = expand
      ? [
          'Product rule: the log of a product is a sum; quotient rule: the log of a quotient is a difference; power rule: exponents (and roots) become coefficients.',
          m$(`${condensedTex(s)} = ${expandedTex(s)}`),
        ]
      : [
          'Power rule: move each coefficient into the argument as an exponent; then combine sums as products and differences as quotients.',
          m$(`${expandedTex(s)} = ${condensedTex(s)}`),
        ];
    const label = task === 'mixed' || task === '' ? (expand ? 'Expand: ' : 'Condense: ') : '';
    return { question: `${label}${m$(qf(s))}`, answer, steps, distractors, check: { kind: 'equivalent', vars: ['x', 'y', 'z'], positive: true } };
  },
});

function m$(t: string): string {
  return `$${t}$`;
}

// ------------------------------------------------------------ writing logs in terms of others

const LETTERS = ['A', 'B', 'C'] as const;
const PRIMES = [2, 3, 5] as const;

export const logsInTermsOfOthers = defineTopic({
  id: 'alg2.explog.in-terms-of-others',
  subject: 'algebra2',
  category: CATEGORY,
  title: 'Writing Logs in Terms of Others',
  description: 'Given log_b 2 = A and log_b 3 = B (and log_b 5 = C), write logarithms such as log_b 18 in terms of A, B and C.',
  instruction: 'Write each logarithm in terms of the given values.',
  multipleChoice: true,
  defaultCount: 10,
  options: [{ type: 'boolean', id: 'generalBase', label: 'Use a general base b', default: false }],
  generate(ctx): ProblemContent {
    const { rng, difficulty: d } = ctx;
    const general = boolOpt(ctx, 'generalBase');
    const p = attempt('in-terms', () => {
      const base = general ? 'b' : String(rng.pick([7, 11, 13]));
      const np = d === 'hard' && rng.bool(0.6) ? 3 : 2;
      const exps = PRIMES.slice(0, np).map(() => (d === 'easy' ? rng.int(0, 4) : rng.int(-3, 3)));
      const t0 = d === 'easy' ? 0 : rng.bool(0.35) ? rng.signedInt(1, 2, true) : 0;
      const root = d === 'hard' && rng.bool(0.45) ? rng.pick([2, 3]) : 1;
      if (exps.filter((e) => e !== 0).length + (t0 ? 1 : 0) < (d === 'easy' ? 1 : 2)) return null;
      if (np === 3 && exps[2] === 0) return null;
      if (d === 'easy' && exps.reduce((s, e) => s + e, 0) < 2) return null;
      const num: string[] = [];
      const den: string[] = [];
      let numV = 1;
      let denV = 1;
      exps.forEach((e, i) => {
        if (e > 0) numV *= PRIMES[i]! ** e;
        if (e < 0) denV *= PRIMES[i]! ** -e;
      });
      const bPow = (k: number) => (k === 1 ? base : `${base}^{${k}}`);
      if (general) {
        if (numV > 1 || t0 <= 0) num.push(String(numV));
        if (t0 > 0) num.push(bPow(t0));
        if (denV > 1) den.push(String(denV));
        if (t0 < 0) den.push(bPow(-t0));
      } else {
        const B = Number(base);
        numV *= t0 > 0 ? B ** t0 : 1;
        denV *= t0 < 0 ? B ** -t0 : 1;
        num.push(String(numV));
        if (denV > 1) den.push(String(denV));
      }
      if (numV * denV > 2000) return null;
      const numT = num.join('');
      let arg = den.length ? `\\frac{${numT}}{${den.join('')}}` : numT;
      if (root > 1) arg = root === 2 ? `\\sqrt{${arg}}` : `\\sqrt[${root}]{${arg}}`;
      const wrapArg = !den.length && root === 1 && num.length > 1;
      return { base, np, exps, t0, root, arg: wrapArg ? `(${arg})` : arg };
    });
    const { base, np, exps, t0, root, arg } = p;
    const op = `\\log_{${base}}`;
    const coefs = exps.map((e) => new Frac(e, root));
    const render = (cs: Frac[], k: Frac) => sum([...cs.map((c, i) => ({ coef: c, sym: LETTERS[i]! })), { coef: k }]);
    const answerTex = render(coefs, new Frac(t0, root));
    const answer = m$(answerTex);
    const givens = PRIMES.slice(0, np).map((q, i) => m$(`${op} ${q} = ${LETTERS[i]}`));
    const givenText = givens.length === 2 ? `${givens[0]} and ${givens[1]}` : `${givens[0]}, ${givens[1]} and ${givens[2]}`;
    const question = `Use ${givenText}: ${m$(`${op} ${arg}`)}`;
    const factorText = exps
      .map((e, i) => (e === 0 ? null : e === 1 ? String(PRIMES[i]) : `${PRIMES[i]}^{${e}}`))
      .filter(Boolean)
      .concat(t0 ? [t0 === 1 ? base : `${base}^{${t0}}`] : [])
      .join(' \\cdot ');
    const steps = [
      `Factor the argument into primes${t0 ? ' and powers of the base' : ''}: ${m$(factorText)}${root > 1 ? `, under a root of index ${root}` : ''}.`,
      `Expand with the log properties (${m$(`${op} ${base} = 1`)}).`,
      m$(`${op} ${arg} = ${answerTex}`),
    ];
    const k0 = new Frac(t0, root);
    const variants: Array<[Frac[], Frac]> = [
      [coefs.map((c) => c.abs()), k0.abs()],
      [coefs.map((c) => new Frac(c.sign)), k0],
      [coefs.map((_c, i) => coefs[(i + 1) % coefs.length]!), k0],
      [coefs, k0.isZero() ? new Frac(1) : new Frac(0)],
      [coefs.map((c) => c.mul(root)), new Frac(t0)],
    ];
    const distractors = distinctDistractors(
      answer,
      variants.map(([cs, k]) => m$(render(cs, k))),
      (j) => m$(render(coefs.map((c, i) => (i === 0 ? c.add(offset(j)) : c)), k0)),
    );
    return { question, answer, steps, distractors, check: { kind: 'alg2-explog.terms' } };
  },
});
