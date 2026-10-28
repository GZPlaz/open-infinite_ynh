/** Green's theorem, surface integrals and flux, Stokes' theorem, the divergence theorem. */
import { Frac } from '../../fraction';
import { attempt } from '../../generator';
import type { Rng } from '../../rng';
import { m } from '../../tex';
import { add, cst, diff, ex, exAdd, exPi, exRad, exScale, exTex, mt, mul, norm, randMono, sorted, sub, subst, taskTopic, tex, trigPolyIntegral, vr, vtex, type Ex, type MX } from './common';
import { exactIter } from './integrals';
import { divOf, curlOf } from './vfields';

const CAT = 'Vector Calculus';
const XYZ = ['x', 'y', 'z'];
const F = '\\mathbf{F}';
const fieldTex = (comps: readonly MX[], vars: readonly string[]) => `${F}(${vars.join(', ')}) = ${vtex(comps.map(tex))}`;
const valAns = (lhs: string, e: Ex) => m(`${lhs} = ${exTex(e)}`);
const RANGE_TEX = { quarter: '\\frac{\\pi}{2}', half: '\\pi', full: '2\\pi' } as const;
type Range = keyof typeof RANGE_TEX;
const s1 = (n: number) => (n === 1 ? '' : String(n));

function randPoly(rng: Rng, vars: readonly string[], maxDeg: number, n: number, cmax = 4): MX {
  for (;;) {
    const f = norm(Array.from({ length: n }, () => mt(rng.signedInt(1, cmax, true), randMono(rng, vars, 0, maxDeg))));
    if (f.length === n && f.some((t) => Object.keys(t.e).length)) return f;
  }
}

/** Substitute x = a·X, y = a·Y, z = Z (polynomials in the new variables). */
function substAll(f: MX, map: Record<string, MX>): MX {
  let g = f;
  for (const [v, p] of Object.entries(map)) g = subst(g, v, p);
  return g;
}

const wrongs3 = (lhs: string, v: Ex) => [valAns(lhs, exScale(v, -1)), valAns(lhs, exScale(v, 2)), valAns(lhs, exScale(v, new Frac(1, 2)))];
const fallbackEx = (lhs: string, v: Ex) => (k: number) => valAns(lhs, exAdd(v, ex(k)));

// ---------------------------------------------------------------- Green's theorem

type GTask = 'rectangle' | 'triangle' | 'circle' | 'area';

