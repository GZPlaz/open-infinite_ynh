/**
 * Shared helpers for the multivariable calculus generators:
 *  - MX: a small closed algebra of terms c·(monomial in several variables)·atom
 *    (atom = e^{u}, sin u, cos u or ln u of a monomial u) that can be
 *    differentiated, evaluated and rendered tidily; atom-free MX are
 *    multivariable polynomials that can also be integrated and substituted.
 *  - Ex: exact real numbers c·√n·π^p (+ an optional opaque symbol such as e^{2}).
 *  - 3-D integer vector helpers and LaTeX for vectors.
 */
import { Frac, lcm, type FracLike } from '../../fraction';
import { defineTopic, distinctDistractors, strOpt } from '../../generator';
import { simplifySqrt } from '../../radical';
import type { Rng } from '../../rng';
import { num } from '../../tex';
import type { Diagram } from '../../diagram';
import type { Difficulty, GeneratorContext, OptionDef, RichText, TopicGenerator } from '../../types';

export const VAR_ORDER = ['x', 'y', 'z', 't', 's', 'u', 'v', 'r', '\\rho', '\\phi', '\\theta'];
const rank = (v: string) => {
  const i = VAR_ORDER.indexOf(v);
  return i < 0 ? 99 : i;
};

export type Mono = Record<string, number>;
export type AtomFn = 'exp' | 'sin' | 'cos' | 'ln';
export interface Atom {
  fn: AtomFn;
  k: Frac;
  e: Mono;
}
export interface MT {
  c: Frac;
  e: Mono;
  a?: Atom;
}
export type MX = MT[];

const F = (x: FracLike) => Frac.of(x);

function cleanMono(e: Mono): Mono {
  const out: Mono = {};
  for (const v of Object.keys(e).sort((a, b) => rank(a) - rank(b))) if (e[v]) out[v] = e[v]!;
  return out;
}
const monoKey = (e: Mono) => Object.entries(cleanMono(e)).map(([v, k]) => `${v}${k}`).join('.');
const atomKey = (a?: Atom) => (a ? `${a.fn}(${a.k.toString()}*${monoKey(a.e)})` : '');
const termKey = (t: MT) => `${monoKey(t.e)}|${atomKey(t.a)}`;

/** Term constructor; normalises sin(−u) = −sin u and cos(−u) = cos u. */
export function mt(c: FracLike, e: Mono = {}, a?: { fn: AtomFn; k?: FracLike; e: Mono }): MT {
  let cc = F(c);
  let atom: Atom | undefined;
  if (a) {
    let k = F(a.k ?? 1);
    if (k.sign < 0 && a.fn === 'sin') {
      k = k.neg();
      cc = cc.neg();
    } else if (k.sign < 0 && a.fn === 'cos') k = k.neg();
    atom = { fn: a.fn, k, e: cleanMono(a.e) };
  }
  return { c: cc, e: cleanMono(e), a: atom };
}

/** Shorthand: monomial from a string like 'x2y' → {x: 2, y: 1}. Greek names are not supported here. */
export function mono(s: string): Mono {
  const out: Mono = {};
  for (const mm of s.matchAll(/([a-z])(-?\d*)/g)) out[mm[1]!] = (out[mm[1]!] ?? 0) + (mm[2] ? Number(mm[2]) : 1);
  return out;
}

/** c·monomial from strings: P(3, 'x2y'). */
export const P = (c: FracLike, s = ''): MT => mt(c, mono(s));

export function norm(x: readonly MT[]): MX {
  const out: MT[] = [];
  const idx = new Map<string, number>();
  for (const t of x) {
    const k = termKey(t);
    const i = idx.get(k);
    if (i === undefined) {
      idx.set(k, out.length);
      out.push(t);
    } else out[i] = { ...out[i]!, c: out[i]!.c.add(t.c) };
  }
  return out.filter((t) => !t.c.isZero());
}

export const add = (...xs: ReadonlyArray<readonly MT[]>): MX => norm(xs.flat());
export const scale = (x: readonly MT[], k: FracLike): MX => norm(x.map((t) => ({ ...t, c: t.c.mul(k) })));
export const sub = (a: readonly MT[], b: readonly MT[]): MX => add(a, scale(b, -1));

