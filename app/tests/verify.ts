/**
 * Per-kind answer verification. Each verifier receives the generated problem
 * and throws (via expect) when the rendered answer key is wrong.
 */
import { expect } from 'vitest';
import type { ProblemContent } from '../src/engine/types';
import {
  close,
  closeC,
  evalReal,
  evaluate,
  listItems,
  mathSegments,
  onlyMath,
  RELATIONS,
  splitTop,
  stripUnits,
  type C,
} from './evaluator';

type Verifier = (p: ProblemContent) => void;

const SAMPLE_POINTS = [-2.7, -1.3, 0.6, 1.7, 3.1];
const POSITIVE_POINTS = [0.7, 1.3, 1.9, 2.6, 3.4];

function sides(tex: string): [string, string] {
  const { parts, rels } = splitTop(tex, ['=']);
  expect(rels.length, `one '=' in ${tex}`).toBe(1);
  return [parts[0]!, parts[1]!];
}

function rhs(answerMath: string): string {
  const { parts } = splitTop(answerMath, ['=']);
  return parts[parts.length - 1]!;
}

function relHolds(a: number, rel: string, b: number): boolean {
  const eps = 1e-9;
  switch (rel) {
    case '<':
      return a < b - eps;
    case '>':
      return a > b + eps;
    case '\\le':
    case '\\leq':
      return a <= b + eps;
    case '\\ge':
    case '\\geq':
      return a >= b - eps;
    case '=':
      return Math.abs(a - b) <= eps;
    default:
      throw new Error(`relation ${rel}`);
  }
}

function chainHolds(tex: string, vars: Record<string, number>): boolean {
  const { parts, rels } = splitTop(tex, RELATIONS);
  const vals = parts.map((p) => evalReal(p, { vars }));
  return rels.every((r, i) => relHolds(vals[i]!, r, vals[i + 1]!));
}

/** Check that two expressions agree at several points. */
export function expectEquivalent(a: string, b: string, vars: string[], positive = false, opts: { mixed?: boolean } = {}): void {
  const pts = positive ? POSITIVE_POINTS : SAMPLE_POINTS;
  for (let i = 0; i < pts.length; i++) {
    const env: Record<string, number> = {};
    vars.forEach((v, j) => (env[v] = pts[(i + j * 2) % pts.length]! + j * 0.11));
    const x = evaluate(a, { vars: env, ...opts });
    const y = evaluate(b, { vars: env, ...opts });
    expect(closeC(x, y, 1e-7), `${a}  vs  ${b}  at ${JSON.stringify(env)}`).toBe(true);
  }
}

