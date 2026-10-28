/** Triple integrals (rectangular, cylindrical, spherical) and applications of multiple integrals. */
import { Frac, gcdAll } from '../../fraction';
import { offset } from '../../generator';
import type { Rng } from '../../rng';
import { m, num } from '../../tex';
import type { Difficulty } from '../../types';
import { cosPi, cst, definite, ex, exAdd, exMul, exPi, exScale, exTex, integ, mt, norm, piTex, randMono, sub, taskTopic, tex, vr, type Ex, type MX } from './common';
import { exactIter, iterTex, regionTex, topSum, type BT } from './integrals';

const CAT = 'Multiple Integrals';
interface B {
  v: string;
  lo: MX;
  hi: MX;
}
const btex = (b: B): BT => ({ v: b.v, lo: tex(b.lo), hi: tex(b.hi) });
const valAns = (e: Ex | Frac) => m(e instanceof Frac ? num(e) : exTex(e));

function randPoly(rng: Rng, vars: readonly string[], maxDeg: number, n: number, cmax = 5): MX {
  for (;;) {
    const f = norm(Array.from({ length: n }, () => mt(rng.signedInt(1, cmax, true), randMono(rng, vars, 0, maxDeg))));
    if (f.length === n && f.some((t) => Object.keys(t.e).length)) return f;
  }
}

// ---------------------------------------------------------------- triple integrals

type TTask = 'box' | 'iterated' | 'region' | 'tetra';