export const greensTheorem = taskTopic<GTask>({
  id: 'mv.vector.greens-theorem',
  title: "Green's Theorem",
  description: "Use Green's Theorem to evaluate circulation line integrals around rectangles, triangles and circles, and to find areas.",
  category: CAT,
  instruction: "Use Green's Theorem to answer each question. All curves are oriented counterclockwise.",
  defaultCount: 8,
  tasks: [
    { value: 'rectangle', label: 'Boundary of a rectangle' },
    { value: 'triangle', label: 'Boundary of a triangle' },
    { value: 'circle', label: 'Circle' },
    { value: 'area', label: 'Area enclosed by a curve' },
  ],
  mix: { easy: ['rectangle', 'triangle'], medium: ['rectangle', 'triangle', 'circle', 'area'], hard: ['triangle', 'circle', 'area'] },
  build(task, { rng, difficulty }) {
    if (task === 'area') {
      const a = rng.int(1, 6);
      const b = rng.intExcept(1, 6, [a]);
      const astroid = difficulty === 'hard' && rng.bool(0.5);
      const comps = astroid ? [`${s1(a)}\\cos^{3} t`, `${s1(a)}\\sin^{3} t`] : [`${s1(a)}\\cos t`, `${s1(b)}\\sin t`];
      const A = astroid ? exPi(new Frac(3 * a * a, 8)) : exPi(a * b);
      return {
        question: `Use Green's Theorem to find the area enclosed by ${m(`C: \\mathbf{r}(t) = ${vtex(comps)},\\ 0 \\le t \\le 2\\pi`)}.`,
        answer: valAns('A', A),
        steps: [m(`A = \\frac{1}{2}\\oint_{C} x\\,dy - y\\,dx = \\frac{1}{2}\\int_{0}^{2\\pi} (x y' - y x')\\,dt`), valAns('A', A)],
        wrongs: [valAns('A', exScale(A, 2)), valAns('A', exScale(A, new Frac(1, 2))), valAns('A', astroid ? exPi(a * a) : exPi(a * a))],
        fallback: fallbackEx('A', A),
        check: { kind: 'multivariable.green', task },
      };
    }
    const { P, Q, g } = attempt('green', () => {
      const P = randPoly(rng, ['x', 'y'], 2, rng.int(1, 2));
      const Q = randPoly(rng, ['x', 'y'], 2, rng.int(1, 2));
      const g = sub(diff(Q, 'x'), diff(P, 'y'));
      return g.length ? { P, Q, g } : null;
    });
    let region: string;
    let v: Ex;
    if (task === 'circle') {
      const r = rng.int(1, 3);
      v = trigPolyIntegral(mul(substAll(g, { x: [mt(1, { r: 1, c: 1 })], y: [mt(1, { r: 1, s: 1 })] }), vr('r')), [['c', 's', 'full']], { r: [0, r] });
      region = `${m('C')} is the circle ${m(`x^{2} + y^{2} = ${r * r}`)}`;
    } else {
      const a = rng.int(1, 4);
      const b = rng.int(1, 4);
      if (task === 'rectangle') {
        v = ex(exactIter(g, [{ v: 'x', lo: cst(0), hi: cst(a) }, { v: 'y', lo: cst(0), hi: cst(b) }]));
        region = `${m('C')} is the boundary of the rectangle with vertices ${m('(0, 0)')}, ${m(`(${a}, 0)`)}, ${m(`(${a}, ${b})`)}, and ${m(`(0, ${b})`)}`;
      } else {
        v = ex(exactIter(g, [{ v: 'x', lo: cst(0), hi: cst(a) }, { v: 'y', lo: cst(0), hi: [mt(new Frac(b, a), { x: 1 })] }]));
        region = `${m('C')} is the triangle with vertices ${m('(0, 0)')}, ${m(`(${a}, 0)`)}, and ${m(`(${a}, ${b})`)}`;
      }
    }
    const lhs = '\\oint_{C} P\\,dx + Q\\,dy';
    const form = `${norm(P).length > 1 ? `(${tex(P)})` : tex(P)}\\,dx + ${norm(Q).length > 1 ? `(${tex(Q)})` : tex(Q)}\\,dy`.replace(/\+ -/g, '- ');
    const wrong = exScale(v, -1);
    return {
      question: `Evaluate ${m(`\\displaystyle \\oint_{C} ${form}`)}, where ${region}.`,
      answer: valAns(lhs, v),
      steps: [m(`\\frac{\\partial Q}{\\partial x} - \\frac{\\partial P}{\\partial y} = ${tex(sorted(g))}`), m(`\\oint_{C} P\\,dx + Q\\,dy = \\iint_{D} (${tex(sorted(g))})\\,dA`), valAns(lhs, v)],
      wrongs: exTex(wrong) === exTex(v) ? [valAns(lhs, ex(1)), valAns(lhs, ex(2)), valAns(lhs, ex(-1))] : [valAns(lhs, wrong), valAns(lhs, exScale(v, 2)), valAns(lhs, exAdd(v, ex(1)))],
      fallback: fallbackEx(lhs, v),
      check: { kind: 'multivariable.green', task },
    };
  },
});

// ---------------------------------------------------------------- parametrized surfaces

interface Surface {
  /** components as LaTeX in u, v */
  r: string[];
  u: [string, string];
  v: [string, string];
  orient: 'up' | 'out';
  text: string;
  /** exact ∬ g(r(u, v))·(component of r_u × r_v or |r_u × r_v|) */
  scalar: (f: MX) => Ex;
  flux: (F: MX[]) => Ex;
}

function planeSurface(rng: Rng): Surface {
  const a = rng.int(-3, 3);
  const b = rng.int(-3, 3);
  const c = rng.int(0, 6);
  const p = rng.int(1, 3);
  const q = rng.int(1, 3);
  const zuv = norm([mt(c), mt(-a, { u: 1 }), mt(-b, { v: 1 })]);
  const N = a * a + b * b + 1;
  const sub3 = (f: MX) => substAll(f, { x: vr('u'), y: vr('v'), z: zuv });
  const box = [{ v: 'u', lo: cst(0), hi: cst(p) }, { v: 'v', lo: cst(0), hi: cst(q) }];
  return {
    r: ['u', 'v', tex(zuv)],
    u: ['0', String(p)],
    v: ['0', String(q)],
    orient: 'up',
    text: 'oriented upward',
    scalar: (f) => exRad(exactIter(sub3(f), box), N),
    flux: (Fc) => ex(exactIter(add(mul(sub3(Fc[0]!), cst(a)), mul(sub3(Fc[1]!), cst(b)), sub3(Fc[2]!)), box)),
  };
}

