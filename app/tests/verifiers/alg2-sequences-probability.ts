/**
 * Verifiers for the Algebra 2 sequences / probability pack.
 *
 * Sequences are rebuilt from the RENDERED question (explicit or recursive
 * formulas, listed terms, given terms) or by brute-force iteration from the
 * check parameters — in which case every fact printed in the question is
 * checked against that sequence too. Probabilities are recomputed by
 * enumerating every outcome of the experiment described in `check`.
 */
import { expect } from 'vitest';
import type { ProblemContent } from '../../src/engine/types';
import { close, evalReal, mathSegments, splitTop } from '../evaluator';
import type { Verifier } from '../verify';

const PFX = 'alg2-sequences-probability';
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** Make pack notation digestible for the evaluator. */
function prep(t: string): string {
  return t
    .replace(/\\displaystyle/g, '')
    .replace(/\{,\}/g, '')
    .replace(/a_\{n-1\}/g, '(P)')
    .replace(/a_\{n-2\}/g, '(Q)')
    .replace(/\\%/g, '')
    .trim();
}

const ev = (t: string, vars: Record<string, number> = {}) => evalReal(prep(t), { vars });

interface Sigma {
  v: string;
  lo: number;
  hi: number;
  body: string;
}

function parseSigma(seg: string): Sigma | null {
  const mm = /^\\sum_\{([a-z])=(-?\d+)\}\^\{(\d+|\\infty)\}\s*(.+)$/.exec(prep(seg));
  if (!mm) return null;
  return { v: mm[1]!, lo: Number(mm[2]), hi: mm[3] === '\\infty' ? Infinity : Number(mm[3]), body: mm[4]! };
}

function sigmaTerms(s: Sigma, cap = 4000): number[] {
  const out: number[] = [];
  for (let i = s.lo; i <= Math.min(s.hi, s.lo + cap - 1); i++) out.push(evalReal(s.body, { vars: { [s.v]: i } }));
  return out;
}

/** Split `3 + 7 - 2 + \cdots + 47` into signed top-level terms. */
function signedTerms(expr: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i]!;
    if (ch === '{' || ch === '(') depth++;
    if (ch === '}' || ch === ')') depth--;
    if (depth === 0 && (ch === '+' || ch === '-') && cur.trim() && !/[\^_]\s*$/.test(cur)) {
      out.push(cur.trim());
      cur = ch === '-' ? '-' : '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.map((t) => t.replace(/^-\s+/, '-'));
}

const listOf = (seg: string) => splitTop(prep(seg).replace(/,\s*\\ldots$/, ''), [',']).parts.filter((x) => x.trim());

function expectClose(a: number, b: number, what: string): void {
  expect(close(a, b, 1e-9), `${what}: ${a} vs ${b}`).toBe(true);
}

/** Answer as a single number (or the text "Diverges"). */
function answerNumber(p: ProblemContent): number {
  const segs = mathSegments(p.answer);
  expect(segs.length, p.answer).toBe(1);
  return ev(splitTop(segs[0]!, ['=']).parts.at(-1)!);
}

interface Facts {
  explicit?: string;
  recursion?: string;
  terms: Map<number, number>;
  list?: number[];
  series?: { head: number[]; last?: number; infinite: boolean; explicit: boolean };
  sigma?: Sigma;
  d?: number;
  r?: number;
  psum?: number;
  askTerm?: number;
  askSum?: number;
}