function mulMono(a: Mono, b: Mono): Mono {
  const out: Mono = { ...a };
  for (const [v, k] of Object.entries(b)) out[v] = (out[v] ?? 0) + k;
  return cleanMono(out);
}

export function mul(a: readonly MT[], b: readonly MT[]): MX {
  const out: MT[] = [];
  for (const s of a)
    for (const t of b) {
      if (s.a && t.a) throw new Error('mul: two atoms');
      out.push({ c: s.c.mul(t.c), e: mulMono(s.e, t.e), a: s.a ?? t.a });
    }
  return norm(out);
}

export function powMX(a: readonly MT[], k: number): MX {
  let r: MX = [mt(1)];
  for (let i = 0; i < k; i++) r = mul(r, a);
  return r;
}

export const isPoly = (x: readonly MT[]) => x.every((t) => !t.a && Object.values(t.e).every((k) => k >= 0));

/** Partial derivative. */
export function diff(x: readonly MT[], v: string): MX {
  const out: MT[] = [];
  for (const t of x) {
    const ev = t.e[v] ?? 0;
    if (ev) out.push({ c: t.c.mul(ev), e: cleanMono({ ...t.e, [v]: ev - 1 }), a: t.a });
    const a = t.a;
    const av = a?.e[v] ?? 0;
    if (a && av) {
      // inner g = k·m, ∂g/∂v = k·av·m/v
      const gv = a.k.mul(av);
      const mv = cleanMono({ ...a.e, [v]: av - 1 });
      switch (a.fn) {
        case 'exp':
          out.push({ c: t.c.mul(gv), e: mulMono(t.e, mv), a });
          break;
        case 'sin':
          out.push({ c: t.c.mul(gv), e: mulMono(t.e, mv), a: { ...a, fn: 'cos' } });
          break;
        case 'cos':
          out.push({ c: t.c.mul(gv).neg(), e: mulMono(t.e, mv), a: { ...a, fn: 'sin' } });
          break;
        case 'ln':
          out.push({ c: t.c.mul(av), e: cleanMono({ ...t.e, [v]: ev - 1 }) });
          break;
      }
    }
  }
  return norm(out);
}

function monoVal(e: Mono, env: Record<string, number>): number {
  let r = 1;
  for (const [v, k] of Object.entries(e)) r *= env[v]! ** k;
  return r;
}

export function evalNum(x: readonly MT[], env: Record<string, number>): number {
  let s = 0;
  for (const t of x) {
    let v = t.c.value * monoVal(t.e, env);
    if (t.a) {
      const g = t.a.k.value * monoVal(t.a.e, env);
      v *= t.a.fn === 'exp' ? Math.exp(g) : t.a.fn === 'sin' ? Math.sin(g) : t.a.fn === 'cos' ? Math.cos(g) : Math.log(g);
    }
    s += v;
  }
  return s;
}

function monoExact(e: Mono, env: Record<string, FracLike>): Frac | null {
  let r = Frac.ONE;
  for (const [v, k] of Object.entries(e)) {
    const b = F(env[v]!);
    if (b.isZero() && k < 0) return null;
    r = r.mul(b.pow(k));
  }
  return r;
}

/** Exact value at a rational point, or null when an atom is not at a "nice" argument (e⁰, sin 0, cos 0, ln 1). */
export function evalExact(x: readonly MT[], env: Record<string, FracLike>): Frac | null {
  let s = Frac.ZERO;
  for (const t of x) {
    const m = monoExact(t.e, env);
    if (!m) return null;
    let v = t.c.mul(m);
    if (t.a) {
      const g0 = monoExact(t.a.e, env);
      if (!g0) return null;
      const g = t.a.k.mul(g0);
      if (t.a.fn === 'ln') {
        if (!g.eq(1)) return null;
        v = Frac.ZERO;
      } else {
        if (!g.isZero()) return null;
        if (t.a.fn === 'sin') v = Frac.ZERO;
      }
    }
    s = s.add(v);
  }
  return s;
}

