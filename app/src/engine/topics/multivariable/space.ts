/** Lines and planes in space, quadric surfaces, cylindrical and spherical coordinates. */
import { Frac, gcdAll } from '../../fraction';
import { attempt, defineTopic, offset } from '../../generator';
import type { Rng } from '../../rng';
import { decimal, m, sum } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { cosPi, cross, lincomb, dot, exMul, exQ, exRad, exScale, exTex, isZeroV, mt, norm2, piTex, randV, sinPi, taskTopic, tex, vsub, vtex, type Ex, type MT, type V3 } from './common';

const CAT = 'Vectors and the Geometry of Space';
const XYZ = ['x', 'y', 'z'] as const;
const pt = (p: readonly number[]) => `(${p.join(', ')})`;
const named = (n: string, p: readonly number[]) => `${n}${pt(p)}`;

function primitive(v: V3): V3 {
  const g = gcdAll(v) || 1;
  const s = v.find((x) => x !== 0)! < 0 ? -1 : 1;
  return v.map((x) => (s * x) / g);
}

/** `ax + by + cz = d`. */
const planeTex = (n: readonly number[], d: number) => `${sum(n.map((c, i) => ({ coef: c, sym: XYZ[i] })))} = ${d}`;
/** `x = 1 + 2t, y = …, z = …`. */
const paramTex = (p: readonly number[], d: readonly number[]) =>
  XYZ.map((v, i) => `${v} = ${sum([{ coef: p[i]! }, { coef: d[i]!, sym: 't' }])}`).join(',\\ ');
const symTex = (p: readonly number[], d: readonly number[]) =>
  XYZ.map((v, i) => {
    const top = sum([{ coef: 1, sym: v }, { coef: -p[i]! }]);
    return d[i] === 1 ? top : `\\frac{${top}}{${d[i]}}`;
  }).join(' = ');

type LTask = 'parametric' | 'symmetric' | 'plane3' | 'planeNormal' | 'intersect' | 'angle' | 'distance';