export const VERIFIERS: Record<string, Verifier> = {
  value(p) {
    const mixed = p.check!.mixed === true;
    const q = evalReal(onlyMath(p.question), { mixed });
    const a = evalReal(onlyMath(p.answer), { mixed });
    expect(close(q, p.check!.value as number), p.question).toBe(true);
    expect(close(a, p.check!.value as number), p.answer).toBe(true);
  },

  linear(p) {
    const [l, r] = sides(onlyMath(p.question));
    const v = p.check!.variable as string;
    const f = (x: number) => evalReal(l, { vars: { [v]: x } }) - evalReal(r, { vars: { [v]: x } });
    const sol = p.check!.solution;
    if (typeof sol === 'number') {
      expect(close(f(sol), 0), `${p.question} at ${sol}`).toBe(true);
      expect(close(evalReal(rhs(onlyMath(p.answer))), sol), p.answer).toBe(true);
    } else {
      const d = [f(0), f(1), f(-3)];
      expect(close(d[0]!, d[1]!) && close(d[1]!, d[2]!), `${p.question} should not depend on ${v}`).toBe(true);
      expect(sol === 'all' ? close(d[0]!, 0) : !close(d[0]!, 0), p.question).toBe(true);
    }
  },

  quadratic(p) {
    const [l, r] = sides(onlyMath(p.question));
    const v = p.check!.variable as string;
    const roots = listItems(onlyMath(p.answer)).map((t) => evaluate(t));
    const D = (p.check!.b as number) ** 2 - 4 * (p.check!.a as number) * (p.check!.c as number);
    expect(roots.length).toBe(D === 0 ? 1 : 2);
    for (const root of roots) {
      const lv = evaluate(l, { vars: { [v]: root } });
      const rv = evaluate(r, { vars: { [v]: root } });
      expect(closeC(lv, rv, 1e-7), `${p.question} at root ${JSON.stringify(root)}`).toBe(true);
    }
  },

  inequality(p) {
    const v = p.check!.variable as string;
    const q = onlyMath(p.question);
    const a = onlyMath(p.answer);
    // the boundary values appear in the answer; probe around them
    const { parts } = splitTop(a, RELATIONS);
    const bounds = parts.filter((t) => t.trim() !== v).map((t) => evalReal(t));
    const probes = bounds.flatMap((b) => [b - 3.3, b - 0.4, b, b + 0.4, b + 3.3]);
    for (const x of probes) {
      expect(chainHolds(q, { [v]: x }), `${q} vs ${a} at ${v}=${x}`).toBe(chainHolds(a, { [v]: x }));
    }
  },

  system(p) {
    const q = onlyMath(p.question)
      .replace(/\\begin\{aligned\}|\\end\{aligned\}/g, '')
      .split('\\\\')
      .map((r) => r.replace(/&/g, ''));
    expect(q.length).toBe(2);
    const sol = p.check!.solution;
    const g = q.map((row) => {
      const [l, r] = sides(row);
      return (x: number, y: number) => evalReal(l, { vars: { x, y } }) - evalReal(r, { vars: { x, y } });
    });
    if (Array.isArray(sol)) {
      const [x, y] = sol as number[];
      g.forEach((f) => expect(close(f(x!, y!), 0), `${p.question} at (${x}, ${y})`).toBe(true));
      const items = listItems(onlyMath(p.answer)).map((t) => evalReal(t));
      expect(close(items[0]!, x!) && close(items[1]!, y!), p.answer).toBe(true);
    } else {
      const coeffs = g.map((f) => [f(1, 0) - f(0, 0), f(0, 1) - f(0, 0), -f(0, 0)] as const);
      const [[a1, b1, c1], [a2, b2, c2]] = coeffs as unknown as [readonly number[], readonly number[]];
      expect(close(a1! * b2! - a2! * b1!, 0), 'determinant should vanish').toBe(true);
      const consistent = close(a1! * c2!, a2! * c1!) && close(b1! * c2!, b2! * c1!);
      expect(consistent).toBe(sol === 'all');
    }
  },

  factor(p) {
    const twoVars = p.check!.twoVars === true;
    const vars = twoVars ? ['x', 'y'] : ['x'];
    if (p.check!.prime) {
      const [A, B, C] = p.check!.coeffs as number[];
      const D = B! * B! - 4 * A! * C!;
      expect(Number.isInteger(Math.sqrt(D)) && D >= 0).toBe(false);
      return;
    }
    expectEquivalent(onlyMath(p.question), onlyMath(p.answer), vars);
  },

  equivalent(p) {
    const vars = p.check!.vars as string[];
    const positive = p.check!.positive === true;
    expectEquivalent(onlyMath(p.question), onlyMath(p.answer), vars, positive);
    if (positive) expect(onlyMath(p.answer), 'positive exponents only').not.toMatch(/\^\{-/);
  },
};

// ---------------------------------------------------------------- matrices

type M = number[][];

export function parseMatrices(tex: string): M[] {
  const out: M[] = [];
  const re = /\\begin\{bmatrix\}(.*?)\\end\{bmatrix\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tex))) {
    out.push(
      m[1]!
        .split('\\\\')
        .map((row) => row.split('&').map((cell) => evalReal(cell.trim()))),
    );
  }
  return out;
}

const mmul = (a: M, b: M): M => a.map((r) => b[0]!.map((_, j) => r.reduce((s, x, k) => s + x * b[k]![j]!, 0)));
function mdet(a: M): number {
  if (a.length === 2) return a[0]![0]! * a[1]![1]! - a[0]![1]! * a[1]![0]!;
  return [0, 1, 2].reduce((s, j) => s + (j % 2 ? -1 : 1) * a[0]![j]! * mdet([1, 2].map((i) => a[i]!.filter((_, c) => c !== j))), 0);
}
function expectMatrix(actual: M, expected: M, what: string) {
  expect(actual.length, what).toBe(expected.length);
  actual.forEach((r, i) => {
    expect(r.length, what).toBe(expected[i]!.length);
    r.forEach((x, j) => expect(close(x, expected[i]![j]!), `${what} entry (${i},${j})`).toBe(true));
  });
}