function readFacts(rich: string): Facts {
  const f: Facts = { terms: new Map() };
  for (const raw of mathSegments(rich)) {
    const seg = prep(raw);
    if (seg.includes('\\sum')) {
      f.sigma = parseSigma(seg)!;
      expect(f.sigma, seg).toBeTruthy();
      continue;
    }
    if (seg.includes('\\ldots')) {
      f.list = listOf(seg).map((t) => evalReal(t));
      continue;
    }
    const { parts } = splitTop(seg, ['=']);
    if (parts.length === 2) {
      const [l, r] = [parts[0]!.trim(), parts[1]!];
      let mm: RegExpExecArray | null;
      if (l === 'a_n') {
        if (r.includes('(P)')) f.recursion = r;
        else f.explicit = r;
      } else if ((mm = /^a_\{?(\d+)\}?$/.exec(l))) f.terms.set(Number(mm[1]), evalReal(r));
      else if (l === 'd') f.d = evalReal(r);
      else if (l === 'r') f.r = evalReal(r);
      else if (l === 'S_n') f.psum = evalReal(r);
      else throw new Error(`unknown fact ${seg}`);
      continue;
    }
    if (parts.length > 2) throw new Error(`unknown fact ${seg}`);
    let mm: RegExpExecArray | null;
    if ((mm = /^a_\{(\d+)\}$/.exec(seg))) f.askTerm = Number(mm[1]);
    else if ((mm = /^S_\{(\d+)\}$/.exec(seg))) f.askSum = Number(mm[1]);
    else if (seg === 'n') continue;
    else if (/[+-]/.test(seg.slice(1))) {
      const ts = signedTerms(seg);
      const ci = ts.indexOf('\\cdots');
      const head = (ci < 0 ? ts : ts.slice(0, ci)).map((t) => evalReal(t));
      const last = ci >= 0 && ci < ts.length - 1 ? evalReal(ts[ts.length - 1]!) : undefined;
      f.series = { head, last, infinite: ci >= 0 && last === undefined, explicit: ci < 0 };
    } else throw new Error(`unknown fact ${seg}`);
  }
  return f;
}

/** Brute-force sequence: a(n) for n ≥ 1, with the largest n it is known for. */
function buildSeq(p: ProblemContent, f: Facts): { a: (n: number) => number; dom: number } {
  const c = p.check!;
  if (c.seq === 'arithmetic' || c.seq === 'geometric') {
    const k = c.k as number;
    const a1 = c.a1 as number;
    const cache = [a1];
    return {
      a: (n) => {
        while (cache.length < n) cache.push(c.seq === 'arithmetic' ? cache.at(-1)! + k : cache.at(-1)! * k);
        return cache[n - 1]!;
      },
      dom: Infinity,
    };
  }
  if (f.explicit) {
    const e = f.explicit;
    return { a: (n) => evalReal(e, { vars: { n } }), dom: Infinity };
  }
  if (f.recursion) {
    const rec = f.recursion;
    const vals: number[] = [];
    for (let i = 1; f.terms.has(i); i++) vals.push(f.terms.get(i)!);
    expect(vals.length, 'initial terms').toBeGreaterThan(0);
    return {
      a: (n) => {
        while (vals.length < n) {
          const m = vals.length + 1;
          vals.push(evalReal(rec, { vars: { n: m, P: vals[m - 2]!, Q: vals[m - 3] ?? NaN } }));
        }
        return vals[n - 1]!;
      },
      dom: Infinity,
    };
  }
  if (f.sigma) {
    const ts = sigmaTerms(f.sigma, 40);
    return { a: (n) => ts[n - 1]!, dom: ts.length };
  }
  const known = f.list ?? f.series?.head;
  expect(known, `no sequence in ${p.question}`).toBeTruthy();
  return { a: (n) => known![n - 1]!, dom: known!.length };
}

function checkFacts(f: Facts, a: (n: number) => number, dom: number, q: string): void {
  const upto = Math.min(dom, 10);
  if (f.explicit) for (let n = 1; n <= upto; n++) expectClose(evalReal(f.explicit, { vars: { n } }), a(n), `${q} explicit at ${n}`);
  if (f.recursion) {
    for (let n = 3; n <= upto; n++) expectClose(evalReal(f.recursion, { vars: { n, P: a(n - 1), Q: a(n - 2) } }), a(n), `${q} recursion at ${n}`);
  }
  for (const [k, v] of f.terms) expectClose(a(k), v, `${q} a_${k}`);
  f.list?.forEach((v, i) => expectClose(a(i + 1), v, `${q} listed term ${i + 1}`));
  f.series?.head.forEach((v, i) => expectClose(a(i + 1), v, `${q} series term ${i + 1}`));
  if (f.d !== undefined) expectClose(a(2) - a(1), f.d, `${q} d`);
  if (f.r !== undefined) expectClose(a(2) / a(1), f.r, `${q} r`);
  if (f.sigma && dom === Infinity) sigmaTerms(f.sigma, 8).forEach((t, i) => expectClose(t, a(i + 1), `${q} sigma term ${i + 1}`));
}