export const linesPlanes = taskTopic<LTask>({
  id: 'mv.vectors.lines-planes',
  title: 'Lines and Planes in Space',
  description: 'Parametric and symmetric equations of lines, equations of planes, intersections, angles and distances.',
  category: CAT,
  instruction: 'Answer each question. Round angles to the nearest tenth of a degree.',
  tasks: [
    { value: 'parametric', label: 'Parametric equations of a line' },
    { value: 'symmetric', label: 'Symmetric equations of a line' },
    { value: 'plane3', label: 'Plane through three points' },
    { value: 'planeNormal', label: 'Plane through a point with a normal' },
    { value: 'intersect', label: 'Line–plane intersection' },
    { value: 'angle', label: 'Angle between planes' },
    { value: 'distance', label: 'Distance from a point to a plane' },
  ],
  mix: {
    easy: ['parametric', 'planeNormal', 'parametric'],
    medium: ['parametric', 'symmetric', 'plane3', 'intersect'],
    hard: ['plane3', 'intersect', 'angle', 'distance', 'symmetric'],
  },
  build(task, { rng, difficulty }) {
    const R = difficulty === 'easy' ? 5 : 8;
    switch (task) {
      case 'parametric': {
        const p = randV(rng, R, 1);
        const viaPoints = difficulty !== 'easy' && rng.bool(0.6);
        const d = attempt('dir', () => {
          const d = randV(rng, 6, 2);
          return isZeroV(d) ? null : d;
        });
        const q = p.map((x, i) => x + d[i]!);
        const ans = (a: readonly number[], b: readonly number[]) => m(paramTex(a, b));
        const question = viaPoints
          ? `Find parametric equations of the line through ${m(named('P', p))} and ${m(named('Q', q))}.`
          : `Find parametric equations of the line through ${m(named('P', p))} parallel to ${m(`\\mathbf{v} = ${vtex(d)}`)}.`;
        return {
          question,
          answer: ans(p, d),
          steps: [viaPoints ? m(`\\mathbf{v} = \\overrightarrow{PQ} = ${vtex(d)}`) : m(`\\mathbf{v} = ${vtex(d)}`), m(`\\mathbf{r}(t) = ${vtex(p)} + t${vtex(d)}`), ans(p, d)],
          wrongs: [ans(d, p), ans(p, viaPoints ? q : d.map((x) => -x).map((x, i) => (i === 0 ? -x : x))), ans(p, d.map((x, i) => (i === 1 ? -x : x)))],
          fallback: (k) => ans(p, d.map((x, i) => (i === 2 ? x + offset(k) : x))),
          check: { kind: 'multivariable.line', task: viaPoints ? 'points' : 'parallel' },
        };
      }
      case 'symmetric': {
        const p = randV(rng, R, 1);
        const d = attempt('dir', () => {
          const d = randV(rng, 5, 3);
          return d.every((x) => x !== 0) ? d : null;
        });
        const q = p.map((x, i) => x + d[i]!);
        const ans = (a: readonly number[], b: readonly number[]) => m(symTex(a, b));
        return {
          question: `Find symmetric equations of the line through ${m(named('P', p))} and ${m(named('Q', q))}.`,
          answer: ans(p, d),
          steps: [m(`\\mathbf{v} = \\overrightarrow{PQ} = ${vtex(d)}`), ans(p, d)],
          wrongs: [ans(p.map((x) => -x), d), ans(p, q.every((x) => x !== 0) ? q : d.map((x) => 2 * x + 1)), ans(d.every((x, i) => x === p[i]) ? p.map((x) => x + 1) : d, p.every((x) => x !== 0) ? p : d.map((x) => -x))],
          fallback: (k) => ans(p.map((x, i) => (i === 0 ? x + offset(k) : x)), d),
          check: { kind: 'multivariable.line', task: 'symmetric' },
        };
      }
      case 'plane3': {
        const [P, Q, Rr, n] = attempt('plane3', () => {
          const P = randV(rng, 4, 1);
          const Q = randV(rng, 4, 1);
          const Rr = randV(rng, 4, 1);
          const n = cross(vsub(Q, P), vsub(Rr, P));
          if (isZeroV(n) || n.filter((x) => x !== 0).length < 2) return null;
          const pn = primitive(n);
          return pn.some((x) => Math.abs(x) > 12) ? null : [P, Q, Rr, pn];
        });
        const d = dot(n, P);
        const ans = (a: readonly number[], b: number) => m(planeTex(a, b));
        return {
          question: `Find an equation of the plane through ${m(named('P', P))}, ${m(named('Q', Q))}, and ${m(named('R', Rr))}.`,
          answer: ans(n, d),
          steps: [
            m(`\\overrightarrow{PQ} = ${vtex(vsub(Q, P))},\\ \\overrightarrow{PR} = ${vtex(vsub(Rr, P))}`),
            m(`\\mathbf{n} = \\overrightarrow{PQ} \\times \\overrightarrow{PR} \\parallel ${vtex(n)}`),
            ans(n, d),
          ],
          wrongs: [ans(n, -d || d + 3), ans(n.map((x, i) => (i === 1 ? -x : x)), d), ans(n, dot(n, Q) + dot(n, Rr) - d + 1 === d ? d + 2 : dot(n, vsub(Q, P)))],
          fallback: (k) => ans(n, d + offset(k)),
          check: { kind: 'multivariable.plane', task: 'points' },
        };
      }
      case 'planeNormal': {
        const P = randV(rng, R, 1);
        const n = randV(rng, 6, 2);
        const d = dot(n, P);
        const ans = (a: readonly number[], b: number) => m(planeTex(a, b));
        return {
          question: `Find an equation of the plane through ${m(named('P', P))} with normal vector ${m(`\\mathbf{n} = ${vtex(n)}`)}.`,
          answer: ans(n, d),
          steps: [m(`${lincomb(n.map((c, i) => [c, sum([{ coef: 1, sym: XYZ[i] }, { coef: -P[i]! }])] as const))} = 0`), ans(n, d)],
          wrongs: [ans(n, -d || 4), ans(P.every((x) => x === 0) ? n.map((x) => x + 1) : P, dot(n, P) === d && P.some((x, i) => x !== n[i]) ? dot(P, P) : d + 1), ans(n, dot(n, n))],
          fallback: (k) => ans(n, d + offset(k)),
          check: { kind: 'multivariable.plane', task: 'normal' },
        };
      }
      case 'intersect': {
        const [n, d, X0, t0, p] = attempt('intersect', () => {
          const n = randV(rng, 4, 2);
          const d = randV(rng, 4, 2);
          if (dot(n, d) === 0) return null;
          const X0 = randV(rng, 6, 0);
          const t0 = rng.intExcept(-3, 3, [0]);
          const p = X0.map((x, i) => x - t0 * d[i]!);
          return p.some((x) => Math.abs(x) > 12) ? null : ([n, d, X0, t0, p] as const);
        });
        const c = dot(n, X0);
        const ans = (q: readonly number[]) => m(pt(q));
        const subst = lincomb(n.map((k, i) => [k, sum([{ coef: p[i]! }, { coef: d[i]!, sym: 't' }])] as const));
        return {
          question: `Find the point where the line ${m(paramTex(p, d))} intersects the plane ${m(planeTex(n, c))}.`,
          answer: ans(X0),
          steps: [m(`${subst} = ${c}`), m(`t = ${t0}`), ans(X0)],
          wrongs: [ans(p.map((x, i) => x + -t0 * d[i]!)), ans(p.map((x, i) => x + (t0 + 1) * d[i]!)), ans(p)],
          fallback: (k) => ans(X0.map((x, i) => (i === 0 ? x + offset(k) : x))),
          check: { kind: 'multivariable.plane', task: 'intersect' },
        };
      }
      case 'angle': {
        const [n1, n2] = attempt('angle', () => {
          const n1 = randV(rng, 4, 2);
          const n2 = randV(rng, 4, 2);
          return isZeroV(cross(n1, n2)) ? null : [n1, n2];
        });
        const c1 = rng.int(-6, 6);
        const c2 = rng.int(-6, 6);
        const cos = Math.abs(dot(n1, n2)) / Math.sqrt(norm2(n1) * norm2(n2));
        const th = (Math.acos(cos) * 180) / Math.PI;
        const ans = (t: number) => m(`\\theta ${dot(n1, n2) === 0 && t === 90 ? '=' : '\\approx'} ${decimal(t)}^\\circ`);
        return {
          question: `Find the acute angle between the planes ${m(planeTex(n1, c1))} and ${m(planeTex(n2, c2))}.`,
          answer: ans(th),
          steps: [m(`\\cos\\theta = \\frac{|\\mathbf{n}_1 \\cdot \\mathbf{n}_2|}{\\|\\mathbf{n}_1\\|\\,\\|\\mathbf{n}_2\\|} = \\frac{${Math.abs(dot(n1, n2))}}{\\sqrt{${norm2(n1)}}\\sqrt{${norm2(n2)}}}`), ans(th)],
          wrongs: [ans(90 - th), dot(n1, n2) === 0 ? ans(45) : ans(180 - th), ans((Math.acos(Math.min(1, Math.abs(dot(n1, n2)) / (norm2(n1) + norm2(n2)))) * 180) / Math.PI)],
          fallback: (k) => ans(th + 3.3 * offset(k)),
          check: { kind: 'multivariable.plane', task: 'angle' },
        };
      }
      case 'distance':
      default: {
        const n = randV(rng, 5, 2);
        const P = randV(rng, 6, 1);
        const c = attempt('dist', () => {
          const c = rng.int(-10, 10);
          return dot(n, P) === c ? null : c;
        });
        const top = Math.abs(dot(n, P) - c);
        const val = exRad(new Frac(top, norm2(n)), norm2(n));
        const ans = (e: Ex) => m(`D = ${exTex(e)}`);
        return {
          question: `Find the distance from ${m(named('P', P))} to the plane ${m(planeTex(n, c))}.`,
          answer: ans(val),
          steps: [m(`D = \\frac{|${n.map((k, i) => `(${k})(${P[i]})`).join(' + ')} - ${c < 0 ? `(${c})` : c}|}{\\sqrt{${norm2(n)}}} = \\frac{${top}}{\\sqrt{${norm2(n)}}}`), ans(val)],
          wrongs: [ans(exQ(new Frac(top, norm2(n)))), ans(exRad(new Frac(Math.abs(dot(n, P) + c) || top + 2, norm2(n)), norm2(n))), ans(exQ(top))],
          fallback: (k) => ans(exRad(new Frac(top + k, norm2(n)), norm2(n))),
          check: { kind: 'multivariable.plane', task: 'distance' },
        };
      }
    }
  },
});

