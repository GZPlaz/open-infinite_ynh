/** Triangles: classifying, angle sums, isosceles/equilateral, inequality, midsegments, centroids. */
import { DiagramBuilder, type Pt } from '../../diagram';
import { Frac } from '../../fraction';
import { attempt, defineTopic, distinctDistractors, offset, strOpt } from '../../generator';
import type { Rng } from '../../rng';
import { m, tuple } from '../../tex';
import type { ProblemContent } from '../../types';
import { coordinatePlane } from '../../diagram';
import {
  add,
  angleLabel,
  centroid,
  dirDeg,
  dist,
  fitted,
  labelledTriangle,
  letters,
  linDeg,
  linFor,
  linSubTex,
  linTex,
  linVal,
  mid,
  mul,
  nameVertices,
  numChoices,
  orient,
  posToward,
  sub,
  ticks,
  unit,
  type Lin,
} from './kit';

/** Triangle with angles A at P0 and B at P1 (degrees), base P0P1 of length `base`. */
export function trianglePts(A: number, B: number, base = 1): [Pt, Pt, Pt] {
  const t = (base * Math.sin((B * Math.PI) / 180)) / Math.sin(((A + B) * Math.PI) / 180);
  return [[0, 0], [base, 0], mul(dirDeg(A), t)];
}

/** Random tilt / mirror of a triangle. */
function place(rng: Rng, pts: readonly Pt[], maxTurn = 25): Pt[] {
  return orient(pts, rng.int(-maxTurn, maxTurn) + (rng.bool(0.2) ? 180 : 0), rng.bool());
}

/** Polygon with vertex names. */
function drawPolygon(pts: Pt[], names: readonly string[] | null, sizePx = 160): DiagramBuilder {
  const b = fitted(pts, sizePx);
  b.polygon(pts, { weight: 1.4 });
  if (names) nameVertices(b, pts, names);
  return b;
}

const deg = (v: number) => `${v}^\\circ`;

// ---------------------------------------------------------------- classifying triangles

type AngleKind = 'Acute' | 'Right' | 'Obtuse';
type SideKind = 'scalene' | 'isosceles' | 'equilateral';

function className(a: AngleKind, s: SideKind): string {
  return s === 'equilateral' ? 'Equilateral' : `${a} ${s}`;
}
const ALL_CLASSES = ['Acute scalene', 'Acute isosceles', 'Right scalene', 'Right isosceles', 'Obtuse scalene', 'Obtuse isosceles', 'Equilateral'];

function anglesFor(rng: Rng, a: AngleKind, s: SideKind): [number, number, number] {
  return attempt('classify-tri', () => {
    if (s === 'equilateral') return [60, 60, 60];
    if (s === 'isosceles') {
      const apex = a === 'Right' ? 90 : a === 'Acute' ? rng.int(20, 88) : rng.int(95, 150);
      if ((180 - apex) % 2 !== 0 || apex === 60) return null;
      const base = (180 - apex) / 2;
      return rng.shuffle([apex, base, base]) as [number, number, number];
    }
    const big = a === 'Right' ? 90 : a === 'Acute' ? rng.int(62, 88) : rng.int(95, 140);
    const p = rng.int(15, 180 - big - 15);
    const q = 180 - big - p;
    if (q < 15 || new Set([big, p, q]).size < 3 || Math.abs(p - q) < 6 || (a === 'Acute' && Math.max(p, q) >= 88)) return null;
    return rng.shuffle([big, p, q]) as [number, number, number];
  });
}

export const classifyTriangles = defineTopic({
  id: 'geo.classify-triangles',
  subject: 'geometry',
  category: 'Triangles',
  title: 'Classifying Triangles',
  description: 'Classify triangles by their angles (acute, right, obtuse) and sides (scalene, isosceles, equilateral).',
  instruction: 'Classify each triangle by its angles and sides.',
  multipleChoice: true,
  defaultCount: 9,
  options: [],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const s = rng.weighted<SideKind>([
      ['scalene', 4],
      ['isosceles', 4],
      ['equilateral', 1],
    ]);
    const a = s === 'equilateral' ? 'Acute' : rng.pick<AngleKind>(['Acute', 'Right', 'Obtuse']);
    const angles = anglesFor(rng, a, s);
    const answer = className(a, s);
    const names = letters(rng, 3);
    const tri = `\\triangle ${names.join('')}`;
    const near = ALL_CLASSES.filter((c) => c !== answer && (c.split(' ')[0] === answer.split(' ')[0] || c.split(' ')[1] === answer.split(' ')[1]));
    const distractors = distinctDistractors(answer, rng.shuffle(near), (k) => rng.shuffle(ALL_CLASSES)[k % 7]!);
    const pts = place(rng, trianglePts(angles[0], angles[1]));
    const sides = [dist(pts[1]!, pts[2]!), dist(pts[0]!, pts[2]!), dist(pts[0]!, pts[1]!)];
    const steps: string[] = [];
    if (difficulty === 'hard') {
      // side lengths only (whole numbers), classify by the converse of the Pythagorean theorem
      const [p, q, r] = attempt('tri-sides', () => {
        const k = rng.int(3, 9);
        const L = sides.map((v) => Math.round((v / Math.max(...sides)) * k * 3));
        if (L.some((v) => v < 2)) return null;
        const sorted = [...L].sort((x, y) => x - y) as [number, number, number];
        if (sorted[0] + sorted[1] <= sorted[2]) return null;
        const d = sorted[0] ** 2 + sorted[1] ** 2 - sorted[2] ** 2;
        const kind: AngleKind = d === 0 ? 'Right' : d > 0 ? 'Acute' : 'Obtuse';
        const sk: SideKind = sorted[0] === sorted[2] ? 'equilateral' : sorted[0] === sorted[1] || sorted[1] === sorted[2] ? 'isosceles' : 'scalene';
        if (className(kind, sk) !== answer) return null;
        return L as [number, number, number];
      }, 400);
      const sorted = [p, q, r].sort((x, y) => x - y) as [number, number, number];
      const d = sorted[0] ** 2 + sorted[1] ** 2 - sorted[2] ** 2;
      steps.push(m(`${sorted[0]}^{2} + ${sorted[1]}^{2} = ${sorted[0] ** 2 + sorted[1] ** 2}${d === 0 ? ' =' : d > 0 ? ' >' : ' <'} ${sorted[2] ** 2} = ${sorted[2]}^{2}`));
      steps.push(`The triangle is ${answer.toLowerCase()}.`);
      return {
        question: `A triangle has side lengths $${p}$, $${q}$, and $${r}$.`,
        answer,
        steps,
        distractors,
        check: { kind: 'geometry.classifyTriangle' },
      };
    }
    const b = drawPolygon(pts, names);
    const showAngles = difficulty === 'medium';
    if (showAngles) {
      [0, 1, 2].forEach((i) => {
        const v = pts[i]!;
        const pp = pts[(i + 1) % 3]!;
        const qq = pts[(i + 2) % 3]!;
        if (angles[i] === 90) {
          b.rightAngle(v, pp, qq, 10);
          angleLabel(b, v, pp, qq, deg(90), { arc: false, minPx: 24 });
        } else angleLabel(b, v, pp, qq, deg(angles[i]!), { radiusPx: 13 });
      });
      steps.push(`The angles measure $${angles.map(deg).join(', ')}$.`);
    } else {
      // tick marks on congruent sides, a right-angle mark, and one angle measure when obtuse
      const tickCount = sides.map((v) => (sides.filter((w) => Math.abs(w - v) < 1e-9).length > 1 ? 1 : 0));
      [0, 1, 2].forEach((i) => ticks(b, pts[(i + 1) % 3]!, pts[(i + 2) % 3]!, tickCount[i]!));
      const scaleneMarks = s === 'scalene';
      if (scaleneMarks) [0, 1, 2].forEach((i) => ticks(b, pts[(i + 1) % 3]!, pts[(i + 2) % 3]!, i + 1));
      [0, 1, 2].forEach((i) => {
        const v = pts[i]!;
        const pp = pts[(i + 1) % 3]!;
        const qq = pts[(i + 2) % 3]!;
        if (angles[i] === 90) b.rightAngle(v, pp, qq, 10);
        else if (angles[i]! > 90) angleLabel(b, v, pp, qq, deg(angles[i]!), { radiusPx: 13 });
      });
      if (a === 'Acute' && s !== 'equilateral') {
        const i = angles.indexOf(Math.max(...angles));
        angleLabel(b, pts[i]!, pts[(i + 1) % 3]!, pts[(i + 2) % 3]!, deg(angles[i]!), { radiusPx: 13 });
      }
      steps.push(s === 'scalene' ? 'No two sides are marked congruent.' : s === 'isosceles' ? 'Two sides are marked congruent.' : 'All three sides are marked congruent.');
      steps.push(a === 'Right' ? 'One angle is a right angle.' : a === 'Obtuse' ? 'One angle is obtuse.' : 'The largest angle is acute, so all three angles are acute.');
    }
    steps.push(`$${tri}$ is ${answer.toLowerCase()}.`);
    return {
      question: `Classify $${tri}$.`,
      answer,
      steps,
      distractors,
      diagram: b.build(`Triangle ${names.join('')}`),
      check: { kind: 'geometry.classifyTriangle', pts, angles },
    };
  },
});

