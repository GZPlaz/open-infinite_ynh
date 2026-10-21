/** Similarity: similar polygons (scale factor, missing sides) and triangle proportionality. */
import { DiagramBuilder, type Pt } from '../../diagram';
import { Frac } from '../../fraction';
import { attempt, defineTopic, distinctDistractors, offset, strOpt } from '../../generator';
import { m, num } from '../../tex';
import type { ProblemContent } from '../../types';
import { add, centroid, dirDeg, linSolve, linSubTex, linTex, linVal, mul, nameVertices, randomLetters, rotate, sideText, sub, type Lin } from './kit';

// ---------------------------------------------------------------- shapes with integer sides

/** Triangle with side lengths a = P0P1, b = P1P2, c = P2P0 (counterclockwise). */
function triFromSides(a: number, b: number, c: number): Pt[] | null {
  if (a + b <= c || b + c <= a || a + c <= b) return null;
  // angle at P0 between P0P1 (length a) and P0P2 (length c)
  const cosA = (a * a + c * c - b * b) / (2 * a * c);
  const A = Math.acos(cosA);
  return [[0, 0], [a, 0], [c * Math.cos(A), c * Math.sin(A)]];
}

/** Convex quadrilateral with sides s0..s3 (P0P1, P1P2, P2P3, P3P0) and diagonal P0P2 = d. */
function quadFromSides(s: number[], d: number): Pt[] | null {
  const t1 = triFromSides(s[0]!, s[1]!, d);
  if (!t1) return null;
  const P0 = t1[0]!;
  const P1 = t1[1]!;
  const P2 = t1[2]!;
  // P3 on the other side of P0P2 with |P2P3| = s2, |P3P0| = s3
  const u = mul(sub(P2, P0), 1 / d);
  const n: Pt = [-u[1], u[0]];
  const s3 = s[3]!;
  const s2 = s[2]!;
  if (s2 + s3 <= d || s2 + d <= s3 || s3 + d <= s2) return null;
  const along = (s3 * s3 - s2 * s2 + d * d) / (2 * d);
  const h = Math.sqrt(s3 * s3 - along * along);
  // P1 is on the right of P0→P2 when the triangle is counterclockwise: put P3 on the left
  const side = (P1[0] - P0[0]) * n[0] + (P1[1] - P0[1]) * n[1] > 0 ? -1 : 1;
  const P3 = add(add(P0, mul(u, along)), mul(n, side * h));
  const pts = [P0, P1, P2, P3];
  // convexity: all cross products of consecutive edges share a sign
  const cr = pts.map((p, i) => {
    const q = pts[(i + 1) % 4]!;
    const r = pts[(i + 2) % 4]!;
    return (q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0]);
  });
  if (!(cr.every((c) => c > 0) || cr.every((c) => c < 0))) return null;
  // avoid needle-thin corners
  for (let i = 0; i < 4; i++) {
    const a = pts[(i + 3) % 4]!;
    const v = pts[i]!;
    const c = pts[(i + 1) % 4]!;
    const u1 = sub(a, v);
    const u2 = sub(c, v);
    const ang = (Math.acos((u1[0] * u2[0] + u1[1] * u2[1]) / (Math.hypot(...u1) * Math.hypot(...u2))) * 180) / Math.PI;
    if (ang < 45 || ang > 145) return null;
  }
  return pts;
}

const RATIOS: Array<[number, number]> = [
  [2, 1],
  [3, 1],
  [3, 2],
  [4, 3],
  [5, 2],
  [5, 3],
  [1, 2],
  [2, 3],
  [3, 4],
  [2, 5],
];