function cylinderSurface(rng: Rng): Surface {
  const R = rng.int(1, 3);
  const h = rng.int(1, 4);
  const range = rng.pick<Range>(['quarter', 'half', 'full']);
  const sub3 = (f: MX) => substAll(f, { x: [mt(R, { c: 1 })], y: [mt(R, { s: 1 })], z: vr('v') });
  const I = (g: MX) => trigPolyIntegral(g, [['c', 's', range]], { v: [0, h] });
  return {
    r: [`${s1(R)}\\cos u`, `${s1(R)}\\sin u`, 'v'],
    u: ['0', RANGE_TEX[range]],
    v: ['0', String(h)],
    orient: 'out',
    text: 'oriented away from the z-axis',
    scalar: (f) => exScale(I(sub3(f)), R),
    // r_u × r_v = ⟨R cos u, R sin u, 0⟩
    flux: (Fc) => I(add(mul(sub3(Fc[0]!), [mt(R, { c: 1 })]), mul(sub3(Fc[1]!), [mt(R, { s: 1 })]))),
  };
}

function sphereSurface(rng: Rng): Surface {
  const R = rng.int(1, 3);
  const range = rng.pick<Range>(['quarter', 'half']);
  // x = R sin u cos v, y = R sin u sin v, z = R cos u;  r_u × r_v = R² sin u ⟨sin u cos v, sin u sin v, cos u⟩
  const sub3 = (f: MX) => substAll(f, { x: [mt(R, { su: 1, cv: 1 })], y: [mt(R, { su: 1, sv: 1 })], z: [mt(R, { cu: 1 })] });
  const I = (g: MX) => trigPolyIntegral(g, [['cu', 'su', range], ['cv', 'sv', 'full']]);
  const n: MX[] = [[mt(R * R, { su: 2, cv: 1 })], [mt(R * R, { su: 2, sv: 1 })], [mt(R * R, { su: 1, cu: 1 })]];
  return {
    r: [`${s1(R)}\\sin u\\cos v`, `${s1(R)}\\sin u\\sin v`, `${s1(R)}\\cos u`],
    u: ['0', RANGE_TEX[range]],
    v: ['0', '2\\pi'],
    orient: 'out',
    text: 'oriented outward',
    scalar: (f) => I(mul(sub3(f), [mt(R * R, { su: 1 })])),
    flux: (Fc) => I(add(...Fc.map((c, i) => mul(sub3(c), n[i]!)))),
  };
}

type STask = 'area' | 'scalar' | 'flux';

