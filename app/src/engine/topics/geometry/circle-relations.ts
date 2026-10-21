/** Circles: angles formed by chords, secants and tangents; segment lengths; equations of circles. */
import { DiagramBuilder, graphPlane, plotParam, type Pt } from '../../diagram';
import { attempt, defineTopic, distinctDistractors, offset, strOpt } from '../../generator';
import { isPerfectSquare, sqrtTex } from '../../radical';
import { m, sum, tuple } from '../../tex';
import type { ProblemContent } from '../../types';
import { arcLabel, deg, O, pointName } from './circles';
import { add, angleLabel, dirDeg, dist, mul, numChoices, onCircle, randomLetters, sideText, sub, unit } from './kit';

// ---------------------------------------------------------------- geometry helpers

/** Intersection of lines p1 + s·d1 and p2 + t·d2. */
function intersect(p1: Pt, d1: Pt, p2: Pt, d2: Pt): Pt | null {
  const det = d1[0] * d2[1] - d1[1] * d2[0];
  if (Math.abs(det) < 1e-9) return null;
  const s = ((p2[0] - p1[0]) * d2[1] - (p2[1] - p1[1]) * d2[0]) / det;
  return add(p1, mul(d1, s));
}

const ext = (from: Pt, to: Pt, k = 0.18): Pt => add(to, mul(sub(to, from), k));

// ---------------------------------------------------------------- angles of chords, secants, tangents

type Case = 'chords' | 'secants' | 'tangentSecant' | 'tangents' | 'tangentChord';