function lastIndex(a: (n: number) => number, last: number): number {
  for (let n = 1; n <= 3000; n++) if (close(a(n), last, 1e-12)) return n;
  throw new Error(`last term ${last} is not in the sequence`);
}

const partial = (a: (n: number) => number, n: number) => {
  let s = 0;
  for (let i = 1; i <= n; i++) s += a(i);
  return s;
};

function seqVerifier(p: ProblemContent): void {
  const c = p.check!;
  const q = p.question;
  const f = readFacts(q);
  const { a, dom } = buildSeq(p, f);
  checkFacts(f, a, dom, q);
  const ans = mathSegments(p.answer).map(prep);
  const upto = Math.min(dom, 10);
  switch (c.asked) {
    case 'terms': {
      const count = c.count as number;
      expect(q).toContain(`first ${NUMBER_WORDS[count]} terms`);
      expect(ans.length).toBe(1);
      const items = listOf(ans[0]!).map((t) => evalReal(t));
      expect(items.length, p.answer).toBe(count);
      items.forEach((v, i) => expectClose(v, a(i + 1), `${p.answer} term ${i + 1}`));
      break;
    }
    case 'term': {
      expect(f.askTerm, q).toBeDefined();
      expect(ans.length).toBe(1);
      const mm = /^a_\{(\d+)\} = (.+)$/.exec(ans[0]!)!;
      expect(Number(mm[1]), p.answer).toBe(f.askTerm);
      expectClose(evalReal(mm[2]!), a(f.askTerm!), p.answer);
      break;
    }
    case 'explicit': {
      expect(ans.length).toBe(1);
      const mm = /^a_n = (.+)$/.exec(ans[0]!)!;
      expect(mm[1]).not.toContain('(P)');
      for (let n = 1; n <= upto; n++) expectClose(evalReal(mm[1]!, { vars: { n } }), a(n), `${p.answer} at n=${n}`);
      break;
    }
    case 'recursive': {
      const g = readFacts(p.answer);
      expect(g.recursion, p.answer).toBeDefined();
      expect(g.terms.has(1), p.answer).toBe(true);
      const b = buildSeq({ ...p, check: { seq: 'question' } }, g).a;
      for (let n = 1; n <= upto; n++) expectClose(b(n), a(n), `${p.answer} at n=${n}`);
      break;
    }
    case 'sum': {
      let want: number;
      if (f.sigma) want = sigmaTerms(f.sigma).reduce((s, t) => s + t, 0);
      else if (f.askSum !== undefined) want = partial(a, f.askSum);
      else if (f.series?.last !== undefined) want = partial(a, lastIndex(a, f.series.last));
      else throw new Error(`what sum? ${q}`);
      expectClose(answerNumber(p), want, `${q} → ${p.answer}`);
      break;
    }
    case 'n': {
      expect(f.psum).toBeDefined();
      const mm = /^n = (\d+)$/.exec(ans[0]!)!;
      expectClose(partial(a, Number(mm[1])), f.psum!, `${q} → ${p.answer}`);
      break;
    }
    case 'infinite': {
      const ts = f.sigma ? sigmaTerms(f.sigma, 4001) : Array.from({ length: 4001 }, (_, i) => a(i + 1));
      const s = (n: number) => ts.slice(0, n).reduce((x, t) => x + t, 0);
      const [s1, s2, s3] = [s(2000), s(2001), s(4001)];
      const converges = [s1, s2, s3].every((x) => Number.isFinite(x)) && close(s1, s2, 1e-9) && close(s1, s3, 1e-9);
      if (!converges) expect(p.answer, q).toMatch(/^Diverges$/);
      else expectClose(answerNumber(p), s3, `${q} → ${p.answer}`);
      break;
    }
    case 'sigma': {
      expect(ans.length).toBe(1);
      const sg = parseSigma(ans[0]!)!;
      expect(sg, p.answer).toBeTruthy();
      expect(f.series, q).toBeDefined();
      const want = f.series!.explicit ? f.series!.head : Array.from({ length: lastIndex(a, f.series!.last!) }, (_, i) => a(i + 1));
      const got = sigmaTerms(sg);
      expect(got.length, `${p.answer}: number of terms`).toBe(want.length);
      got.forEach((g, i) => expectClose(g, want[i]!, `${p.answer} term ${i + 1}`));
      break;
    }
    default:
      throw new Error(`asked ${String(c.asked)}`);
  }
}