export const tripleIntegrals = taskTopic<TTask>({
  id: 'mv.integrals.triple',
  title: 'Triple Integrals',
  description: 'Triple integrals over boxes and simple solid regions, and volumes of tetrahedra.',
  category: CAT,
  instruction: 'Evaluate each integral or find the indicated volume.',
  defaultCount: 8,
  tasks: [
    { value: 'box', label: 'Over a rectangular box' },
    { value: 'iterated', label: 'Iterated integral with variable limits' },
    { value: 'region', label: 'Over a solid region E' },
    { value: 'tetra', label: 'Volume of a tetrahedron' },
  ],
  mix: { easy: ['box', 'iterated'], medium: ['box', 'iterated', 'tetra'], hard: ['iterated', 'region', 'tetra'] },
  build(task, { rng, difficulty }) {
    const V3 = ['x', 'y', 'z'];
    switch (task) {
      case 'box': {
        const bs: B[] = rng.shuffle(V3).map((v) => {
          const lo = difficulty === 'easy' ? 0 : rng.int(-1, 1);
          return { v, lo: cst(lo), hi: cst(lo + rng.int(1, 3)) };
        });
        const f = randPoly(rng, V3, difficulty === 'easy' ? 2 : 3, difficulty === 'easy' ? 1 : 2);
        const v = exactIter(f, bs);
        const box = `B = ${V3.map((x) => bs.find((b) => b.v === x)!).map((b) => `[${tex(b.lo)}, ${tex(b.hi)}]`).join(' \\times ')}`;
        const asRegion = difficulty !== 'easy' && rng.bool(0.5);
        return {
          question: asRegion ? `${m(`\\displaystyle \\iiint_{B} ${topSum(tex(f)) ? `(${tex(f)})` : tex(f)}\\,dV`)}, ${m(box)}` : m(iterTex(f, bs.map(btex))),
          answer: valAns(v),
          steps: [m(`\\int_{${tex(bs[2]!.lo)}}^{${tex(bs[2]!.hi)}} ${topSum(tex(f)) ? `(${tex(f)})` : tex(f)}\\,d${bs[2]!.v} = ${tex(definite(f, bs[2]!.v, bs[2]!.lo, bs[2]!.hi))}`), valAns(v)],
          wrongs: [valAns(v.neg()), valAns(v.mul(2)), valAns(exactIter(f, bs.map((b, i) => (i === 0 ? { ...b, hi: b.lo, lo: b.hi } : b))).eq(v) ? v.add(3) : v.add(exactIter(cst(1), bs)))],
          fallback: (k) => valAns(v.add(offset(k))),
          check: { kind: 'multivariable.integral' },
        };
      }
      case 'iterated':
      case 'region': {
        const a = rng.int(1, 2);
        const outer: B = { v: 'x', lo: cst(0), hi: cst(a) };
        const mid: B = rng.pick<B>([
          { v: 'y', lo: cst(0), hi: vr('x') },
          { v: 'y', lo: cst(0), hi: [mt(1, { x: 2 })] },
          { v: 'y', lo: vr('x'), hi: vr('x', 2) },
          { v: 'y', lo: cst(0), hi: cst(rng.int(1, 2)) },
        ]);
        const inner: B = rng.pick<B>([
          { v: 'z', lo: cst(0), hi: norm([mt(1, { x: 1 }), mt(1, { y: 1 })]) },
          { v: 'z', lo: cst(0), hi: [mt(1, { x: 1, y: 1 })] },
          { v: 'z', lo: cst(0), hi: vr('y') },
          { v: 'z', lo: vr('y'), hi: norm([mt(1, { x: 1 }), mt(1, { y: 1 })]) },
        ]);
        const bs = [outer, mid, inner];
        const f = difficulty === 'easy' ? [mt(rng.int(1, 6), randMono(rng, V3, 0, 1))] : randPoly(rng, V3, 1, 2, 4);
        const v = exactIter(f, bs);
        const question = task === 'region' ? `${m(`\\displaystyle \\iiint_{E} ${topSum(tex(f)) ? `(${tex(f)})` : tex(f)}\\,dV`)}, ${m(regionTex('E', V3, bs.map(btex)))}` : m(iterTex(f, bs.map(btex)));
        return {
          question,
          answer: valAns(v),
          steps: [m(`\\int_{${tex(inner.lo)}}^{${tex(inner.hi)}} ${topSum(tex(f)) ? `(${tex(f)})` : tex(f)}\\,dz = ${tex(definite(f, 'z', inner.lo, inner.hi))}`), m(`\\int_{${tex(mid.lo)}}^{${tex(mid.hi)}} (\\ldots)\\,dy = ${tex(definite(definite(f, 'z', inner.lo, inner.hi), 'y', mid.lo, mid.hi))}`), valAns(v)],
          wrongs: [valAns(v.neg()), valAns(v.mul(2)), valAns(v.add(exactIter(cst(1), bs)))],
          fallback: (k) => valAns(v.add(offset(k))),
          check: { kind: 'multivariable.integral' },
        };
      }
      case 'tetra':
      default: {
        const [p, q, r] = [rng.int(1, 4), rng.int(1, 4), rng.int(1, 6)];
        // x/p + y/q + z/r = 1  ⇒  qr·x + pr·y + pq·z = pqr
        const n = [q * r, p * r, p * q];
        const g = gcdAll([...n, p * q * r]);
        const nn = n.map((x) => x / g);
        const d = (p * q * r) / g;
        const plane = `${nn.map((c, i) => `${c === 1 ? '' : c}${V3[i]}`).join(' + ')} = ${d}`;
        const v = new Frac(p * q * r, 6);
        return {
          question: `Find the volume of the solid in the first octant bounded by the coordinate planes and the plane ${m(plane)}.`,
          answer: m(`V = ${num(v)}`),
          steps: [`The intercepts are ${m(`x = ${p}`)}, ${m(`y = ${q}`)} and ${m(`z = ${r}`)}.`, m(`V = \\int_{0}^{${p}}\\int_{0}^{${tex(norm([mt(q), mt(new Frac(-q, p), { x: 1 })]))}}\\int_{0}^{${tex(norm([mt(r), mt(new Frac(-r, p), { x: 1 }), mt(new Frac(-r, q), { y: 1 })]))}} dz\\,dy\\,dx = ${num(v)}`)],
          wrongs: [m(`V = ${num(new Frac(p * q * r, 2))}`), m(`V = ${p * q * r}`), m(`V = ${num(new Frac(p * q * r, 3))}`)],
          fallback: (k) => m(`V = ${num(v.add(offset(k)))}`),
          check: { kind: 'multivariable.tetra' },
        };
      }
    }
  },
});

// ---------------------------------------------------------------- cylindrical and spherical

/** ∫_c^1 (1 − u²)^j u^k du exactly, for c an exact value (cos φ₁). */
function uIntegral(j: number, k: number, c: Ex): Ex {
  // expand (1 − u²)^j u^k into a polynomial in u
  let p: MX = [mt(1)];
  for (let i = 0; i < j; i++) p = norm(p.flatMap((t) => [t, { ...t, c: t.c.neg(), e: { u: (t.e.u ?? 0) + 2 } }]));
  p = p.map((t) => ({ ...t, e: { u: (t.e.u ?? 0) + k } }));
  const P = integ(p, 'u');
  let at1: Ex = [];
  let atc: Ex = [];
  for (const t of P) {
    const e = t.e.u ?? 0;
    at1 = exAdd(at1, ex(t.c));
    let pw: Ex = ex(1);
    for (let i = 0; i < e; i++) pw = exMul(pw, c);
    atc = exAdd(atc, exScale(pw, t.c));
  }
  return exAdd(at1, exScale(atc, -1));
}