export const surfaceIntegrals = taskTopic<STask>({
  id: 'mv.vector.surface-integrals',
  title: 'Surface Integrals and Flux',
  description: 'Surface area, surface integrals of scalar functions and flux of vector fields across parametrized surfaces.',
  category: CAT,
  instruction: 'Evaluate each surface integral. Leave answers in exact form.',
  defaultCount: 6,
  tasks: [
    { value: 'area', label: 'Surface area' },
    { value: 'scalar', label: 'Surface integral of a function' },
    { value: 'flux', label: 'Flux of a vector field' },
  ],
  mix: { easy: ['area', 'scalar', 'flux'], medium: ['area', 'scalar', 'flux'], hard: ['scalar', 'flux'] },
  build(task, { rng, difficulty }) {
    const S = attempt('surface', () => {
      const S = rng.pick(difficulty === 'easy' ? [planeSurface] : [planeSurface, cylinderSurface, sphereSurface])(rng);
      return S;
    });
    const surf = `${m(`S: \\mathbf{r}(u, v) = ${vtex(S.r)}`)}, ${m(`${S.u[0]} \\le u \\le ${S.u[1]}`)}, ${m(`${S.v[0]} \\le v \\le ${S.v[1]}`)}`;
    if (task === 'flux') {
      const { Fc, v } = attempt('flux', () => {
        const Fc = XYZ.map(() => randPoly(rng, XYZ, difficulty === 'easy' ? 1 : 2, rng.int(1, 2)));
        const v = S.flux(Fc);
        return v.length ? { Fc, v } : null;
      });
      const lhs = `\\iint_{S} ${F} \\cdot d\\mathbf{S}`;
      return {
        question: `Find the flux of ${m(fieldTex(Fc, XYZ))} across ${surf}, ${S.text}.`,
        answer: valAns(lhs, v),
        steps: [m(`\\iint_{S} ${F} \\cdot d\\mathbf{S} = \\iint_{D} ${F}(\\mathbf{r}(u, v)) \\cdot (\\mathbf{r}_{u} \\times \\mathbf{r}_{v})\\,dA`), valAns(lhs, v)],
        wrongs: wrongs3(lhs, v),
        fallback: fallbackEx(lhs, v),
        check: { kind: 'multivariable.surface', task, orient: S.orient },
      };
    }
    const { f, v } = attempt('scalar', () => {
      const f = task === 'area' ? cst(1) : randPoly(rng, XYZ, difficulty === 'easy' ? 1 : 2, rng.int(1, 2));
      const v = S.scalar(f);
      return v.length ? { f, v } : null;
    });
    const lhs = task === 'area' ? 'A' : '\\iint_{S} f\\,dS';
    return {
      question: task === 'area' ? `Find the area of the surface ${surf}.` : `Evaluate ${m(`\\displaystyle \\iint_{S} ${norm(f).length > 1 ? `(${tex(f)})` : tex(f)}\\,dS`)}, where ${surf}.`,
      answer: valAns(lhs, v),
      steps: [m(`dS = \\|\\mathbf{r}_{u} \\times \\mathbf{r}_{v}\\|\\,dA`), valAns(lhs, v)],
      wrongs: wrongs3(lhs, v),
      fallback: fallbackEx(lhs, v),
      check: { kind: 'multivariable.surface', task },
    };
  },
});

// ---------------------------------------------------------------- Stokes' theorem

type KTask = 'surfaceToLine' | 'lineToSurface';

