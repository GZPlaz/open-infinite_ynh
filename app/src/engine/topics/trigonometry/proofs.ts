/**
 * Random trig identities with complete proofs.
 *
 * An identity is built by a random walk: start from a simple expression and
 * apply random identity-preserving rewrite rules (quotient, reciprocal,
 * Pythagorean, double-angle, splitting / combining fractions, multiplying by a
 * conjugate, …). The final expression and the start form the identity; the
 * walk read backwards is a step-by-step proof, each step naming its identity.
 */
import type { Rng } from '../../rng';

export type Fn = 'sin' | 'cos' | 'tan' | 'cot' | 'sec' | 'csc';

export type E =
  | { k: 'n'; v: number }
  | { k: 'f'; f: Fn; p: number; two: boolean }
  | { k: 's'; t: Term[] }
  | { k: 'p'; c: number; fs: E[] }
  | { k: 'q'; n: E; d: E };

export interface Term {
  neg: boolean;
  e: E;
}

export const N = (v: number): E => ({ k: 'n', v });
export const F = (f: Fn, p = 1, two = false): E => ({ k: 'f', f, p, two });
export const S = (...t: Array<[boolean, E]>): E => ({ k: 's', t: t.map(([neg, e]) => ({ neg, e })) });
export const P = (c: number, ...fs: E[]): E => ({ k: 'p', c, fs });
export const Q = (n: E, d: E): E => ({ k: 'q', n, d });
const plus = (e: E): [boolean, E] => [false, e];
const minus = (e: E): [boolean, E] => [true, e];

// ---------------------------------------------------------------- normal form, TeX, value, width

/** Flatten nested sums / products, fold constants, merge equal function factors. */
export function norm(e: E): E {
  switch (e.k) {
    case 'n':
    case 'f':
      return e;
    case 'q': {
      const n = norm(e.n);
      const d = norm(e.d);
      if (d.k === 'n' && d.v === 1) return n;
      // no complex fractions: (a/b)/c = a/(bc), a/(b/c) = ac/b
      if (n.k === 'q') return norm(Q(n.n, P(1, n.d, d)));
      if (d.k === 'q') return norm(Q(P(1, n, d.d), d.n));
      return Q(n, d);
    }
    case 's': {
      const out: Term[] = [];
      for (const t of e.t) {
        const x = norm(t.e);
        if (x.k === 's') x.t.forEach((u) => out.push({ neg: u.neg !== t.neg, e: u.e }));
        else out.push({ neg: t.neg, e: x });
      }
      if (out.length === 1 && !out[0]!.neg) return out[0]!.e;
      return { k: 's', t: out };
    }
    case 'p': {
      let c = e.c;
      const fs: E[] = [];
      const push = (x: E) => {
        if (x.k === 'n') c *= x.v;
        else if (x.k === 'p') {
          c *= x.c;
          x.fs.forEach(push);
        } else if (x.k === 'f') {
          const i = fs.findIndex((y) => y.k === 'f' && y.f === x.f && y.two === x.two);
          if (i >= 0) {
            const y = fs[i] as Extract<E, { k: 'f' }>;
            fs[i] = F(x.f, y.p + x.p, x.two);
          } else fs.push(x);
        } else fs.push(x);
      };
      e.fs.map(norm).forEach(push);
      // a product containing fractions is written as one fraction
      const qi = fs.findIndex((x) => x.k === 'q');
      if (qi >= 0) {
        const q = fs[qi] as Extract<E, { k: 'q' }>;
        return norm(Q(P(c, ...fs.filter((_, i) => i !== qi), q.n), q.d));
      }
      if (fs.length === 0) return N(c);
      if (c === 1 && fs.length === 1) return fs[0]!;
      // functions first, then sums and fractions
      const rank = (x: E) => (x.k === 'f' ? 0 : x.k === 's' ? 1 : 2);
      fs.sort((a, b) => rank(a) - rank(b));
      return { k: 'p', c, fs };
    }
  }
}