type CSTask = 'cylIterated' | 'sphIterated' | 'cylRegion' | 'sphRegion';

const THETAS: Array<[Frac, string]> = [
  [new Frac(2), '2\\pi'],
  [new Frac(1), '\\pi'],
  [new Frac(1, 2), '\\frac{\\pi}{2}'],
];
const PHIS: Frac[] = [new Frac(1, 6), new Frac(1, 4), new Frac(1, 3), new Frac(1, 2), new Frac(1)];

export const cylSphIntegrals = taskTopic<CSTask>({
  id: 'mv.integrals.cylindrical-spherical',
  title: 'Triple Integrals in Cylindrical and Spherical Coordinates',
  description: 'Evaluate triple integrals using cylindrical and spherical coordinates.',
  category: CAT,
  instruction: 'Evaluate each integral.',
  defaultCount: 8,
  tasks: [
    { value: 'cylIterated', label: 'Cylindrical iterated integral' },
    { value: 'sphIterated', label: 'Spherical iterated integral' },
    { value: 'cylRegion', label: 'Solid described in cylindrical coordinates' },
    { value: 'sphRegion', label: 'Solid described in spherical coordinates' },
  ],
  mix: { easy: ['cylIterated', 'sphIterated'], medium: ['cylIterated', 'sphIterated', 'cylRegion', 'sphRegion'], hard: ['cylRegion', 'sphRegion'] },
  build(task, { rng, difficulty }) {
    const [Th, thTex] = rng.pick(difficulty === 'easy' ? THETAS.slice(0, 1) : THETAS);
    if (task === 'cylIterated' || task === 'cylRegion') {
      // integrand (in r, z, already times the Jacobian r) and its x, y, z form
      const k = rng.int(1, 4);
      const s = (n: number) => (n === 1 ? '' : String(n));
      const opts: Array<{ rz: MX; xyz: string }> = [
        { rz: [mt(k, { r: 1 })], xyz: String(k) },
        { rz: [mt(k, { r: 3 })], xyz: `${s(k)}x^{2} + ${s(k)}y^{2}` },
        { rz: [mt(k, { r: 1, z: 1 })], xyz: `${s(k)}z` },
        { rz: [mt(1, { r: 2 })], xyz: `\\sqrt{x^{2} + y^{2}}` },
      ];
      const opt = rng.pick(difficulty === 'easy' ? opts.slice(0, 2) : opts);
      const a = rng.int(1, 3);
      const h = rng.int(1, 4);
      const zb: B = rng.pick<B>([
        { v: 'z', lo: cst(0), hi: cst(h) },
        { v: 'z', lo: cst(0), hi: norm([mt(a * a), mt(-1, { r: 2 })]) },
        { v: 'z', lo: [mt(1, { r: 2 })], hi: cst(a * a) },
        { v: 'z', lo: cst(0), hi: vr('r') },
      ]);
      const rb: B = { v: 'r', lo: cst(0), hi: cst(a) };
      const v = exMul(ex(exactIter(opt.rz, [rb, zb])), exPi(Th));
      const bsT: BT[] = [{ v: '\\theta', lo: '0', hi: thTex }, btex(rb), btex(zb)];
      const question =
        task === 'cylIterated'
          ? m(iterTex(tex(opt.rz), bsT))
          : `${m(`\\displaystyle \\iiint_{E} ${topSum(opt.xyz) ? `(${opt.xyz})` : opt.xyz}\\,dV`)}, ${m(`E = \\left\\{(r, \\theta, z) \\mid ${bsT.map((b) => `${b.lo} \\le ${b.v} \\le ${b.hi}`).join(',\\ ')}\\right\\}`)}`;
      const noJac = exMul(ex(exactIter(norm(opt.rz.map((t) => ({ ...t, e: { ...t.e, r: (t.e.r ?? 0) - 1 } }))).filter((t) => (t.e.r ?? 0) >= 0), [rb, zb])), exPi(Th));
      return {
        question,
        answer: valAns(v),
        steps: [m(`x^{2} + y^{2} = r^{2},\\ dV = r\\,dz\\,dr\\,d\\theta`), m(`\\int_{0}^{${a}}\\int_{${tex(zb.lo)}}^{${tex(zb.hi)}} ${tex(opt.rz)}\\,dz\\,dr = ${num(exactIter(opt.rz, [rb, zb]))}`), valAns(v)],
        wrongs: [valAns(exScale(v, 2)), valAns(exScale(v, new Frac(1, 2))), valAns(exAdd(noJac, ex(0)).length && exTex(noJac) !== exTex(v) ? noJac : exScale(v, 3))],
        fallback: (j) => valAns(exScale(v, j + 3)),
        check: { kind: 'multivariable.integral' },
      };
    }
    // spherical: integrand f·ρ² sin φ = c·ρ^n·cos^m φ·sin^{2j+1} φ
    const k = rng.int(1, 4);
    const s = (n: number) => (n === 1 ? '' : String(n));
    const opts: Array<{ n: number; mm: number; j: number; c: number; xyz: string; rpf: string }> = [
      { n: 2, mm: 0, j: 0, c: k, xyz: String(k), rpf: `${s(k)}\\rho^{2}\\sin\\phi` },
      { n: 4, mm: 0, j: 0, c: k, xyz: `${s(k)}x^{2} + ${s(k)}y^{2} + ${s(k)}z^{2}`, rpf: `${s(k)}\\rho^{4}\\sin\\phi` },
      { n: 3, mm: 1, j: 0, c: k, xyz: `${s(k)}z`, rpf: `${s(k)}\\rho^{3}\\cos\\phi\\sin\\phi` },
      { n: 3, mm: 0, j: 0, c: 1, xyz: `\\sqrt{x^{2} + y^{2} + z^{2}}`, rpf: `\\rho^{3}\\sin\\phi` },
      { n: 4, mm: 0, j: 1, c: k, xyz: `${s(k)}x^{2} + ${s(k)}y^{2}`, rpf: `${s(k)}\\rho^{4}\\sin^{3}\\phi` },
    ];
    const o = rng.pick(difficulty === 'easy' ? opts.slice(0, 2) : opts);
    const phi = rng.pick(o.mm === 1 ? PHIS.slice(0, 4) : PHIS);
    const a = rng.int(1, 3);
    const rhoPart = new Frac(o.c * a ** (o.n + 1), o.n + 1);
    const phiPart = uIntegral(o.j, o.mm, cosPi(phi));
    const v = exMul(exMul(ex(rhoPart), phiPart), exPi(Th));
    const bsT: BT[] = [{ v: '\\theta', lo: '0', hi: thTex }, { v: '\\phi', lo: '0', hi: piTex(phi) }, { v: '\\rho', lo: '0', hi: String(a) }];
    const question =
      task === 'sphIterated'
        ? m(iterTex(o.rpf, bsT))
        : `${m(`\\displaystyle \\iiint_{E} ${topSum(o.xyz) ? `(${o.xyz})` : o.xyz}\\,dV`)}, ${m(`E = \\left\\{(\\rho, \\theta, \\phi) \\mid 0 \\le \\rho \\le ${a},\\ 0 \\le \\theta \\le ${thTex},\\ 0 \\le \\phi \\le ${piTex(phi)}\\right\\}`)}`;
    const wrongRho = exMul(exMul(ex(new Frac(o.c * a ** (o.n - 1), o.n - 1)), phiPart), exPi(Th));
    return {
      question,
      answer: valAns(v),
      steps: [m(`dV = \\rho^{2}\\sin\\phi\\,d\\rho\\,d\\phi\\,d\\theta`), m(`\\int_{0}^{${a}} \\rho^{${o.n}}\\,d\\rho = \\frac{${a ** (o.n + 1)}}{${o.n + 1}}`), m(`\\int_{0}^{${piTex(phi)}} (\\ldots)\\,d\\phi = ${exTex(phiPart)}`), valAns(v)],
      wrongs: [valAns(exScale(v, 2)), valAns(exTex(wrongRho) === exTex(v) ? exScale(v, 3) : wrongRho), valAns(exScale(v, new Frac(1, 2)))],
      fallback: (j) => valAns(exScale(v, j + 3)),
      check: { kind: 'multivariable.integral' },
    };
  },
});