export const similarPolygons = defineTopic({
  id: 'geo.similar-polygons',
  subject: 'geometry',
  category: 'Similarity',
  title: 'Similar Polygons',
  description: 'Use the scale factor of similar polygons to find missing side lengths.',
  instruction: (o) => (o.task === 'scale' ? 'The polygons are similar. Find the scale factor of the figure on the left to the figure on the right.' : 'The polygons are similar. Find the indicated value.'),
  multipleChoice: true,
  defaultCount: 8,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Find',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'side', label: 'Missing side' },
        { value: 'scale', label: 'Scale factor' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const chosen = strOpt(ctx, 'task');
    const task = chosen === 'any' ? (rng.bool(0.7) ? 'side' : 'scale') : chosen;
    const quad = difficulty !== 'easy' && rng.bool(0.5);
    const n = quad ? 4 : 3;
    const built = attempt('similar', () => {
      const [p, q] = rng.pick(difficulty === 'easy' ? RATIOS.slice(0, 6) : RATIOS);
      // left sides are multiples of q, right sides = left · p/q
      const sides = Array.from({ length: n }, () => q * rng.int(difficulty === 'easy' ? 2 : 2, difficulty === 'hard' ? 12 : 8));
      const raw = quad ? quadFromSides(sides, q * rng.int(2, 14)) : triFromSides(sides[0]!, sides[1]!, sides[2]!);
      if (!raw) return null;
      if (new Set(sides).size < n - 1) return null;
      return { p, q, sides, raw };
    });
    const { p, q, sides } = built;
    const k = new Frac(p, q);
    const turn = rng.int(0, 359);
    const left = built.raw.map((pt) => rotate(pt, turn));
    const flip = rng.bool(0.3);
    const cl = centroid(left);
    const right0 = left.map((pt) => {
      const r = add(cl, mul(sub(pt, cl), k.value));
      return flip ? ([2 * cl[0] - r[0], r[1]] as Pt) : r;
    });
    const maxL = Math.max(...left.map((pt) => pt[0]));
    const minR = Math.min(...right0.map((pt) => pt[0]));
    const ext = (pts: Pt[]) => Math.max(Math.max(...pts.map((pt) => pt[0])) - Math.min(...pts.map((pt) => pt[0])), Math.max(...pts.map((pt) => pt[1])) - Math.min(...pts.map((pt) => pt[1])));
    const gap = 0.3 * Math.max(ext(left), ext(right0));
    const right = right0.map((pt) => [pt[0] - minR + maxL + gap, pt[1]] as Pt);
    const all = [...left, ...right];
    const xs = all.map((pt) => pt[0]);
    const ys = all.map((pt) => pt[1]);
    const b = new DiagramBuilder(320 / Math.max(Math.max(...xs) - Math.min(...xs), (Math.max(...ys) - Math.min(...ys)) * 1.6));
    b.polygon(left, { weight: 1.4 });
    b.polygon(right, { weight: 1.4 });
    const L = randomLetters(rng, 2 * n);
    const nl = L.slice(0, n);
    const nr = L.slice(n);
    nameVertices(b, left, nl);
    nameVertices(b, right, nr);
    const sideOf = (pts: Pt[], i: number): [Pt, Pt] => [pts[i]!, pts[(i + 1) % n]!];
    const rightLen = sides.map((s) => (s * p) / q);
    const lengths: Array<[Pt, Pt, string]> = [];
    const label = (pts: Pt[], i: number, tex: string) => {
      const [u, v] = sideOf(pts, i);
      sideText(b, u, v, tex, centroid(pts), 3);
      lengths.push([u, v, tex]);
    };
    const polyL = nl.join('');
    const polyR = nr.join('');
    const sim = `${quad ? '' : '\\triangle '}${polyL} \\sim ${quad ? '' : '\\triangle '}${polyR}`;
    if (task === 'scale') {
      // label every side on both figures
      for (let i = 0; i < n; i++) {
        label(left, i, String(sides[i]));
        label(right, i, String(rightLen[i]));
      }
      const fmt = (f: Frac) => m(num(f));
      const answer = fmt(k);
      return {
        question: `$${sim}$`,
        answer,
        steps: [`Divide corresponding sides (right ÷ left): $\\frac{${rightLen[0]}}{${sides[0]}} = ${num(k)}$`],
        distractors: distinctDistractors(answer, [k.inv(), k.add(1), new Frac(rightLen[0]! - sides[0]!, 1).abs()].map(fmt), (j) => fmt(k.add(new Frac(offset(j), q)))),
        diagram: b.build(`Two similar ${quad ? 'quadrilaterals' : 'triangles'}, ${polyL} and ${polyR}`),
        check: { kind: 'geometry.solve', names: { '': 'k' }, eqs: [`k = \\frac{${rightLen[0]}}{${sides[0]}}`, `k = \\frac{${rightLen[1]}}{${sides[1]}}`], lengths, given: [String(rightLen[0]), String(sides[0])] },
      };
    }
    // missing side: a pair of corresponding sides is fully labelled; the unknown is on one figure
    const pairIdx = rng.int(0, n - 1);
    const unkIdx = rng.pick([...Array(n).keys()].filter((i) => i !== pairIdx));
    const unkRight = rng.bool();
    label(left, pairIdx, String(sides[pairIdx]));
    label(right, pairIdx, String(rightLen[pairIdx]));
    const knownVal = unkRight ? sides[unkIdx]! : rightLen[unkIdx]!;
    const unkVal = unkRight ? rightLen[unkIdx]! : sides[unkIdx]!;
    label(unkRight ? left : right, unkIdx, String(knownVal));
    // a few extra labels on the left figure for realism (not needed)
    let e: Lin | null = null;
    let x = unkVal;
    if (difficulty !== 'easy') {
      const r = linSolve(rng, unkVal, { aMax: 4, bMax: 25 });
      e = r.e;
      x = r.x;
    }
    const unkTex = e ? linTex(e) : 'x';
    label(unkRight ? right : left, unkIdx, unkTex);
    const ratioTex = unkRight ? `\\frac{${unkTex}}{${knownVal}} = \\frac{${rightLen[pairIdx]}}{${sides[pairIdx]}}` : `\\frac{${unkTex}}{${knownVal}} = \\frac{${sides[pairIdx]}}{${rightLen[pairIdx]}}`;
    const hard = difficulty === 'hard';
    const sName = (unkRight ? nr : nl)[unkIdx]! + (unkRight ? nr : nl)[(unkIdx + 1) % n]!;
    const fmt = (w: number) => (hard && e ? `${m(`x = ${w}`)}, ${m(`${sName} = ${linVal(e, w)}`)}` : m(`x = ${w}`));
    const scaleUsed = unkRight ? k : k.inv();
    const wrongSide = [knownVal * scaleUsed.inv().value, knownVal + Math.abs(rightLen[pairIdx]! - sides[pairIdx]!), knownVal * scaleUsed.value + 1];
    const wrongX = e ? wrongSide.map((v) => (v - e!.b) / e!.a) : wrongSide;
    const steps = [`Corresponding sides are proportional:`, m(ratioTex), e ? m(`${unkTex} = ${unkVal}`) : '', m(`x = ${x}`)].filter(Boolean);
    if (hard && e) steps.push(m(`${sName} = ${linSubTex(e, x)} = ${unkVal}`));
    return {
      question: `$${sim}$. Find ${hard && e ? `$x$ and $${sName}$` : '$x$'}.`,
      answer: fmt(x),
      steps,
      distractors: distinctDistractors(fmt(x), wrongX.filter((w) => Number.isInteger(w) && w > 0 && w !== x && (!e || linVal(e, w) > 0)).map(fmt), (j) => {
        const w = x + offset(j);
        return w > 0 && (!e || linVal(e, w) > 0) ? fmt(w) : null;
      }),
      diagram: b.build(`Two similar ${quad ? 'quadrilaterals' : 'triangles'}, ${polyL} and ${polyR}`),
      check: {
        kind: 'geometry.solve',
        eqs: [ratioTex.replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '\\frac{$1}{$2}'), ...(hard && e ? [`L = ${unkTex}`] : [])],
        names: hard && e ? { [sName]: 'L' } : {},
        lengths,
        given: [String(sides[pairIdx]), String(rightLen[pairIdx]), String(knownVal), unkTex],
      },
    };
  },
});