export function tex(e: E, v: string): string {
  switch (e.k) {
    case 'n':
      return String(e.v);
    case 'f':
      return `\\${e.f}${e.p > 1 ? `^{${e.p}}` : ''} ${e.two ? `2${v}` : v}`;
    case 'q':
      return `\\frac{${tex(e.n, v)}}{${tex(e.d, v)}}`;
    case 's':
      return e.t
        .map((t, i) => {
          const body = t.e.k === 's' ? `\\left(${tex(t.e, v)}\\right)` : tex(t.e, v);
          return i === 0 ? `${t.neg ? '-' : ''}${body}` : ` ${t.neg ? '-' : '+'} ${body}`;
        })
        .join('');
    case 'p':
      return `${e.c === 1 ? '' : e.c}${e.fs.map((x) => (x.k !== 's' ? tex(x, v) : tex(x, v).includes('\\frac') ? `\\left(${tex(x, v)}\\right)` : `(${tex(x, v)})`)).join('')}`;
  }
}

const FNV: Record<Fn, (x: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  cot: (x) => Math.cos(x) / Math.sin(x),
  sec: (x) => 1 / Math.cos(x),
  csc: (x) => 1 / Math.sin(x),
};

export function value(e: E, x: number): number {
  switch (e.k) {
    case 'n':
      return e.v;
    case 'f':
      return FNV[e.f](e.two ? 2 * x : x) ** e.p;
    case 'q':
      return value(e.n, x) / value(e.d, x);
    case 's':
      return e.t.reduce((s, t) => s + (t.neg ? -1 : 1) * value(t.e, x), 0);
    case 'p':
      return e.fs.reduce((s, f) => s * value(f, x), e.c);
  }
}

/** Rough printed width in characters (fractions stack). */
export function width(e: E): number {
  switch (e.k) {
    case 'n':
      return String(e.v).length;
    case 'f':
      return 5 + (e.p > 1 ? 1 : 0) + (e.two ? 1 : 0);
    case 'q':
      return Math.max(width(e.n), width(e.d)) + 1;
    case 's':
      return e.t.reduce((s, t) => s + width(t.e) + (t.e.k === 's' ? 2 : 0), 0) + 3 * (e.t.length - 1) + (e.t[0]?.neg ? 1 : 0);
    case 'p':
      return (e.c === 1 ? 0 : String(e.c).length) + e.fs.reduce((s, f) => s + width(f) + (f.k === 's' ? 2 : 0), 0);
  }
}

const key = (e: E) => tex(e, 'x');

/** No sum with two constants or a repeated term (such as 1 − 1 + …). */
function tidy(e: E): boolean {
  if (e.k === 's') {
    if (e.t.filter((t) => t.e.k === 'n').length > 1) return false;
    const keys = e.t.map((t) => key(t.e));
    if (new Set(keys).size !== keys.length) return false;
    return e.t.every((t) => tidy(t.e));
  }
  if (e.k === 'p') return e.fs.every(tidy);
  if (e.k === 'q') return key(e.n) !== key(e.d) && tidy(e.n) && tidy(e.d);
  return true;
}

/** A fraction whose numerator and denominator visibly share a factor (cos x and cos² x count). */
function visibleCommonFactor(e: E): boolean {
  if (e.k === 's') return e.t.some((t) => visibleCommonFactor(t.e));
  if (e.k === 'p') return e.fs.some(visibleCommonFactor);
  if (e.k !== 'q') return false;
  const base = (x: E) => (x.k === 'f' ? `${x.f}${x.two ? '2' : ''}` : key(x));
  const facs = (x: E) => (x.k === 'p' ? x.fs : [x]).filter((y) => y.k !== 'n').map(base);
  const dn = new Set(facs(e.d));
  return facs(e.n).some((b) => dn.has(b)) || visibleCommonFactor(e.n) || visibleCommonFactor(e.d);
}
const same = (a: E, b: E) => key(a) === key(b);

// ---------------------------------------------------------------- rewrite rules

export type RuleName =
  | 'quotient'
  | 'quotientRev'
  | 'reciprocal'
  | 'reciprocalRev'
  | 'pyth'
  | 'pythRev'
  | 'one'
  | 'double'
  | 'doubleRev'
  | 'split'
  | 'combine'
  | 'distribute'
  | 'mulBy'
  | 'mulConj'
  | 'cancel'
  | 'conjExpand'
  | 'conjCollapse';

