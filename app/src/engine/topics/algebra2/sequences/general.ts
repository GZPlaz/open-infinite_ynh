/**
 * General sequences: terms of explicit and recursive sequences, and a
 * formula for the nth term of a simple pattern.
 */
import { Frac } from '../../../fraction';
import { attempt, defineTopic, distinctDistractors, offset, strOpt } from '../../../generator';
import type { Rng } from '../../../rng';
import { m, num, sum, term } from '../../../tex';
import type { Difficulty, ProblemContent } from '../../../types';
import { baseTex, NUMBER_WORDS, recursiveRich } from './common';

/** An explicit formula: LaTeX right-hand side in n, and its values. */
export interface Fm {
  tex: string;
  f: (n: number) => Frac;
}

/** A parameterised family of formulas, so distractors can nudge one parameter. */
export interface Pattern {
  make: (p: number[]) => Fm | null;
  p: number[];
}

const pw = (b: number, e: number): Frac => new Frac(b).pow(e);

const signed = (main: string, shift: number) => (shift === 0 ? main : shift < 0 ? `${main} - ${-shift}` : `${main} + ${shift}`);

const coefPrefix = (c: number) => (c === 1 ? '' : c === -1 ? '-' : `${c} \\cdot `);

export const FAMILIES = {
  lin: ([b, c]: number[]): Fm | null => (b ? { tex: sum([{ coef: b!, sym: 'n' }, { coef: c! }]), f: (n) => new Frac(b! * n + c!) } : null),
  quad: ([a, b, c]: number[]): Fm | null =>
    a ? { tex: sum([{ coef: a, sym: 'n^{2}' }, { coef: b!, sym: 'n' }, { coef: c! }]), f: (n) => new Frac(a * n * n + b! * n + c!) } : null,
  cube: ([a, c]: number[]): Fm | null => (a ? { tex: sum([{ coef: a, sym: 'n^{3}' }, { coef: c! }]), f: (n) => new Frac(a * n ** 3 + c!) } : null),
  geo: ([a, r]: number[]): Fm | null => {
    if (!a || !r || Math.abs(r) === 1) return null;
    const power = `${baseTex(new Frac(r))}^{n - 1}`;
    const tex = a === 1 ? power : a === -1 ? `-${power}` : r < 0 ? `${a}${power}` : `${a} \\cdot ${power}`;
    return { tex, f: (n) => pw(r, n - 1).mul(a) };
  },
  exps: ([c, b, s]: number[]): Fm | null => {
    if (!c || !b || Math.abs(b) === 1) return null;
    return { tex: signed(`${coefPrefix(c)}${baseTex(new Frac(b))}^{n}`, s!), f: (n) => pw(b, n).mul(c).add(s!) };
  },
  alt: ([a, b, s]: number[]): Fm | null => {
    if (!a || a < 0 || b! < 0 || (s !== 0 && s !== 1)) return null;
    const inner = sum([{ coef: a, sym: 'n' }, { coef: b! }]);
    const sign = `(-1)^{${s ? 'n + 1' : 'n'}}`;
    return { tex: b ? `${sign}(${inner})` : `${sign} \\cdot ${inner}`, f: (n) => new Frac((a * n + b!) * (-1) ** (n + s)) };
  },
  rat: ([a, b, c, d]: number[]): Fm | null => {
    if ((!a && !b) || (!c && !d)) return null;
    for (let n = 0; n <= 8; n++) if (c! * n + d! === 0) return null;
    const top = sum([{ coef: a!, sym: 'n' }, { coef: b! }]);
    const bot = sum([{ coef: c!, sym: 'n' }, { coef: d! }]);
    if (bot === '1' || top === bot) return null;
    return { tex: `\\frac{${top}}{${bot}}`, f: (n) => new Frac(a! * n + b!, c! * n + d!) };
  },
  powFrac: ([k, b]: number[]): Fm | null => (k! > 0 && b! >= 2 ? { tex: `\\frac{${k}}{${b}^{n}}`, f: (n) => new Frac(k!).div(pw(b!, n)) } : null),
  prod: ([c]: number[]): Fm | null => (c ? { tex: `n(${sum([{ coef: 1, sym: 'n' }, { coef: c }])})`, f: (n) => new Frac(n * (n + c)) } : null),
} as const;

type Family = keyof typeof FAMILIES;

export function pattern(family: Family, p: number[]): Pattern {
  return { make: FAMILIES[family], p };
}