VERIFIERS.matrix = (p) => {
  const op = p.check!.op as string;
  const q = onlyMath(p.question);
  const qs = parseMatrices(q);
  if (op === 'undefined') {
    expect(p.answer).toBe('Undefined');
    expect(qs[0]![0]!.length).not.toBe(qs[1]!.length);
    return;
  }
  const a = onlyMath(p.answer);
  if (op === 'determinant') {
    expect(close(evalReal(a), mdet(qs[0]!)), p.question).toBe(true);
    return;
  }
  const ans = parseMatrices(a)[0]!;
  if (op === 'add' || op === 'sub') {
    const s = /\\end\{bmatrix\}\s*-\s*\\begin/.test(q) ? -1 : 1;
    expect(s).toBe(op === 'add' ? 1 : -1);
    expectMatrix(ans, qs[0]!.map((r, i) => r.map((x, j) => x + s * qs[1]![i]![j]!)), p.question);
  } else if (op === 'scalar') {
    const k = evalReal(q.slice(0, q.indexOf('\\begin')));
    expectMatrix(ans, qs[0]!.map((r) => r.map((x) => k * x)), p.question);
  } else if (op === 'multiply') {
    expectMatrix(ans, mmul(qs[0]!, qs[1]!), p.question);
  } else if (op === 'inverse') {
    const n = qs[0]!.length;
    expectMatrix(mmul(qs[0]!, ans), Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))), p.question);
  } else throw new Error(`matrix op ${op}`);
};

// ---------------------------------------------------------------- geometry

/** Numeric value of a measurement answer such as `x \approx 9.7\text{ cm}` or `A = 16\pi\text{ in}^{2}`. */
export function measureValue(answer: string): { value: number; approx: boolean } {
  const tex = stripUnits(onlyMath(answer));
  const { parts, rels } = splitTop(tex, ['=', '\\approx']);
  return { value: evalReal(parts[parts.length - 1]!), approx: rels.includes('\\approx') };
}

function expectMeasure(answer: string, expected: number, what: string) {
  const { value, approx } = measureValue(answer);
  if (approx) expect(Math.abs(value - expected), `${what}: ${answer} vs ${expected}`).toBeLessThanOrEqual(0.0500001 + 1e-9 * expected);
  else expect(close(value, expected, 1e-9), `${what}: ${answer} vs ${expected}`).toBe(true);
  // "=" must only be used for exact values
  if (!approx) expect(Math.abs(value - expected) < 1e-9 * Math.max(1, expected), `${what} uses = for a rounded value`).toBe(true);
}

VERIFIERS.measure = (p) => {
  const [a, b] = p.check!.legs as number[];
  const expected = p.check!.findHyp ? Math.hypot(a!, b!) : b!;
  // independent: the given sides satisfy the theorem with the answer
  const hyp = p.check!.hyp as number;
  expect(close(a! * a! + b! * b!, hyp * hyp)).toBe(true);
  expectMeasure(p.answer, expected, p.question);
};

VERIFIERS.trig = (p) => {
  const c = p.check!;
  const r = (d: number) => (d * Math.PI) / 180;
  if (c.task === 'ratio') {
    const { opp, adj, hyp } = c as unknown as { opp: number; adj: number; hyp: number };
    expect(close(opp * opp + adj * adj, hyp * hyp)).toBe(true);
    const want = c.fn === 'sin' ? opp / hyp : c.fn === 'cos' ? adj / hyp : opp / adj;
    expect(close(evalReal(onlyMath(p.answer)), want), p.answer).toBe(true);
    expect(onlyMath(p.question)).toContain(`\\${c.fn as string}`);
  } else if (c.task === 'side') {
    const t = r(c.theta as number);
    const k = c.known as number;
    // build the triangle from the known side, then read off the unknown
    const sides: Record<string, number> =
      c.knownRole === 'adj' ? { adj: k, opp: k * Math.tan(t), hyp: k / Math.cos(t) } : c.knownRole === 'opp' ? { opp: k, adj: k / Math.tan(t), hyp: k / Math.sin(t) } : { hyp: k, opp: k * Math.sin(t), adj: k * Math.cos(t) };
    expectMeasure(p.answer, sides[c.unknownRole as string]!, p.question);
  } else {
    const v = c.vals as Record<string, number>;
    const opp = v.opp ?? Math.sqrt(v.hyp! ** 2 - v.adj! ** 2);
    const adj = v.adj ?? Math.sqrt(v.hyp! ** 2 - v.opp! ** 2);
    const want = (Math.atan2(opp, adj) * 180) / Math.PI;
    const got = evalReal(stripUnits(splitTop(onlyMath(p.answer), ['\\approx']).parts[1]!).replace(/\^\\circ/, ''));
    expect(Math.abs(got - want)).toBeLessThanOrEqual(0.0500001);
  }
};

