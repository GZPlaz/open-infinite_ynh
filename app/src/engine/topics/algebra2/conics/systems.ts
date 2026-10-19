/** Systems of quadratic equations: line–conic and conic–conic, with integer solutions (or none). */
import { Frac, gcdAll } from '../../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, offset, strOpt } from '../../../generator';
import { Poly } from '../../../polynomial';
import { isPerfectSquare } from '../../../radical';
import type { Rng } from '../../../rng';
import { linear, m, num, sum } from '../../../tex';
import type { Difficulty, ProblemContent } from '../../../types';
import { CATEGORY, ptTex, sqTex } from './common';

type Pt = [number, number];

interface Built {
  rows: [string, string];
  pts: Pt[];
  steps: string[];
}

const system = (rows: readonly string[]) => `\\begin{aligned} ${rows.map((r) => r.replace(' = ', ' &= ')).join(' \\\\ ')} \\end{aligned}`;

/** Lattice points on x² + y² = r². */
function latticeOn(r2: number): Pt[] {
  const out: Pt[] = [];
  const r = Math.floor(Math.sqrt(r2));
  for (let x = -r; x <= r; x++) {
    const y2 = r2 - x * x;
    if (isPerfectSquare(y2)) {
      const y = Math.round(Math.sqrt(y2));
      out.push([x, y]);
      if (y !== 0) out.push([x, -y]);
    }
  }
  return out;
}

const R2_EASY = [2, 5, 8, 10, 13, 17, 20, 25];
const R2_ALL = [...R2_EASY, 26, 29, 34, 37, 40, 41, 45, 50, 52, 53, 58, 65];

/** Rational square root of a non-negative fraction, or null. */
function sqrtFrac(f: Frac): Frac | null {
  if (f.sign < 0 || !isPerfectSquare(f.n) || !isPerfectSquare(f.d)) return null;
  return new Frac(Math.round(Math.sqrt(f.n)), Math.round(Math.sqrt(f.d)));
}

/** Conic A x² + C y² + D x + E y + F = 0 (integers). */
interface Con {
  A: number;
  C: number;
  D: number;
  E: number;
  F: number;
}

/** Line a x + b y = c. */
interface Lin {
  a: number;
  b: number;
  c: number;
}

/** Exact intersections of a line and a conic; null when they are not all integer points. */
function lineConic(q: Con, l: Lin): { pts: Pt[]; poly: Poly; v: 'x' | 'y' } | null {
  const xs = l.b !== 0;
  // the free variable t is x when b ≠ 0 (y = (c − a·x)/b), otherwise y (x = c/a)
  const other = xs ? Poly.of(new Frac(l.c, l.b), new Frac(-l.a, l.b)) : Poly.of(new Frac(l.c, l.a));
  const t = Poly.of(0, 1);
  const X = xs ? t : other;
  const Y = xs ? other : t;
  const poly = X.mul(X).scale(q.A).add(Y.mul(Y).scale(q.C)).add(X.scale(q.D)).add(Y.scale(q.E)).add(Poly.of(q.F));
  const roots: Frac[] = [];
  if (poly.degree === 2) {
    const [c0, c1, c2] = [poly.coef(0), poly.coef(1), poly.coef(2)];
    const disc = c1.mul(c1).sub(c2.mul(c0).mul(4));
    if (disc.sign >= 0) {
      const s = sqrtFrac(disc);
      if (!s) return null;
      roots.push(c1.neg().add(s).div(c2.mul(2)));
      if (!s.isZero()) roots.push(c1.neg().sub(s).div(c2.mul(2)));
    }
  } else if (poly.degree === 1) roots.push(poly.coef(0).neg().div(poly.coef(1)));
  else return null;
  const pts: Pt[] = [];
  for (const r of roots) {
    const xv = xs ? r : other.eval(r);
    const yv = xs ? other.eval(r) : r;
    if (!xv.isInt() || !yv.isInt() || Math.abs(xv.value) > 12 || Math.abs(yv.value) > 12) return null;
    pts.push([xv.value, yv.value]);
  }
  return { pts, poly, v: xs ? 'x' : 'y' };
}

function lineThrough(p: Pt, q: Pt): Lin {
  const a = q[1] - p[1];
  const b = -(q[0] - p[0]);
  const c = a * p[0] + b * p[1];
  const g = gcdAll([a, b, c]) || 1;
  const s = a < 0 || (a === 0 && b < 0) ? -1 : 1;
  return { a: (s * a) / g, b: (s * b) / g, c: (s * c) / g };
}