// ---------------------------------------------------------------- quadric surfaces

const QUADRICS = [
  'Ellipsoid',
  'Hyperboloid of one sheet',
  'Hyperboloid of two sheets',
  'Elliptic cone',
  'Elliptic paraboloid',
  'Hyperbolic paraboloid',
  'Elliptic cylinder',
  'Hyperbolic cylinder',
  'Parabolic cylinder',
] as const;
type Quadric = (typeof QUADRICS)[number];
const NEAR: Record<Quadric, Quadric[]> = {
  Ellipsoid: ['Hyperboloid of one sheet', 'Elliptic paraboloid', 'Elliptic cylinder'],
  'Hyperboloid of one sheet': ['Hyperboloid of two sheets', 'Elliptic cone', 'Hyperbolic paraboloid'],
  'Hyperboloid of two sheets': ['Hyperboloid of one sheet', 'Elliptic cone', 'Ellipsoid'],
  'Elliptic cone': ['Hyperboloid of one sheet', 'Hyperboloid of two sheets', 'Elliptic paraboloid'],
  'Elliptic paraboloid': ['Hyperbolic paraboloid', 'Elliptic cone', 'Ellipsoid'],
  'Hyperbolic paraboloid': ['Elliptic paraboloid', 'Hyperboloid of one sheet', 'Hyperbolic cylinder'],
  'Elliptic cylinder': ['Ellipsoid', 'Hyperbolic cylinder', 'Elliptic paraboloid'],
  'Hyperbolic cylinder': ['Elliptic cylinder', 'Hyperbolic paraboloid', 'Hyperboloid of one sheet'],
  'Parabolic cylinder': ['Elliptic paraboloid', 'Hyperbolic cylinder', 'Elliptic cylinder'],
};