function shoelace(poly: number[][]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i]!;
    const [x2, y2] = poly[(i + 1) % poly.length]!;
    s += x1! * y2! - x2! * y1!;
  }
  return Math.abs(s) / 2;
}
function perimeterOf(poly: number[][]): number {
  return poly.reduce((s, p, i) => {
    const q = poly[(i + 1) % poly.length]!;
    return s + Math.hypot(q[0]! - p[0]!, q[1]! - p[1]!);
  }, 0);
}

VERIFIERS.area = (p) => {
  const c = p.check!;
  const area = c.measure === 'area';
  let expected: number;
  if (c.polygon) expected = area ? shoelace(c.polygon as number[][]) : perimeterOf(c.polygon as number[][]);
  else if (c.circle) {
    const r = (c.circle as { r: number }).r;
    expected = area ? Math.PI * r * r : 2 * Math.PI * r;
  } else {
    const { L, W } = c.semicircle as { L: number; W: number };
    expected = area ? L * W + (Math.PI * (W / 2) ** 2) / 2 : 2 * L + W + (Math.PI * W) / 2;
  }
  expectMeasure(p.answer, expected, p.question);
};

VERIFIERS.solid = (p) => {
  const c = p.check!;
  const q = c.params as Record<string, number>;
  const V = c.measure === 'volume';
  const PI = Math.PI;
  const table: Record<string, () => number> = {
    prism: () => (V ? q.l! * q.w! * q.h! : 2 * (q.l! * q.w! + q.l! * q.h! + q.w! * q.h!)),
    cube: () => (V ? q.s! ** 3 : 6 * q.s! ** 2),
    cylinder: () => (V ? PI * q.r! ** 2 * q.h! : 2 * PI * q.r! ** 2 + 2 * PI * q.r! * q.h!),
    cone: () => (V ? (PI * q.r! ** 2 * q.h!) / 3 : PI * q.r! ** 2 + PI * q.r! * Math.hypot(q.r!, q.h!)),
    sphere: () => (V ? (4 / 3) * PI * q.r! ** 3 : 4 * PI * q.r! ** 2),
    pyramid: () => (V ? (q.s! ** 2 * q.h!) / 3 : q.s! ** 2 + 2 * q.s! * Math.hypot(q.s! / 2, q.h!)),
  };
  expectMeasure(p.answer, table[c.solid as string]!(), p.question);
};

VERIFIERS.angles = (p) => {
  const c = p.check!;
  const x = evalReal(splitTop(onlyMath(p.answer), ['=']).parts[1]!);
  const vals = (c.exprs as number[][]).map(([a, b]) => a! * x + b!);
  vals.forEach((v) => expect(v, 'angles are positive').toBeGreaterThan(0));
  if (c.relation === 'vertical') expect(close(vals[0]!, vals[1]!)).toBe(true);
  else expect(close(vals.reduce((s, v) => s + v, 0), c.total as number), p.question).toBe(true);
};

VERIFIERS.coord = (p) => {
  const c = p.check!;
  const [ax, ay] = c.A as number[];
  const [bx, by] = c.B as number[];
  if (c.task === 'distance') expectMeasure(p.answer, Math.hypot(bx! - ax!, by! - ay!), p.question);
  else if (c.task === 'slope') {
    if (bx === ax) expect(p.answer).toBe('Undefined');
    else expect(close(evalReal(splitTop(onlyMath(p.answer), ['=']).parts[1]!), (by! - ay!) / (bx! - ax!))).toBe(true);
  } else {
    const items = listItems(onlyMath(p.answer)).map((t) => evalReal(t));
    const want = c.task === 'midpoint' ? [(ax! + bx!) / 2, (ay! + by!) / 2] : [2 * bx! - ax!, 2 * by! - ay!];
    expect(close(items[0]!, want[0]!) && close(items[1]!, want[1]!), `${p.question} → ${p.answer}`).toBe(true);
  }
};