/** Substitute exact values for some variables (polynomial terms or atoms that become nice). */
export function partialEval(x: readonly MT[], env: Record<string, FracLike>): MX | null {
  const out: MT[] = [];
  for (const t of x) {
    let c = t.c;
    const e: Mono = {};
    for (const [v, k] of Object.entries(t.e)) {
      if (v in env) {
        const b = F(env[v]!);
        if (b.isZero() && k < 0) return null;
        c = c.mul(b.pow(k));
      } else e[v] = k;
    }
    let a = t.a;
    if (a && Object.keys(a.e).some((v) => v in env)) {
      const rest: Mono = {};
      let k = a.k;
      for (const [v, p] of Object.entries(a.e)) {
        if (v in env) k = k.mul(F(env[v]!).pow(p));
        else rest[v] = p;
      }
      if (k.isZero()) {
        if (a.fn === 'sin') c = Frac.ZERO;
        else if (a.fn === 'ln') return null;
        a = undefined;
      } else if (!Object.keys(rest).length) {
        if (a.fn === 'ln' && k.eq(1)) c = Frac.ZERO;
        else return null;
        a = undefined;
      } else a = { ...a, k, e: cleanMono(rest) };
    }
    out.push({ c, e: cleanMono(e), a });
  }
  return norm(out);
}

// ---------------------------------------------------------------- polynomial calculus

/** Antiderivative in v (polynomials only). */
export function integ(x: readonly MT[], v: string): MX {
  return norm(
    x.map((t) => {
      if (t.a) throw new Error('integ: atoms');
      const k = (t.e[v] ?? 0) + 1;
      if (k <= 0) throw new Error('integ: negative power');
      return { c: t.c.div(k), e: cleanMono({ ...t.e, [v]: k }) };
    }),
  );
}

/** Replace variable v by the polynomial p (non-negative powers of v only). */
export function subst(x: readonly MT[], v: string, p: readonly MT[]): MX {
  const out: MT[][] = [];
  for (const t of x) {
    const k = t.e[v] ?? 0;
    if (k < 0) throw new Error('subst: negative power');
    if (t.a && (t.a.e[v] ?? 0)) throw new Error('subst: atom depends on v');
    const rest = cleanMono({ ...t.e, [v]: 0 });
    out.push(mul([{ c: t.c, e: rest, a: t.a }], powMX(p, k)));
  }
  return add(...out);
}

/** ∫_{lo}^{hi} x dv with polynomial bounds. */
export function definite(x: readonly MT[], v: string, lo: readonly MT[], hi: readonly MT[]): MX {
  const A = integ(x, v);
  return sub(subst(A, v, hi), subst(A, v, lo));
}

export const constOf = (x: readonly MT[]): Frac => {
  const n = norm(x);
  if (n.some((t) => t.a || Object.keys(t.e).length)) throw new Error('constOf: not constant');
  return n[0]?.c ?? Frac.ZERO;
};

export const cst = (c: FracLike): MX => (F(c).isZero() ? [] : [mt(c)]);
export const vr = (v: string, c: FracLike = 1): MX => [mt(c, { [v]: 1 })];

// ---------------------------------------------------------------- rendering

function powTex(v: string, k: number): string {
  if (k === 1) return v;
  return `${v}^{${k}}`;
}

function monoTex(e: Mono): string {
  let s = '';
  for (const [v, k] of Object.entries(cleanMono(e))) {
    const p = powTex(v, k);
    if (s && /\\[a-zA-Z]+$/.test(s) && /^[a-zA-Z]/.test(p)) s += ' ';
    s += p;
  }
  return s;
}

function atomTex(a: Atom): string {
  const top = Object.fromEntries(Object.entries(a.e).filter(([, k]) => k > 0));
  const bot = Object.fromEntries(Object.entries(a.e).map(([v, k]) => [v, -k]).filter(([, k]) => (k as number) > 0));
  let inner: string;
  const k = a.k;
  const topT = monoTex(top);
  const botT = monoTex(bot);
  if (!botT) inner = (k.eq(1) ? '' : k.eq(-1) ? '-' : k.toTex()) + topT;
  else inner = `${k.sign < 0 ? '-' : ''}\\frac{${k.abs().n === 1 && topT ? '' : k.abs().n}${topT}}{${k.d === 1 ? '' : k.d}${botT}}`;
  if (!topT && !botT) inner = k.toTex();
  switch (a.fn) {
    case 'exp':
      return `e^{${inner}}`;
    default: {
      const simple = k.eq(1) && !botT && Object.keys(top).length === 1 && Object.values(top)[0] === 1;
      return simple ? `\\${a.fn} ${inner}` : `\\${a.fn}(${inner})`;
    }
  }
}