export const stokesTheorem = taskTopic<KTask>({
  id: 'mv.vector.stokes',
  title: "Stokes' Theorem",
  description: "Use Stokes' Theorem to trade the flux of a curl through a surface for a line integral around its boundary, and vice versa.",
  category: CAT,
  instruction: "Use Stokes' Theorem to evaluate each integral.",
  defaultCount: 6,
  tasks: [
    { value: 'surfaceToLine', label: 'Flux of the curl through a surface' },
    { value: 'lineToSurface', label: 'Circulation around a curve' },
  ],
  mix: { easy: ['surfaceToLine'], medium: ['surfaceToLine', 'lineToSurface'], hard: ['surfaceToLine', 'lineToSurface'] },
  build(task, { rng, difficulty }) {
    const a = rng.int(1, 3);
    const isSurf = task === 'surfaceToLine';
    const kind = isSurf ? rng.pick(['paraboloid', 'hemisphere', 'disk'] as const) : 'disk';
    const h = kind === 'disk' ? rng.int(isSurf ? 1 : 0, 4) : 0;
    const surfEq = kind === 'paraboloid' ? `z = ${a * a} - x^{2} - y^{2}` : kind === 'hemisphere' ? `x^{2} + y^{2} + z^{2} = ${a * a}` : `z = ${h}`;
    const surfText = kind === 'paraboloid' ? `the part of the paraboloid ${m(surfEq)} above the ${m('xy')}-plane` : kind === 'hemisphere' ? `the hemisphere ${m(surfEq)}, ${m('z \\ge 0')}` : `the disk ${m(`x^{2} + y^{2} \\le ${a * a}`)} in the plane ${m(surfEq)}`;
    const surface =
      kind === 'paraboloid'
        ? { r: ['u\\cos v', 'u\\sin v', `${a * a} - u^{2}`], u: ['0', String(a)], v: ['0', '2\\pi'] }
        : kind === 'hemisphere'
          ? { r: [`${s1(a)}\\sin u\\cos v`, `${s1(a)}\\sin u\\sin v`, `${s1(a)}\\cos u`], u: ['0', '\\frac{\\pi}{2}'], v: ['0', '2\\pi'] }
          : { r: ['u\\cos v', 'u\\sin v', String(h)], u: ['0', String(a)], v: ['0', '2\\pi'] };
    const curve = { r: [`${s1(a)}\\cos t`, `${s1(a)}\\sin t`, String(h)], t: ['0', '2\\pi'] };
    const { Fc, v } = attempt('stokes', () => {
      const Fc = XYZ.map(() => randPoly(rng, XYZ, difficulty === 'easy' ? 1 : 2, rng.int(1, 2)));
      // ∮ F·dr on x = a cos t, y = a sin t, z = h
      const sub3 = (g: MX) => substAll(g, { x: [mt(a, { c: 1 })], y: [mt(a, { s: 1 })], z: cst(h) });
      const v = trigPolyIntegral(add(mul(sub3(Fc[0]!), [mt(-a, { s: 1 })]), mul(sub3(Fc[1]!), [mt(a, { c: 1 })])), [['c', 's', 'full']]);
      return v.length && curlOf(Fc).some((x) => x.length) ? { Fc, v } : null;
    });
    const lhsS = `\\iint_{S} (\\nabla \\times ${F}) \\cdot d\\mathbf{S}`;
    const lhsC = `\\oint_{C} ${F} \\cdot d\\mathbf{r}`;
    const question = isSurf
      ? `Evaluate ${m(`\\displaystyle ${lhsS}`)} for ${m(fieldTex(Fc, XYZ))}, where ${m('S')} is ${surfText}, oriented upward.`
      : `Evaluate ${m(`\\displaystyle ${lhsC}`)} for ${m(fieldTex(Fc, XYZ))}, where ${m('C')} is the circle ${m(`x^{2} + y^{2} = ${a * a}`)} in the plane ${m(`z = ${h}`)}, oriented counterclockwise as viewed from above.`;
    const lhs = isSurf ? lhsS : lhsC;
    return {
      question,
      answer: valAns(lhs, v),
      steps: isSurf
        ? [`The boundary of ${m('S')} is the circle ${m(`\\mathbf{r}(t) = ${vtex(curve.r)}`)}, ${m('0 \\le t \\le 2\\pi')}.`, m(`${lhsS} = ${lhsC} = \\int_{0}^{2\\pi} ${F}(\\mathbf{r}(t)) \\cdot \\mathbf{r}'(t)\\,dt`), valAns(lhs, v)]
        : [m(`\\nabla \\times ${F} = ${vtex(curlOf(Fc).map(tex))}`), `Integrate the curl over the disk bounded by ${m('C')}.`, valAns(lhs, v)],
      wrongs: wrongs3(lhs, v),
      fallback: fallbackEx(lhs, v),
      check: { kind: 'multivariable.stokes', surface, curve, surfEq: isSurf ? surfEq : `z = ${h}`, onCurve: [`x^{2} + y^{2} = ${a * a}`, `z = ${h}`] },
    };
  },
});

// ---------------------------------------------------------------- divergence theorem

type VTask = 'box' | 'ball' | 'cylinder';