export const circleAngles = defineTopic({
  id: 'geo.circle-angles',
  subject: 'geometry',
  category: 'Circles',
  title: 'Angles of Chords, Secants and Tangents',
  description: 'Angles formed inside, on and outside a circle by chords, secants and tangents, and their intercepted arcs.',
  instruction: 'Find $x$. Assume that lines which appear tangent are tangent.',
  multipleChoice: true,
  defaultCount: 9,
  options: [
    {
      type: 'select',
      id: 'where',
      label: 'Vertex',
      default: 'any',
      choices: [
        { value: 'any', label: 'By difficulty' },
        { value: 'inside', label: 'Inside the circle (chords)' },
        { value: 'on', label: 'On the circle (tangent and chord)' },
        { value: 'outside', label: 'Outside the circle (secants, tangents)' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const where = strOpt(ctx, 'where');
    const pool: Case[] =
      where === 'inside'
        ? ['chords']
        : where === 'on'
          ? ['tangentChord']
          : where === 'outside'
            ? ['secants', 'tangentSecant', 'tangents']
            : difficulty === 'easy'
              ? ['chords', 'tangentChord']
              : ['chords', 'secants', 'tangentSecant', 'tangents', 'tangentChord'];
    const kind = rng.pick(pool);
    const findArc = difficulty === 'hard' || (difficulty === 'medium' && rng.bool(0.3));
    const start = rng.int(0, 359);
    const at = (d: number) => onCircle(O, 1, start + d);
    const b = new DiagramBuilder(70);
    const L = randomLetters(rng, 5);
    const dot = (p: Pt, n: string) => {
      b.dot(p);
      pointName(b, p, n);
    };
    let arcs: Array<{ from: number; size: number; pts: [Pt, Pt] }>;
    let vertex: Pt;
    let rays: [Pt, Pt];
    let relation: 'half-sum' | 'half-diff' | 'half';
    let angle: number;
    const built = attempt('circle-angle', () => {
      if (kind === 'chords') {
        const a1 = rng.int(30, 150);
        const a2 = rng.int(30, 150);
        const s1 = rng.int(30, 360 - a1 - a2 - 30);
        if ((a1 + a2) % 2 !== 0 || 360 - a1 - a2 - s1 < 30) return null;
        return { a1, a2, s1 };
      }
      if (kind === 'secants') {
        const n = rng.int(20, 90);
        const f = rng.int(n + 30, 200);
        if (360 - n - f < 80) return null;
        const s1 = rng.int(40, 360 - n - f - 40);
        if ((f - n) % 2 !== 0 || 360 - n - f - s1 < 40) return null;
        const A = at(0);
        const C = at(n);
        const D = at(n + s1);
        const B = at(n + s1 + f);
        const P = intersect(A, sub(B, A), C, sub(D, C));
        if (!P || dist(P, A) > dist(P, B) || dist(P, C) > dist(P, D) || Math.hypot(...P) > 2.4) return null;
        return { a1: n, a2: f, s1 };
      }
      if (kind === 'tangentSecant') {
        const n = rng.int(30, 110);
        const f = rng.int(n + 30, 230);
        if ((f - n) % 2 !== 0 || 360 - n - f < 40) return null;
        const T = at(0);
        const A = at(n);
        const B = at(360 - f);
        const P = intersect(T, dirDeg(start + 90), A, sub(B, A));
        if (!P || dist(P, A) > dist(P, B) || Math.hypot(...P) > 2.4) return null;
        return { a1: n, a2: f, s1: 0 };
      }
      if (kind === 'tangents') {
        const a = rng.int(60, 130);
        return { a1: a, a2: 360 - a, s1: 0 };
      }
      const a = 2 * rng.int(40, 85);
      return { a1: a, a2: 0, s1: 0 };
    });
    const { a1, a2, s1 } = built;
    if (kind === 'chords') {
      // ccw: A, B (arc a1), C (gap s1), D (arc a2); chords AC and BD
      const A = at(0);
      const B = at(a1);
      const C = at(a1 + s1);
      const D = at(a1 + s1 + a2);
      b.circle(O, 1, { weight: 1.4 });
      b.segment(A, C, { weight: 1.3 });
      b.segment(B, D, { weight: 1.3 });
      [A, B, C, D].forEach((p, i) => dot(p, L[i]!));
      vertex = intersect(A, sub(C, A), B, sub(D, B))!;
      rays = [A, B];
      arcs = [
        { from: start, size: a1, pts: [A, B] },
        { from: start + a1 + s1, size: a2, pts: [C, D] },
      ];
      relation = 'half-sum';
      angle = (a1 + a2) / 2;
    } else if (kind === 'secants') {
      // ccw: A (near), C (near) [arc n], D (far) [gap s1], B (far) [arc f]; secants A→B and C→D meet at P
      const A = at(0);
      const C = at(a1);
      const D = at(a1 + s1);
      const B = at(a1 + s1 + a2);
      const P = intersect(A, sub(B, A), C, sub(D, C))!;
      b.circle(O, 1, { weight: 1.4 });
      b.segment(P, ext(P, B, 0.12), { weight: 1.3 });
      b.segment(P, ext(P, D, 0.12), { weight: 1.3 });
      [A, C, D, B].forEach((p, i) => dot(p, L[i]!));
      b.label(add(P, mul(unit(sub(P, O)), b.px(10))), L[4]!, 'c');
      vertex = P;
      rays = [B, D];
      arcs = [
        { from: start, size: a1, pts: [A, C] },
        { from: start + a1 + s1, size: a2, pts: [D, B] },
      ];
      relation = 'half-diff';
      angle = (a2 - a1) / 2;
    } else if (kind === 'tangentSecant') {
      // ccw: T, A (arc n), B (chord AB), back to T (arc f)
      const T = at(0);
      const A = at(a1);
      const B = at(360 - a2);
      const tdir = dirDeg(start + 90);
      const P = intersect(T, tdir, A, sub(B, A))!;
      b.circle(O, 1, { weight: 1.4 });
      b.segment(ext(P, T, 0.35), P, { weight: 1.3 });
      b.segment(P, ext(P, B, 0.12), { weight: 1.3 });
      [T, A, B].forEach((p, i) => dot(p, L[i]!));
      b.label(add(P, mul(unit(sub(P, O)), b.px(10))), L[4]!, 'c');
      vertex = P;
      rays = [T, B];
      arcs = [
        { from: start, size: a1, pts: [T, A] },
        { from: start + 360 - a2, size: a2, pts: [B, T] },
      ];
      relation = 'half-diff';
      angle = (a2 - a1) / 2;
    } else if (kind === 'tangents') {
      const T1 = at(0);
      const T2 = at(a1);
      const P = mul(dirDeg(start + a1 / 2), 1 / Math.cos((a1 * Math.PI) / 360));
      b.circle(O, 1, { weight: 1.4 });
      b.segment(ext(P, T1, 0.3), P, { weight: 1.3 });
      b.segment(ext(P, T2, 0.3), P, { weight: 1.3 });
      dot(T1, L[0]!);
      dot(T2, L[1]!);
      b.label(add(P, mul(unit(P), b.px(10))), L[4]!, 'c');
      vertex = P;
      rays = [T1, T2];
      // label the major arc (the minor arc is the near one)
      arcs = [
        { from: start, size: a1, pts: [T1, T2] },
        { from: start + a1, size: 360 - a1, pts: [T2, T1] },
      ];
      relation = 'half-diff';
      angle = 180 - a1;
    } else {
      const T = at(0);
      const A = at(a1);
      const u = dirDeg(start + 90);
      b.circle(O, 1, { weight: 1.4 });
      b.segment(add(T, mul(u, -0.9)), add(T, mul(u, 1.1)), { weight: 1.3 });
      b.segment(T, A, { weight: 1.3 });
      dot(T, L[0]!);
      dot(A, L[1]!);
      vertex = T;
      rays = [A, add(T, u)];
      arcs = [{ from: start, size: a1, pts: [T, A] }];
      relation = 'half';
      angle = a1 / 2;
    }
    // unknown: the angle, or (findArc) one of the arcs
    const unknownArc = !findArc ? -1 : kind === 'tangents' ? 1 : kind === 'tangentChord' ? 0 : rng.int(0, 1);
    const arcTex = arcs.map((a, i) => (i === unknownArc ? 'x' : String(a.size)));
    const angleTex = unknownArc === -1 ? 'x' : String(angle);
    const showArcs = kind === 'tangents' ? [1] : arcs.map((_, i) => i);
    showArcs.forEach((i) => {
      const midDeg = arcs[i]!.from + arcs[i]!.size / 2;
      // the near arc of an outside vertex is labelled inside the circle, away from the angle label
      if (i === 0 && (kind === 'secants' || kind === 'tangentSecant')) b.label(mul(dirDeg(midDeg), 1 - b.px(14)), deg(arcTex[i]!), 'c');
      else arcLabel(b, midDeg, deg(arcTex[i]!));
    });
    angleLabel(b, vertex, rays[0], rays[1], deg(angleTex), { radiusPx: 13, maxPx: 45 });
    const shownTex = (i: number) => arcTex[i]!;
    let eq: string;
    if (kind === 'tangents') eq = `${angleTex} = \\frac{1}{2}((${shownTex(1)}) - (360 - (${shownTex(1)})))`;
    else if (relation === 'half-sum') eq = `${angleTex} = \\frac{1}{2}(${shownTex(0)} + ${shownTex(1)})`;
    else if (relation === 'half-diff') eq = `${angleTex} = \\frac{1}{2}(${shownTex(1)} - ${shownTex(0)})`;
    else eq = `${angleTex} = \\frac{1}{2} \\cdot ${shownTex(0)}`;
    const val = unknownArc === -1 ? angle : arcs[unknownArc]!.size;
    const fmt = (v: number) => m(`x = ${v}`);
    const rule =
      relation === 'half-sum'
        ? 'An angle formed by two chords is half the sum of the intercepted arcs:'
        : relation === 'half'
          ? 'An angle formed by a tangent and a chord is half the intercepted arc:'
          : kind === 'tangents'
            ? 'An angle formed by two tangents is half the difference of the intercepted arcs (the major arc is $360^\\circ$ minus the minor arc):'
            : 'An angle with its vertex outside the circle is half the difference of the intercepted arcs:';
    const wrong =
      unknownArc === -1
        ? [relation === 'half-sum' ? (a2 - a1) / 2 : (a1 + a2) / 2, relation === 'half' ? a1 : a1 + a2, kind === 'tangents' ? a1 : Math.abs(a2 - a1), angle * 2]
        : [angle * 2, relation === 'half-sum' ? 2 * angle + (unknownArc === 0 ? a2 : a1) : 2 * angle - (unknownArc === 0 ? -a1 : a2), 180 - val, val / 2];
    const arcChecks: Array<[Pt, Pt, Pt, string]> = arcs.map((a, i) => [O, a.pts[0], a.pts[1], kind === 'tangents' && i === 0 ? `360 - (${arcTex[1]})` : arcTex[i]!]);
    return {
      question: 'Find $x$.',
      answer: fmt(val),
      steps: [rule, m(eq), fmt(val)],
      distractors: numChoices(fmt, val, wrong),
      diagram: b.build('Circle with chords, secants or tangents; arcs and an angle labelled'),
      check: { kind: 'geometry.solve', eqs: [eq], angles: [[rays[0], vertex, rays[1], angleTex]], arcs: arcChecks, given: [deg(angleTex), ...showArcs.map((i) => deg(arcTex[i]!))].filter((g) => g !== 'x^\\circ') },
    };
  },
});

// ---------------------------------------------------------------- segment lengths in circles

type SegCase = 'chords' | 'secants' | 'tangent';

export const circleSegments = defineTopic({
  id: 'geo.circle-segments',
  subject: 'geometry',
  category: 'Circles',
  title: 'Segment Lengths in Circles',
  description: 'Intersecting chords, two secants, and a secant with a tangent from the same point.',
  instruction: 'Find $x$. Assume that lines which appear tangent are tangent.',
  multipleChoice: true,
  defaultCount: 8,
  options: [
    {
      type: 'select',
      id: 'case',
      label: 'Segments',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'chords', label: 'Intersecting chords' },
        { value: 'secants', label: 'Two secants' },
        { value: 'tangent', label: 'Secant and tangent' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const chosen = strOpt(ctx, 'case');
    const kind: SegCase = chosen !== 'any' ? (chosen as SegCase) : difficulty === 'easy' ? rng.pick<SegCase>(['chords', 'chords', 'secants']) : rng.pick<SegCase>(['chords', 'secants', 'tangent']);
    const quad = difficulty === 'hard' && kind !== 'chords';
    const L = randomLetters(rng, 5);
    const hi = difficulty === 'easy' ? 10 : 16;
    // values: chords a·b = c·d; secants a(a+b) = c(c+d); tangent t² = a(a+b)
    const v = attempt('segments', () => {
      if (kind === 'chords') {
        const quads: Array<[number, number, number, number]> = [];
        const top = difficulty === 'easy' ? 12 : 18;
        for (let p1 = 2; p1 <= top; p1++)
          for (let p2 = p1; p2 <= top; p2++)
            for (let q1 = 2; q1 < p1; q1++) {
              const q2 = (p1 * p2) / q1;
              if (Number.isInteger(q2) && q2 <= top && q1 / q2 >= 0.34 && p1 / p2 >= 0.34) quads.push([p1, p2, q1, q2]);
            }
        const [p1, p2, q1, q2] = rng.pick(quads);
        const [a, b0] = rng.bool() ? [p1, p2] : [p2, p1];
        const [c, d] = rng.bool() ? [q1, q2] : [q2, q1];
        return { a, b: b0, c, d };
      }
      if (kind === 'secants') {
        const a = rng.int(2, hi);
        const b0 = rng.int(2, hi);
        const c = rng.int(2, hi);
        const prod = a * (a + b0);
        if (prod % c !== 0 || c === a) return null;
        const d = prod / c - c;
        if (d < 2 || d > 2 * hi) return null;
        return { a, b: b0, c, d };
      }
      const a = rng.int(2, hi);
      const b0 = rng.int(2, 2 * hi);
      const t2 = a * (a + b0);
      if (!isPerfectSquare(t2)) return null;
      return { a, b: b0, c: Math.sqrt(t2), d: 0 };
    });
    const { a, c, d } = v;
    const bb = v.b;
    // build the figure in real units, radius r
    const fig = attempt('seg-fig', () => {
      if (kind === 'chords') {
        const need = Math.max((a + bb) / 2, (c + d) / 2);
        const r = need * (rng.int(102, 125) / 100);
        const p = Math.sqrt(r * r - a * bb);
        const P: Pt = [p, 0];
        // chord 1: t = +a and t = −b along u1 with P·u1 = (b − a)/2
        const c1 = (bb - a) / (2 * p);
        const c2 = (d - c) / (2 * p);
        if (Math.abs(c1) > 0.97 || Math.abs(c2) > 0.97) return null;
        const psi1 = Math.acos(c1);
        const psi2 = -Math.acos(c2);
        if (Math.abs(psi1 - psi2) < 0.5 || Math.abs(psi1 - psi2) > 2 * Math.PI - 0.5) return null;
        const u1: Pt = [Math.cos(psi1), Math.sin(psi1)];
        const u2: Pt = [Math.cos(psi2), Math.sin(psi2)];
        return { r, P, pts: [add(P, mul(u1, a)), add(P, mul(u1, -bb)), add(P, mul(u2, c)), add(P, mul(u2, -d))] as Pt[] };
      }
      const b2 = kind === 'secants' ? Math.max(bb, d) : bb;
      const r = (b2 / 2) * (rng.int(105, 150) / 100);
      const power = kind === 'secants' ? a * (a + bb) : c * c;
      const p = Math.sqrt(r * r + power);
      const P: Pt = [p, 0];
      const cos1 = -(2 * a + bb) / (2 * p);
      if (Math.abs(cos1) > 1) return null;
      const psi1 = Math.acos(cos1);
      if (kind === 'secants') {
        const cos2 = -(2 * c + d) / (2 * p);
        if (Math.abs(cos2) > 1) return null;
        const psi2 = -Math.acos(cos2);
        if (Math.abs(psi1 - psi2) < 0.35) return null;
        const u1: Pt = [Math.cos(psi1), Math.sin(psi1)];
        const u2: Pt = [Math.cos(psi2), Math.sin(psi2)];
        return { r, P, pts: [add(P, mul(u1, a)), add(P, mul(u1, a + bb)), add(P, mul(u2, c)), add(P, mul(u2, c + d))] as Pt[] };
      }
      const cosT = -c / p;
      const psiT = -Math.acos(cosT);
      if (Math.abs(psi1 - psiT) < 0.35) return null;
      const u1: Pt = [Math.cos(psi1), Math.sin(psi1)];
      const uT: Pt = [Math.cos(psiT), Math.sin(psiT)];
      return { r, P, pts: [add(P, mul(u1, a)), add(P, mul(u1, a + bb)), add(P, mul(uT, c))] as Pt[] };
    });
    const turn = rng.int(0, 359);
    const rot = (p: Pt): Pt => {
      const t = (turn * Math.PI) / 180;
      return [p[0] * Math.cos(t) - p[1] * Math.sin(t), p[0] * Math.sin(t) + p[1] * Math.cos(t)];
    };
    const P = rot(fig.P);
    const pts = fig.pts.map(rot);
    const span = kind === 'chords' ? 2 * fig.r : fig.r + Math.hypot(...fig.P);
    const b = new DiagramBuilder(190 / span);
    b.circle(O, fig.r, { weight: 1.4 });
    const lengths: Array<[Pt, Pt, string]> = [];
    const label = (u: Pt, w: Pt, tex: string, side: Pt) => {
      sideText(b, u, w, tex, side, 3);
      lengths.push([u, w, tex]);
    };
    const name = (p: Pt, n: string) => {
      b.dot(p);
      const dd = unit(p);
      b.label(add(p, mul(dd, b.px(9))), n, 'c');
    };
    b.dot(P);
    let eq: string;
    let x: number;
    let steps: string[];
    let wrong: number[];
    let texs: string[];
    if (kind === 'chords') {
      const [A1, B1, C1, D1] = pts as [Pt, Pt, Pt, Pt];
      b.segment(A1, B1, { weight: 1.3 });
      b.segment(C1, D1, { weight: 1.3 });
      [A1, B1, C1, D1].forEach((p, i) => name(p, L[i]!));
      b.label(add(P, mul(unit(sub(P, mul(add(A1, C1), 0.5))), b.px(11))), L[4]!, 'c');
      const vals = [a, bb, c, d];
      const ui = rng.int(0, 3);
      x = vals[ui]!;
      texs = vals.map((val, i) => (i === ui ? 'x' : String(val)));
      label(P, A1, texs[0]!, C1);
      label(P, B1, texs[1]!, D1);
      label(P, C1, texs[2]!, B1);
      label(P, D1, texs[3]!, A1);
      eq = `${texs[0]} \\cdot ${texs[1]} = ${texs[2]} \\cdot ${texs[3]}`;
      steps = ['The products of the parts of intersecting chords are equal:', m(eq), m(`x = ${x}`)];
      const partner = vals[ui ^ 1]!;
      const others = [vals[ui < 2 ? 2 : 0]!, vals[ui < 2 ? 3 : 1]!];
      wrong = [others[0]! + others[1]! - partner, (others[0]! * partner) / others[1]!, (others[1]! * partner) / others[0]!, others[0]! * others[1]! - partner];
    } else if (kind === 'secants') {
      const [A1, B1, C1, D1] = pts as [Pt, Pt, Pt, Pt];
      b.segment(P, ext(P, B1, 0.1), { weight: 1.3 });
      b.segment(P, ext(P, D1, 0.1), { weight: 1.3 });
      [A1, B1, C1, D1].forEach((p, i) => name(p, L[i]!));
      b.label(add(P, mul(unit(P), b.px(11))), L[4]!, 'c');
      const vals = [a, bb, c, d];
      const ui = quad ? rng.pick([0, 2]) : rng.int(0, 3);
      x = vals[ui]!;
      texs = vals.map((val, i) => (i === ui ? 'x' : String(val)));
      label(P, A1, texs[0]!, C1);
      label(A1, B1, texs[1]!, O);
      label(P, C1, texs[2]!, A1);
      label(C1, D1, texs[3]!, O);
      eq = `${texs[0]}(${texs[0]} + ${texs[1]}) = ${texs[2]}(${texs[2]} + ${texs[3]})`;
      steps = ['Outside segment × whole secant is the same for both secants:', m(eq)];
      if (quad) {
        const kk = ui === 0 ? bb : d;
        const rhsV = ui === 0 ? c * (c + d) : a * (a + bb);
        steps.push(m(`x^{2} + ${kk}x - ${rhsV} = 0`), m(`x = ${x}`) + ' (the negative root is rejected)');
      } else steps.push(m(`x = ${x}`));
      wrong = [ui % 2 === 0 ? x + vals[ui + 1]! : x * 2, (a * bb) / (c || 1), (c * d) / (a || 1), x + 2];
    } else {
      const [A1, B1, T1] = pts as [Pt, Pt, Pt];
      b.segment(P, ext(P, B1, 0.1), { weight: 1.3 });
      b.segment(P, ext(P, T1, 0.35), { weight: 1.3 });
      [A1, B1, T1].forEach((p, i) => name(p, L[i]!));
      b.label(add(P, mul(unit(P), b.px(11))), L[4]!, 'c');
      const vals = [a, bb, c];
      const ui = quad ? 0 : rng.int(0, 2);
      x = vals[ui]!;
      texs = vals.map((val, i) => (i === ui ? 'x' : String(val)));
      label(P, A1, texs[0]!, T1);
      label(A1, B1, texs[1]!, O);
      label(P, T1, texs[2]!, A1);
      eq = `${texs[2]}^{2} = ${texs[0]}(${texs[0]} + ${texs[1]})`;
      steps = ['The tangent squared equals the outside segment times the whole secant:', m(eq)];
      if (quad) steps.push(m(`x^{2} + ${bb}x - ${c * c} = 0`), m(`x = ${x}`) + ' (the negative root is rejected)');
      else steps.push(m(`x = ${x}`));
      wrong = ui === 2 ? [a + bb, Math.sqrt(a * bb), a * (a + bb) / 2] : ui === 0 ? [(c * c) / bb, c - bb, c] : [(c * c) / a, c * c - a, c];
    }
    const fmt = (val: number) => m(`x = ${val}`);
    const question =
      kind === 'chords'
        ? `Chords $\\overline{${L[0]}${L[1]}}$ and $\\overline{${L[2]}${L[3]}}$ intersect at $${L[4]}$. Find $x$.`
        : kind === 'secants'
          ? `Secants $\\overline{${L[4]}${L[1]}}$ and $\\overline{${L[4]}${L[3]}}$ meet at $${L[4]}$. Find $x$.`
          : `$\\overline{${L[4]}${L[2]}}$ is tangent to the circle. Find $x$.`;
    return {
      question,
      answer: fmt(x),
      steps,
      distractors: numChoices(fmt, x, wrong),
      diagram: b.build(kind === 'chords' ? 'Two chords intersecting inside a circle' : kind === 'secants' ? 'Two secants from an outside point' : 'A secant and a tangent from an outside point'),
      check: { kind: 'geometry.solve', eqs: [eq.replace(/(\d+|x)\^\{2\}/, '($1)^{2}')], lengths, given: texs.filter((t) => t !== 'x') },
    };
  },
});

// ---------------------------------------------------------------- equations of circles

/** `(x - h)^{2}` / `x^{2}`. */
const sq = (v: string, h: number) => (h === 0 ? `${v}^{2}` : `(${sum([{ coef: 1, sym: v }, { coef: -h }])})^{2}`);
const standard = (h: number, k: number, r2: number) => `${sq('x', h)} + ${sq('y', k)} = ${r2}`;
const radiusTex = (r2: number) => (isPerfectSquare(r2) ? String(Math.sqrt(r2)) : sqrtTex(r2));

export const circleEquations = defineTopic({
  id: 'geo.circle-equations',
  subject: 'geometry',
  category: 'Circles',
  title: 'Equations of Circles',
  description: 'Write the equation of a circle from its center and radius (or a point, or a diameter), and read the center and radius from an equation.',
  instruction: (o) =>
    o.task === 'write' ? 'Write the standard form of the equation of each circle.' : o.task === 'identify' ? 'Identify the center and radius of each circle.' : o.task === 'graph' ? 'Identify the center and radius of each circle, then graph it.' : 'Answer each question about equations of circles.',
  multipleChoice: true,
  defaultCount: 9,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Problems',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed (write and identify)' },
        { value: 'write', label: 'Write the equation' },
        { value: 'identify', label: 'Center and radius' },
        { value: 'graph', label: 'Graph the circle' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const chosen = strOpt(ctx, 'task');
    const task = chosen === 'any' ? rng.pick(['write', 'identify']) : chosen;
    const R = task === 'graph' ? 4 : difficulty === 'easy' ? 6 : 10;
    const h = rng.int(-R, R);
    const k = rng.int(-R, R);
    if (task === 'graph') {
      const r = rng.int(1, Math.min(5, 9 - Math.max(Math.abs(h), Math.abs(k))));
      const { b, w } = graphPlane(10, 2, 10);
      const ans = graphPlane(10, 2, 10);
      plotParam(ans.b, (t) => h + r * Math.cos(t), (t) => k + r * Math.sin(t), 0, 2 * Math.PI, ans.w, {}, 160);
      ans.b.dot([h, k], false, 'accent');
      const eq = standard(h, k, r * r);
      const fmt = (hh: number, kk: number, rr: string) => `Center: ${m(tuple([hh, kk]))}, radius: ${m(rr)}`;
      const answer = fmt(h, k, String(r));
      void w;
      return {
        question: m(eq),
        answer,
        steps: [`Compare with $(x - h)^{2} + (y - k)^{2} = r^{2}$.`, answer],
        distractors: distinctDistractors(answer, [fmt(-h, -k, String(r)), fmt(h, k, String(r * r)), fmt(k, h, String(r)), fmt(-h, -k, String(r * r))], (j) => fmt(h + j, k, String(r))),
        diagram: b.build('Blank coordinate plane'),
        answerDiagram: ans.b.build(`Circle with center (${h}, ${k}) and radius ${r}`),
        check: { kind: 'curve', eq: `${eq.replace(/\^\{2\}/g, '^{2}')}` },
      };
    }
    if (task === 'write') {
      const mode = difficulty === 'easy' ? 'radius' : difficulty === 'medium' ? rng.pick(['radius', 'point']) : rng.pick(['point', 'diameter']);
      let r2: number;
      let question: string;
      const steps: string[] = [];
      if (mode === 'radius') {
        const useRoot = difficulty !== 'easy' && rng.bool(0.4);
        r2 = useRoot ? rng.pick([2, 3, 5, 6, 7, 8, 10, 12, 13, 15, 18, 20]) : rng.int(1, 12) ** 2;
        question = `Center: $${tuple([h, k])}$, radius: $${radiusTex(r2)}$`;
        steps.push(m(`r^{2} = ${r2}`));
      } else if (mode === 'point') {
        const P = attempt('circ-pt', () => {
          const p: [number, number] = [h + rng.int(-7, 7), k + rng.int(-7, 7)];
          return p[0] === h && p[1] === k ? null : p;
        });
        r2 = (P[0] - h) ** 2 + (P[1] - k) ** 2;
        question = `Center: $${tuple([h, k])}$, passes through $${tuple(P)}$`;
        steps.push(m(`r^{2} = (${P[0]} - ${h < 0 ? `(${h})` : h})^{2} + (${P[1]} - ${k < 0 ? `(${k})` : k})^{2} = ${r2}`));
      } else {
        const dx = rng.int(-7, 7);
        const dy = rng.int(-7, 7) || 3;
        const E1: [number, number] = [h - dx, k - dy];
        const E2: [number, number] = [h + dx, k + dy];
        r2 = dx * dx + dy * dy;
        question = `Ends of a diameter: $${tuple(E1)}$ and $${tuple(E2)}$`;
        steps.push(`The center is the midpoint: $${tuple([h, k])}$.`, m(`r^{2} = ${dx}^{2} + ${dy}^{2} = ${r2}`.replace(/-(\d+)\^/g, '(-$1)^')));
      }
      const answer = m(standard(h, k, r2));
      steps.push(answer);
      return {
        question,
        answer,
        steps,
        distractors: distinctDistractors(answer, [m(standard(-h, -k, r2)), m(standard(h, k, isPerfectSquare(r2) ? Math.sqrt(r2) : 2 * r2)), m(standard(k, h, r2)), m(standard(-h, -k, isPerfectSquare(r2) ? Math.sqrt(r2) : r2 + 1))], (j) => m(standard(h, k, r2 + j))),
        check: { kind: 'geometry.circleEq', task, mode },
      };
    }
    // identify center and radius
    const r2 = difficulty === 'easy' ? rng.int(1, 10) ** 2 : rng.bool(0.6) ? rng.int(1, 12) ** 2 : rng.pick([2, 3, 5, 6, 7, 8, 10, 12, 18, 20, 27, 32]);
    let qEq: string;
    const steps: string[] = [];
    if (difficulty === 'hard') {
      // general form x² + y² + Dx + Ey + F = 0
      const D = -2 * h;
      const E = -2 * k;
      const F = h * h + k * k - r2;
      qEq = `${sum([{ coef: 1, sym: 'x^{2}' }, { coef: 1, sym: 'y^{2}' }, { coef: D, sym: 'x' }, { coef: E, sym: 'y' }, { coef: F }])} = 0`;
      steps.push('Complete the square in $x$ and in $y$:', m(standard(h, k, r2)));
    } else qEq = standard(h, k, r2);
    const fmt = (hh: number, kk: number, rr: string) => `Center: ${m(tuple([hh, kk]))}, radius: ${m(rr)}`;
    const answer = fmt(h, k, radiusTex(r2));
    steps.push(answer);
    return {
      question: m(qEq),
      answer,
      steps,
      distractors: distinctDistractors(answer, [fmt(-h, -k, radiusTex(r2)), fmt(h, k, String(r2)), fmt(k, h, radiusTex(r2)), fmt(-h, -k, String(r2))], (j) => fmt(h + offset(j), k, radiusTex(r2))),
      check: { kind: 'geometry.circleEq', task },
    };
  },
});