// ---------------------------------------------------------------- triangle angle sum / exterior angle

type Q = { k: 'n'; v: number } | { k: 'e'; e: Lin } | { k: 'x' };
const qTex = (q: Q) => (q.k === 'n' ? String(q.v) : q.k === 'x' ? 'x' : linTex(q.e));
const qDeg = (q: Q) => (q.k === 'n' ? deg(q.v) : q.k === 'x' ? 'x^\\circ' : linDeg(q.e));
const qPar = (q: Q) => (q.k === 'e' ? `(${linTex(q.e)})` : qTex(q));
const qAt = (q: Q, x: number) => (q.k === 'n' ? q.v : q.k === 'x' ? x : linVal(q.e, x));
const qA = (q: Q) => (q.k === 'n' ? 0 : q.k === 'x' ? 1 : q.e.a);
const qB = (q: Q) => (q.k === 'e' ? q.e.b : q.k === 'n' ? q.v : 0);

/** Expressions for values `vals` in x: easy keeps numbers, otherwise k of them become linear expressions. */
function exprsFor(rng: Rng, vals: number[], x: number, which: number[], aMax = 6): Q[] | null {
  const out: Q[] = [];
  for (let i = 0; i < vals.length; i++) {
    if (!which.includes(i)) {
      out.push({ k: 'n', v: vals[i]! });
      continue;
    }
    const e = linFor(rng, vals[i]!, x, { aMin: 1, aMax, bMax: 60 });
    if (!e) return null;
    out.push({ k: 'e', e });
  }
  return out;
}

function solveLinearSteps(lhs: Q[], rhs: Q, x: number): string[] {
  const A = lhs.reduce((s, q) => s + qA(q), 0) - qA(rhs);
  const B = qB(rhs) - lhs.reduce((s, q) => s + qB(q), 0);
  return [m(`${lhs.map(qPar).join(' + ')} = ${qPar(rhs)}`), m(`${A === 1 ? '' : A === -1 ? '-' : A}x = ${B}`), m(`x = ${x}`)];
}