VERIFIERS.transform = (p) => {
  const c = p.check!;
  type T = { k: string; h?: number; v?: number; axis?: string; deg?: number; s?: number };
  const apply = (t: T, [x, y]: number[]): number[] => {
    if (t.k === 'translate') return [x! + t.h!, y! + t.v!];
    if (t.k === 'dilate') return [x! * t.s!, y! * t.s!];
    if (t.k === 'rotate') {
      const r = (t.deg! * Math.PI) / 180;
      return [Math.round(x! * Math.cos(r) - y! * Math.sin(r)), Math.round(x! * Math.sin(r) + y! * Math.cos(r))];
    }
    // reflect: across a line through the origin with direction angle φ
    const phi = t.axis === 'x' ? 0 : t.axis === 'y' ? Math.PI / 2 : t.axis === 'y=x' ? Math.PI / 4 : -Math.PI / 4;
    return [Math.round(x! * Math.cos(2 * phi) + y! * Math.sin(2 * phi)), Math.round(x! * Math.sin(2 * phi) - y! * Math.cos(2 * phi))];
  };
  const pre = c.pre as number[][];
  const want = pre.map((pt) => (c.transforms as T[]).reduce((q, t) => apply(t, q), pt).map((v) => v + 0));
  const got = [...onlyMath(p.answer).matchAll(/([A-Z])'+\((-?\d+), (-?\d+)\)/g)].map((mm) => [Number(mm[2]), Number(mm[3])]);
  expect(got, `${p.question} → ${p.answer}`).toEqual(want);
};

// ---------------------------------------------------------------- precalculus

VERIFIERS.sequence = (p) => {
  const c = p.check!;
  const q = p.question;
  const segs = mathSegments(q);
  const k0 = c.k as number;
  const a1 = c.a1 as number;
  // brute-force generator of the sequence (no closed forms)
  const seq = (n: number) => {
    let v = a1;
    for (let i = 1; i < n; i++) v = c.seqKind === 'arithmetic' ? v + k0 : v * k0;
    return v;
  };
  const listed = segs.find((s) => s.includes('\\ldots'));
  if (listed) {
    const items = splitTop(listed.replace(/,\s*\\ldots/, ''), [',']).parts.map((t) => evalReal(t));
    items.forEach((v, i) => expect(close(v, seq(i + 1)), `term ${i + 1} of ${q}`).toBe(true));
    // the listed terms really are arithmetic / geometric
    if (c.seqKind === 'arithmetic') expect(close(items[2]! - items[1]!, items[1]! - items[0]!)).toBe(true);
    else expect(close(items[2]! * items[0]!, items[1]! * items[1]!)).toBe(true);
  }
  const ans = onlyMath(p.answer);
  const rhsVal = (n?: number) => evalReal(rhs(ans), n === undefined ? {} : { vars: { n } });
  if (c.task === 'term') {
    const n = Number(/a_\{(\d+)\}/.exec(q)![1]);
    expect(close(rhsVal(), seq(n)), `${q} → ${p.answer}`).toBe(true);
  } else if (c.task === 'formula') {
    for (let n = 1; n <= 6; n++) expect(close(rhsVal(n), seq(n)), `${p.answer} at n=${n}`).toBe(true);
  } else if (c.task === 'sum' || c.task === 'sigma') {
    let total = 0;
    const sigma = /\\sum_\{k=1\}\^\{(\d+)\} (.*)$/.exec(segs[0]!);
    if (sigma) {
      for (let k = 1; k <= Number(sigma[1]); k++) total += evalReal(sigma[2]!, { vars: { k } });
    } else {
      const n = Number(/S_\{(\d+)\}/.exec(q)![1]);
      for (let i = 1; i <= n; i++) total += seq(i);
    }
    expect(close(evalReal(ans), total), `${q} → ${p.answer}`).toBe(true);
  } else {
    let total = 0;
    for (let i = 1; i <= 400; i++) total += seq(i);
    expect(Math.abs(evalReal(ans) - total), `${q} → ${p.answer}`).toBeLessThan(1e-6);
    const shown = segs[0]!.replace(/\+ \\cdots$/, '');
    expect(close(evalReal(shown), seq(1) + seq(2) + seq(3) + seq(4))).toBe(true);
  }
};

VERIFIERS.vector = (p) => {
  const c = p.check!;
  const ans = onlyMath(p.answer);
  const comps = () => listItems(rhs(ans)).map((t) => evalReal(t));
  const [u0, u1] = (c.u ?? c.v ?? [0, 0]) as number[];
  if (c.task === 'component') {
    const [px, py] = c.P as number[];
    const [qx, qy] = c.Q as number[];
    expect(comps()).toEqual([qx! - px!, qy! - py!].map((x) => x + 0));
  } else if (c.task === 'magnitude') {
    expectMeasure(p.answer, Math.hypot(u0!, u1!), p.question);
  } else if (c.task === 'combination') {
    const [v0, v1] = c.v as number[];
    const a = c.a as number;
    const b = c.b as number;
    const got = comps();
    expect(close(got[0]!, a * u0! + b * v0!) && close(got[1]!, a * u1! + b * v1!), p.answer).toBe(true);
  } else if (c.task === 'dot') {
    const [v0, v1] = c.v as number[];
    expect(close(evalReal(rhs(ans)), u0! * v0! + u1! * v1!)).toBe(true);
  } else if (c.task === 'angle') {
    const [v0, v1] = c.v as number[];
    const want = (Math.abs(Math.atan2(u0! * v1! - u1! * v0!, u0! * v0! + u1! * v1!)) * 180) / Math.PI;
    const got = evalReal(splitTop(ans, ['\\approx']).parts[1]!.replace(/\^\\circ/, ''));
    expect(Math.abs(got - want)).toBeLessThanOrEqual(0.0500001);
  } else {
    const got = comps();
    const n = Math.hypot(u0!, u1!);
    expect(close(got[0]!, u0! / n) && close(got[1]!, u1! / n), p.answer).toBe(true);
  }
};

// ---------------------------------------------------------------- calculus

const POS = [0.7, 1.3, 1.9, 2.6, 3.4];

function stripC(t: string): string {
  return t.replace(/\s*\+\s*C$/, '');
}

VERIFIERS.limit = (p) => {
  const q = onlyMath(p.question).replace(/^\\displaystyle\s*/, '');
  const m = /^\\lim_\{x \\to ([^}]*)\}\s*(.*)$/.exec(q)!;
  const f = (x: number) => evalReal(m[2]!, { vars: { x } });
  const ans = onlyMath(p.answer);
  if (p.check!.point === 'inf') {
    const big = f(1e6);
    if (ans === '\\infty') expect(big, q).toBeGreaterThan(1e3);
    else if (ans === '-\\infty') expect(big, q).toBeLessThan(-1e3);
    else expect(Math.abs(big - evalReal(ans)), `${q} → ${ans}`).toBeLessThan(1e-3);
  } else {
    const a = p.check!.point as number;
    const near = (f(a - 1e-6) + f(a + 1e-6)) / 2;
    expect(Math.abs(near - evalReal(ans)), `${q} → ${ans}`).toBeLessThan(1e-4 * Math.max(1, Math.abs(near)));
  }
};

VERIFIERS.derivative = (p) => {
  const f = rhs(onlyMath(p.question));
  const d = rhs(onlyMath(p.answer));
  const h = 1e-5;
  for (const x of POS) {
    const numeric = (evalReal(f, { vars: { x: x + h } }) - evalReal(f, { vars: { x: x - h } })) / (2 * h);
    const got = evalReal(d, { vars: { x } });
    expect(Math.abs(numeric - got), `${p.question} → ${p.answer} at x=${x}`).toBeLessThan(1e-4 * Math.max(1, Math.abs(got)));
  }
};

VERIFIERS.integral = (p) => {
  const q = onlyMath(p.question).replace(/^\\displaystyle\s*/, '');
  const m = /^\\int(?:_\{(-?\d+)\}\^\{(-?\d+)\})?\s*(.*?)\\,dx$/.exec(q)!;
  const integrand = m[3]!;
  const g = (x: number) => evalReal(integrand, { vars: { x } });
  const ans = onlyMath(p.answer);
  if (m[1] !== undefined) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const N = 2000;
    const hh = (b - a) / N;
    let s = g(a) + g(b);
    for (let i = 1; i < N; i++) s += g(a + i * hh) * (i % 2 ? 4 : 2);
    expect(Math.abs((s * hh) / 3 - evalReal(ans)), `${q} → ${ans}`).toBeLessThan(1e-6);
    return;
  }
  expect(ans.endsWith('+ C'), 'indefinite answers end with + C').toBe(true);
  const F = (x: number) => evalReal(stripC(ans), { vars: { x } });
  const h = 1e-5;
  for (const x of POS) {
    const numeric = (F(x + h) - F(x - h)) / (2 * h);
    expect(Math.abs(numeric - g(x)), `${q} → ${ans} at x=${x}`).toBeLessThan(1e-4 * Math.max(1, Math.abs(g(x))));
  }
};

export function verify(p: ProblemContent): void {
  const kind = p.check?.kind as string | undefined;
  if (!kind) throw new Error('problem has no check');
  const fn = VERIFIERS[kind];
  if (!fn) throw new Error(`no verifier for kind ${kind}`);
  fn(p);
}

export { evalReal, mathSegments, stripUnits };
export type { C };