function meansVerifier(p: ProblemContent): void {
  const c = p.check!;
  const segs = mathSegments(p.question);
  expect(segs.length).toBe(2);
  const [x, y] = segs.map((s) => ev(s)) as [number, number];
  const items = listOf(mathSegments(p.answer).join(', ')).map((t) => ev(t));
  const k = c.count as number;
  expect(items.length, p.answer).toBe(k);
  if (k > 1) expect(p.question).toContain(` ${NUMBER_WORDS[k]} `);
  if (k === 1 && c.mean === 'geometric') {
    expect(items[0]!).toBeGreaterThan(0);
    expectClose(items[0]! * items[0]!, x * y, `${p.question} → ${p.answer}`);
    return;
  }
  const all = [x, ...items, y];
  for (let i = 1; i + 1 < all.length; i++) {
    if (c.mean === 'arithmetic') expectClose(all[i + 1]! - all[i]!, all[i]! - all[i - 1]!, `${p.question} → ${p.answer}`);
    else expectClose(all[i + 1]! / all[i]!, all[i]! / all[i - 1]!, `${p.question} → ${p.answer}`);
  }
}

// ---------------------------------------------------------------- counting

const LIMIT = 200_000;

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : Math.abs(a);
}

/** Ordered selections of k from n, by depth-first enumeration when small. */
function countPerm(n: number, k: number): number {
  let est = 1;
  for (let i = 0; i < k; i++) est *= n - i;
  if (est > LIMIT) return est;
  const used = new Array<boolean>(n).fill(false);
  const dfs = (depth: number): number => {
    if (depth === k) return 1;
    let c = 0;
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      used[i] = true;
      c += dfs(depth + 1);
      used[i] = false;
    }
    return c;
  };
  return dfs(0);
}

/** Pascal's triangle, independent of any factorial formula. */
function pascal(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let row = [1];
  for (let i = 1; i <= n; i++) {
    const next = [1];
    for (let j = 1; j < i; j++) next.push(row[j - 1]! + row[j]!);
    next.push(1);
    row = next;
  }
  return row[k]!;
}

function countComb(n: number, k: number): number {
  const est = pascal(n, k);
  if (est > LIMIT) return est;
  const dfs = (start: number, left: number): number => {
    if (left === 0) return 1;
    let c = 0;
    for (let i = start; i <= n - left; i++) c += dfs(i + 1, left - 1);
    return c;
  };
  return dfs(0, k);
}

function countRepeat(n: number, k: number): number {
  if (n ** k > LIMIT) return n ** k;
  const dfs = (depth: number): number => (depth === k ? 1 : Array.from({ length: n }, () => dfs(depth + 1)).reduce((a, b) => a + b, 0));
  return dfs(0);
}

interface Factor {
  n: number;
  k: number;
  mode: 'repeat' | 'perm' | 'comb';
}

const countFactor = (f: Factor) => (f.mode === 'repeat' ? countRepeat(f.n, f.k) : f.mode === 'perm' ? countPerm(f.n, f.k) : countComb(f.n, f.k));

function expectMentions(p: ProblemContent): void {
  for (const s of (p.check!.mentions as string[] | undefined) ?? []) expect(p.question, `mentions ${s}`).toContain(s);
}

/** The (last) number in the answer, thousands separators removed. */
function lastNumber(rich: string): number {
  const segs = mathSegments(rich);
  expect(segs.length, rich).toBeGreaterThan(0);
  return ev(segs.at(-1)!);
}

function countVerifier(p: ProblemContent): void {
  const c = p.check!;
  expectMentions(p);
  const want = (c.factors as Factor[]).reduce((acc, f) => acc * countFactor(f), 1);
  expect(lastNumber(p.answer), `${p.question} → ${p.answer}`).toBe(want);
  if (c.label) expect(p.answer.startsWith(`${c.label as string};`), p.answer).toBe(true);
}