export const triangleAngleSum = defineTopic({
  id: 'geo.triangle-angle-sum',
  subject: 'geometry',
  category: 'Triangles',
  title: 'Triangle Angle Sum and Exterior Angles',
  description: 'Use the triangle angle sum theorem and the exterior angle theorem to find missing angles.',
  instruction: 'Find the indicated value.',
  multipleChoice: true,
  defaultCount: 9,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Theorem',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'interior', label: 'Triangle angle sum' },
        { value: 'exterior', label: 'Exterior angle theorem' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const chosen = strOpt(ctx, 'task');
    const task = chosen === 'any' ? rng.pick(['interior', 'exterior']) : chosen;
    const names = letters(rng, task === 'exterior' ? 4 : 3);
    const built = attempt('tri-sum', () => {
      const A = rng.int(25, 110);
      const B = rng.int(25, 150 - A);
      const C = 180 - A - B;
      if (C < 22) return null;
      const x = rng.int(3, difficulty === 'hard' ? 20 : 14);
      // quantities: interior → [A, B, C] summing to 180; exterior → [A, B] remote, ext = 180 - C
      const vals = task === 'interior' ? [A, B, C] : [A, B, A + B];
      let qs: Q[] | null;
      if (difficulty === 'easy') {
        const u = rng.int(0, 2);
        qs = vals.map((v, i) => (i === u ? ({ k: 'x' } as Q) : ({ k: 'n', v } as Q)));
        return { A, B, C, x: vals[u]!, qs, unknown: u };
      }
      const which = difficulty === 'medium' ? rng.sample([0, 1, 2], 2) : [0, 1, 2];
      qs = exprsFor(rng, vals, x, which, difficulty === 'hard' ? 9 : 6);
      if (!qs) return null;
      if (task === 'exterior' && qA(qs[0]!) + qA(qs[1]!) === qA(qs[2]!)) return null;
      return { A, B, C, x, qs, unknown: -1 };
    });
    const { A, B, x, qs, unknown } = built;
    const P = place(rng, trianglePts(A, B));
    let b: DiagramBuilder;
    const angles: Array<[Pt, Pt, Pt, string]> = [];
    if (task === 'interior') {
      b = labelledTriangle(P, names, qs.map(qDeg));
      [0, 1, 2].forEach((i) => angles.push([P[(i + 1) % 3]!, P[i]!, P[(i + 2) % 3]!, qTex(qs[i]!)]));
    } else {
      // extend side P1→P2 beyond P2; the exterior angle at P2 is between the extension and P2→P0
      const ext = add(P[2]!, mul(unit(sub(P[2]!, P[1]!)), dist(P[0]!, P[1]!) * 0.6));
      b = labelledTriangle(P, names.slice(0, 3), [qDeg(qs[0]!), qDeg(qs[1]!), null], { extra: [ext], draw: (bb) => bb.segment(P[2]!, ext, { weight: 1.4 }) });
      b.dot(ext);
      b.label(add(ext, mul(unit(sub(ext, P[2]!)), b.px(10))), names[3]!, 'c');
      [0, 1].forEach((i) => angles.push([P[(i + 1) % 3]!, P[i]!, P[(i + 2) % 3]!, qTex(qs[i]!)]));
      angleLabel(b, P[2]!, ext, P[0]!, qDeg(qs[2]!), { radiusPx: 13, maxPx: 300 });
      angles.push([ext, P[2]!, P[0]!, qTex(qs[2]!)]);
    }
    const fig = b.build(task === 'interior' ? `Triangle ${names.join('')} with its angles labelled` : `Triangle ${names.slice(0, 3).join('')} with side extended to ${names[3]}; exterior angle labelled`);
    const lhs = task === 'interior' ? qs : [qs[0]!, qs[1]!];
    const rhs: Q = task === 'interior' ? { k: 'n', v: 180 } : qs[2]!;
    const eq = `${lhs.map(qPar).join(' + ')} = ${qPar(rhs)}`;
    const reason = task === 'interior' ? 'The angles of a triangle add up to $180^\\circ$:' : 'An exterior angle equals the sum of the two remote interior angles:';
    if (difficulty === 'easy') {
      const fmt = (v: number) => m(`x = ${v}`);
      const known = qs.filter((q) => q.k === 'n').map((q) => (q as { v: number }).v);
      const wrongs = task === 'interior' ? [180 - known[0]!, 90 - known[0]!, 360 - known[0]! - known[1]!] : unknown === 2 ? [180 - known[0]! - known[1]!, Math.abs(known[0]! - known[1]!)] : [known[1]! + known[0]!, 180 - known[1]!, 180 - known[1]! - known[0]!];
      return {
        question: 'Find $x$.',
        answer: fmt(x),
        steps: [reason, m(eq), m(`x = ${x}`)],
        distractors: numChoices(fmt, x, wrongs),
        diagram: fig,
        check: { kind: 'geometry.solve', eqs: [eq], angles, given: qs.map(qDeg) },
      };
    }
    // ask for a named angle (medium) or x and the angle (hard)
    const t = rng.pick([0, 1, 2].filter((i) => qs[i]!.k === 'e'));
    const vName = task === 'exterior' && t === 2 ? `m\\angle ${names[0]}${names[2]}${names[3]}` : `m\\angle ${names[t]}`;
    const fmt = (w: number) => (difficulty === 'hard' ? `${m(`x = ${w}`)}, ${m(`${vName} = ${qAt(qs[t]!, w)}^\\circ`)}` : m(`${vName} = ${qAt(qs[t]!, w)}^\\circ`));
    const steps = [reason, ...solveLinearSteps(lhs, rhs, x), m(`${vName} = ${qs[t]!.k === 'e' ? `${linSubTex(qs[t]!.e, x)} = ` : ''}${qAt(qs[t]!, x)}^\\circ`)];
    const Asum = lhs.reduce((s, q) => s + qA(q), 0) - qA(rhs);
    const Bsum = qB(rhs) - lhs.reduce((s, q) => s + qB(q), 0);
    const wrong = [(Bsum + 2 * qB(lhs[0]!)) / Asum, task === 'interior' ? (90 - Bsum + 90) / Asum : (180 - qB(rhs) - qB(lhs[0]!) - qB(lhs[1]!)) / (qA(lhs[0]!) + qA(lhs[1]!) + qA(rhs) || 1), (Bsum - 2 * qB(lhs[0]!)) / Asum, x + 1, x - 1];
    const okW = wrong.filter((w) => Number.isInteger(w) && w > 0 && w !== x && qs.every((q) => qAt(q, w) > 0));
    return {
      question: `Find ${difficulty === 'hard' ? `$x$ and $${vName}$` : `$${vName}$`}.`.replace('Find $m', 'Find $m'),
      answer: fmt(x),
      steps,
      distractors: distinctDistractors(fmt(x), okW.map(fmt), (k) => (x + offset(k) > 0 && qs.every((q) => qAt(q, x + offset(k)) > 0) ? fmt(x + offset(k)) : null)),
      diagram: fig,
      check: { kind: 'geometry.solve', eqs: [eq, `L = ${qPar(qs[t]!)}`], names: { [vName]: 'L' }, angles, given: qs.map(qDeg) },
    };
  },
});

// ---------------------------------------------------------------- isosceles and equilateral