function lineTex(l: Lin, rng: Rng, preferStandard: boolean): string {
  if (l.b === 0) return `x = ${num(new Frac(l.c, l.a))}`;
  const slope = new Frac(-l.a, l.b);
  const icpt = new Frac(l.c, l.b);
  if (!preferStandard && slope.isInt() && icpt.isInt() && rng.bool(0.8)) return `y = ${linear(slope, icpt)}`;
  return `${sum([{ coef: l.a, sym: 'x' }, { coef: l.b, sym: 'y' }])} = ${l.c}`;
}

const conicTex = (q: Con) => `${sum([{ coef: q.A, sym: 'x^{2}' }, { coef: q.C, sym: 'y^{2}' }, { coef: q.D, sym: 'x' }, { coef: q.E, sym: 'y' }])} = ${-q.F}`;

const ptsTex = (pts: Pt[]) =>
  [...pts]
    .sort((s, t) => s[0] - t[0] || s[1] - t[1])
    .map((p) => ptTex(p[0], p[1])).join(', ');

function primitivePoly(p: Poly): Poly {
  const den = p.c.reduce((l, c) => (l * c.d) / gcdAll([l, c.d]), 1);
  const ints = p.scale(den);
  const g = gcdAll(ints.c.map((c) => c.n)) || 1;
  const s = ints.lead().sign < 0 ? -1 : 1;
  return ints.scale(new Frac(s, g));
}

/** Line meets a conic (circle, ellipse or hyperbola), possibly shifted. */
function lineConicSystem(rng: Rng, d: Difficulty, kind: 'circle' | 'shifted' | 'conic', none: boolean): Built {
  return attempt('line-conic', () => {
    let q: Con;
    let pool: Pt[];
    let conicRow: string;
    if (kind === 'conic') {
      const P: Pt = [rng.int(-5, 5), rng.int(-5, 5)];
      const Q: Pt = [rng.int(-5, 5), rng.int(-5, 5)];
      const u = P[0] ** 2 - Q[0] ** 2;
      const v = Q[1] ** 2 - P[1] ** 2;
      if (u === 0 || v === 0) return null;
      const g = gcdAll([u, v]);
      let A = v / g;
      let C = u / g;
      if (A < 0) [A, C] = [-A, -C];
      if (A === C || Math.abs(A) > 9 || Math.abs(C) > 9) return null;
      const F = A * P[0] ** 2 + C * P[1] ** 2;
      if (F === 0) return null;
      q = { A, C, D: 0, E: 0, F: -F };
      pool = [P, Q];
      conicRow = conicTex(q);
    } else {
      const r2 = rng.pick(d === 'easy' ? R2_EASY : R2_ALL);
      const h = kind === 'shifted' ? rng.int(-4, 4) : 0;
      const k = kind === 'shifted' ? rng.int(-4, 4) : 0;
      if (kind === 'shifted' && h === 0 && k === 0) return null;
      q = { A: 1, C: 1, D: -2 * h, E: -2 * k, F: h * h + k * k - r2 };
      pool = rng.sample(latticeOn(r2), 2).map(([x, y]) => [x + h, y + k] as Pt);
      conicRow = kind === 'shifted' ? `${sqTex('x', h)} + ${sqTex('y', k)} = ${r2}` : `x^{2} + y^{2} = ${r2}`;
    }
    let l: Lin;
    if (none) {
      const a = rng.int(-4, 4);
      const b = rng.int(-4, 4);
      if (a === 0 && b === 0) return null;
      l = { a, b, c: rng.int(-20, 20) };
      const g = gcdAll([a, b, l.c]) || 1;
      l = { a: a / g, b: b / g, c: l.c / g };
    } else if (rng.bool(0.12) && kind !== 'conic') {
      // tangent line at a lattice point
      const P = pool[0]!;
      l = lineThrough(P, [P[0] - (2 * q.C * P[1] + q.E), P[1] + (2 * q.A * P[0] + q.D)]);
    } else {
      if (pool[0]![0] === pool[1]![0] && pool[0]![1] === pool[1]![1]) return null;
      l = lineThrough(pool[0]!, pool[1]!);
    }
    if (l.a < 0 || (l.a === 0 && l.b < 0)) l = { a: -l.a, b: -l.b, c: -l.c };
    const res = lineConic(q, l);
    if (!res || (none ? res.pts.length > 0 : res.pts.length === 0)) return null;
    const lt = lineTex(l, rng, d === 'hard');
    const rows: [string, string] = rng.bool() ? [conicRow, lt] : [lt, conicRow];
    const steps: string[] = [];
    const v = res.v;
    const solved = l.b === 0 ? `x = ${num(new Frac(l.c, l.a))}` : `y = ${linear(new Frac(-l.a, l.b), new Frac(l.c, l.b))}`;
    steps.push(`Solve the linear equation: $${solved}$`);
    const pp = primitivePoly(res.poly);
    steps.push(`Substitute into the other equation and simplify: $${pp.toTex(v)} = 0$`);
    if (res.pts.length === 0) steps.push(`The discriminant is negative, so the line and the ${kind === 'conic' ? 'conic' : 'circle'} do not intersect.`);
    else {
      const vals = [...new Set(res.pts.map((p) => (v === 'x' ? p[0] : p[1])))];
      steps.push(`$${v} = ${vals.join(', ')}$${res.pts.length === 1 ? ' (one solution: the line is tangent)' : ''}`);
      steps.push(`Back-substitute to find the points: $${ptsTex(res.pts)}$`);
    }
    return { rows, pts: res.pts, steps };
  });
}