function countExprVerifier(p: ProblemContent): void {
  const segs = mathSegments(p.question);
  expect(segs.length).toBe(1);
  const tex = segs[0]!
    .replace(/\{\}_\{(\d+)\}P_\{(\d+)\}/g, (_, n: string, r: string) => `(${countPerm(Number(n), Number(r))})`)
    .replace(/\{\}_\{(\d+)\}C_\{(\d+)\}/g, (_, n: string, r: string) => `(${countComb(Number(n), Number(r))})`);
  expect(tex, 'all counting notation replaced').not.toMatch(/\{\}_/);
  expectClose(lastNumber(p.answer), ev(tex), `${p.question} → ${p.answer}`);
}

/** Distinct strings of length r from a multiset of letters, by enumeration with memo. */
function letterArrangements(word: string, r: number): number {
  const counts = new Map<string, number>();
  for (const ch of word) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  const keys = [...counts.keys()];
  const memo = new Map<string, number>();
  const rec = (state: number[], left: number): number => {
    if (left === 0) return 1;
    const key = `${state.join(',')}|${left}`;
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    let c = 0;
    state.forEach((k, i) => {
      if (!k) return;
      state[i]--;
      c += rec(state, left - 1);
      state[i]++;
    });
    memo.set(key, c);
    return c;
  };
  return rec(keys.map((k) => counts.get(k)!), r);
}

function lettersVerifier(p: ProblemContent): void {
  const word = /word ([A-Z]+)/.exec(p.question)![1]!;
  const part = /(\d+)-letter arrangements/.exec(p.question);
  const r = part ? Number(part[1]) : word.length;
  expect(r).toBe(p.check!.r);
  if (part) expect(new Set(word).size, 'no repeated letters for partial arrangements').toBe(word.length);
  expect(lastNumber(p.answer), `${p.question} → ${p.answer}`).toBe(letterArrangements(word, r));
}

function spaceVerifier(p: ProblemContent): void {
  const c = p.check!;
  expectMentions(p);
  const stages = c.stages as string[][];
  const sep = c.sep as string;
  const want = stages.reduce<string[]>((acc, st) => acc.flatMap((a) => st.map((x) => (a === '' ? x : `${a}${sep}${x}`))), ['']);
  const [list, rest] = p.answer.split(';');
  const got = list!.split(',').map((x) => x.trim());
  expect(new Set(got).size, 'no repeated outcomes').toBe(got.length);
  expect([...got].sort(), p.answer).toEqual([...want].sort());
  expect(ev(mathSegments(rest!)[0]!)).toBe(want.length);
  // every listed code is something the question offers
  for (const st of stages) for (const x of st) if (x.length > 1) expect(p.question).toContain(x);
}

// ---------------------------------------------------------------- probability by enumeration

type AttrValue = string | number;
type Attrs = Record<string, AttrValue>;
interface PoolSpec {
  die?: number;
  deck?: boolean;
  coin?: boolean;
  items?: Array<{ count: number; attrs: Attrs }>;
}
type Ev = Record<string, unknown>;
interface Experiment {
  pools: Record<string, PoolSpec>;
  draws: string[];
  replace: boolean;
  event: Ev;
}

const DECK_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const DECK_SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];

function poolOf(p: PoolSpec): Array<{ count: number; attrs: Attrs }> {
  if (p.die) return Array.from({ length: p.die }, (_, i) => ({ count: 1, attrs: { value: i + 1 } }));
  if (p.coin) return [{ count: 1, attrs: { side: 'H' } }, { count: 1, attrs: { side: 'T' } }];
  if (p.deck) {
    expect(DECK_RANKS.length * DECK_SUITS.length).toBe(52);
    return DECK_RANKS.flatMap((rank) => DECK_SUITS.map((suit) => ({ count: 1, attrs: { rank, suit } })));
  }
  return p.items!;
}

function attrsUsed(e: Ev, out = new Set<string>()): Set<string> {
  if (typeof e.attr === 'string') out.add(e.attr);
  if (typeof e.sum === 'string') out.add(e.sum);
  if (typeof e.same === 'string') out.add(e.same);
  if (e.count) out.add((e.count as { attr: string }).attr);
  for (const k of ['and', 'or']) if (Array.isArray(e[k])) (e[k] as Ev[]).forEach((x) => attrsUsed(x, out));
  if (e.not) attrsUsed(e.not as Ev, out);
  return out;
}