export const isoscelesEquilateral = defineTopic({
  id: 'geo.isosceles-equilateral',
  subject: 'geometry',
  category: 'Triangles',
  title: 'Isosceles and Equilateral Triangles',
  description: 'Base angles of isosceles triangles and the equal sides and angles of equilateral triangles.',
  instruction: 'Find the indicated value.',
  multipleChoice: true,
  defaultCount: 9,
  options: [{ type: 'boolean', id: 'equilateral', label: 'Include equilateral triangles', default: true }],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const equi = ctx.options.equilateral === true && rng.bool(0.25);
    const names = letters(rng, 3);
    // apex at index 2 (between the two congruent legs P0P2 and P1P2)
    const apex = equi ? 60 : attempt('apex', () => {
      const a = rng.int(20, 140);
      return (180 - a) % 2 === 0 && a !== 60 ? a : null;
    });
    const base = (180 - apex) / 2;
    const P = place(rng, trianglePts(base, base), 20);
    const b = drawPolygon(P, names);
    ticks(b, P[0]!, P[2]!, 1);
    ticks(b, P[1]!, P[2]!, 1);
    if (equi) ticks(b, P[0]!, P[1]!, 1);
    const angleTri = (i: number): [Pt, Pt, Pt] => [P[(i + 1) % 3]!, P[i]!, P[(i + 2) % 3]!];
    const angName = (i: number) => `m\\angle ${names[i]}`;
    const sideName = (i: number, j: number) => `${names[i]}${names[j]}`;
    const fig = (alt: string) => b.build(alt);

    if (difficulty === 'easy') {
      // numbers: find x (an angle) from one given angle
      const givenApex = equi ? false : rng.bool();
      const fmt = (v: number) => m(`x = ${v}`);
      if (equi) {
        const i = rng.int(0, 2);
        angleLabel(b, ...angleTri(i), 'x^\\circ', { radiusPx: 13 });
        return {
          question: 'Find $x$. (All three sides are marked congruent.)',
          answer: fmt(60),
          steps: ['An equilateral triangle is equiangular.', m('3x = 180'), m('x = 60')],
          distractors: numChoices(fmt, 60, [45, 90, 120, 30]),
          diagram: fig('Equilateral triangle'),
          check: { kind: 'geometry.solve', eqs: ['3x = 180'], angles: [[...angleTri(i), 'x']] },
        };
      }
      const xi = givenApex ? rng.int(0, 1) : 2;
      const gi = givenApex ? 2 : rng.int(0, 1);
      const val = xi === 2 ? apex : base;
      angleLabel(b, ...angleTri(gi), deg(gi === 2 ? apex : base), { radiusPx: 13 });
      angleLabel(b, ...angleTri(xi), 'x^\\circ', { radiusPx: 13 });
      const known = gi === 2 ? apex : base;
      return {
        question: 'Find $x$.',
        answer: fmt(val),
        steps: givenApex ? ['The base angles are congruent.', m(`2x + ${apex} = 180`), m(`x = ${base}`)] : ['The base angles are congruent.', m(`x + 2(${base}) = 180`), m(`x = ${apex}`)],
        distractors: numChoices(fmt, val, givenApex ? [180 - apex, apex, 90 - apex / 2 + 10] : [base, 180 - base, 180 - 2 * base + 10, 90 - base]),
        diagram: fig('Isosceles triangle with congruent legs marked'),
        check: {
          kind: 'geometry.solve',
          eqs: [givenApex ? `2x + ${known} = 180` : `x + 2 \\cdot ${known} = 180`],
          angles: [[...angleTri(xi), 'x'], [...angleTri(gi), String(known)]],
          given: [deg(known)],
        },
      };
    }

    // medium / hard: expressions; ask for x and a measure
    const sideMode = rng.bool(0.4);
    const built = attempt('iso', () => {
      const x = rng.int(3, difficulty === 'hard' ? 18 : 12);
      if (sideMode) {
        const L = rng.int(6, 40);
        const e1 = linFor(rng, L, x, { aMin: 1, aMax: 6, bMax: 40 });
        const e2 = linFor(rng, L, x, { aMin: 1, aMax: 8, bMax: 40, avoidA: e1 ? [e1.a] : [] });
        const e3 = equi ? linFor(rng, L, x, { aMin: 1, aMax: 8, bMax: 40, avoidA: e1 && e2 ? [e1.a, e2.a] : [] }) : null;
        if (!e1 || !e2 || (equi && !e3)) return null;
        return { x, e: [e1, e2, e3], L };
      }
      const e1 = linFor(rng, equi ? 60 : base, x, { aMin: 1, aMax: 6, bMax: 50 });
      const e2 = difficulty === 'hard' ? linFor(rng, equi ? 60 : apex, x, { aMin: 1, aMax: 8, bMax: 60, avoidA: equi && e1 ? [e1.a] : [] }) : null;
      if (!e1 || (difficulty === 'hard' && !e2)) return null;
      return { x, e: [e1, e2, null], L: 0 };
    });
    const { x } = built;
    const [e1, e2, e3] = built.e;
    if (sideMode) {
      // legs P0P2 and P1P2 (and base for equilateral)
      const segs: Array<[number, number, Lin]> = [[0, 2, e1!], [1, 2, e2!]];
      if (equi) segs.push([0, 1, e3!]);
      const inside = centroid(P);
      for (const [i, j, e] of segs) b.sideLabel(P[i]!, P[j]!, linTex(e), inside);
      const tName = sideName(...([[0, 2], [1, 2], [0, 1]][rng.int(0, equi ? 2 : 1)] as [number, number]));
      const lAt = (w: number) => linVal(e1!, w);
      const fmt = (w: number) => `${m(`x = ${w}`)}, ${m(`${tName} = ${lAt(w)}`)}`;
      const wrong = [(e2!.b + e1!.b) / (e1!.a - e2!.a), (e2!.b - e1!.b) / (e1!.a + e2!.a), (180 - e1!.b - e2!.b) / (e1!.a + e2!.a)];
      return {
        question: `Find $x$ and $${tName}$.`,
        answer: fmt(x),
        steps: [`The marked sides are congruent: $${linTex(e1!)} = ${linTex(e2!)}$`, m(`x = ${x}`), m(`${tName} = ${linSubTex(e1!, x)} = ${lAt(x)}`)],
        distractors: numChoices(fmt, x, wrong.filter((w) => w > 0 && linVal(e1!, w) > 0 && linVal(e2!, w) > 0)),
        diagram: fig(equi ? 'Equilateral triangle with side expressions' : 'Isosceles triangle with expressions on the congruent legs'),
        check: {
          kind: 'geometry.solve',
          eqs: [`${linTex(e1!)} = ${linTex(e2!)}`, `L = ${linTex(e1!)}`],
          names: { [tName]: 'L' },
          lengths: segs.map(([i, j, e]) => [P[i]!, P[j]!, linTex(e)]),
          given: segs.map(([, , e]) => linTex(e)),
        },
      };
    }
    // angle expressions: base angle at P0 (and apex P2 when hard)
    const bi = rng.int(0, 1);
    angleLabel(b, ...angleTri(bi), linDeg(e1!), { radiusPx: 13 });
    const angles: Array<[Pt, Pt, Pt, string]> = [[...angleTri(bi), linTex(e1!)]];
    let eq: string;
    let steps: string[];
    if (e2) {
      angleLabel(b, ...angleTri(2), linDeg(e2), { radiusPx: 13 });
      angles.push([...angleTri(2), linTex(e2)]);
      eq = equi ? `${linTex(e1!)} = ${linTex(e2)}` : `2(${linTex(e1!)}) + (${linTex(e2)}) = 180`;
      steps = [equi ? 'All angles of an equilateral triangle are congruent:' : 'The base angles are congruent, and the angles add up to $180^\\circ$:', m(eq), m(`x = ${x}`)];
    } else if (equi) {
      eq = `${linTex(e1!)} = 60`;
      steps = ['Each angle of an equilateral triangle measures $60^\\circ$:', m(eq), m(`x = ${x}`)];
    } else {
      const other = 1 - bi;
      angleLabel(b, ...angleTri(other), deg(base), { radiusPx: 13 });
      angles.push([...angleTri(other), String(base)]);
      eq = `${linTex(e1!)} = ${base}`;
      steps = ['The base angles are congruent:', m(eq), m(`x = ${x}`)];
    }
    const tIdx = rng.pick([2, 1 - bi]);
    const tVal = (w: number) => {
      const bv = linVal(e1!, w);
      return tIdx === 2 ? (equi ? bv : 180 - 2 * bv) : bv;
    };
    const tName = angName(tIdx);
    const fmt = (w: number) => (difficulty === 'hard' ? `${m(`x = ${w}`)}, ${m(`${tName} = ${tVal(w)}^\\circ`)}` : m(`${tName} = ${tVal(w)}^\\circ`));
    steps.push(m(`${tName} = ${tVal(x)}^\\circ`));
    const wrong = e2 && !equi ? [(180 - e1!.b - e2.b) / (e1!.a + e2.a), (180 - 2 * e1!.b - e2.b) / (e1!.a + e2.a)] : [(180 - 2 * e1!.b) / (2 * e1!.a), (90 - e1!.b) / e1!.a, (180 - e1!.b) / e1!.a];
    return {
      question: difficulty === 'hard' ? `Find $x$ and $${tName}$.` : `Find $${tName}$.`,
      answer: fmt(x),
      steps,
      distractors: distinctDistractors(fmt(x), wrong.filter((w) => Number.isInteger(w) && w > 0 && w !== x && tVal(w) > 0 && tVal(w) < 180).map(fmt), (k) => {
        const w = x + offset(k);
        return w > 0 && tVal(w) > 0 && tVal(w) < 180 ? fmt(w) : null;
      }),
      diagram: fig(equi ? 'Equilateral triangle' : 'Isosceles triangle with congruent legs marked'),
      check: {
        kind: 'geometry.solve',
        eqs: [eq, tIdx === 2 && !equi ? `L = 180 - 2(${linTex(e1!)})` : `L = ${linTex(e1!)}`],
        names: { [tName]: 'L' },
        angles,
        given: angles.map((a) => a[3]),
      },
    };
  },
});