/** y = a·x² + b·x + c meets y = m·x + n. */
function lineParabola(rng: Rng, d: Difficulty, none: boolean): Built {
  return attempt('line-parabola', () => {
    const a = d === 'easy' ? rng.pick([1, 1, -1]) : rng.pick(d === 'medium' ? [1, -1, 2, -2] : [1, -1, 2, -2, 3, -3]);
    const b = rng.int(-6, 6);
    const n = rng.int(-8, 8);
    let p: number; // (x² + p·x + q)
    let qq: number;
    let roots: number[] = [];
    if (none) {
      p = rng.int(-4, 4);
      qq = Math.floor((p * p) / 4) + rng.int(1, 5);
    } else {
      const x1 = rng.int(-5, 5);
      const x2 = rng.bool(0.1) ? x1 : rng.int(-5, 5);
      p = -(x1 + x2);
      qq = x1 * x2;
      roots = x1 === x2 ? [x1] : [x1, x2].sort((s, t) => s - t);
    }
    const mm = b - a * p;
    const c = n + a * qq;
    if (Math.abs(mm) > 8 || Math.abs(c) > 20) return null;
    const pts: Pt[] = roots.map((x) => [x, mm * x + n]);
    if (pts.some((pt) => Math.abs(pt[1]) > 40)) return null;
    const par = `y = ${Poly.of(c, b, a).toTex()}`;
    const line = d === 'hard' && rng.bool(0.5) ? `${sum([{ coef: mm, sym: 'x' }, { coef: -1, sym: 'y' }])} = ${-n}` : `y = ${linear(mm, n)}`;
    const rows: [string, string] = rng.bool(0.7) ? [par, line] : [line, par];
    const diff = Poly.of(c - n, b - mm, a);
    const steps = [`Set the expressions for $y$ equal: $${Poly.of(c, b, a).toTex()} = ${linear(mm, n)}$`, `$${diff.toTex()} = 0$`];
    if (none) steps.push(`The discriminant is $${(b - mm) ** 2 - 4 * a * (c - n)} < 0$, so there is no real solution.`);
    else {
      steps.push(`$x = ${roots.join(', ')}$`);
      steps.push(`Substitute into $y = ${linear(mm, n)}$: $${ptsTex(pts)}$`);
    }
    return { rows, pts, steps };
  });
}