/** Square coefficient, linear coefficient and shift per variable slot. */
interface Slot {
  sq: number;
  lin: number;
}

function quadricEq(rng: Rng, kind: Quadric, d: Difficulty): string {
  const vars = rng.shuffle([...XYZ]);
  const sqs = [4, 9, 16, 25, 36, 1];
  // signs of the three square terms on the left (0 = absent), the right-hand side, and which slot is linear
  let signs: number[];
  let K: number;
  let linear = -1;
  switch (kind) {
    case 'Ellipsoid':
      signs = [1, 1, 1];
      K = 1;
      break;
    case 'Hyperboloid of one sheet':
      signs = [1, 1, -1];
      K = 1;
      break;
    case 'Hyperboloid of two sheets':
      signs = [1, -1, -1];
      K = 1;
      break;
    case 'Elliptic cone':
      signs = [1, 1, -1];
      K = 0;
      break;
    case 'Elliptic paraboloid':
      signs = [1, 1, 0];
      K = 0;
      linear = 2;
      break;
    case 'Hyperbolic paraboloid':
      signs = [1, -1, 0];
      K = 0;
      linear = 2;
      break;
    case 'Elliptic cylinder':
      signs = [1, 1, 0];
      K = 1;
      break;
    case 'Hyperbolic cylinder':
      signs = [1, -1, 0];
      K = 1;
      break;
    case 'Parabolic cylinder':
    default:
      signs = [1, 0, 0];
      K = 0;
      linear = 1;
      break;
  }
  // distinct denominators so ellipsoids are not spheres
  const den = rng.sample(sqs, 3);
  if (d === 'easy') {
    // standard form: x²/a² ± y²/b² … = 1, or z = x²/a² ± y²/b²
    const terms: MT[] = [];
    signs.forEach((s, i) => s && terms.push(mt(new Frac(s, den[i]!), { [vars[i]!]: 2 })));
    if (linear >= 0) {
      const c = rng.pick([1, 2, 3]);
      return `${linear === 2 && rng.bool(0.5) ? `${vars[linear]!} = ${tex(terms)}` : `${c === 1 ? '' : c}${vars[linear]!} = ${tex(terms)}`}`;
    }
    if (K === 0) {
      const neg = signs.findIndex((s) => s < 0);
      const left = mt(new Frac(1, den[neg]!), { [vars[neg]!]: 2 });
      return `${tex([left])} = ${tex(terms.slice(0, 2))}`;
    }
    return `${tex(terms)} = 1`;
  }
  // integer form: multiply through; medium = Ax² ± By² ± Cz² = K, hard = with completed squares expanded and terms moved
  const coef = signs.map((s, i) => s * den[i]!);
  const slots: Slot[] = coef.map((c) => ({ sq: c, lin: 0 }));
  let rhs = K ? rng.pick([4, 9, 16, 36, 12, 18]) : 0;
  const shifts = [0, 0, 0];
  if (d === 'hard') {
    // (v − h)² expanded for one or two squared variables
    for (let i = 0; i < 3; i++)
      if (slots[i]!.sq && rng.bool(0.6)) {
        const h = rng.signedInt(1, 3, true);
        shifts[i] = h;
        slots[i]!.lin = -2 * h * slots[i]!.sq;
        rhs -= slots[i]!.sq * h * h; // move the constant to the right
      }
  }
  const terms: MT[] = [];
  slots.forEach((s, i) => {
    if (s.sq) terms.push(mt(s.sq, { [vars[i]!]: 2 }));
    if (s.lin) terms.push(mt(s.lin, { [vars[i]!]: 1 }));
  });
  if (linear >= 0) {
    const c = rng.pick([1, 2, 4, 3]);
    if (rng.bool(0.5)) return `${tex(terms)} = ${c === 1 ? '' : c}${vars[linear]!}${rhs ? ` ${rhs > 0 ? '+' : '-'} ${Math.abs(rhs)}` : ''}`;
    terms.push(mt(-c, { [vars[linear]!]: 1 }));
    return `${tex(terms)} = ${rhs}`;
  }
  return `${tex(terms)} = ${rhs}`;
}