// ---------------------------------------------------------------- applications: mass and center of mass

type ATask = 'mass' | 'center' | 'centroid';

function lamina(rng: Rng, d: Difficulty, centroid = false): B[] {
  const a = rng.int(1, centroid ? 4 : 3);
  const k = rng.int(1, centroid ? 4 : 3);
  return rng.pick<B[]>(
    d === 'easy' && !centroid
      ? [
          [{ v: 'x', lo: cst(0), hi: cst(a) }, { v: 'y', lo: cst(0), hi: cst(rng.int(1, 3)) }],
          [{ v: 'x', lo: cst(0), hi: cst(a) }, { v: 'y', lo: cst(0), hi: vr('x', k) }],
        ]
      : [
          [{ v: 'x', lo: cst(0), hi: cst(a) }, { v: 'y', lo: cst(0), hi: vr('x', k) }],
          [{ v: 'x', lo: cst(0), hi: cst(a) }, { v: 'y', lo: cst(0), hi: [mt(1, { x: 2 })] }],
          [{ v: 'x', lo: cst(0), hi: cst(k) }, { v: 'y', lo: [mt(1, { x: 2 })], hi: vr('x', k) }],
          [{ v: 'x', lo: cst(0), hi: cst(1) }, { v: 'y', lo: [mt(1, { x: 2 })], hi: vr('x') }],
          [{ v: 'x', lo: cst(0), hi: cst(a) }, { v: 'y', lo: cst(0), hi: sub(cst(a), vr('x')) }],
        ],
  );
}