/** Explicit formulas whose terms students compute. */
function explicitPattern(rng: Rng, d: Difficulty): Pattern {
  const nz = (lo: number, hi: number) => rng.intExcept(lo, hi, [0]);
  if (d === 'easy') {
    return rng.pick<() => Pattern>([
      () => pattern('lin', [rng.int(2, 6), nz(-6, 9)]),
      () => pattern('lin', [-rng.int(2, 5), rng.int(10, 20)]),
      () => pattern('quad', [1, 0, nz(-4, 6)]),
      () => pattern('quad', [rng.int(2, 3), 0, 0]),
      () => pattern('exps', [1, rng.pick([2, 3]), rng.int(-2, 2)]),
    ])();
  }
  if (d === 'medium') {
    return rng.pick<() => Pattern>([
      () => pattern('quad', [1, nz(-5, 5), rng.int(-5, 5)]),
      () => pattern('exps', [rng.pick([1, 2, 3]), rng.pick([2, 3]), rng.int(-3, 3)]),
      () => pattern('alt', [rng.int(1, 4), 0, rng.int(0, 1)]),
      () => pattern('rat', [1, 0, 1, rng.int(1, 4)]),
      () => pattern('cube', [1, nz(-5, 5)]),
      () => pattern('geo', [rng.signedInt(1, 5, true), rng.pick([-2, -3, 2, 3])]),
    ])();
  }
  return rng.pick<() => Pattern>([
    () => pattern('rat', [rng.int(1, 3), rng.int(-2, 3), rng.int(1, 3), rng.int(1, 5)]),
    () => pattern('alt', [rng.int(2, 4), rng.int(1, 5), rng.int(0, 1)]),
    () => pattern('quad', [rng.signedInt(2, 3, true), nz(-6, 6), rng.int(-6, 6)]),
    () => pattern('prod', [nz(-4, 5)]),
    () => pattern('powFrac', [rng.int(1, 5), rng.pick([2, 3])]),
    () => pattern('exps', [rng.signedInt(1, 3, true), rng.pick([-2, -3, 2]), rng.int(-4, 4)]),
  ])();
}

/** Patterns students identify from listed terms. */
function listPattern(rng: Rng, d: Difficulty): Pattern {
  if (d === 'easy') {
    return rng.pick<() => Pattern>([
      () => pattern('lin', [rng.int(2, 7), rng.int(-5, 8)]),
      () => pattern('lin', [rng.int(2, 7), 0]),
      () => pattern('quad', [1, 0, rng.int(-3, 5)]),
      () => pattern('geo', [rng.int(1, 4), rng.pick([2, 3])]),
    ])();
  }
  if (d === 'medium') {
    return rng.pick<() => Pattern>([
      () => pattern('lin', [rng.signedInt(2, 9, true), rng.int(-9, 15)]),
      () => pattern('geo', [rng.signedInt(1, 5, true), rng.pick([2, 3, -2, -3, 4])]),
      () => pattern('quad', [1, 0, rng.intExcept(-6, 6, [0])]),
      () => pattern('alt', [rng.int(1, 3), 0, rng.int(0, 1)]),
      () => pattern('rat', [0, 1, 1, rng.int(0, 2)]),
    ])();
  }
  return rng.pick<() => Pattern>([
    () => pattern('rat', [1, 0, 1, rng.int(1, 3)]),
    () => pattern('rat', [1, rng.int(1, 2), 1, rng.int(3, 5)]),
    () => pattern('cube', [1, rng.int(-3, 3)]),
    () => pattern('powFrac', [1, rng.pick([2, 3])]),
    () => pattern('prod', [rng.intExcept(-2, 3, [0])]),
    () => pattern('alt', [rng.int(1, 3), rng.int(1, 3), rng.int(0, 1)]),
    () => pattern('exps', [1, rng.pick([2, 3]), rng.intExcept(-3, 3, [0])]),
  ])();
}

interface Rec {
  rhs: string;
  init: Frac[];
  next: (p: Frac, q: Frac, n: number) => Frac;
  /** A plausible misreading of the rule. */
  wrong: (p: Frac, q: Frac, n: number) => Frac;
}