export const quadricSurfaces = defineTopic({
  id: 'mv.vectors.quadric-surfaces',
  subject: 'multivariable',
  category: CAT,
  title: 'Quadric Surfaces',
  description: 'Classify quadric surfaces from their equations.',
  instruction: 'Identify each surface.',
  multipleChoice: true,
  defaultCount: 10,
  options: [{ type: 'boolean', id: 'cylinders', label: 'Include cylinders', default: true }],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const pool = QUADRICS.filter((q) => ctx.options.cylinders !== false || !q.endsWith('cylinder'));
    const kind = rng.pick(pool);
    const eq = quadricEq(rng, kind, difficulty);
    const steps: string[] = [];
    if (difficulty === 'hard') steps.push('Complete the square in each variable that has a linear term.');
    steps.push(STEP[kind]);
    return {
      question: `${m(eq)}`,
      answer: kind,
      steps,
      distractors: NEAR[kind],
      check: { kind: 'multivariable.quadric' },
    };
  },
});

const STEP: Record<Quadric, string> = {
  Ellipsoid: 'All three squared terms are positive and equal a positive constant: an ellipsoid.',
  'Hyperboloid of one sheet': 'Two squared terms are positive and one is negative, equal to a positive constant: a hyperboloid of one sheet.',
  'Hyperboloid of two sheets': 'One squared term is positive and two are negative, equal to a positive constant: a hyperboloid of two sheets.',
  'Elliptic cone': 'Squared terms of mixed sign with constant term zero: an elliptic cone.',
  'Elliptic paraboloid': 'One variable appears to the first power and the two squared terms have the same sign: an elliptic paraboloid.',
  'Hyperbolic paraboloid': 'One variable appears to the first power and the two squared terms have opposite signs: a hyperbolic paraboloid.',
  'Elliptic cylinder': 'One variable is missing and the two squared terms have the same sign: an elliptic cylinder.',
  'Hyperbolic cylinder': 'One variable is missing and the two squared terms have opposite signs: a hyperbolic cylinder.',
  'Parabolic cylinder': 'One variable is missing and only one variable is squared: a parabolic cylinder.',
};