/** Magnitude of a term. */
function termMag(t: MT): string {
  const c = t.c.abs();
  const pos = Object.fromEntries(Object.entries(t.e).filter(([, k]) => k > 0));
  const neg = Object.fromEntries(Object.entries(t.e).filter(([, k]) => k < 0).map(([v, k]) => [v, -k]));
  let top = monoTex(pos);
  if (t.a) {
    const at = atomTex(t.a);
    top = top ? `${top}${/\\[a-zA-Z]+$/.test(top) && /^[a-zA-Z]/.test(at) ? ' ' : ''}${at}` : at;
  }
  const bot = monoTex(neg);
  const numer = c.n === 1 && top ? top : `${c.n}${top}`;
  const denom = `${c.d === 1 ? '' : c.d}${bot}`;
  return denom ? `\\frac{${numer}}{${denom}}` : numer;
}

/** LaTeX of a sum of terms (0 for the empty sum). Order: as given (after combining). */
export function tex(x: readonly MT[]): string {
  const n = norm(x);
  if (!n.length) return '0';
  return n.map((t, i) => (i === 0 ? `${t.c.sign < 0 ? '-' : ''}${termMag(t)}` : `${t.c.sign < 0 ? ' - ' : ' + '}${termMag(t)}`)).join('');
}

/** Total degree ordering, highest first, variables in VAR_ORDER. */
export function sorted(x: readonly MT[]): MX {
  const deg = (t: MT) => Object.values(t.e).reduce((s, k) => s + k, 0) + (t.a ? 0.5 : 0);
  const lex = (t: MT) => Object.entries(t.e).map(([v, k]) => String.fromCharCode(65 + rank(v)) + String.fromCharCode(80 - k)).join('');
  return norm(x).slice().sort((a, b) => deg(b) - deg(a) || (lex(a) < lex(b) ? -1 : lex(a) > lex(b) ? 1 : 0));
}

/** Wrap in parentheses when there is more than one term. */
export function grp(x: readonly MT[]): string {
  return norm(x).length > 1 ? `(${tex(x)})` : tex(x);
}

// ---------------------------------------------------------------- exact numbers

export interface ExT {
  c: Frac;
  pi: number;
  rad: number;
  /** opaque factor such as `e^{2}` or `\ln 3`, with its value */
  sym?: string;
  val?: number;
}
export type Ex = ExT[];

const exKey = (t: ExT) => `${t.pi}|${t.rad}|${t.sym ?? ''}`;

export function exNorm(x: readonly ExT[]): Ex {
  const out: ExT[] = [];
  for (const t of x) {
    if (t.c.isZero()) continue;
    const i = out.findIndex((o) => exKey(o) === exKey(t));
    if (i >= 0) out[i] = { ...out[i]!, c: out[i]!.c.add(t.c) };
    else out.push({ ...t });
  }
  return out.filter((t) => !t.c.isZero());
}

/** c·√n·π^pi (√n simplified). */
export function ex(c: FracLike, opts: { pi?: number; rad?: number; sym?: string; val?: number } = {}): Ex {
  const { out, inside } = simplifySqrt(opts.rad ?? 1);
  return exNorm([{ c: F(c).mul(out), pi: opts.pi ?? 0, rad: inside, sym: opts.sym, val: opts.val }]);
}
export const exAdd = (...xs: ReadonlyArray<readonly ExT[]>): Ex => exNorm(xs.flat());
export const exScale = (x: readonly ExT[], k: FracLike): Ex => exNorm(x.map((t) => ({ ...t, c: t.c.mul(k) })));
export function exMul(a: readonly ExT[], b: readonly ExT[]): Ex {
  const out: ExT[] = [];
  for (const s of a)
    for (const t of b) {
      if (s.sym && t.sym) throw new Error('exMul: two symbols');
      const { out: o, inside } = simplifySqrt(s.rad * t.rad);
      out.push({ c: s.c.mul(t.c).mul(o), pi: s.pi + t.pi, rad: inside, sym: s.sym ?? t.sym, val: s.val ?? t.val });
    }
  return exNorm(out);
}
export const exVal = (x: readonly ExT[]): number => x.reduce((s, t) => s + t.c.value * Math.sqrt(t.rad) * Math.PI ** t.pi * (t.val ?? 1), 0);
export const exFrac = (x: readonly ExT[]): Frac | null => (x.every((t) => !t.pi && t.rad === 1 && !t.sym) ? x.reduce((s, t) => s.add(t.c), Frac.ZERO) : null);
export const exIsZero = (x: readonly ExT[]) => exNorm(x).length === 0;