// ---------------------------------------------------------------- triangle proportionality

export const similarTriangles = defineTopic({
  id: 'geo.similar-triangles',
  subject: 'geometry',
  category: 'Similarity',
  title: 'Similar Triangles and Triangle Proportionality',
  description: 'Use similar triangles and the side-splitter theorem (a line parallel to one side divides the other two proportionally).',
  instruction: 'In each figure the segment inside the triangle is parallel to the side it does not touch. Find the indicated value.',
  multipleChoice: true,
  defaultCount: 8,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Problems',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'splitter', label: 'Side-splitter (segments of the sides)' },
        { value: 'similar', label: 'Similar triangles (parallel segment length)' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const chosen = strOpt(ctx, 'task');
    const task = chosen === 'any' ? (rng.bool(0.6) ? 'splitter' : 'similar') : chosen;
    const built = attempt('splitter', () => {
      const pr = rng.int(1, 4);
      const qr = rng.int(1, 4);
      if (pr === qr && rng.bool(0.7)) return null;
      const u = rng.int(2, difficulty === 'easy' ? 5 : 8);
      const v = rng.int(2, difficulty === 'easy' ? 5 : 8);
      if (u === v || u / v > 1.7 || v / u > 1.7) return null;
      const AD = pr * u;
      const DB = qr * u;
      const AE = pr * v;
      const EC = qr * v;
      const angA = rng.int(35, 80);
      const AB = AD + DB;
      const AC = AE + EC;
      const BC = Math.sqrt(AB * AB + AC * AC - 2 * AB * AC * Math.cos((angA * Math.PI) / 180));
      if (BC < 0.5 * Math.min(AB, AC)) return null;
      return { AD, DB, AE, EC, AB, AC, angA };
    });
    const { AD, DB, AE, EC, AB, AC, angA } = built;
    // A at the top
    const base = rng.int(-60, -20);
    const A: Pt = [0, 0];
    const B = mul(dirDeg(base - angA), AB);
    const C = mul(dirDeg(base), AC);
    const tilt = rng.int(-15, 15);
    const P = [A, B, C].map((pt) => rotate(pt, tilt));
    const [pA, pB, pC] = P as [Pt, Pt, Pt];
    const pD = add(pA, mul(sub(pB, pA), AD / AB));
    const pE = add(pA, mul(sub(pC, pA), AE / AC));
    const xs = P.map((pt) => pt[0]);
    const ys = P.map((pt) => pt[1]);
    const b = new DiagramBuilder(190 / Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)));
    b.polygon(P, { weight: 1.4 });
    b.segment(pD, pE, { weight: 1.4 });
    const names = randomLetters(rng, 5);
    const [nA, nB, nC, nD, nE] = names as [string, string, string, string, string];
    nameVertices(b, P, [nA, nB, nC]);
    const cen = centroid(P);
    // D and E sit on the sides: push their names outward, perpendicular to the side
    const outward = (pt: Pt, s0: Pt, s1: Pt) => {
      const d = sub(s1, s0);
      let nrm: Pt = [-d[1], d[0]];
      if ((cen[0] - pt[0]) * nrm[0] + (cen[1] - pt[1]) * nrm[1] > 0) nrm = mul(nrm, -1);
      const l = Math.hypot(...nrm);
      return add(pt, mul(nrm, b.px(10) / l));
    };
    b.label(outward(pD, pA, pB), nD, 'c');
    b.label(outward(pE, pA, pC), nE, 'c');
    const lengths: Array<[Pt, Pt, string]> = [];
    const label = (u: Pt, v: Pt, tex: string, inside: Pt = cen) => {
      sideText(b, u, v, tex, inside, 3);
      lengths.push([u, v, tex]);
    };
    const hard = difficulty === 'hard';
    if (task === 'splitter') {
      // four segments; one unknown (x or an expression)
      const segs: Array<[Pt, Pt, number, string]> = [
        [pA, pD, AD, `${nA}${nD}`],
        [pD, pB, DB, `${nD}${nB}`],
        [pA, pE, AE, `${nA}${nE}`],
        [pE, pC, EC, `${nE}${nC}`],
      ];
      const ui = rng.int(0, 3);
      let x = segs[ui]![2];
      let e: Lin | null = null;
      if (difficulty !== 'easy') {
        const r = linSolve(rng, segs[ui]![2], { aMax: 3, bMax: 20 });
        x = r.x;
        e = r.e;
      }
      const tex = (i: number) => (i === ui ? (e ? linTex(e) : 'x') : String(segs[i]![2]));
      segs.forEach((s, i) => label(s[0], s[1], tex(i)));
      const eq = `\\frac{${tex(0)}}{${tex(1)}} = \\frac{${tex(2)}}{${tex(3)}}`;
      const sName = segs[ui]![3];
      const fmt = (w: number) => (hard && e ? `${m(`x = ${w}`)}, ${m(`${sName} = ${linVal(e, w)}`)}` : m(`x = ${w}`));
      const val = segs[ui]![2];
      // mistakes: using the whole side instead of the lower segment, inverting the proportion
      const others = segs.map((s) => s[2]);
      const wrongVals = [
        ui % 2 === 0 ? (others[ui ^ 1]! * others[(ui + 2) % 4]!) / others[((ui + 2) % 4) ^ 1]! : (others[ui ^ 1]! * others[(ui + 2) % 4]!) / others[((ui + 2) % 4) ^ 1]!,
        val + (ui < 2 ? DB - AD : EC - AE),
        ui % 2 === 0 ? ((ui === 0 ? AB : AC) * (ui === 0 ? AE : AD)) / (ui === 0 ? AC : AB) : (others[ui ^ 1]! * (ui < 2 ? AC : AB)) / (ui < 2 ? AE : AD),
      ];
      const wrongX = e ? wrongVals.map((v) => (v - e!.b) / e!.a) : wrongVals;
      return {
        question: hard && e ? `Find $x$ and $${sName}$.` : `$\\overline{${nD}${nE}} \\parallel \\overline{${nB}${nC}}$. Find $x$.`,
        answer: fmt(x),
        steps: ['A line parallel to one side divides the other two sides proportionally:', m(eq), ...(e ? [m(`${linTex(e)} = ${val}`)] : []), m(`x = ${x}`), ...(hard && e ? [m(`${sName} = ${val}`)] : [])],
        distractors: distinctDistractors(fmt(x), wrongX.filter((w) => Number.isInteger(w) && w > 0 && w !== x && (!e || linVal(e, w) > 0)).map(fmt), (j) => {
          const w = x + offset(j);
          return w > 0 && (!e || linVal(e, w) > 0) ? fmt(w) : null;
        }),
        diagram: b.build(`Triangle ${nA}${nB}${nC} with segment ${nD}${nE} parallel to ${nB}${nC}`),
        check: { kind: 'geometry.solve', eqs: [eq, ...(hard && e ? [`L = ${linTex(e)}`] : [])], names: hard && e ? { [sName]: 'L' } : {}, lengths, given: segs.map((_, i) => tex(i)) },
      };
    }
    // similar triangles: DE / BC = AD / AB
    // scale DE, BC to nice integers: DE = AD·w, BC = AB·w with w integer
    const w = rng.int(1, 3);
    const de = AD * w;
    const bc = AB * w;
    // the drawn BC/DE ratio equals AB/AD automatically; labels de, bc are proportional to it
    const findDE = rng.bool();
    let x = findDE ? de : bc;
    let e: Lin | null = null;
    if (difficulty !== 'easy') {
      const r = linSolve(rng, findDE ? de : bc, { aMax: 3, bMax: 20 });
      x = r.x;
      e = r.e;
    }
    const unk = e ? linTex(e) : 'x';
    label(pA, pD, String(AD));
    label(pD, pB, String(DB));
    label(pD, pE, findDE ? unk : String(de), pA);
    label(pB, pC, findDE ? String(bc) : unk);
    const eq = findDE ? `\\frac{${unk}}{${bc}} = \\frac{${AD}}{${AD} + ${DB}}` : `\\frac{${de}}{${unk}} = \\frac{${AD}}{${AD} + ${DB}}`;
    const sName = findDE ? `${nD}${nE}` : `${nB}${nC}`;
    const fmt = (v: number) => (hard && e ? `${m(`x = ${v}`)}, ${m(`${sName} = ${linVal(e, v)}`)}` : m(`x = ${v}`));
    const val = findDE ? de : bc;
    const wrongVals = findDE ? [(bc * AD) / DB, (bc * DB) / AB, bc / 2] : [(de * DB) / AD, (de * AB) / DB, de * 2 + 1];
    const wrongX = e ? wrongVals.map((v) => (v - e!.b) / e!.a) : wrongVals;
    return {
      question: hard && e ? `Find $x$ and $${sName}$.` : `$\\overline{${nD}${nE}} \\parallel \\overline{${nB}${nC}}$. Find $x$.`,
      answer: fmt(x),
      steps: [`$\\triangle ${nA}${nD}${nE} \\sim \\triangle ${nA}${nB}${nC}$ (AA), so`, m(eq), ...(e ? [m(`${unk} = ${val}`)] : []), m(`x = ${x}`)],
      distractors: distinctDistractors(fmt(x), wrongX.filter((v) => Number.isInteger(v) && v > 0 && v !== x && (!e || linVal(e, v) > 0)).map(fmt), (j) => {
        const v = x + offset(j);
        return v > 0 && (!e || linVal(e, v) > 0) ? fmt(v) : null;
      }),
      diagram: b.build(`Triangle ${nA}${nB}${nC} with segment ${nD}${nE} parallel to ${nB}${nC}`),
      check: {
        kind: 'geometry.solve',
        eqs: [eq, ...(hard && e ? [`L = ${unk}`] : [])],
        names: hard && e ? { [sName]: 'L' } : {},
        // only the two sides along AB and the two parallel segments are drawn to one common scale per pair
        lengths: [[pA, pD, String(AD)], [pD, pB, String(DB)]],
        ratios: [[pD, pE, findDE ? unk : String(de)], [pB, pC, findDE ? String(bc) : unk]],
        given: [String(AD), String(DB), findDE ? String(bc) : String(de), unk],
      },
    };
  },
});