export const divergenceTheorem = taskTopic<VTask>({
  id: 'mv.vector.divergence-theorem',
  title: 'The Divergence Theorem',
  description: 'Use the Divergence Theorem to find the outward flux of a vector field across a closed surface.',
  category: CAT,
  instruction: 'Use the Divergence Theorem to find the outward flux of F across the boundary of E.',
  defaultCount: 6,
  tasks: [
    { value: 'box', label: 'Rectangular box' },
    { value: 'ball', label: 'Ball' },
    { value: 'cylinder', label: 'Solid cylinder' },
  ],
  mix: { easy: ['box'], medium: ['box', 'ball', 'cylinder'], hard: ['ball', 'cylinder', 'box'] },
  build(task, { rng, difficulty }) {
    const Fc = attempt('field', () => {
      const Fc = XYZ.map(() => randPoly(rng, XYZ, difficulty === 'easy' ? 2 : 3, rng.int(1, 2)));
      return divOf(Fc).length ? Fc : null;
    });
    const d = divOf(Fc);
    let v: Ex;
    let E: string;
    let region: { vars: string[]; bounds: Array<{ v: string; lo: string; hi: string }> };
    let surfaces: Array<{ r: string[]; u: [string, string]; v: [string, string] }>;
    let center: number[];
    if (task === 'box') {
      const [a, b, c] = [rng.int(1, 3), rng.int(1, 3), rng.int(1, 3)];
      v = ex(exactIter(d, [{ v: 'x', lo: cst(0), hi: cst(a) }, { v: 'y', lo: cst(0), hi: cst(b) }, { v: 'z', lo: cst(0), hi: cst(c) }]));
      E = `E = [0, ${a}] \\times [0, ${b}] \\times [0, ${c}]`;
      region = { vars: XYZ, bounds: [{ v: 'x', lo: '0', hi: String(a) }, { v: 'y', lo: '0', hi: String(b) }, { v: 'z', lo: '0', hi: String(c) }] };
      surfaces = [
        { r: ['0', 'u', 'v'], u: ['0', String(b)], v: ['0', String(c)] },
        { r: [String(a), 'u', 'v'], u: ['0', String(b)], v: ['0', String(c)] },
        { r: ['u', '0', 'v'], u: ['0', String(a)], v: ['0', String(c)] },
        { r: ['u', String(b), 'v'], u: ['0', String(a)], v: ['0', String(c)] },
        { r: ['u', 'v', '0'], u: ['0', String(a)], v: ['0', String(b)] },
        { r: ['u', 'v', String(c)], u: ['0', String(a)], v: ['0', String(b)] },
      ];
      center = [a / 2, b / 2, c / 2];
    } else if (task === 'ball') {
      const a = rng.int(1, 3);
      const g = mul(substAll(d, { x: [mt(1, { R: 1, su: 1, cv: 1 })], y: [mt(1, { R: 1, su: 1, sv: 1 })], z: [mt(1, { R: 1, cu: 1 })] }), [mt(1, { R: 2, su: 1 })]);
      v = trigPolyIntegral(g, [['cu', 'su', 'half'], ['cv', 'sv', 'full']], { R: [0, a] });
      E = `E = \\left\\{(x, y, z) \\mid x^{2} + y^{2} + z^{2} \\le ${a * a}\\right\\}`;
      region = { vars: ['R', 'Q', 'P'], bounds: [{ v: 'R', lo: '0', hi: String(a) }, { v: 'Q', lo: '0', hi: '2\\pi' }, { v: 'P', lo: '0', hi: '\\pi' }] };
      surfaces = [{ r: [`${s1(a)}\\sin u\\cos v`, `${s1(a)}\\sin u\\sin v`, `${s1(a)}\\cos u`], u: ['0', '\\pi'], v: ['0', '2\\pi'] }];
      center = [0, 0, 0];
    } else {
      const a = rng.int(1, 3);
      const h = rng.int(1, 4);
      const g = mul(substAll(d, { x: [mt(1, { r: 1, c: 1 })], y: [mt(1, { r: 1, s: 1 })] }), vr('r'));
      v = trigPolyIntegral(g, [['c', 's', 'full']], { r: [0, a], z: [0, h] });
      E = `E = \\left\\{(x, y, z) \\mid x^{2} + y^{2} \\le ${a * a},\\ 0 \\le z \\le ${h}\\right\\}`;
      region = { vars: ['r', 'Q', 'z'], bounds: [{ v: 'r', lo: '0', hi: String(a) }, { v: 'Q', lo: '0', hi: '2\\pi' }, { v: 'z', lo: '0', hi: String(h) }] };
      surfaces = [
        { r: [`${s1(a)}\\cos u`, `${s1(a)}\\sin u`, 'v'], u: ['0', '2\\pi'], v: ['0', String(h)] },
        { r: ['u\\cos v', 'u\\sin v', String(h)], u: ['0', String(a)], v: ['0', '2\\pi'] },
        { r: ['u\\cos v', 'u\\sin v', '0'], u: ['0', String(a)], v: ['0', '2\\pi'] },
      ];
      center = [0, 0, h / 2];
    }
    const lhs = `\\iint_{S} ${F} \\cdot d\\mathbf{S}`;
    const wrongDiv = v.length ? exScale(v, -1) : ex(1);
    return {
      question: `${m(fieldTex(Fc, XYZ))}, ${m(E)}`,
      answer: valAns(lhs, v),
      steps: [m(`\\nabla \\cdot ${F} = ${tex(d)}`), m(`${lhs} = \\iiint_{E} \\nabla \\cdot ${F}\\,dV = ${exTex(v)}`)],
      wrongs: v.length ? [valAns(lhs, wrongDiv), valAns(lhs, exScale(v, 2)), valAns(lhs, exScale(v, new Frac(1, 2)))] : [valAns(lhs, ex(1)), valAns(lhs, exPi(1)), valAns(lhs, ex(-1))],
      fallback: fallbackEx(lhs, v),
      check: { kind: 'multivariable.divergence', region, surfaces, center },
    };
  },
});

