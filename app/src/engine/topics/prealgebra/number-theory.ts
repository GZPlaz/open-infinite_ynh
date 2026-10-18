/** Number theory: divisibility, prime factorization (with factor trees), GCF and LCM. */
import { DiagramBuilder, type Diagram } from '../../diagram';
import { gcd, lcm } from '../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, offset, strOpt } from '../../generator';
import type { Rng } from '../../rng';
import { m, pow } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { CAT, groupDigits } from './common';

export function primeFactors(n: number): number[] {
  const out: number[] = [];
  for (let f = 2; f * f <= n; f++) {
    while (n % f === 0) {
      out.push(f);
      n /= f;
    }
  }
  if (n > 1) out.push(n);
  return out;
}

/** `2^{3} \cdot 3^{2} \cdot 5` from a multiset of primes. */
function exponentForm(ps: number[]): string {
  const counts = new Map<number, number>();
  for (const p of [...ps].sort((a, b) => a - b)) counts.set(p, (counts.get(p) ?? 0) + 1);
  return [...counts].map(([p, k]) => (k === 1 ? String(p) : `${p}^{${k}}`)).join(' \\cdot ');
}

function expandedForm(ps: number[]): string {
  return [...ps].sort((a, b) => a - b).join(' \\cdot ');
}

/** Factor tree: split off the smallest prime at each level. */
function factorTree(n: number): Diagram {
  const b = new DiagramBuilder(24);
  let x = 0;
  let y = 0;
  let v = n;
  b.label([x, y], groupDigits(String(v)), 'c');
  while (primeFactors(v).length > 1) {
    const p = primeFactors(v)[0]!;
    const rest = v / p;
    const L: [number, number] = [x - 0.9, y - 1.3];
    const R: [number, number] = [x + 0.9, y - 1.3];
    b.segment([x - 0.15, y - 0.35], [L[0] + 0.15, L[1] + 0.4], { weight: 1 });
    b.segment([x + 0.15, y - 0.35], [R[0] - 0.15, R[1] + 0.4], { weight: 1 });
    b.label(L, String(p), 'c');
    b.circle(L, 0.45, { ink: 'accent', weight: 1 });
    b.label(R, String(rest), 'c');
    if (primeFactors(rest).length === 1) b.circle(R, 0.45, { ink: 'accent', weight: 1 });
    [x, y, v] = [R[0], R[1], rest];
  }
  return b.build(`Factor tree for ${n}`, 8);
}

const DIVISORS = [2, 3, 4, 5, 6, 9, 10];

function listTex(ds: number[]): string {
  return ds.length ? m(ds.join(', ')) : 'None of them';
}