// ---------------------------------------------------------------- cylindrical and spherical coordinates

type CTask = 'rectToCyl' | 'cylToRect' | 'sphToRect' | 'rectToSph' | 'equation';

const exPair = (e: Ex) => exTex(e);

/** r and θ for which r·cos θ and r·sin θ are reasonably simple. */
function polarPair(rng: Rng, nonAxis = true): { r: Ex; th: Frac; k: number } {
  const th = rng.pick(nonAxis ? [1, 2, 3, 4, 5, 7, 8, 9, 10, 11].map((n) => new Frac(n, 6)).concat([1, 3, 5, 7].map((n) => new Frac(n, 4))) : [new Frac(0), new Frac(1, 2), new Frac(1), new Frac(3, 2)]);
  const k = rng.int(1, 4);
  if (th.d === 4) return { r: exRad(k, 2), th, k };
  if (th.d === 3 || th.d === 6) return { r: exQ(2 * k), th, k };
  return { r: exQ(k), th, k };
}

const sq = (a: number) => a * a;
const CYL_EQ: Array<{ rect: (a: number) => string; cyl: (a: number) => string }> = [
  { rect: (a) => `x^{2} + y^{2} = ${sq(a)}`, cyl: (a) => `r = ${a}` },
  { rect: (a) => `z = ${a === 1 ? '' : a}x^{2} + ${a === 1 ? '' : a}y^{2}`, cyl: (a) => `z = ${a === 1 ? '' : a}r^{2}` },
  { rect: (a) => `x^{2} + y^{2} = ${2 * a}x`, cyl: (a) => `r = ${2 * a}\\cos\\theta` },
  { rect: (a) => `x^{2} + y^{2} = ${2 * a}y`, cyl: (a) => `r = ${2 * a}\\sin\\theta` },
  { rect: (a) => `x^{2} + y^{2} + z^{2} = ${sq(a)}`, cyl: (a) => `r^{2} + z^{2} = ${sq(a)}` },
  { rect: (a) => `x^{2} - y^{2} = ${a}`, cyl: (a) => `r^{2}\\cos 2\\theta = ${a}` },
];
const SPH_EQ: Array<{ rect: (a: number) => string; sph: (a: number) => string }> = [
  { rect: (a) => `x^{2} + y^{2} + z^{2} = ${sq(a)}`, sph: (a) => `\\rho = ${a}` },
  { rect: (a) => `x^{2} + y^{2} + z^{2} = ${2 * a}z`, sph: (a) => `\\rho = ${2 * a}\\cos\\phi` },
  { rect: (a) => `z = ${a}`, sph: (a) => `\\rho = ${a}\\sec\\phi` },
  { rect: (a) => `x^{2} + y^{2} = ${sq(a)}`, sph: (a) => `\\rho\\sin\\phi = ${a}` },
  { rect: () => `z = \\sqrt{x^{2} + y^{2}}`, sph: () => `\\phi = \\frac{\\pi}{4}` },
  { rect: () => `z = \\sqrt{3x^{2} + 3y^{2}}`, sph: () => `\\phi = \\frac{\\pi}{6}` },
];

const COORD_NAME = { rect: 'rectangular', cyl: 'cylindrical', sph: 'spherical' };