function pickRec(rng: Rng, d: Difficulty): Rec {
  const P = 'a_{n-1}';
  const Q = 'a_{n-2}';
  const a1 = () => new Frac(rng.signedInt(1, d === 'easy' ? 9 : 6, d !== 'easy'));
  const pool: Array<() => Rec> =
    d === 'easy'
      ? [
          () => {
            const k = rng.signedInt(2, 9, true);
            return { rhs: sum([{ coef: 1, sym: P }, { coef: k }]), init: [new Frac(rng.int(-5, 12))], next: (p) => p.add(k), wrong: (p) => p.sub(k) };
          },
          () => {
            const r = rng.pick([2, 3, -2]);
            return { rhs: term(r, P), init: [new Frac(rng.int(1, 5))], next: (p) => p.mul(r), wrong: (p) => p.add(r) };
          },
        ]
      : d === 'medium'
        ? [
            () => {
              const r = rng.pick([2, 3, -2, -3]);
              const c = rng.signedInt(1, 6, true);
              return { rhs: sum([{ coef: r, sym: P }, { coef: c }]), init: [a1()], next: (p) => p.mul(r).add(c), wrong: (p) => p.add(c).mul(r) };
            },
            () => {
              const k = rng.pick([1, 2, 3, -2]);
              return { rhs: sum([{ coef: 1, sym: P }, { coef: k, sym: 'n' }]), init: [a1()], next: (p, _q, n) => p.add(k * n), wrong: (p, _q, n) => p.add(k * (n - 1)) };
            },
            () => {
              const r = rng.pick([-1, -2, 4]);
              const c = rng.signedInt(1, 9, true);
              return { rhs: sum([{ coef: c }, { coef: r, sym: P }]), init: [a1()], next: (p) => p.mul(r).add(c), wrong: (p) => p.mul(-r).add(c) };
            },
          ]
        : [
            () => ({ rhs: `${P} + ${Q}`, init: [a1(), a1()], next: (p, q) => p.add(q), wrong: (p) => p.add(p) }),
            () => ({ rhs: `${P} - ${Q}`, init: [a1(), a1()], next: (p, q) => p.sub(q), wrong: (p, q) => q.sub(p) }),
            () => {
              const k = rng.pick([2, 3, -2]);
              return { rhs: sum([{ coef: 1, sym: P }, { coef: k, sym: Q }]), init: [a1(), a1()], next: (p, q) => p.add(q.mul(k)), wrong: (p, q) => p.mul(k).add(q) };
            },
            () => ({ rhs: `n \\cdot ${P}`, init: [new Frac(rng.signedInt(1, 4, true))], next: (p, _q, n) => p.mul(n), wrong: (p, _q, n) => p.mul(n - 1) }),
            () => {
              const c = rng.int(1, 4);
              return { rhs: `\\left(${P}\\right)^{2} - ${c}`, init: [new Frac(rng.signedInt(1, 3, true))], next: (p) => p.mul(p).sub(c), wrong: (p) => p.mul(2).sub(c) };
            },
            () => {
              const c = rng.signedInt(1, 6, true);
              return { rhs: sum([{ coef: new Frac(1, 2), sym: P }, { coef: c }]), init: [new Frac(rng.signedInt(1, 8, true) * 4)], next: (p) => p.div(2).add(c), wrong: (p) => p.add(c).div(2) };
            },
          ];
  return rng.pick(pool)();
}

function runRec(r: Rec, count: number, rule: Rec['next'] = r.next, init = r.init): Frac[] {
  const out = init.slice(0, count);
  for (let n = out.length + 1; n <= count; n++) out.push(rule(out[n - 2]!, out[n - 3] ?? Frac.ZERO, n));
  return out;
}

const listAns = (xs: readonly Frac[]) => m(xs.map((x) => num(x)).join(', '));

function nudgedLast(xs: readonly Frac[], k: number): string {
  return listAns([...xs.slice(0, -1), xs[xs.length - 1]!.add(offset(k))]);
}

/** Formulas from one-parameter nudges of the true pattern that differ on the listed terms. */
export function patternDistractors(pt: Pattern, count: number, truth: readonly Frac[]): Fm[] {
  const out: Fm[] = [];
  const differs = (f: Fm) => {
    try {
      const vals = truth.map((_, i) => f.f(i + 1));
      return vals.some((v, i) => !v.eq(truth[i]!));
    } catch {
      return false;
    }
  };
  for (const delta of [1, -1, 2, -2, 3]) {
    for (let i = 0; i < pt.p.length; i++) {
      const p = pt.p.slice();
      p[i] = p[i]! + delta;
      const f = pt.make(p);
      if (f && differs(f) && !out.some((o) => o.tex === f.tex)) out.push(f);
    }
    if (out.length >= count) break;
  }
  return out;
}

type Task = 'terms' | 'recursive' | 'formula';