function exFactors(t: ExT): string {
  let s = '';
  if (t.rad > 1) s += `\\sqrt{${t.rad}}`;
  if (t.sym) s += t.sym;
  if (t.pi) s += t.pi === 1 ? '\\pi' : `\\pi^{${t.pi}}`;
  return s;
}

function exMagnitude(t: ExT): string {
  const c = t.c.abs();
  const f = exFactors(t);
  const numer = c.n === 1 && f ? f : `${c.n}${f}`;
  return c.d === 1 ? numer : `\\frac{${numer}}{${c.d}}`;
}

/** LaTeX of an exact number; several terms with fractions go over a common denominator. */
export function exTex(x: readonly ExT[]): string {
  const n = exNorm(x);
  if (!n.length) return '0';
  const ordered = [...n.filter((t) => t.pi || t.rad > 1 || t.sym), ...n.filter((t) => !(t.pi || t.rad > 1 || t.sym))];
  const L = ordered.reduce((l, t) => lcm(l, t.c.d), 1);
  const join = (ts: ExT[]) => ts.map((t, i) => (i === 0 ? `${t.c.sign < 0 ? '-' : ''}${exMagnitude(t)}` : `${t.c.sign < 0 ? ' - ' : ' + '}${exMagnitude(t)}`)).join('');
  if (ordered.length > 1 && L > 1) {
    const scaled = ordered.map((t) => ({ ...t, c: t.c.mul(L) }));
    // keep a leading minus outside the fraction
    if (scaled[0]!.c.sign < 0) return `-\\frac{${join(scaled.map((t) => ({ ...t, c: t.c.neg() })))}}{${L}}`;
    return `\\frac{${join(scaled)}}{${L}}`;
  }
  return join(ordered);
}

/** a/√n style values rationalised: Ex for (p/q)·√n. */
export const exRad = (c: FracLike, n: number): Ex => ex(c, { rad: n });
export const exPi = (c: FracLike, p = 1): Ex => ex(c, { pi: p });
export const exQ = (c: FracLike): Ex => ex(c);

// ---------------------------------------------------------------- vectors

export type V3 = number[];
export const dot = (a: readonly number[], b: readonly number[]) => a.reduce((s, x, i) => s + x * b[i]!, 0);
export const cross = (a: readonly number[], b: readonly number[]): V3 => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
export const vsub = (a: readonly number[], b: readonly number[]): V3 => a.map((x, i) => x - b[i]!);
export const vadd = (a: readonly number[], b: readonly number[]): V3 => a.map((x, i) => x + b[i]!);
export const vscale = (a: readonly number[], k: number): V3 => a.map((x) => x * k);
export const norm2 = (a: readonly number[]) => dot(a, a);
export const isZeroV = (a: readonly number[]) => a.every((x) => x === 0);

/** `\left\langle a, b, c \right\rangle`. */
export function vtex(xs: ReadonlyArray<FracLike | string>): string {
  return `\\left\\langle ${xs.map((x) => (typeof x === 'string' ? x : num(x))).join(', ')} \\right\\rangle`;
}
export const bf = (s: string) => `\\mathbf{${s}}`;
export const ptex = (xs: ReadonlyArray<FracLike | string>) => `\\left(${xs.map((x) => (typeof x === 'string' ? x : num(x))).join(', ')}\\right)`;