/** A rewrite of one node; `label` describes the step in proof direction (after → before). */
interface Rewrite {
  e: E;
  label: string;
  rule: RuleName;
}

const isF = (e: E, f: Fn, p = 1, two = false) => e.k === 'f' && e.f === f && e.p === p && e.two === two;
const isOne = (e: E) => e.k === 'n' && e.v === 1;

const QUOTIENT = 'Quotient identity';
const RECIPROCAL = 'Reciprocal identity';
const PYTHAGOREAN = 'Pythagorean identity';
const DOUBLE = 'Double-angle identity';

function rewrites(e: E, rng: Rng, v: string): Rewrite[] {
  const out: Rewrite[] = [];
  const add = (rule: RuleName, label: string, x: E) => out.push({ rule, label, e: x });
  if (e.k === 'f' && !e.two) {
    const p = e.p;
    if (e.f === 'tan') add('quotient', QUOTIENT, Q(F('sin', p), F('cos', p)));
    if (e.f === 'cot') add('quotient', QUOTIENT, Q(F('cos', p), F('sin', p)));
    if (e.f === 'sec') add('reciprocal', RECIPROCAL, Q(N(1), F('cos', p)));
    if (e.f === 'csc') add('reciprocal', RECIPROCAL, Q(N(1), F('sin', p)));
    if (p === 2) {
      const pyth: Partial<Record<Fn, E>> = {
        sin: S(plus(N(1)), minus(F('cos', 2))),
        cos: S(plus(N(1)), minus(F('sin', 2))),
        sec: S(plus(N(1)), plus(F('tan', 2))),
        csc: S(plus(N(1)), plus(F('cot', 2))),
        tan: S(plus(F('sec', 2)), minus(N(1))),
        cot: S(plus(F('csc', 2)), minus(N(1))),
      };
      add('pyth', PYTHAGOREAN, pyth[e.f]!);
    }
  }
  if (e.k === 'f' && e.two && e.p === 1) {
    if (e.f === 'sin') add('double', DOUBLE, P(2, F('sin'), F('cos')));
    if (e.f === 'cos')
      add('double', DOUBLE, rng.pick([S(plus(F('cos', 2)), minus(F('sin', 2))), S(plus(N(1)), minus(P(2, F('sin', 2)))), S(plus(P(2, F('cos', 2))), minus(N(1)))]));
  }
  if (e.k === 'n' && e.v === 1) add('one', PYTHAGOREAN, rng.bool() ? S(plus(F('sin', 2)), plus(F('cos', 2))) : S(plus(F('cos', 2)), plus(F('sin', 2))));
  if (e.k === 'q') {
    const { n, d } = e;
    if (n.k === 'f' && d.k === 'f' && n.p === d.p && !n.two && !d.two) {
      if (n.f === 'sin' && d.f === 'cos') add('quotientRev', QUOTIENT, F('tan', n.p));
      if (n.f === 'cos' && d.f === 'sin') add('quotientRev', QUOTIENT, F('cot', n.p));
    }
    if (isOne(n) && d.k === 'f' && !d.two && (d.f === 'cos' || d.f === 'sin')) add('reciprocalRev', RECIPROCAL, F(d.f === 'cos' ? 'sec' : 'csc', d.p));
    if (n.k === 's' && n.t.length === 2) add('split', 'Write as a single fraction', { k: 's', t: n.t.map((t) => ({ neg: t.neg, e: Q(t.e, d) })) });
    const g = rng.pick([F('sin'), F('cos')]);
    add('mulBy', `Cancel the common factor ${'$'}${tex(g, v)}${'$'}`, Q(P(1, n, g), P(1, d, g)));
    // multiply by the conjugate of a 1 ± f denominator
    if (d.k === 's' && d.t.length === 2 && isOne(d.t[0]!.e) && !d.t[0]!.neg && d.t[1]!.e.k === 'f' && d.t[1]!.e.p === 1 && !d.t[1]!.e.two) {
      const conj = S(plus(N(1)), [!d.t[1]!.neg, d.t[1]!.e]);
      add('mulConj', `Cancel the common factor ${'$'}${tex(conj, v)}${'$'}`, Q(P(1, n, conj), P(1, d, conj)));
    }
    // cancel a common factor
    const facs = (x: E) => (x.k === 'p' ? x.fs : [x]);
    for (const f of facs(n)) {
      if (f.k === 'n') continue;
      if (facs(d).some((y) => same(y, f))) {
        const drop = (x: E) => (x.k === 'p' ? P(x.c, ...dropOne(x.fs, f)) : N(1));
        add('cancel', `Multiply the numerator and denominator by ${'$'}${tex(f, v)}${'$'}`, Q(drop(n), drop(d)));
        break;
      }
    }
  }
  if (e.k === 's') {
    const t = e.t;
    if (t.length === 2 && !t[0]!.neg) {
      const [a, b] = [t[0]!.e, t[1]!.e];
      const neg = t[1]!.neg;
      const rev = (f: Fn, p: number) => add('pythRev', PYTHAGOREAN, F(f, p));
      if (isOne(a) && neg && b.k === 'f' && !b.two && b.p === 2 && (b.f === 'cos' || b.f === 'sin')) rev(b.f === 'cos' ? 'sin' : 'cos', 2);
      if (isOne(a) && !neg && b.k === 'f' && !b.two && b.p === 2 && (b.f === 'tan' || b.f === 'cot')) rev(b.f === 'tan' ? 'sec' : 'csc', 2);
      if (isOne(b) && neg && a.k === 'f' && !a.two && a.p === 2 && (a.f === 'sec' || a.f === 'csc')) rev(a.f === 'sec' ? 'tan' : 'cot', 2);
      if (!neg && a.k === 'f' && b.k === 'f' && a.p === 2 && b.p === 2 && !a.two && !b.two && ((a.f === 'sin' && b.f === 'cos') || (a.f === 'cos' && b.f === 'sin'))) add('pythRev', PYTHAGOREAN, N(1));
      if (isF(a, 'cos', 2) && neg && isF(b, 'sin', 2)) add('doubleRev', DOUBLE, F('cos', 1, true));
      // 1 − f² = (1 − f)(1 + f)
      if (isOne(a) && neg && b.k === 'f' && !b.two && b.p === 2 && (b.f === 'cos' || b.f === 'sin'))
        add('conjExpand', 'Multiply out the conjugates', P(1, S(plus(N(1)), minus(F(b.f))), S(plus(N(1)), plus(F(b.f)))));
    }
    // combine fractions over a common denominator
    if (t.length === 2 && t[0]!.e.k === 'q' && t[1]!.e.k === 'q' && same(t[0]!.e.d, t[1]!.e.d)) {
      const d = t[0]!.e.d;
      add('combine', 'Split into two fractions', Q({ k: 's', t: t.map((u) => ({ neg: u.neg, e: (u.e as Extract<E, { k: 'q' }>).n })) }, d));
    }
  }
  if (e.k === 'p') {
    if (isProdOf(e, ['sin', 'cos']) && e.c === 2) add('doubleRev', DOUBLE, F('sin', 1, true));
    const sumIdx = e.fs.findIndex((x) => x.k === 's' && x.t.length === 2);
    const others = e.fs.filter((_, i) => i !== sumIdx);
    if (sumIdx >= 0 && others.length >= 1 && others.every((x) => x.k === 'f')) {
      const s = e.fs[sumIdx] as Extract<E, { k: 's' }>;
      add('distribute', 'Factor out the common factor', { k: 's', t: s.t.map((u) => ({ neg: u.neg, e: P(e.c, ...others, u.e) })) });
    }
    // (1 − f)(1 + f) → 1 − f²
    for (let i = 0; i < e.fs.length; i++)
      for (let j = i + 1; j < e.fs.length; j++) {
        const f = conjPair(e.fs[i]!, e.fs[j]!);
        if (f) add('conjCollapse', 'Factor as a difference of squares', P(e.c, ...e.fs.filter((_, k) => k !== i && k !== j), S(plus(N(1)), minus(F(f, 2)))));
      }
  }
  return out;
}