// ---------------------------------------------------------------- triangle inequality

export const triangleInequality = defineTopic({
  id: 'geo.triangle-inequality',
  subject: 'geometry',
  category: 'Triangles',
  title: 'Triangle Inequalities',
  description: 'The range for the third side of a triangle, and ordering sides and angles by size.',
  instruction: (o) =>
    o.task === 'range' ? 'Two sides of a triangle are given. Find the range of possible lengths of the third side.' : o.task === 'order' ? 'Order the parts of each triangle from least to greatest.' : 'Answer each question about triangle inequalities.',
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Problems',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'range', label: 'Range for the third side' },
        { value: 'order', label: 'Order sides or angles' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const chosen = strOpt(ctx, 'task');
    const task = chosen === 'any' ? rng.pick(['range', 'order']) : chosen;
    if (task === 'range') {
      const hi = difficulty === 'easy' ? 15 : difficulty === 'medium' ? 30 : 60;
      const [a, b] = attempt('ineq', () => {
        let a = rng.int(2, hi);
        let b = rng.int(2, hi);
        if (a === b) return null;
        if (difficulty === 'hard' && rng.bool(0.5)) {
          a += 0.5;
          b += rng.pick([0, 0.5]);
        }
        return [a, b];
      });
      const lo = Math.abs(a - b);
      const up = a + b;
      const f = (l: number, u: number, rel = '<') => m(`${l} ${rel} x ${rel} ${u}`);
      const answer = f(lo, up);
      return {
        question: `Two sides of a triangle measure $${a}$ and $${b}$. Find the range of possible lengths $x$ of the third side.`,
        answer,
        steps: [`The third side must be longer than the difference and shorter than the sum of the other two sides.`, m(`${Math.max(a, b)} - ${Math.min(a, b)} < x < ${a} + ${b}`), answer],
        distractors: distinctDistractors(answer, [f(lo, up, '\\le'), f(Math.min(a, b), Math.max(a, b)), f(0, up), f(lo, Math.max(a, b))], (k) => f(lo, up + k)),
        check: { kind: 'geometry.ineqRange' },
      };
    }
    // order
    const names = letters(rng, 3);
    const tri = `\\triangle ${names.join('')}`;
    const ang = attempt('order', () => {
      const A = rng.int(25, 110);
      const B = rng.int(25, 150 - A);
      const C = 180 - A - B;
      if (C < 20 || new Set([A, B, C]).size < 3 || Math.min(Math.abs(A - B), Math.abs(B - C), Math.abs(A - C)) < 4) return null;
      return [A, B, C];
    });
    const P = place(rng, trianglePts(ang[0]!, ang[1]!));
    const sideOpp = (i: number) => `${names[(i + 1) % 3]}${names[(i + 2) % 3]}`;
    const sideLen = (i: number) => dist(P[(i + 1) % 3]!, P[(i + 2) % 3]!);
    const fromSides = difficulty === 'hard' && rng.bool(0.5);
    const b = drawPolygon(P, names);
    let question: string;
    let order: number[];
    let item: (i: number) => string;
    let steps: string[];
    if (fromSides) {
      // integer side lengths roughly proportional to the true ones
      const s = [0, 1, 2].map((i) => Math.round(sideLen(i) * (20 / Math.max(sideLen(0), sideLen(1), sideLen(2)))));
      if (new Set(s).size < 3) s[s.indexOf(Math.max(...s))]! += 1;
      [0, 1, 2].forEach((i) => b.sideLabel(P[(i + 1) % 3]!, P[(i + 2) % 3]!, String(s[i]), centroid(P)));
      order = [0, 1, 2].sort((i, j) => s[i]! - s[j]!);
      item = (i) => `\\angle ${names[i]}`;
      question = `Order the angles of $${tri}$ from smallest to largest.`;
      steps = [`The smallest angle is opposite the shortest side.`, `Sides: $${order.map((i) => `${sideOpp(i)} = ${s[i]}`).join(' < ')}$`];
      return finishOrder(rng, question, order, item, steps, b, { sides: Object.fromEntries([0, 1, 2].map((i) => [sideOpp(i), s[i]!])) }, names);
    }
    const shown = difficulty === 'easy' ? [0, 1, 2] : rng.sample([0, 1, 2], 2);
    shown.forEach((i) => angleLabel(b, P[i]!, P[(i + 1) % 3]!, P[(i + 2) % 3]!, deg(ang[i]!), { radiusPx: 13 }));
    order = [0, 1, 2].sort((i, j) => ang[i]! - ang[j]!);
    item = (i) => `\\overline{${sideOpp(i)}}`;
    question = `Order the sides of $${tri}$ from shortest to longest.`;
    steps = [];
    if (shown.length < 3) {
      const hid = [0, 1, 2].find((i) => !shown.includes(i))!;
      steps.push(m(`m\\angle ${names[hid]} = 180^\\circ - ${ang[shown[0]!]}^\\circ - ${ang[shown[1]!]}^\\circ = ${ang[hid]}^\\circ`));
    }
    steps.push('The shortest side is opposite the smallest angle.');
    return finishOrder(rng, question, order, item, steps, b, { angles: Object.fromEntries([0, 1, 2].map((i) => [names[i]!, ang[i]!])) }, names);
  },
});