export const primeFactorization = defineTopic({
  id: 'prealg.prime-factorization',
  subject: 'prealgebra',
  category: CAT.numberTheory,
  title: 'Divisibility and Prime Factorization',
  description: 'Apply divisibility rules, and write numbers as products of primes (with factor trees).',
  instruction: (o) =>
    o.task === 'divisibility'
      ? 'State which of 2, 3, 4, 5, 6, 9 and 10 divide each number.'
      : o.form === 'expanded'
        ? 'Write the prime factorization of each number.'
        : 'Write the prime factorization of each number. Use exponents for repeated factors.',
  multipleChoice: true,
  defaultCount: 12,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Task',
      default: 'factor',
      choices: [
        { value: 'factor', label: 'Prime factorization' },
        { value: 'divisibility', label: 'Divisibility rules' },
      ],
    },
    {
      type: 'select',
      id: 'form',
      label: 'Factorization form',
      default: 'exponent',
      choices: [
        { value: 'exponent', label: 'Exponent form (2³ · 5)' },
        { value: 'expanded', label: 'Expanded (2 · 2 · 2 · 5)' },
      ],
    },
    { type: 'boolean', id: 'tree', label: 'Factor tree in the answer key', default: true },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    if (strOpt(ctx, 'task') === 'divisibility') return divisibility(rng, difficulty);
    const expanded = strOpt(ctx, 'form') === 'expanded';
    const cfg = {
      easy: { primes: [2, 2, 3, 3, 5, 7], count: [2, 4], lo: 12, hi: 100 },
      medium: { primes: [2, 2, 3, 3, 5, 7], count: [3, 5], lo: 60, hi: 600 },
      hard: { primes: [2, 2, 3, 3, 5, 7, 11, 13], count: [4, 7], lo: 200, hi: 3000 },
    }[difficulty];
    const ps = attempt('prime-factorization', () => {
      const k = rng.int(cfg.count[0]!, cfg.count[1]!);
      const ps = Array.from({ length: k }, () => rng.pick(cfg.primes));
      const n = ps.reduce((a, b) => a * b, 1);
      if (n < cfg.lo || n > cfg.hi) return null;
      if (new Set(ps).size === 1 && difficulty !== 'easy') return null;
      return ps.sort((a, b) => a - b);
    });
    const n = ps.reduce((a, b) => a * b, 1);
    const render = expanded ? expandedForm : exponentForm;
    const answer = m(render(ps));
    // mistakes: a composite left in the product, one factor too many / too few, a wrong prime
    const composite = ps.length >= 3 ? `${ps[0]! * ps[1]!} \\cdot ${render(ps.slice(2))}` : null;
    const extra = render([...ps, ps[0]!]);
    const fewer = ps.length > 2 ? render(ps.slice(1)) : null;
    const wrongPrime = render([...ps.slice(0, -1), ps.at(-1)! === 2 ? 3 : ps.at(-1)! + 2]);
    const distractors = distinctDistractors(answer, [composite ? m(composite) : null, m(extra), fewer ? m(fewer) : null, m(wrongPrime)], (k) =>
      m(render([...ps, ...Array.from({ length: k }, () => 3)])),
    );
    const steps: string[] = [];
    let v = n;
    for (const p of ps.slice(0, -1)) {
      steps.push(m(`${v} = ${p} \\cdot ${v / p}`));
      v /= p;
    }
    steps.push(`So $${groupDigits(String(n))} = ${render(ps)}$.`);
    return {
      question: m(groupDigits(String(n))),
      answer,
      steps,
      distractors,
      answerDiagram: boolOpt(ctx, 'tree') ? factorTree(n) : undefined,
      check: { kind: 'prealgebra.primeFactors', form: expanded ? 'expanded' : 'exponent' },
    };
  },
});

function divisibility(rng: Rng, d: Difficulty): ProblemContent {
  const n = attempt('divisibility', () => {
    const base = d === 'easy' ? rng.int(4, 60) : d === 'medium' ? rng.int(20, 400) : rng.int(200, 4000);
    const n = base * rng.pick([1, 2, 3, 4, 5, 6, 9, 10, 12, 15, 18, 30]);
    const max = d === 'easy' ? 500 : d === 'medium' ? 5000 : 50000;
    return n < 30 || n > max ? null : n;
  });
  const yes = DIVISORS.filter((k) => n % k === 0);
  const answer = listTex(yes);
  const toggled = (k: number) => (yes.includes(k) ? yes.filter((x) => x !== k) : [...yes, k].sort((a, b) => a - b));
  // the most tempting slips first: 4 vs 2, 9 vs 3, 6, 10 vs 5
  const order = [4, 9, 6, 10, 2, 3, 5];
  const distractors = distinctDistractors(answer, order.map((k) => listTex(toggled(k))), () => null);
  const digitSum = String(n)
    .split('')
    .reduce((s, c) => s + Number(c), 0);
  const steps = [
    `Last digit $${n % 10}$; last two digits $${n % 100}$; digit sum $${digitSum}$.`,
    yes.length ? `Divisible by $${yes.join(', ')}$.` : 'Divisible by none of them.',
  ];
  return { question: m(groupDigits(String(n))), answer, steps, distractors, check: { kind: 'prealgebra.divisibility' } };
}

// ---------------------------------------------------------------- GCF and LCM

interface Mono {
  c: number;
  e: number[];
}

function monoTex(mo: Mono, vars: string[]): string {
  const body = vars.map((v, i) => pow(v, mo.e[i]!)).join('');
  if (!body) return String(mo.c);
  return mo.c === 1 ? body : `${mo.c}${body}`;
}