function dropOne(list: E[], f: E): E[] {
  const i = list.findIndex((y) => same(y, f));
  return list.filter((_, k) => k !== i);
}

function isProdOf(e: Extract<E, { k: 'p' }>, fns: Fn[]): boolean {
  return e.fs.length === fns.length && e.fs.every((x, i) => isF(x, fns[i]!));
}

/** (1 − f)(1 + f) in either order → f. */
function conjPair(a: E, b: E): Fn | null {
  const parts = (x: E) => (x.k === 's' && x.t.length === 2 && isOne(x.t[0]!.e) && !x.t[0]!.neg && x.t[1]!.e.k === 'f' && x.t[1]!.e.p === 1 && !x.t[1]!.e.two ? { f: x.t[1]!.e.f, neg: x.t[1]!.neg } : null);
  const pa = parts(a);
  const pb = parts(b);
  if (!pa || !pb || pa.f !== pb.f || pa.neg === pb.neg) return null;
  return pa.f === 'sin' || pa.f === 'cos' ? pa.f : null;
}

// ---------------------------------------------------------------- tree walking

type Path = number[];

function nodes(e: E, path: Path = [], out: Array<[Path, E]> = []): Array<[Path, E]> {
  out.push([path, e]);
  if (e.k === 'q') {
    nodes(e.n, [...path, 0], out);
    nodes(e.d, [...path, 1], out);
  } else if (e.k === 's') e.t.forEach((t, i) => nodes(t.e, [...path, i], out));
  else if (e.k === 'p') e.fs.forEach((f, i) => nodes(f, [...path, i], out));
  return out;
}