function evHolds(e: Ev, out: Attrs[]): boolean {
  if ('at' in e) return (e.in as AttrValue[]).includes(out[e.at as number]![e.attr as string]!);
  if ('and' in e) return (e.and as Ev[]).every((x) => evHolds(x, out));
  if ('or' in e) return (e.or as Ev[]).some((x) => evHolds(x, out));
  if ('not' in e) return !evHolds(e.not as Ev, out);
  if ('count' in e) {
    const cnt = e.count as { attr: string; in: AttrValue[] };
    const k = out.filter((o) => cnt.in.includes(o[cnt.attr]!)).length;
    return e.op === '>=' ? k >= (e.n as number) : k === e.n;
  }
  if ('sum' in e) {
    const s = out.reduce((acc, o) => acc + Number(o[e.sum as string]), 0);
    const v = e.value as number;
    return e.op === '=' ? s === v : e.op === '>' ? s > v : e.op === '<' ? s < v : (() => { throw new Error(`op ${String(e.op)}`); })();
  }
  if ('same' in e) return out.every((o) => o[e.same as string] === out[0]![e.same as string]);
  throw new Error(`unknown event ${JSON.stringify(e)}`);
}

/** Probability of the event over every sequence of draws (items grouped by the attributes the event reads). */
function enumerate(x: Experiment): number {
  const used = [...attrsUsed(x.event)];
  const pools: Record<string, Array<{ count: number; attrs: Attrs }>> = {};
  for (const [name, spec] of Object.entries(x.pools)) {
    const groups = new Map<string, { count: number; attrs: Attrs }>();
    for (const it of poolOf(spec)) {
      expect(it.count).toBeGreaterThanOrEqual(0);
      const sig = JSON.stringify(used.map((a) => it.attrs[a] ?? null));
      const g = groups.get(sig);
      if (g) g.count += it.count;
      else groups.set(sig, { count: it.count, attrs: it.attrs });
    }
    pools[name] = [...groups.values()];
  }
  const out: Attrs[] = [];
  const rec = (i: number): number => {
    if (i === x.draws.length) return evHolds(x.event, out) ? 1 : 0;
    const pool = pools[x.draws[i]!]!;
    const total = pool.reduce((s, it) => s + it.count, 0);
    let acc = 0;
    for (const it of pool) {
      if (!it.count) continue;
      const w = it.count / total;
      out.push(it.attrs);
      if (!x.replace) it.count--;
      acc += w * rec(i + 1);
      if (!x.replace) it.count++;
      out.pop();
    }
    return acc;
  };
  return rec(0);
}

function probVerifier(p: ProblemContent): void {
  expectMentions(p);
  const want = enumerate(p.check!.exp as Experiment);
  const segs = mathSegments(p.answer);
  expect(segs.length, p.answer).toBe(1);
  const seg = segs[0]!.trim();
  if (seg.includes('\\frac')) {
    const mm = /^\\frac\{(\d+)\}\{(\d+)\}$/.exec(seg);
    expect(mm, `reduced fraction: ${seg}`).toBeTruthy();
    expect(gcd(Number(mm![1]), Number(mm![2])), `reduced: ${seg}`).toBe(1);
    expect(Math.abs(ev(seg) - want), `${p.question} → ${p.answer} (want ${want})`).toBeLessThan(1e-12);
    return;
  }
  const pct = seg.endsWith('\\%');
  const body = seg.replace(/\\%$/, '');
  const decimals = (body.split('.')[1] ?? '').length;
  const tol = 0.5 * 10 ** -decimals * (pct ? 0.01 : 1) + 1e-12;
  const got = ev(body) * (pct ? 0.01 : 1);
  expect(Math.abs(got - want), `${p.question} → ${p.answer} (want ${want})`).toBeLessThanOrEqual(tol);
  if (Number.isInteger(want) === false) expect(decimals, 'shows decimals').toBeGreaterThan(0);
}

export const VERIFIERS: Record<string, Verifier> = {
  [`${PFX}.seq`]: seqVerifier,
  [`${PFX}.means`]: meansVerifier,
  [`${PFX}.count`]: countVerifier,
  [`${PFX}.countExpr`]: countExprVerifier,
  [`${PFX}.letters`]: lettersVerifier,
  [`${PFX}.space`]: spaceVerifier,
  [`${PFX}.prob`]: probVerifier,
};