function equationProblem(rng: Rng, d: Difficulty) {
  const toSph = d !== 'easy' && rng.bool(d === 'hard' ? 0.7 : 0.5);
  const reverse = rng.bool(0.35);
  const a = rng.int(1, 5);
  const table = toSph ? SPH_EQ.map((t) => ({ rect: t.rect, other: t.sph })) : CYL_EQ.map((t) => ({ rect: t.rect, other: t.cyl }));
  const i = rng.int(0, table.length - 1);
  const other = toSph ? 'sph' : 'cyl';
  const from = reverse ? other : 'rect';
  const to = reverse ? 'rect' : other;
  const side = (j: number, s: 'from' | 'to', aa = a) => {
    const t = table[j]!;
    const isRect = (s === 'from' ? from : to) === 'rect';
    return isRect ? t.rect(aa) : t.other(aa);
  };
  const qeq = side(i, 'from');
  const answer = m(side(i, 'to'));
  const wrongs = rng.shuffle(table.map((_, j) => j).filter((j) => j !== i)).map((j) => m(side(j, 'to')));
  wrongs.unshift(m(side(i, 'to', a + 1)));
  return {
    question: `Convert ${m(qeq)} from ${COORD_NAME[from]} to ${COORD_NAME[to]} coordinates.`,
    answer,
    steps: [toSph ? m(`x = \\rho\\sin\\phi\\cos\\theta,\\ y = \\rho\\sin\\phi\\sin\\theta,\\ z = \\rho\\cos\\phi,\\ x^{2} + y^{2} + z^{2} = \\rho^{2}`) : m(`x = r\\cos\\theta,\\ y = r\\sin\\theta,\\ x^{2} + y^{2} = r^{2}`), answer],
    wrongs,
    fallback: (k: number) => m(side(i, 'to', a + 1 + k)),
    check: { kind: 'multivariable.coordEq', from, to },
  };
}