function finishOrder(rng: Rng, question: string, order: number[], item: (i: number) => string, steps: string[], b: DiagramBuilder, facts: Record<string, unknown>, names: string[]): ProblemContent {
  const fmt = (o: number[]) => m(o.map(item).join(', '));
  const answer = fmt(order);
  const perms = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ];
  const rev = [...order].reverse();
  const wrongs = [fmt(rev), ...rng.shuffle(perms).map((p) => fmt(p.map((i) => order[i]!)))];
  steps.push(answer);
  return {
    question,
    answer,
    steps,
    distractors: distinctDistractors(answer, wrongs, () => null),
    diagram: b.build(`Triangle ${names.join('')}`),
    check: { kind: 'geometry.order', ...facts },
  };
}

// ---------------------------------------------------------------- midsegments

export const midsegments = defineTopic({
  id: 'geo.midsegments',
  subject: 'geometry',
  category: 'Triangles',
  title: 'Midsegments of Triangles',
  description: 'A midsegment is parallel to the third side and half as long.',
  instruction: 'Each figure shows a midsegment of a triangle. Find the indicated value.',
  multipleChoice: true,
  defaultCount: 9,
  options: [],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const names = letters(rng, 5);
    const [nA, nB, nC, nD, nE] = names as [string, string, string, string, string];
    const built = attempt('midseg', () => {
      const A = rng.int(35, 100);
      const B = rng.int(35, 145 - A);
      if (180 - A - B < 30) return null;
      const half = rng.int(difficulty === 'easy' ? 3 : 4, difficulty === 'hard' ? 30 : 18);
      const x = rng.int(2, difficulty === 'hard' ? 15 : 10);
      return { A, B, half, x };
    });
    const { half, x } = built;
    // base P0P1 is the third side (length 2·half); D on P2P0, E on P2P1
    const T = trianglePts(built.A, built.B, 2 * half);
    const P = place(rng, T);
    const D = mid(P[2]!, P[0]!);
    const E = mid(P[2]!, P[1]!);
    const b = drawPolygon(P, [nB, nC, nA]);
    b.segment(D, E, { weight: 1.4 });
    const inside = centroid(P);
    nameVertices(b, [D, E], [nD, nE], inside, 9);
    ticks(b, P[2]!, D, 1);
    ticks(b, D, P[0]!, 1);
    ticks(b, P[2]!, E, 2);
    ticks(b, E, P[1]!, 2);
    const third = `${nB}${nC}`;
    const ms = `${nD}${nE}`;
    if (difficulty === 'easy') {
      const findMid = rng.bool();
      const known = findMid ? 2 * half : half;
      const val = findMid ? half : 2 * half;
      b.sideLabel(P[0]!, P[1]!, findMid ? String(known) : 'x', inside);
      b.sideLabel(D, E, findMid ? 'x' : String(known), mid(P[0]!, P[1]!));
      const fmt = (v: number) => m(`x = ${v}`);
      return {
        question: 'Find $x$.',
        answer: fmt(val),
        steps: [`$\\overline{${ms}}$ is a midsegment, so $${ms} = \\frac{1}{2}${third}$.`, m(findMid ? `x = \\frac{1}{2} \\cdot ${known} = ${val}` : `${known} = \\frac{1}{2}x`), ...(findMid ? [] : [m(`x = ${val}`)])],
        distractors: numChoices(fmt, val, findMid ? [2 * known, known, known - 2] : [known / 2, known, known + 2]),
        diagram: b.build(`Triangle ${nA}${nB}${nC} with midsegment ${ms}`),
        check: {
          kind: 'geometry.solve',
          eqs: [findMid ? `2x = ${known}` : `x = 2 \\cdot ${known}`],
          lengths: [[D, E, findMid ? 'x' : String(known)], [P[0]!, P[1]!, findMid ? String(known) : 'x']],
          given: [String(known)],
        },
      };
    }
    const exprs = attempt('midseg-expr', () => {
      const em = linFor(rng, half, x, { aMin: 1, aMax: 5, bMax: 30 });
      const et = difficulty === 'hard' || rng.bool() ? linFor(rng, 2 * half, x, { aMin: 1, aMax: 9, bMax: 40, avoidA: em ? [2 * em.a] : [] }) : null;
      if (!em) return null;
      return { em, et };
    });
    const { em, et } = exprs;
    const tTex = et ? linTex(et) : String(2 * half);
    b.sideLabel(P[0]!, P[1]!, tTex, inside);
    b.sideLabel(D, E, linTex(em), mid(P[0]!, P[1]!));
    const targetMid = rng.bool();
    const tName = targetMid ? ms : third;
    const tVal = (w: number) => (targetMid ? linVal(em, w) : 2 * linVal(em, w));
    const fmt = (w: number) => (difficulty === 'hard' ? `${m(`x = ${w}`)}, ${m(`${tName} = ${tVal(w)}`)}` : m(`${tName} = ${tVal(w)}`));
    const eq = `2(${linTex(em)}) = ${et ? `(${tTex})` : tTex}`;
    const A2 = 2 * em.a - (et?.a ?? 0);
    const B2 = (et?.b ?? 2 * half) - 2 * em.b;
    const wrong = [((et?.b ?? 2 * half) - em.b) / (em.a - (et?.a ?? 0) || 0.5), (2 * (et?.b ?? 2 * half) - em.b) / (em.a - 2 * (et?.a ?? 0) || 0.5), (B2 + 2 * em.b) / A2];
    return {
      question: difficulty === 'hard' ? `Find $x$ and $${tName}$.` : `Find $${tName}$.`,
      answer: fmt(x),
      steps: [`The midsegment is half the third side: $${ms} = \\frac{1}{2}${third}$`, m(eq), m(`${A2 === 1 ? '' : A2 === -1 ? '-' : A2}x = ${B2}`), m(`x = ${x}`), m(`${tName} = ${tVal(x)}`)],
      distractors: distinctDistractors(fmt(x), wrong.filter((w) => Number.isInteger(w) && w > 0 && w !== x && tVal(w) > 0 && (!et || linVal(et, w) > 0)).map(fmt), (k) => {
        const w = x + offset(k);
        return w > 0 && tVal(w) > 0 && (!et || linVal(et, w) > 0) ? fmt(w) : null;
      }),
      diagram: b.build(`Triangle ${nA}${nB}${nC} with midsegment ${ms}`),
      check: {
        kind: 'geometry.solve',
        eqs: [eq, `L = ${targetMid ? linTex(em) : `2(${linTex(em)})`}`],
        names: { [tName]: 'L' },
        lengths: [[D, E, linTex(em)], [P[0]!, P[1]!, tTex]],
        given: [linTex(em), tTex],
      },
    };
  },
});