function replace(e: E, path: Path, x: E): E {
  if (path.length === 0) return x;
  const [i, ...rest] = path as [number, ...number[]];
  if (e.k === 'q') return i === 0 ? Q(replace(e.n, rest, x), e.d) : Q(e.n, replace(e.d, rest, x));
  if (e.k === 's') return { k: 's', t: e.t.map((t, j) => (j === i ? { neg: t.neg, e: replace(t.e, rest, x) } : t)) };
  if (e.k === 'p') return { k: 'p', c: e.c, fs: e.fs.map((f, j) => (j === i ? replace(f, rest, x) : f)) };
  return e;
}

// ---------------------------------------------------------------- building identities

export interface Proof {
  /** Expressions from the complicated side to the simple side. */
  chain: E[];
  /** Step i explains chain[i] → chain[i + 1]: identity used and the sub-expressions rewritten. */
  steps: Array<{ label: string; from: E; to: E }>;
}

const SAMPLES = [0.37, 0.81, 1.19, 2.03, 2.67, 3.71, 4.33, 5.09, -0.55, -1.27];

function equalNumerically(a: E, b: E): boolean {
  let used = 0;
  for (const x of SAMPLES) {
    const ya = value(a, x);
    const yb = value(b, x);
    if (!Number.isFinite(ya) || !Number.isFinite(yb) || Math.abs(ya) > 1e6 || Math.abs(yb) > 1e6) continue;
    used++;
    if (Math.abs(ya - yb) > 1e-7 * Math.max(1, Math.abs(ya))) return false;
  }
  return used >= 5;
}

export type Level = 'easy' | 'medium' | 'hard';

const STARTS: Record<Level, E[]> = {
  easy: [F('sin'), F('cos'), F('tan'), F('cot'), F('sec'), F('csc'), F('sin', 2), F('cos', 2), F('tan', 2), F('sec', 2), F('csc', 2), F('cot', 2), P(1, F('sin'), F('cos')), P(1, F('tan'), F('cos')), P(1, F('sec'), F('sin')), Q(N(1), F('sin', 2))],
  medium: [
    F('sin'),
    F('cos'),
    F('tan'),
    F('sec'),
    F('csc'),
    F('cot'),
    F('sin', 2),
    F('cos', 2),
    F('tan', 2),
    F('sec', 2),
    P(1, F('sec'), F('csc')),
    P(1, F('sin'), F('tan')),
    P(1, F('cos'), F('cot')),
    Q(N(1), F('sin', 2)),
    Q(F('sin'), F('cos', 2)),
    P(1, F('tan', 2), F('cos', 2)),
  ],
  hard: [
    F('sin', 1, true),
    F('cos', 1, true),
    Q(S(plus(N(1)), plus(F('cos'))), F('sin')),
    Q(S(plus(N(1)), minus(F('sin'))), F('cos')),
    Q(F('cos'), S(plus(N(1)), minus(F('sin')))),
    Q(F('sin'), S(plus(N(1)), plus(F('cos')))),
    P(1, F('sec'), F('csc')),
    Q(F('sin', 1, true), F('cos', 2)),
    P(2, F('tan')),
    Q(F('cos', 1, true), F('sin')),
    S(plus(F('sec')), plus(F('tan'))),
    S(plus(F('csc')), minus(F('cot'))),
  ],
};