export const applicationsMultiple = taskTopic<ATask>({
  id: 'mv.integrals.applications',
  title: 'Applications of Multiple Integrals',
  description: 'Mass, moments and center of mass of laminas with variable density, and centroids of plane regions.',
  category: CAT,
  instruction: 'Find the indicated quantity.',
  defaultCount: 6,
  tasks: [
    { value: 'mass', label: 'Mass of a lamina' },
    { value: 'center', label: 'Center of mass' },
    { value: 'centroid', label: 'Centroid' },
  ],
  mix: { easy: ['mass', 'centroid'], medium: ['mass', 'center', 'centroid'], hard: ['center', 'mass'] },
  build(task, { rng, difficulty }) {
    const bs = lamina(rng, difficulty, task === 'centroid');
    const k = rng.int(1, 4);
    const dens: MX = task === 'centroid' ? [mt(1)] : rng.pick<MX>([[mt(k, { x: 1 })], [mt(k, { y: 1 })], norm([mt(1, { x: 1 }), mt(1, { y: 1 })]), [mt(k, { x: 1, y: 1 })], norm([mt(k), mt(1, { x: 1 })]), [mt(k, { x: 2 })]]);
    const M = exactIter(dens, bs);
    const My = exactIter(norm(dens.map((t) => ({ ...t, e: { ...t.e, x: (t.e.x ?? 0) + 1 } }))), bs);
    const Mx = exactIter(norm(dens.map((t) => ({ ...t, e: { ...t.e, y: (t.e.y ?? 0) + 1 } }))), bs);
    const D = regionTex('D', ['x', 'y'], bs.map(btex));
    const densTex = m(`\\delta(x, y) = ${tex(dens)}`);
    const pair = (a: Frac, b: Frac) => m(`(\\bar{x}, \\bar{y}) = \\left(${num(a)}, ${num(b)}\\right)`);
    if (task === 'mass') {
      const ans = (v: Frac) => m(`m = ${num(v)}`);
      return {
        question: `Find the mass of the lamina that occupies ${m(D)} with density ${densTex}.`,
        answer: ans(M),
        steps: [m(`m = \\iint_{D} \\delta(x, y)\\,dA = ${iterTex(dens, bs.map(btex))}`), ans(M)],
        wrongs: [ans(My), ans(Mx.eq(M) ? M.mul(2) : Mx), ans(exactIter(cst(1), bs))],
        fallback: (j) => ans(M.add(offset(j))),
        check: { kind: 'multivariable.lamina', what: 'mass' },
      };
    }
    const xb = My.div(M);
    const yb = Mx.div(M);
    return {
      question: task === 'centroid' ? `Find the centroid of the region ${m(D)}.` : `Find the center of mass of the lamina that occupies ${m(D)} with density ${densTex}.`,
      answer: pair(xb, yb),
      steps: [m(`m = ${num(M)},\\ M_{y} = \\iint_{D} x\\,\\delta\\,dA = ${num(My)},\\ M_{x} = \\iint_{D} y\\,\\delta\\,dA = ${num(Mx)}`), pair(xb, yb)],
      wrongs: [pair(yb, xb), pair(My, Mx), pair(xb.mul(2), yb.mul(2))],
      fallback: (j) => pair(xb.add(offset(j)), yb),
      check: { kind: 'multivariable.lamina', what: 'center' },
    };
  },
});