export const gcfLcm = defineTopic({
  id: 'prealg.gcf-lcm',
  subject: 'prealgebra',
  category: CAT.numberTheory,
  title: 'Greatest Common Factor and Least Common Multiple',
  description: 'Find the GCF or LCM of two or three numbers (optionally monomials).',
  instruction: (o) => (o.task === 'gcf' ? 'Find the greatest common factor (GCF) of each.' : o.task === 'lcm' ? 'Find the least common multiple (LCM) of each.' : 'Find the GCF or LCM as indicated.'),
  multipleChoice: true,
  defaultCount: 12,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Find',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'GCF and LCM' },
        { value: 'gcf', label: 'GCF only' },
        { value: 'lcm', label: 'LCM only' },
      ],
    },
    { type: 'boolean', id: 'monomials', label: 'Include variables (monomials)', default: false },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const choice = strOpt(ctx, 'task');
    const task = choice === 'mixed' ? rng.pick(['gcf', 'lcm'] as const) : (choice as 'gcf' | 'lcm');
    const monomials = boolOpt(ctx, 'monomials');
    const count = difficulty === 'hard' && rng.bool(0.6) ? 3 : 2;
    const nums = attempt('gcf-lcm', () => {
      let xs: number[];
      if (task === 'gcf') {
        const g = rng.int(2, difficulty === 'easy' ? 9 : difficulty === 'medium' ? 15 : 20);
        const ms = Array.from({ length: count }, () => rng.int(1, difficulty === 'easy' ? 6 : difficulty === 'medium' ? 8 : 12));
        if (ms.reduce((a, b) => gcd(a, b), 0) !== 1 || new Set(ms).size !== count) return null;
        xs = ms.map((k) => k * g);
      } else {
        const hi = difficulty === 'easy' ? 15 : difficulty === 'medium' ? 30 : 24;
        xs = Array.from({ length: count }, () => rng.int(2, hi));
        if (new Set(xs).size !== count) return null;
        const L = xs.reduce((a, b) => lcm(a, b), 1);
        if (L > (difficulty === 'easy' ? 90 : 400) || xs.includes(L)) return null;
        if (xs.reduce((a, b) => a * b, 1) === L && rng.bool(0.6)) return null; // prefer pairs sharing a factor
      }
      return xs;
    });
    const G = nums.reduce((a, b) => gcd(a, b), 0);
    const L = nums.reduce((a, b) => lcm(a, b), 1);
    const vars = rng.pick([['x', 'y'], ['a', 'b'], ['m', 'n'], ['x', 'y']]);
    const monos: Mono[] = nums.map((c) => ({ c, e: monomials ? vars.map(() => rng.int(0, 4)) : [0, 0] }));
    if (monomials) monos.forEach((mo) => mo.e.every((e) => e === 0) && (mo.e[rng.int(0, 1)] = rng.int(1, 3)));
    const minE = vars.map((_, i) => Math.min(...monos.map((mo) => mo.e[i]!)));
    const maxE = vars.map((_, i) => Math.max(...monos.map((mo) => mo.e[i]!)));
    const res: Mono = task === 'gcf' ? { c: G, e: minE } : { c: L, e: maxE };
    const answer = m(monoTex(res, vars));
    const label = choice === 'mixed' ? `${task.toUpperCase()}: ` : '';
    const question = `${label}$${monos.map((mo) => monoTex(mo, vars)).join(', ')}$`;
    const product = nums.reduce((a, b) => a * b, 1);
    const smallerFactor = primeFactors(G).length > 1 ? G / primeFactors(G)[0]! : 1;
    const otherE = task === 'gcf' ? maxE : minE;
    const cands: Mono[] =
      task === 'gcf'
        ? [{ c: smallerFactor, e: minE }, { c: G, e: otherE }, { c: L, e: minE }, { c: G * 2, e: minE }]
        : [{ c: product, e: maxE }, { c: L, e: otherE }, { c: G, e: maxE }, { c: L * 2, e: maxE }];
    const distractors = distinctDistractors(
      answer,
      cands.map((c) => (c.c === 1 && c.e.every((e) => e === 0) ? null : m(monoTex(c, vars)))),
      (k) => m(monoTex({ c: res.c + offset(k) * (task === 'gcf' ? 1 : G), e: res.e }, vars)),
    );
    const steps = [
      ...nums.map((n) => m(`${n} = ${primeFactors(n).length > 1 ? exponentForm(primeFactors(n)) : String(n)}`)),
      task === 'gcf' ? 'Take each common prime factor (and variable) to its lowest power.' : 'Take every prime factor (and variable) to its highest power.',
      `${task.toUpperCase()} $= ${monoTex(res, vars)}$`,
    ];
    return { question, answer, steps, distractors, check: { kind: 'prealgebra.gcfLcm', task } };
  },
});