const RULES: Record<Level, RuleName[]> = {
  easy: ['quotient', 'quotientRev', 'reciprocal', 'reciprocalRev', 'pyth', 'pythRev'],
  medium: ['quotient', 'quotientRev', 'reciprocal', 'reciprocalRev', 'pyth', 'pythRev', 'split', 'combine', 'distribute', 'mulBy', 'conjExpand', 'conjCollapse'],
  hard: ['quotient', 'quotientRev', 'reciprocal', 'reciprocalRev', 'pyth', 'pythRev', 'split', 'combine', 'distribute', 'mulBy', 'mulConj', 'conjExpand', 'conjCollapse', 'double', 'doubleRev', 'one'],
};

const MOVES: Record<Level, [number, number]> = { easy: [1, 2], medium: [3, 4], hard: [5, 7] };
export const MAX_WIDTH = 24;

/** One random identity with its proof, or null if this walk got stuck. */
export function randomProof(rng: Rng, level: Level, v: string): Proof | null {
  const start = rng.pick(STARTS[level]);
  const moves = rng.int(...MOVES[level]);
  const exprs: E[] = [norm(start)];
  const steps: Array<{ label: string; from: E; to: E; rule: RuleName }> = [];
  const allowed = new Set(RULES[level]);
  const family = (r: RuleName) => r.replace(/Rev$/, '').replace(/^(conjExpand|conjCollapse)$/, 'conj');
  /** Sub-expressions produced by earlier moves, per identity family: never undo them later. */
  const produced = new Set<string>();
  for (let i = 0; i < moves; i++) {
    const cur = exprs[exprs.length - 1]!;
    const cands: Array<{ e: E; label: string; rule: RuleName; from: E; to: E }> = [];
    for (const [path, node] of nodes(cur)) {
      for (const r of rewrites(node, rng, v)) {
        if (!allowed.has(r.rule)) continue;
        // never immediately rewrite what the previous move produced with the same family of identity
        if (produced.has(`${family(r.rule)}|${key(node)}`)) continue;
        const next = norm(replace(cur, path, r.e));
        if (exprs.some((x) => same(x, next))) continue;
        if (width(next) > MAX_WIDTH || !tidy(next)) continue;
        cands.push({ e: next, label: r.label, rule: r.rule, from: norm(r.e), to: node });
      }
    }
    if (cands.length === 0) return null;
    // prefer moves that grow the expression, so the identity is not trivial
    const growing = cands.filter((c) => width(c.e) >= width(cur));
    const pick = rng.pick(growing.length && rng.bool(0.8) ? growing : cands);
    exprs.push(pick.e);
    steps.push({ label: pick.label, from: pick.from, to: pick.to, rule: pick.rule });
    produced.add(`${family(pick.rule)}|${key(pick.from)}`);
  }
  const first = exprs[0]!;
  const last = exprs[exprs.length - 1]!;
  if (same(first, last) || width(last) < width(first) || visibleCommonFactor(last)) return null;
  if (level === 'hard' && !steps.some((s) => ['double', 'doubleRev', 'mulConj', 'conjExpand', 'conjCollapse'].includes(s.rule))) return null;
  if (level === 'medium' && !steps.some((s) => ['split', 'combine', 'distribute', 'mulBy', 'cancel', 'conjExpand', 'conjCollapse'].includes(s.rule))) return null;
  if (!equalNumerically(first, last)) throw new Error(`proof builder produced a false identity: ${key(last)} = ${key(first)}`);
  // proof direction: from the last (complicated) expression back to the start
  const chain = [...exprs].reverse();
  const proofSteps = [...steps].reverse().map((s) => ({ label: s.label, from: s.from, to: s.to }));
  return { chain, steps: proofSteps };
}