/** Integer vector with at least `nz` non-zero entries. */
export function randV(rng: Rng, R: number, nz = 2, dim = 3): V3 {
  for (;;) {
    const v = Array.from({ length: dim }, () => rng.int(-R, R));
    if (v.filter((x) => x !== 0).length >= nz) return v;
  }
}

/** √n in simplest form as Ex-LaTeX. */
export const sqrtEx = (n: number) => exTex(exRad(1, n));

/** Multiple choice helper: answer + wrong candidates + numeric-ish fallback. */
export function mc(answer: RichText, wrongs: ReadonlyArray<RichText | null | undefined>, fallback: (k: number) => RichText | null): RichText[] {
  return distinctDistractors(answer, wrongs, fallback);
}

/** Exact multiple of π as LaTeX: `\frac{3\pi}{4}`. */
export function piTex(k: FracLike): string {
  return exTex(exPi(k));
}

// ---------------------------------------------------------------- standard angles

/** cos(kπ) for k a multiple of 1/6 or 1/4, exactly. */
export function cosPi(k: Frac): Ex {
  // reduce to [0, 2)
  let r = new Frac(((k.n % (2 * k.d)) + 2 * k.d) % (2 * k.d), k.d);
  let sign = 1;
  if (r.cmp(1) >= 0) {
    // cos(π + a) = −cos a
    r = r.sub(1);
    sign = -1;
  }
  if (r.cmp(new Frac(1, 2)) > 0) {
    r = Frac.ONE.sub(r);
    sign = -sign;
  }
  const key = r.toString();
  const table: Record<string, Ex> = {
    '0': exQ(1),
    '1/6': exRad(new Frac(1, 2), 3),
    '1/4': exRad(new Frac(1, 2), 2),
    '1/3': exQ(new Frac(1, 2)),
    '1/2': [],
  };
  const v = table[key];
  if (!v) throw new Error(`cosPi: ${k.toString()}`);
  return exScale(v, sign);
}
export const sinPi = (k: Frac): Ex => cosPi(new Frac(1, 2).sub(k));

/** Standard angles in [0, 2π) as multiples of π. */
export const STD_ANGLES: Frac[] = [0, 1, 2, 3, 4, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20, 21, 22].map((n) => new Frac(n, 12)).filter((f) => [1, 2, 3, 4, 6].includes(f.d) || f.isZero());

// ---------------------------------------------------------------- task-based topics

export interface Built {
  question: RichText;
  answer: RichText;
  steps: RichText[];
  wrongs: ReadonlyArray<RichText | null | undefined>;
  fallback: (k: number) => RichText | null;
  check: Record<string, unknown>;
  diagram?: Diagram;
  answerDiagram?: Diagram;
}

export interface TaskTopicDef<T extends string> {
  id: string;
  title: string;
  description: string;
  category: string;
  instruction: string;
  defaultCount?: number;
  tasks: ReadonlyArray<{ value: T; label: string }>;
  mix: Record<Difficulty, readonly T[]>;
  options?: readonly OptionDef[];
  build: (task: T, ctx: GeneratorContext) => Built;
}

/** A multiple-choice topic with a "Find" select (mixed by difficulty, or one task). */
export function taskTopic<T extends string>(d: TaskTopicDef<T>): TopicGenerator {
  return defineTopic({
    id: d.id,
    subject: 'multivariable',
    category: d.category,
    title: d.title,
    description: d.description,
    instruction: d.instruction,
    multipleChoice: true,
    defaultCount: d.defaultCount ?? 10,
    options: [
      {
        type: 'select',
        id: 'task',
        label: 'Problem type',
        default: 'any',
        choices: [{ value: 'any', label: 'Mixed (by difficulty)' }, ...d.tasks],
      },
      ...(d.options ?? []),
    ],
    generate(ctx) {
      const t = strOpt(ctx, 'task');
      const task = (t === 'any' || !t ? ctx.rng.pick(d.mix[ctx.difficulty]) : t) as T;
      const b = d.build(task, ctx);
      return {
        question: b.question,
        answer: b.answer,
        steps: b.steps,
        distractors: distinctDistractors(b.answer, b.wrongs, b.fallback),
        diagram: b.diagram,
        answerDiagram: b.answerDiagram,
        check: b.check,
      };
    },
  });
}