// ---------------------------------------------------------------- medians and centroids

export const centroids = defineTopic({
  id: 'geo.centroid',
  subject: 'geometry',
  category: 'Triangles',
  title: 'Medians and Centroids',
  description: 'The centroid divides each median 2 : 1; centroid coordinates are the averages of the vertices.',
  instruction: (o) => (o.task === 'coordinates' ? 'Find the coordinates of the centroid of each triangle.' : 'Point G is the centroid of each triangle. Find the indicated value.'),
  multipleChoice: true,
  defaultCount: 9,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Problems',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'segments', label: 'Segment lengths on medians' },
        { value: 'coordinates', label: 'Centroid coordinates' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const chosen = strOpt(ctx, 'task');
    const task = chosen === 'any' ? (rng.bool(0.65) ? 'segments' : 'coordinates') : chosen;
    if (task === 'coordinates') {
      const R = difficulty === 'easy' ? 6 : difficulty === 'medium' ? 9 : 12;
      const V = attempt('centroid-pts', () => {
        const V: Array<[number, number]> = [0, 1, 2].map(() => [rng.int(-R, R), rng.int(-R, R)]);
        const area = (V[1]![0] - V[0]![0]) * (V[2]![1] - V[0]![1]) - (V[2]![0] - V[0]![0]) * (V[1]![1] - V[0]![1]);
        if (Math.abs(area) < 8) return null;
        const sx = V[0]![0] + V[1]![0] + V[2]![0];
        const sy = V[0]![1] + V[1]![1] + V[2]![1];
        const integral = sx % 3 === 0 && sy % 3 === 0;
        if (difficulty !== 'hard' && !integral) return null;
        if (difficulty === 'hard' && integral && rng.bool(0.7)) return null;
        return V;
      });
      const names = letters(rng, 3);
      const G = [new Frac(V[0]![0] + V[1]![0] + V[2]![0], 3), new Frac(V[0]![1] + V[1]![1] + V[2]![1], 3)];
      const fmt = (p: Frac[]) => m(`G${tuple(p)}`);
      const answer = fmt(G);
      const sums = [V[0]![0] + V[1]![0] + V[2]![0], V[0]![1] + V[1]![1] + V[2]![1]];
      const plane = difficulty === 'easy';
      let diagram;
      if (plane) {
        const pl = coordinatePlane({ range: 7, scale: 11, tickEvery: 0 });
        pl.polygon(V.map((v) => [v[0], v[1]] as Pt), { weight: 1.3 });
        V.forEach((v, i) => {
          pl.dot([v[0], v[1]]);
          pl.label([v[0], v[1]], names[i]!, 'ne', { small: true });
        });
        diagram = pl.build(`Triangle ${names.join('')} on a coordinate grid`);
      }
      return {
        question: `$${names.map((n, i) => `${n}${tuple(V[i]!)}`).join(', ')}$`,
        answer,
        steps: [m(`G = \\left(\\frac{${V.map((v) => v[0]).join(' + ').replace(/\+ -/g, '- ')}}{3}, \\frac{${V.map((v) => v[1]).join(' + ').replace(/\+ -/g, '- ')}}{3}\\right)`), answer],
        distractors: distinctDistractors(
          answer,
          [fmt([new Frac(sums[0]!, 2), new Frac(sums[1]!, 2)]), fmt([new Frac(sums[0]!), new Frac(sums[1]!)]), fmt([G[1]!, G[0]!]), fmt([new Frac(V[0]![0] + V[1]![0], 2), new Frac(V[0]![1] + V[1]![1], 2)])],
          (k) => fmt([G[0]!.add(offset(k)), G[1]!]),
        ),
        diagram,
        check: { kind: 'geometry.centroid' },
      };
    }
    // segments on a median: vertex A, midpoint D of the opposite side, centroid G
    const names = letters(rng, 3);
    const [nA, nB, nC] = names as [string, string, string];
    const nD = 'D' === nA || 'D' === nB || 'D' === nC ? 'M' : 'D';
    const built = attempt('median', () => {
      const A = rng.int(40, 95);
      const B = rng.int(40, 140 - A);
      if (180 - A - B < 35) return null;
      return { A, B };
    });
    const P = place(rng, trianglePts(built.A, built.B));
    // median from P2 (vertex A) to midpoint of P0P1
    const Vx = P[2]!;
    const D = mid(P[0]!, P[1]!);
    const G = centroid(P);
    const b = drawPolygon(P, [nB, nC, nA]);
    // all three medians, dashed for the two not used
    b.segment(Vx, D, { weight: 1.2 });
    b.segment(P[0]!, mid(P[1]!, P[2]!), { weight: 0.9, dash: true });
    b.segment(P[1]!, mid(P[0]!, P[2]!), { weight: 0.9, dash: true });
    ticks(b, P[0]!, D, 1);
    ticks(b, D, P[1]!, 1);
    ticks(b, P[1]!, mid(P[1]!, P[2]!), 2, 0.5);
    ticks(b, mid(P[1]!, P[2]!), P[2]!, 2, 0.5);
    ticks(b, P[0]!, mid(P[0]!, P[2]!), 3, 0.5);
    ticks(b, mid(P[0]!, P[2]!), P[2]!, 3, 0.5);
    b.dot(G);
    const nrm = unit([-(D[1] - Vx[1]), D[0] - Vx[0]]);
    b.label(add(G, mul(nrm, b.px(9))), 'G', 'c');
    b.dot(D);
    b.label(add(D, mul(unit(sub(D, G)), b.px(10))), nD, 'c');
    const AG = `${nA}G`;
    const GD = `G${nD}`;
    const AD = `${nA}${nD}`;
    const seg: Record<string, [Pt, Pt]> = { [AG]: [Vx, G], [GD]: [G, D], [AD]: [Vx, D] };
    const factor: Record<string, number> = { [AG]: 2, [GD]: 1, [AD]: 3 };
    const unitLen = rng.int(2, difficulty === 'hard' ? 15 : 10);
    const pair = rng.pick([[AG, GD], [GD, AG], [AD, GD], [GD, AD], [AG, AD], [AD, AG]]) as [string, string];
    const [gName, tName] = pair;
    const val = (n: string) => factor[n]! * unitLen;
    const label = (nm: string, tex: string) => {
      const [p, q] = seg[nm]!;
      if (nm === AD) return; // whole median is described in the question
      b.label(add(mid(p, q), mul(nrm, -b.px(4))), tex, posToward(mul(nrm, -1)));
    };
    if (difficulty === 'easy') {
      const fmt = (v: number) => m(`${tName} = ${v}`);
      label(gName, String(val(gName)));
      return {
        question: `$${gName} = ${val(gName)}$. Find $${tName}$.`,
        answer: fmt(val(tName)),
        steps: [`The centroid is $\\frac{2}{3}$ of the way from the vertex to the midpoint: $${AG} = 2 \\cdot ${GD}$, $${AD} = 3 \\cdot ${GD}$.`, m(`${tName} = ${val(tName)}`)],
        distractors: numChoices(fmt, val(tName), [val(gName) * 2, val(gName) / 2, val(gName) * 3, (val(gName) * 2) / 3, val(gName) / 3]),
        diagram: b.build(`Triangle ${nA}${nB}${nC} with medians meeting at centroid G`),
        check: { kind: 'geometry.solve', names: { [tName]: 'L' }, eqs: [`L / ${factor[tName]} = ${val(gName)} / ${factor[gName]}`], lengths: [[...seg[gName]!, String(val(gName))], [...seg[tName]!, 'L']], given: [`${gName} = ${val(gName)}`] },
      };
    }
    const x = rng.int(2, difficulty === 'hard' ? 12 : 8);
    const [e1, e2] = attempt('median-e', () => {
      const e1 = linFor(rng, val(gName), x, { aMin: 1, aMax: 5, bMax: 30 });
      const e2 = linFor(rng, val(tName), x, { aMin: 1, aMax: 7, bMax: 30 });
      if (!e1 || !e2) return null;
      if (e1.a * factor[tName]! === e2.a * factor[gName]!) return null;
      return [e1, e2];
    });
    label(gName, linTex(e1));
    label(tName, linTex(e2));
    const fmt = (w: number) => (difficulty === 'hard' ? `${m(`x = ${w}`)}, ${m(`${tName} = ${linVal(e2, w)}`)}` : m(`${tName} = ${linVal(e2, w)}`));
    const sc = (k: number, e: Lin) => (k === 1 ? `(${linTex(e)})` : `${k}(${linTex(e)})`);
    const eq = `${sc(factor[tName]!, e1)} = ${sc(factor[gName]!, e2)}`;
    const A2 = factor[tName]! * e1.a - factor[gName]! * e2.a;
    const B2 = factor[gName]! * e2.b - factor[tName]! * e1.b;
    const wrong = [(e2.b - e1.b) / (e1.a - e2.a), (factor[tName]! * e2.b - factor[gName]! * e1.b) / (factor[gName]! * e1.a - factor[tName]! * e2.a), (B2 + 2) / A2];
    const ok = (w: number) => Number.isInteger(w) && w > 0 && w !== x && linVal(e1, w) > 0 && linVal(e2, w) > 0;
    return {
      question: `${m(`${gName} = ${linTex(e1)}`)} and ${m(`${tName} = ${linTex(e2)}`)}. Find ${difficulty === 'hard' ? `$x$ and $${tName}$` : `$${tName}$`}.`,
      answer: fmt(x),
      steps: [`$${AG} = 2 \\cdot ${GD}$ and $${AD} = 3 \\cdot ${GD}$, so`, m(eq), m(`${A2 === 1 ? '' : A2 === -1 ? '-' : A2}x = ${B2}`), m(`x = ${x}`), m(`${tName} = ${linSubTex(e2, x)} = ${linVal(e2, x)}`)],
      distractors: distinctDistractors(fmt(x), wrong.filter(ok).map(fmt), (k) => (ok(x + offset(k)) ? fmt(x + offset(k)) : null)),
      diagram: b.build(`Triangle ${nA}${nB}${nC} with medians meeting at centroid G`),
      check: {
        kind: 'geometry.solve',
        eqs: [eq, `L = ${linTex(e2)}`],
        names: { [tName]: 'L' },
        lengths: [[...seg[gName]!, linTex(e1)], [...seg[tName]!, linTex(e2)]],
        given: [linTex(e1), linTex(e2)],
      },
    };
  },
});