/** Two parabolas y = f(x), y = g(x). */
function parabolaPair(rng: Rng, d: Difficulty, none: boolean): Built {
  return attempt('parabola-pair', () => {
    const as = d === 'easy' ? [1, -1] : [1, -1, 2, -2];
    const a1 = rng.pick(as);
    const a2 = rng.pick(as.filter((v) => v !== a1));
    const b1 = rng.int(-5, 5);
    const c1 = rng.int(-9, 9);
    const k = a1 - a2;
    let p: number;
    let qq: number;
    let roots: number[] = [];
    if (none) {
      p = rng.int(-3, 3);
      qq = Math.floor((p * p) / 4) + rng.int(1, 4);
    } else {
      const x1 = rng.int(-4, 4);
      const x2 = rng.int(-4, 4);
      if (x1 === x2) return null;
      p = -(x1 + x2);
      qq = x1 * x2;
      roots = [x1, x2].sort((s, t) => s - t);
    }
    // (a1 − a2)x² + (b1 − b2)x + (c1 − c2) = k(x² + p x + q)
    const b2 = b1 - k * p;
    const c2 = c1 - k * qq;
    if (Math.abs(b2) > 10 || Math.abs(c2) > 20) return null;
    const f = Poly.of(c1, b1, a1);
    const g = Poly.of(c2, b2, a2);
    const pts: Pt[] = roots.map((x) => [x, f.evalNum(x)]);
    if (pts.some((pt) => Math.abs(pt[1]) > 40)) return null;
    const rows: [string, string] = [`y = ${f.toTex()}`, `y = ${g.toTex()}`];
    const diff = f.sub(g);
    const steps = [`Set the right sides equal: $${f.toTex()} = ${g.toTex()}$`, `$${diff.toTex()} = 0$`];
    if (none) steps.push('The discriminant is negative, so the parabolas do not intersect.');
    else {
      steps.push(`$x = ${roots.join(', ')}$`);
      steps.push(`Substitute into either equation: $${ptsTex(pts)}$`);
    }
    return { rows, pts, steps };
  });
}

/** x² + y² = r² meets y = a·x² + c (a = ±1). */
function circleParabola(rng: Rng, none: boolean): Built {
  return attempt('circle-parabola', () => {
    const r2 = rng.pick(R2_ALL.filter((v) => v <= 50));
    const a = rng.pick([1, -1]);
    const r = Math.sqrt(r2);
    let c: number;
    const pts: Pt[] = [];
    if (none) {
      c = a > 0 ? Math.ceil(r) + rng.int(1, 3) : -Math.ceil(r) - rng.int(1, 3);
    } else {
      const [p, q] = rng.pick(latticeOn(r2).filter(([x]) => x > 0));
      c = q - a * p * p;
      pts.push([-p, q], [p, q]);
      const y2 = (a > 0 ? -1 : 1) - q;
      const x2 = (y2 - c) / a;
      if (x2 === 0) return null;
      if (x2 > 0) {
        if (!isPerfectSquare(x2)) return null;
        const s = Math.round(Math.sqrt(x2));
        pts.push([-s, y2], [s, y2]);
      }
    }
    if (Math.abs(c) > 15) return null;
    pts.sort((s, t) => s[0] - t[0] || s[1] - t[1]);
    const par = `y = ${sum([{ coef: a, sym: 'x^{2}' }, { coef: c }])}`;
    const rows: [string, string] = [`x^{2} + y^{2} = ${r2}`, par];
    const xsq = a > 0 ? sum([{ coef: 1, sym: 'y' }, { coef: -c }]) : sum([{ coef: -1, sym: 'y' }, { coef: c }]);
    const quad = Poly.of(a > 0 ? -c - r2 : c - r2, a > 0 ? 1 : -1, 1);
    const steps = [`From the parabola, $x^{2} = ${xsq}$`, `Substitute into the circle: $${quad.toTex('y')} = 0$`];
    if (none) steps.push(`Every solution $y$ makes $x^{2} = ${xsq}$ negative, so there is no real solution.`);
    else {
      const ys = [...new Set(pts.map((p) => p[1]))];
      steps.push(`$y = ${ys.join(', ')}$; keep the values that give $x^{2} \\ge 0$`);
      steps.push(`$${ptsTex(pts)}$`);
    }
    return { rows, pts, steps };
  });
}