export const generalSequences = defineTopic({
  id: 'alg2.seq.general',
  subject: 'algebra2',
  title: 'General Sequences',
  description: 'Find terms of explicit and recursive sequences, and write a formula for the nth term of a pattern.',
  category: 'Sequences and Series',
  instruction: (o) =>
    o.task === 'terms' ? 'Find the indicated terms of each sequence.' : o.task === 'recursive' ? 'Find the first terms of each recursive sequence.' : o.task === 'formula' ? 'Write a formula for the nth term of each sequence.' : 'Answer as indicated.',
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Problems',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'terms', label: 'Terms from an explicit formula' },
        { value: 'recursive', label: 'Terms from a recursive formula' },
        { value: 'formula', label: 'Formula for the nth term' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty: d } = ctx;
    const tOpt = strOpt(ctx, 'task');
    const task: Task = tOpt === 'any' || !tOpt ? rng.pick<Task>(['terms', 'recursive', 'formula']) : (tOpt as Task);
    const count = d === 'easy' ? 4 : rng.pick([4, 5]);

    if (task === 'terms') {
      return attempt('general-terms', () => {
        const pt = explicitPattern(rng, d);
        const fm = pt.make(pt.p);
        if (!fm) return null;
        const vals = Array.from({ length: count }, (_, i) => fm.f(i + 1));
        if (vals.some((v) => Math.abs(v.value) > 5000)) return null;
        const single = d !== 'easy' && rng.bool(0.3);
        if (single) {
          const N = rng.int(6, 12);
          const v = fm.f(N);
          if (Math.abs(v.value) > 1e6) return null;
          const answer = m(`a_{${N}} = ${num(v)}`);
          const wrongs = [fm.f(N - 1), fm.f(N + 1), ...patternDistractors(pt, 2, vals).map((g) => g.f(N))].map((w) => m(`a_{${N}} = ${num(w)}`));
          return {
            question: `Find ${m(`a_{${N}}`)} for ${m(`a_n = ${fm.tex}`)}.`,
            answer,
            steps: [m(`a_{${N}} = ${fm.tex.replace(/n/g, `(${N})`)}`), answer],
            distractors: distinctDistractors(answer, wrongs, (k) => m(`a_{${N}} = ${num(v.add(offset(k)))}`)),
            check: { kind: 'alg2-sequences-probability.seq', seq: 'question', asked: 'term' },
          };
        }
        const answer = listAns(vals);
        const shifted = (from: number) => {
          try {
            return listAns(Array.from({ length: count }, (_, i) => fm.f(from + i)));
          } catch {
            return null;
          }
        };
        const nudged = patternDistractors(pt, 1, vals).map((g) => listAns(vals.map((_, i) => g.f(i + 1))));
        return {
          question: `Find the first ${NUMBER_WORDS[count]} terms of ${m(`a_n = ${fm.tex}`)}.`,
          answer,
          steps: [m(`a_1 = ${fm.tex.replace(/n/g, '(1)')} = ${num(vals[0]!)}`), m(`a_2 = ${fm.tex.replace(/n/g, '(2)')} = ${num(vals[1]!)}`), answer],
          distractors: distinctDistractors(answer, [shifted(0), shifted(2), ...nudged], (k) => nudgedLast(vals, k)),
          check: { kind: 'alg2-sequences-probability.seq', seq: 'question', asked: 'terms', count },
        };
      });
    }

    if (task === 'recursive') {
      return attempt('general-recursive', () => {
        const r = pickRec(rng, d);
        const vals = runRec(r, count);
        if (vals.some((v) => Math.abs(v.value) > 5000)) return null;
        if (new Set(vals.map((v) => v.toString())).size < 3) return null;
        const answer = listAns(vals);
        const wrongs = [listAns(runRec(r, count, r.wrong)), listAns(runRec(r, count + 1).slice(1)), listAns(runRec(r, count, r.next, r.init.map((x) => x.neg())))];
        const initTex = r.init.length === 2 ? recursiveRich(r.rhs, r.init[0]!, r.init[1]) : recursiveRich(r.rhs, r.init[0]!);
        const nInit = r.init.length;
        return {
          question: `Find the first ${NUMBER_WORDS[count]} terms: ${initTex}.`,
          answer,
          steps: [
            m(`a_{${nInit + 1}} = ${r.rhs.replace(/a_\{n-1\}/g, `(${num(vals[nInit - 1]!)})`).replace(/a_\{n-2\}/g, `(${num(vals[nInit - 2] ?? Frac.ZERO)})`).replace(/\bn\b/g, `(${nInit + 1})`)} = ${num(vals[nInit]!)}`),
            answer,
          ],
          distractors: distinctDistractors(answer, wrongs, (k) => nudgedLast(vals, k)),
          check: { kind: 'alg2-sequences-probability.seq', seq: 'question', asked: 'terms', count },
        };
      });
    }

    return attempt('general-formula', () => {
      const pt = listPattern(rng, d);
      const fm = pt.make(pt.p);
      if (!fm) return null;
      const vals = Array.from({ length: count }, (_, i) => fm.f(i + 1));
      if (vals.some((v) => Math.abs(v.value) > 5000)) return null;
      const answer = m(`a_n = ${fm.tex}`);
      const wrongs = patternDistractors(pt, 3, vals).map((g) => m(`a_n = ${g.tex}`));
      if (wrongs.length < 3) return null;
      return {
        question: `Write a formula for the nth term: ${m(`${vals.map((v) => num(v)).join(', ')}, \\ldots`)}`,
        answer,
        steps: [m(`a_1 = ${num(vals[0]!)}, \\; a_2 = ${num(vals[1]!)}, \\; a_3 = ${num(vals[2]!)}`), answer],
        distractors: wrongs,
        check: { kind: 'alg2-sequences-probability.seq', seq: 'question', asked: 'explicit' },
      };
    });
  },
});