export const cylSph = taskTopic<CTask>({
  id: 'mv.vectors.cylindrical-spherical',
  title: 'Cylindrical and Spherical Coordinates',
  description: 'Convert points and equations between rectangular, cylindrical and spherical coordinates.',
  category: CAT,
  instruction: 'Convert as indicated. Use r ≥ 0, ρ ≥ 0, 0 ≤ θ < 2π and 0 ≤ φ ≤ π.',
  tasks: [
    { value: 'rectToCyl', label: 'Point: rectangular to cylindrical' },
    { value: 'cylToRect', label: 'Point: cylindrical to rectangular' },
    { value: 'sphToRect', label: 'Point: spherical to rectangular' },
    { value: 'rectToSph', label: 'Point: rectangular to spherical' },
    { value: 'equation', label: 'Convert an equation' },
  ],
  mix: { easy: ['cylToRect', 'rectToCyl', 'equation'], medium: ['rectToCyl', 'sphToRect', 'equation', 'cylToRect'], hard: ['rectToSph', 'sphToRect', 'equation'] },
  build(task, { rng, difficulty }) {
    const tup = (xs: Array<Ex | string>) => `\\left(${xs.map((x) => (typeof x === 'string' ? x : exPair(x))).join(', ')}\\right)`;
    switch (task) {
      case 'rectToCyl':
      case 'cylToRect': {
        const { r, th } = polarPair(rng);
        const z = rng.int(-6, 6);
        const x = exMul(r, cosPi(th));
        const y = exMul(r, sinPi(th));
        const rect = tup([x, y, exQ(z)]);
        const cyl = tup([r, piTex(th), String(z)]);
        if (task === 'rectToCyl') {
          const w = (rr: Ex, t: Frac) => m(tup([rr, piTex(t), String(z)]));
          return {
            question: `Convert ${m(rect)} from rectangular to cylindrical coordinates.`,
            answer: m(cyl),
            steps: [m(`r = \\sqrt{x^{2} + y^{2}} = ${exTex(r)}`), m(`\\tan\\theta = \\frac{y}{x}`), m(`\\theta = ${piTex(th)}`), m(cyl)],
            wrongs: [w(r, th.add(1).sub(th.add(1).cmp(2) >= 0 ? 2 : 0)), w(exMul(r, r), th), w(r, new Frac(1, 2).sub(th).add(new Frac(1, 2).sub(th).sign < 0 ? 2 : 0))],
            fallback: (k) => w(r, th.add(new Frac(k, 6)).sub(th.add(new Frac(k, 6)).cmp(2) >= 0 ? 2 : 0)),
            check: { kind: 'multivariable.coordPt', from: 'rect', to: 'cyl' },
          };
        }
        const w = (a: Ex, b: Ex) => m(tup([a, b, exQ(z)]));
        return {
          question: `Convert ${m(cyl)} from cylindrical to rectangular coordinates.`,
          answer: m(rect),
          steps: [m(`x = r\\cos\\theta = ${exTex(x)}`), m(`y = r\\sin\\theta = ${exTex(y)}`), m(rect)],
          wrongs: [w(y, x), w(exScale(x, -1), y), w(x, exScale(y, -1))],
          fallback: (k) => w(x, exScale(y, k + 1)),
          check: { kind: 'multivariable.coordPt', from: 'cyl', to: 'rect' },
        };
      }
      case 'sphToRect':
      case 'rectToSph': {
        const rho = rng.pick([2, 4, 6, 8]);
        const phi = rng.pick([1, 2, 3, 4, 5].map((n) => new Frac(n, 6)).concat([new Frac(1, 4), new Frac(3, 4)]));
        const th = rng.pick([0, 1, 2, 3, 4, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20, 21, 22].map((n) => new Frac(n, 12)).filter((f) => f.d !== 12));
        const sp = sinPi(phi);
        const x = exMul(exScale(sp, rho), cosPi(th));
        const y = exMul(exScale(sp, rho), sinPi(th));
        const z = exScale(cosPi(phi), rho);
        const rect = tup([x, y, z]);
        const sph = tup([String(rho), piTex(th), piTex(phi)]);
        if (task === 'sphToRect') {
          const w = (a: Ex, b: Ex, c: Ex) => m(tup([a, b, c]));
          return {
            question: `Convert ${m(sph)} from spherical ${m('(\\rho, \\theta, \\phi)')} to rectangular coordinates.`,
            answer: m(rect),
            steps: [m(`x = \\rho\\sin\\phi\\cos\\theta = ${exTex(x)}`), m(`y = \\rho\\sin\\phi\\sin\\theta = ${exTex(y)}`), m(`z = \\rho\\cos\\phi = ${exTex(z)}`)],
            wrongs: [
              w(exMul(exScale(cosPi(phi), rho), cosPi(th)), exMul(exScale(cosPi(phi), rho), sinPi(th)), exScale(sp, rho)),
              w(y, x, z),
              w(x, y, exScale(z, -1).length ? exScale(z, -1) : exQ(rho)),
            ],
            fallback: (k) => w(x, y, z.length ? exScale(z, k + 1) : exQ(k)),
            check: { kind: 'multivariable.coordPt', from: 'sph', to: 'rect' },
          };
        }
        const w = (a: string, b: string, c: string) => m(`\\left(${a}, ${b}, ${c}\\right)`);
        return {
          question: `Convert ${m(rect)} from rectangular to spherical ${m('(\\rho, \\theta, \\phi)')} coordinates.`,
          answer: m(sph),
          steps: [m(`\\rho = \\sqrt{x^{2} + y^{2} + z^{2}} = ${rho}`), m(`\\cos\\phi = \\frac{z}{\\rho},\\ \\phi = ${piTex(phi)}`), m(`\\theta = ${piTex(th)}`), m(sph)],
          wrongs: [w(String(rho), piTex(phi), piTex(th)), w(String(rho * rho), piTex(th), piTex(phi)), w(String(rho), piTex(th), piTex(Frac.ONE.sub(phi)))],
          fallback: (k) => w(String(rho + k), piTex(th), piTex(phi)),
          check: { kind: 'multivariable.coordPt', from: 'rect', to: 'sph' },
        };
      }
      case 'equation':
      default:
        return equationProblem(rng, difficulty);
    }
  },
});