/** A₁x² + C₁y² = F₁ and A₂x² + C₂y² = F₂: linear in x² and y². */
function squaresPair(rng: Rng, none: boolean): Built {
  return attempt('squares-pair', () => {
    const p = rng.int(1, 5);
    const q = rng.int(1, 5);
    let X = p * p;
    let Y = q * q;
    if (none) {
      if (rng.bool()) X = -X;
      else Y = -Y;
    }
    const co = () => rng.signedInt(1, 4, true);
    const A1 = rng.int(1, 4);
    const C1 = co();
    const A2 = co();
    const C2 = co();
    if (A1 * C2 - A2 * C1 === 0) return null;
    const F1 = A1 * X + C1 * Y;
    const F2 = A2 * X + C2 * Y;
    // each equation must be a real, non-degenerate conic
    for (const [A, C, F] of [
      [A1, C1, F1],
      [A2, C2, F2],
    ] as const) {
      if (F === 0) return null;
      if (A * C > 0 && Math.sign(F) !== Math.sign(A)) return null;
    }
    const row = (A: number, C: number, F: number) => `${sum([{ coef: A, sym: 'x^{2}' }, { coef: C, sym: 'y^{2}' }])} = ${F}`;
    const rows: [string, string] = [row(A1, C1, F1), row(A2, C2, F2)];
    const pts: Pt[] = none
      ? []
      : [
          [-p, -q],
          [-p, q],
          [p, -q],
          [p, q],
        ];
    const steps = [`Treat $x^{2}$ and $y^{2}$ as the unknowns and eliminate one of them: $x^{2} = ${X}$, $y^{2} = ${Y}$`];
    if (none) steps.push(`A square cannot be negative, so there is no real solution.`);
    else steps.push(`$x = \\pm ${p}$, $y = \\pm ${q}$: $${ptsTex(pts)}$`);
    return { rows, pts, steps };
  });
}

type Kind = 'lp' | 'lc-circle' | 'lc-shifted' | 'lc-conic' | 'pp' | 'cp' | 'sq';

const POOLS: Record<Difficulty, { line: Kind[]; conic: Kind[] }> = {
  easy: { line: ['lp', 'lc-circle'], conic: ['pp'] },
  medium: { line: ['lp', 'lc-circle', 'lc-shifted', 'lc-conic'], conic: ['pp', 'sq'] },
  hard: { line: ['lp', 'lc-shifted', 'lc-conic'], conic: ['cp', 'sq', 'pp'] },
};

export const quadraticSystems = defineTopic({
  id: 'alg2.conic.systems',
  subject: 'algebra2',
  title: 'Systems of Quadratic Equations',
  description: 'Solve line–conic and conic–conic systems with integer solutions, including systems with no solution.',
  category: CATEGORY,
  instruction: 'Solve each system of equations.',
  multipleChoice: true,
  defaultCount: 8,
  options: [
    {
      type: 'select',
      id: 'type',
      label: 'Type of system',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'Mixed' },
        { value: 'line', label: 'Line and conic' },
        { value: 'conic', label: 'Two conics' },
      ],
    },
    { type: 'boolean', id: 'none', label: 'Include systems with no solution', default: true },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const type = strOpt(ctx, 'type');
    const pools = POOLS[difficulty];
    const pool = type === 'line' ? pools.line : type === 'conic' ? pools.conic : [...pools.line, ...pools.conic];
    const kind = rng.pick(pool);
    const none = boolOpt(ctx, 'none') && rng.bool(0.15);
    const built =
      kind === 'lp'
        ? lineParabola(rng, difficulty, none)
        : kind === 'lc-circle'
          ? lineConicSystem(rng, difficulty, 'circle', none)
          : kind === 'lc-shifted'
            ? lineConicSystem(rng, difficulty, 'shifted', none)
            : kind === 'lc-conic'
              ? lineConicSystem(rng, difficulty, 'conic', none)
              : kind === 'pp'
                ? parabolaPair(rng, difficulty, none)
                : kind === 'cp'
                  ? circleParabola(rng, none)
                  : squaresPair(rng, none);
    const pts = [...built.pts].sort((s, t) => s[0] - t[0] || s[1] - t[1]);
    const answer = pts.length ? m(ptsTex(pts)) : 'No solution';
    const swap = pts.map(([x, y]) => [y, x] as Pt);
    const negY = pts.map(([x, y]) => [x, -y] as Pt);
    const negX = pts.map(([x, y]) => [-x, y] as Pt);
    const distractors = distinctDistractors(
      answer,
      pts.length
        ? [pts.length > 1 ? m(ptsTex(pts.slice(0, 1))) : null, m(ptsTex(swap)), m(ptsTex(negY)), 'No solution', m(ptsTex(negX))]
        : [m(ptsTex([[0, offset(rng.int(1, 6))]])), m(ptsTex([[1, 2], [-1, 2]])), m(ptsTex([[2, -1], [-2, -1]]))],
      (n) => m(ptsTex((pts.length ? pts : [[0, 0] as Pt]).map(([x, y]) => [x + n, y] as Pt))),
    );
    return {
      question: m(system(built.rows)),
      answer,
      steps: built.steps,
      distractors,
      check: { kind: 'alg2-conics.system' },
    };
  },
});
