/** Basics of geometry: segment addition, midpoints, angle addition, classifying angles. */
import { DiagramBuilder, type Pt } from '../../diagram';
import { Frac } from '../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, offset, strOpt } from '../../generator';
import type { Rng } from '../../rng';
import { linear, m, paren, parenNeg, sum, tuple } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { coordinatePlane } from '../../diagram';
import { add, angleLabel, dirDeg, letters, linDeg, linFor, linSubTex, linTex, linVal, mul, nameAt, numChoices, ray, unit, type Lin } from './kit';

// ---------------------------------------------------------------- shared

/** Either a number or a linear expression in x. */
type Q = { k: 'n'; v: number } | { k: 'e'; e: Lin };
const qTex = (q: Q): string => (q.k === 'n' ? String(q.v) : linTex(q.e));
const qPar = (q: Q): string => (q.k === 'n' ? String(q.v) : `(${linTex(q.e)})`);
const qA = (q: Q): number => (q.k === 'n' ? 0 : q.e.a);
const qB = (q: Q): number => (q.k === 'n' ? q.v : q.e.b);
const qAt = (q: Q, x: number): number => (q.k === 'n' ? q.v : linVal(q.e, x));
const qDeg = (q: Q): string => (q.k === 'n' ? `${q.v}^\\circ` : linDeg(q.e));

/** Steps for Σ left = right, solved for x. */
function solveSteps(left: Q[], right: Q, x: number): string[] {
  const A = left.reduce((s, q) => s + qA(q), 0);
  const B = left.reduce((s, q) => s + qB(q), 0);
  const a3 = qA(right);
  const b3 = qB(right);
  const out = [m(`${left.map(qPar).join(' + ')} = ${qTex(right)}`), m(`${linear(A, B)} = ${linear(a3, b3)}`)];
  if (a3 !== 0) out.push(m(`${sum([{ coef: A - a3, sym: 'x' }])} = ${b3 - B}`));
  else if (B !== 0) out.push(m(`${sum([{ coef: A, sym: 'x' }])} = ${b3 - B}`));
  out.push(m(`x = ${x}`));
  return out;
}

/** Wrong x values from typical slips when solving Σ left = right. */
function wrongXs(left: Q[], right: Q): number[] {
  const A = left.reduce((s, q) => s + qA(q), 0);
  const B = left.reduce((s, q) => s + qB(q), 0);
  const a3 = qA(right);
  const b3 = qB(right);
  const out: number[] = [];
  if (A - a3 !== 0) out.push((b3 + B) / (A - a3), (b3 - B) / (A + a3 || 1));
  if (left.length === 2 && qA(left[0]!) !== qA(left[1]!)) out.push((qB(left[1]!) - qB(left[0]!)) / (qA(left[0]!) - qA(left[1]!)));
  if (A !== 0) out.push(b3 / A, (2 * b3 - B) / A);
  return out;
}

// ---------------------------------------------------------------- segment addition

function segmentFigure(names: string[], p: number, q: number, labels: [string, string, string]) {
  const A: Pt = [0, 0];
  const B: Pt = [p, 0];
  const C: Pt = [p + q, 0];
  const b = new DiagramBuilder(230 / (p + q));
  b.segment(A, C, { weight: 1.5 });
  for (const P of [A, B, C]) b.dot(P);
  nameAt(b, A, names[0]!, [0, 1], 10);
  nameAt(b, B, names[1]!, [0, 1], 10);
  nameAt(b, C, names[2]!, [0, 1], 10);
  b.label([p / 2, 0], labels[0], 's');
  b.label([p + q / 2, 0], labels[1], 's');
  const y = -b.px(30);
  b.arrow([0, y], [p + q, y], { both: true, ink: 'muted', weight: 0.8 });
  b.segment([0, y - b.px(4)], [0, y + b.px(4)], { ink: 'muted', weight: 0.8 });
  b.segment([p + q, y - b.px(4)], [p + q, y + b.px(4)], { ink: 'muted', weight: 0.8 });
  b.label([(p + q) / 2, y], labels[2], 's');
  return { fig: b.build(`Segment ${names[0]}${names[2]} with point ${names[1]} between ${names[0]} and ${names[2]}`), A, B, C };
}

export const segmentAddition = defineTopic({
  id: 'geo.segment-addition',
  subject: 'geometry',
  category: 'Basics of Geometry',
  title: 'Segment Addition Postulate',
  description: 'Use AB + BC = AC to find missing segment lengths and solve for x.',
  instruction: 'Find the indicated value. In each problem the middle point lies between the other two.',
  multipleChoice: true,
  defaultCount: 9,
  options: [{ type: 'boolean', id: 'figure', label: 'Show a figure', default: true }],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const names = letters(rng, 3);
    const [P, M, R] = names as [string, string, string];
    const seg = (i: number, j: number) => `${names[i]}${names[j]}`;
    const p0 = attempt('segment', () => {
      const x = rng.int(2, difficulty === 'hard' ? 12 : 9);
      const max = difficulty === 'easy' ? 24 : difficulty === 'medium' ? 45 : 70;
      const p = rng.int(3, max);
      const q = rng.int(3, max);
      if (p / (p + q) < 0.28 || p / (p + q) > 0.72) return null;
      if (difficulty === 'easy') return { x, p, q, parts: [{ k: 'n', v: p }, { k: 'n', v: q }, { k: 'n', v: p + q }] as Q[] };
      const e1 = linFor(rng, p, x, { aMin: 1, aMax: 5, bMax: 30 });
      const e2 = rng.bool(difficulty === 'medium' ? 0.6 : 1) ? linFor(rng, q, x, { aMin: 1, aMax: 5, bMax: 30 }) : null;
      if (!e1) return null;
      const A = e1.a + (e2?.a ?? 0);
      const e3 = difficulty === 'hard' ? linFor(rng, p + q, x, { aMin: 2, aMax: 9, bMax: 40, avoidA: [A] }) : null;
      if (difficulty === 'hard' && !e3) return null;
      const parts: Q[] = [{ k: 'e', e: e1 }, e2 ? { k: 'e', e: e2 } : { k: 'n', v: q }, e3 ? { k: 'e', e: e3 } : { k: 'n', v: p + q }];
      if (rng.bool()) [parts[0], parts[1]] = [parts[1]!, parts[0]!];
      return { x, p: qAt(parts[0]!, x), q: qAt(parts[1]!, x), parts };
    });
    const { x, p, q, parts } = p0;
    const figure = boolOpt(ctx, 'figure');
    const segNames = [seg(0, 1), seg(1, 2), seg(0, 2)];
    const shapeNote = `$${M}$ is between $${P}$ and $${R}$.`;
    const labelsTex = parts.map(qTex) as [string, string, string];
    let question: string;
    let answer: string;
    let steps: string[];
    let distractors: string[];
    let eqs: string[];
    let names2: Record<string, string> = {};

    if (difficulty === 'easy') {
      const unknown = rng.int(0, 2);
      const shown = labelsTex.map((t, i) => (i === unknown ? '?' : t)) as [string, string, string];
      const givens = [0, 1, 2].filter((i) => i !== unknown).map((i) => m(`${segNames[i]} = ${labelsTex[i]}`));
      question = `${shapeNote} ${givens.join(' and ')}. Find $${segNames[unknown]}$.`;
      const val = [p, q, p + q][unknown]!;
      answer = m(`${segNames[unknown]} = ${val}`);
      steps =
        unknown === 2
          ? [m(`${segNames[2]} = ${segNames[0]} + ${segNames[1]}`), m(`${segNames[2]} = ${p} + ${q} = ${p + q}`)]
          : [m(`${segNames[unknown]} = ${segNames[2]} - ${segNames[1 - unknown]}`), m(`${segNames[unknown]} = ${p + q} - ${unknown === 0 ? q : p} = ${val}`)];
      const known = unknown === 0 ? q : p;
      distractors = numChoices((v) => m(`${segNames[unknown]} = ${v}`), val, unknown === 2 ? [Math.abs(p - q), 2 * Math.max(p, q), p + q + 2] : [p + q + known, known, Math.round((p + q) / 2)]);
      names2 = { [segNames[unknown]!]: 'L' };
      const v = (i: number) => (i === unknown ? 'L' : labelsTex[i]!);
      eqs = [`(${v(0)}) + (${v(1)}) = ${v(2)}`];
      const fig = figure ? segmentFigure(names, p, q, shown) : null;
      return {
        question,
        answer,
        steps,
        distractors,
        diagram: fig?.fig,
        check: {
          kind: 'geometry.solve',
          eqs,
          names: names2,
          given: givens.map((g) => g.slice(1, -1)),
          lengths: fig ? [[fig.A, fig.B, v(0)], [fig.B, fig.C, v(1)], [fig.A, fig.C, v(2)]] : undefined,
        },
      };
    }

    const givens = [0, 1, 2].map((i) => m(`${segNames[i]} = ${labelsTex[i]}`));
    const findLen = difficulty === 'hard' ? rng.int(0, 2) : -1;
    question = `${shapeNote} ${givens[0]}, ${givens[1]}, and ${givens[2]}. Find ${findLen >= 0 ? `$x$ and $${segNames[findLen]}$` : '$x$'}.`;
    const lenAt = (w: number) => qAt(parts[findLen]!, w);
    const fmt = (w: number) => (findLen >= 0 ? `${m(`x = ${w}`)}, ${m(`${segNames[findLen]} = ${lenAt(w)}`)}` : m(`x = ${w}`));
    answer = fmt(x);
    steps = [m(`${segNames[0]} + ${segNames[1]} = ${segNames[2]}`), ...solveSteps([parts[0]!, parts[1]!], parts[2]!, x)];
    if (findLen >= 0) {
      const t = parts[findLen]!;
      steps.push(m(t.k === 'n' ? `${segNames[findLen]} = ${t.v}` : `${segNames[findLen]} = ${linSubTex(t.e, x)} = ${lenAt(x)}`));
    }
    distractors = numChoices(fmt, x, wrongXs([parts[0]!, parts[1]!], parts[2]!).filter((w) => w > 0 && [0, 1, 2].every((i) => qAt(parts[i]!, w) > 0)));
    eqs = [`${qPar(parts[0]!)} + ${qPar(parts[1]!)} = ${qPar(parts[2]!)}`];
    if (findLen >= 0) {
      names2 = { [segNames[findLen]!]: 'L' };
      eqs.push(`L = ${qPar(parts[findLen]!)}`);
    }
    const fig = figure ? segmentFigure(names, p, q, labelsTex) : null;
    return {
      question,
      answer,
      steps,
      distractors,
      diagram: fig?.fig,
      check: {
        kind: 'geometry.solve',
        eqs,
        names: names2,
        given: labelsTex,
        lengths: fig ? [[fig.A, fig.B, labelsTex[0]], [fig.B, fig.C, labelsTex[1]], [fig.A, fig.C, labelsTex[2]]] : undefined,
      },
    };
  },
});

// ---------------------------------------------------------------- midpoints

const pt = (p: readonly [number, number] | readonly Frac[]) => tuple(p as readonly number[]);

export const midpointEndpoint = defineTopic({
  id: 'geo.midpoint-endpoint',
  subject: 'geometry',
  category: 'Basics of Geometry',
  title: 'Midpoints and Missing Endpoints',
  description: 'Find a missing endpoint from a midpoint, and use the midpoint of a segment to solve for x.',
  instruction: (o) => (o.task === 'endpoint' ? 'Find the other endpoint of each segment.' : o.task === 'segment' ? 'Find the indicated value.' : 'Find the indicated value or point.'),
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
        { value: 'endpoint', label: 'Missing endpoint (coordinates)' },
        { value: 'segment', label: 'Midpoint of a segment: solve for x' },
      ],
    },
    { type: 'boolean', id: 'graph', label: 'Plot the given points on a grid', default: false },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const chosen = strOpt(ctx, 'task');
    const task = chosen === 'any' ? rng.pick(['endpoint', 'segment']) : chosen;
    if (task === 'endpoint') {
      const graph = boolOpt(ctx, 'graph');
      const R = graph ? 8 : difficulty === 'easy' ? 8 : difficulty === 'medium' ? 12 : 16;
      const halfM = difficulty === 'hard' && !graph;
      const { A, E } = attempt('endpoint', () => {
        const A: [number, number] = [rng.int(-R, R), rng.int(-R, R)];
        const E: [number, number] = [rng.int(-R, R), rng.int(-R, R)];
        if (A[0] === E[0] || A[1] === E[1]) return null;
        if (difficulty === 'easy' && (A[0] < 0 || A[1] < 0 || E[0] < 0 || E[1] < 0) && rng.bool(0.7)) return null;
        const sumOdd = (A[0] + E[0]) % 2 !== 0 || (A[1] + E[1]) % 2 !== 0;
        if (halfM !== sumOdd) return null;
        return { A, E };
      });
      const M = [new Frac(A[0] + E[0], 2), new Frac(A[1] + E[1], 2)];
      const names = letters(rng, 2);
      const [nA, nB] = names as [string, string];
      const question = `The midpoint of $\\overline{${nA}${nB}}$ is $M${pt(M)}$ and one endpoint is $${nA}${pt(A)}$. Find the coordinates of $${nB}$.`;
      const answer = m(`${nB}${pt(E)}`);
      const wrongs = [
        m(`${nB}${pt([new Frac(A[0], 1).add(M[0]!).div(2), new Frac(A[1], 1).add(M[1]!).div(2)])}`),
        m(`${nB}${pt([M[0]!.mul(2).add(A[0]), M[1]!.mul(2).add(A[1])])}`),
        m(`${nB}${pt([new Frac(A[0], 1).mul(2).sub(M[0]!), new Frac(A[1], 1).mul(2).sub(M[1]!)])}`),
        m(`${nB}${pt([E[1], E[0]])}`),
      ];
      const steps = [
        m(`x = 2${paren(M[0]!)} - ${parenNeg(A[0])} = ${E[0]}`),
        m(`y = 2${paren(M[1]!)} - ${parenNeg(A[1])} = ${E[1]}`),
      ];
      let diagram;
      if (graph) {
        const plane = coordinatePlane({ range: 9, scale: 9, tickEvery: 0 });
        plane.dot(A);
        plane.label(A, nA, 'ne', { small: true });
        plane.dot([M[0]!.value, M[1]!.value]);
        plane.label([M[0]!.value, M[1]!.value], 'M', 'ne', { small: true });
        diagram = plane.build(`Endpoint ${nA} at (${A.join(', ')}) and midpoint M on a coordinate grid`);
      }
      return {
        question,
        answer,
        steps,
        distractors: distinctDistractors(answer, wrongs, (k) => m(`${nB}${pt([E[0] + offset(k), E[1] - offset(k)])}`)),
        diagram,
        check: { kind: 'geometry.endpoint' },
      };
    }

    // segment with midpoint M: AM = e1, MB = e2
    const names = letters(rng, 3);
    const [P, Mn, R] = names as [string, string, string];
    const p0 = attempt('midseg', () => {
      const x = rng.int(2, difficulty === 'hard' ? 14 : 9);
      const half = rng.int(5, difficulty === 'easy' ? 30 : 60);
      const e1 = linFor(rng, half, x, { aMin: 1, aMax: difficulty === 'easy' ? 3 : 7, bMax: 40 });
      const e2 = difficulty === 'easy' ? null : linFor(rng, half, x, { aMin: 1, aMax: 7, bMax: 40, avoidA: e1 ? [e1.a] : [] });
      if (!e1 || (difficulty !== 'easy' && !e2)) return null;
      return { x, half, e1, e2 };
    });
    const { x, half, e1, e2 } = p0;
    const left: Q = { k: 'e', e: e1 };
    const right: Q = e2 ? { k: 'e', e: e2 } : { k: 'n', v: half };
    const swap = rng.bool();
    const [qa, qb] = swap ? [right, left] : [left, right];
    const target = difficulty === 'hard' ? rng.pick([`${P}${R}`, `${P}${Mn}`]) : difficulty === 'medium' && rng.bool() ? `${P}${R}` : null;
    const targetVal = (w: number) => (target === `${P}${R}` ? 2 * qAt(qa, w) : qAt(qa, w));
    const fmt = (w: number) => (target ? `${m(`x = ${w}`)}, ${m(`${target} = ${targetVal(w)}`)}` : m(`x = ${w}`));
    const question = `$${Mn}$ is the midpoint of $\\overline{${P}${R}}$. ${m(`${P}${Mn} = ${qTex(qa)}`)} and ${m(`${Mn}${R} = ${qTex(qb)}`)}. Find ${target ? `$x$ and $${target}$` : '$x$'}.`;
    const answer = fmt(x);
    const steps = [m(`${P}${Mn} = ${Mn}${R}`), ...solveSteps([qa], qb, x)];
    if (target) steps.push(m(`${target} = ${target === `${P}${R}` ? `2 \\cdot ${qAt(qa, x)}` : qAt(qa, x)} = ${targetVal(x)}`));
    const wrong: number[] = [];
    const A1 = qA(qa) - qA(qb);
    if (A1 !== 0) wrong.push((qB(qb) + qB(qa)) / A1, (qB(qb) - qB(qa)) / (qA(qa) + qA(qb)), (2 * qB(qb) - qB(qa)) / A1);
    const fig = (() => {
      const b = new DiagramBuilder(230 / (2 * half));
      const A: Pt = [0, 0];
      const Mp: Pt = [half, 0];
      const C: Pt = [2 * half, 0];
      b.segment(A, C, { weight: 1.5 });
      [A, Mp, C].forEach((pp, i) => {
        b.dot(pp);
        nameAt(b, pp, names[i]!, [0, 1], 10);
      });
      const tick = (c: Pt) => b.segment([c[0], -b.px(5)], [c[0], b.px(5)], { weight: 1 });
      tick([half / 2, 0]);
      tick([(3 * half) / 2, 0]);
      b.label([half / 2, -b.px(4)], qTex(qa), 's');
      b.label([(3 * half) / 2, -b.px(4)], qTex(qb), 's');
      return { d: b.build(`Segment ${P}${R} with midpoint ${Mn}`), A, Mp, C };
    })();
    const eqs = [`${qPar(qa)} = ${qPar(qb)}`];
    const nm: Record<string, string> = {};
    if (target) {
      nm[target] = 'L';
      eqs.push(target === `${P}${R}` ? `L = ${qPar(qa)} + ${qPar(qb)}` : `L = ${qPar(qa)}`);
    }
    return {
      question,
      answer,
      steps,
      distractors: numChoices(fmt, x, wrong.filter((w) => w > 0 && qAt(qa, w) > 0 && qAt(qb, w) > 0)),
      diagram: fig.d,
      check: {
        kind: 'geometry.solve',
        eqs,
        names: nm,
        given: [qTex(qa), qTex(qb)],
        lengths: [[fig.A, fig.Mp, qTex(qa)], [fig.Mp, fig.C, qTex(qb)]],
      },
    };
  },
});

// ---------------------------------------------------------------- angle addition

function angleAdditionFigure(rng: Rng, names: string[], p: number, q: number, labels?: [string, string]) {
  const start = rng.int(0, 360 - 1);
  const flip = rng.bool();
  const s = flip ? -1 : 1;
  const V: Pt = [0, 0];
  const R = 1.4;
  const A = mul(dirDeg(start), R);
  const D = mul(dirDeg(start + s * p), R);
  const C = mul(dirDeg(start + s * (p + q)), R);
  const b = new DiagramBuilder(85);
  ray(b, V, A, 0.05);
  ray(b, V, D, 0.05);
  ray(b, V, C, 0.05);
  b.dot(V);
  nameAt(b, V, names[1]!, mul(add(add(unit(A), unit(C)), unit(D)), -1), 10);
  nameAt(b, mul(A, 1.05), names[0]!, A, 8);
  nameAt(b, mul(D, 1.05), names[3]!, D, 8);
  nameAt(b, mul(C, 1.05), names[2]!, C, 8);
  if (labels) {
    angleLabel(b, V, A, D, labels[0], { radiusPx: 18 });
    angleLabel(b, V, D, C, labels[1], { radiusPx: 22 });
  } else {
    b.angleArc(V, A, D, 18);
    b.angleArc(V, D, C, 22);
  }
  return { fig: b.build(`Angle ${names[0]}${names[1]}${names[2]} with ray ${names[1]}${names[3]} in its interior`), V, A, D, C };
}

export const angleAddition = defineTopic({
  id: 'geo.angle-addition',
  subject: 'geometry',
  category: 'Basics of Geometry',
  title: 'Angle Addition Postulate',
  description: 'Use m∠ABD + m∠DBC = m∠ABC and angle bisectors to find angle measures and solve for x.',
  instruction: 'Find the indicated value.',
  multipleChoice: true,
  defaultCount: 9,
  options: [{ type: 'boolean', id: 'bisector', label: 'Include angle bisectors', default: true }],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const nm = letters(rng, 4);
    // A, B (vertex), C, D (interior ray)
    const [A, B, C, D] = [nm[0]!, nm[1]!, nm[2]!, nm[3]!];
    const ang = (p: string, q: string) => `m\\angle ${p}${B}${q}`;
    const names3 = [ang(A, D), ang(D, C), ang(A, C)];
    const bis = boolOpt(ctx, 'bisector') && difficulty !== 'easy' && rng.bool(0.4);
    const p0 = attempt('angle-add', () => {
      const x = rng.int(2, difficulty === 'hard' ? 15 : 10);
      const p = rng.int(difficulty === 'easy' ? 20 : 15, 100);
      const q = bis ? p : rng.int(20, 100);
      if (p + q > 170 || p + q < 40) return null;
      if (difficulty === 'easy') return { x, p, q, parts: [{ k: 'n', v: p }, { k: 'n', v: q }, { k: 'n', v: p + q }] as Q[] };
      const e1 = linFor(rng, p, x, { aMin: 1, aMax: 6, bMax: 40 });
      const e2 = bis || difficulty === 'hard' || rng.bool(0.6) ? linFor(rng, q, x, { aMin: 1, aMax: 6, bMax: 40, avoidA: bis && e1 ? [e1.a] : [] }) : null;
      if (!e1 || ((bis || difficulty === 'hard') && !e2)) return null;
      const A2 = e1.a + (e2?.a ?? 0);
      const e3 = difficulty === 'hard' && !bis ? linFor(rng, p + q, x, { aMin: 2, aMax: 10, bMax: 50, avoidA: [A2] }) : null;
      if (difficulty === 'hard' && !bis && !e3) return null;
      const parts: Q[] = [{ k: 'e', e: e1 }, e2 ? { k: 'e', e: e2 } : { k: 'n', v: q }, e3 ? { k: 'e', e: e3 } : { k: 'n', v: p + q }];
      return { x, p, q, parts };
    });
    const { x, p, q, parts } = p0;
    const degs = parts.map(qDeg);
    const figure = angleAdditionFigure(rng, [A, B, C, D], p, q);
    const angles: Array<[Pt, Pt, Pt, string]> = [
      [figure.A, figure.V, figure.D, qTex(parts[0]!)],
      [figure.D, figure.V, figure.C, qTex(parts[1]!)],
      [figure.A, figure.V, figure.C, qTex(parts[2]!)],
    ];
    if (difficulty === 'easy') {
      const unknown = rng.int(0, 2);
      const val = [p, q, p + q][unknown]!;
      const givens = [0, 1, 2].filter((i) => i !== unknown).map((i) => m(`${names3[i]} = ${degs[i]}`));
      const fmt = (v: number) => m(`${names3[unknown]} = ${v}^\\circ`);
      const known = unknown === 0 ? q : p;
      return {
        question: `${givens.join(' and ')}. Find $${names3[unknown]}$.`,
        answer: fmt(val),
        steps:
          unknown === 2
            ? [m(`${names3[2]} = ${names3[0]} + ${names3[1]}`), m(`${names3[2]} = ${p}^\\circ + ${q}^\\circ = ${p + q}^\\circ`)]
            : [m(`${names3[unknown]} = ${names3[2]} - ${names3[1 - unknown]}`), m(`${names3[unknown]} = ${p + q}^\\circ - ${known}^\\circ = ${val}^\\circ`)],
        distractors: numChoices(fmt, val, unknown === 2 ? [Math.abs(p - q), 180 - p - q, p + q + 10] : [p + q + known, 180 - val, known]),
        diagram: figure.fig,
        check: {
          kind: 'geometry.solve',
          names: { [names3[unknown]!]: 'L' },
          eqs: [`${unknown === 0 ? 'L' : p} + ${unknown === 1 ? 'L' : q} = ${unknown === 2 ? 'L' : p + q}`],
          angles: angles.map((a, i) => (i === unknown ? ([a[0], a[1], a[2], 'L'] as [Pt, Pt, Pt, string]) : a)),
        },
      };
    }
    const target = difficulty === 'hard' || rng.bool(0.4) ? rng.int(0, 2) : -1;
    const tVal = (w: number) => (target === 2 ? qAt(parts[0]!, w) + qAt(parts[1]!, w) : qAt(parts[target]!, w));
    const fmt = (w: number) => (target >= 0 ? `${m(`x = ${w}`)}, ${m(`${names3[target]} = ${tVal(w)}^\\circ`)}` : m(`x = ${w}`));
    let question: string;
    let steps: string[];
    let eqs: string[];
    let wrongs: number[];
    if (bis) {
      question = `$\\overrightarrow{${B}${D}}$ bisects $\\angle ${A}${B}${C}$. ${m(`${names3[0]} = ${degs[0]}`)} and ${m(`${names3[1]} = ${degs[1]}`)}. Find ${target >= 0 ? `$x$ and $${names3[target]}$` : '$x$'}.`;
      steps = [m(`${names3[0]} = ${names3[1]}`), ...solveSteps([parts[0]!], parts[1]!, x)];
      eqs = [`${qPar(parts[0]!)} = ${qPar(parts[1]!)}`];
      wrongs = wrongXs([parts[0]!], { k: 'n', v: 90 }).concat(wrongXs([parts[0]!, parts[1]!], { k: 'n', v: 90 }), wrongXs([parts[0]!, parts[1]!], { k: 'n', v: 180 }));
      const a1 = qA(parts[0]!) - qA(parts[1]!);
      wrongs.push((qB(parts[1]!) + qB(parts[0]!)) / a1);
    } else {
      question = `${m(`${names3[0]} = ${degs[0]}`)}, ${m(`${names3[1]} = ${degs[1]}`)}, and ${m(`${names3[2]} = ${degs[2]}`)}. Find ${target >= 0 ? `$x$ and $${names3[target]}$` : '$x$'}.`;
      steps = [m(`${names3[0]} + ${names3[1]} = ${names3[2]}`), ...solveSteps([parts[0]!, parts[1]!], parts[2]!, x)];
      eqs = [`${qPar(parts[0]!)} + ${qPar(parts[1]!)} = ${qPar(parts[2]!)}`];
      wrongs = wrongXs([parts[0]!, parts[1]!], parts[2]!);
    }
    const names2: Record<string, string> = {};
    if (target >= 0) {
      names2[names3[target]!] = 'L';
      eqs.push(target === 2 ? `L = ${qPar(parts[0]!)} + ${qPar(parts[1]!)}` : `L = ${qPar(parts[target]!)}`);
      steps.push(m(`${names3[target]} = ${tVal(x)}^\\circ`));
    }
    return {
      question,
      answer: fmt(x),
      steps,
      distractors: numChoices(fmt, x, wrongs.filter((w) => w > 0 && parts.every((pp) => qAt(pp, w) > 0))),
      diagram: figure.fig,
      check: {
        kind: 'geometry.solve',
        eqs,
        names: names2,
        given: (bis ? parts.slice(0, 2) : parts).map(qTex),
        angles: bis ? angles.slice(0, 2) : angles,
      },
    };
  },
});

// ---------------------------------------------------------------- classifying angles

type AngleClass = 'Acute' | 'Right' | 'Obtuse' | 'Straight';
const CLASSES: AngleClass[] = ['Acute', 'Right', 'Obtuse', 'Straight'];

function classOf(v: number): AngleClass {
  return v < 90 ? 'Acute' : v === 90 ? 'Right' : v < 180 ? 'Obtuse' : 'Straight';
}

function pickMeasure(rng: Rng, difficulty: Difficulty, fromFigure: boolean): number {
  const kind = rng.weighted<AngleClass>([
    ['Acute', 3],
    ['Obtuse', 3],
    ['Right', 1.2],
    ['Straight', fromFigure ? 0.8 : 0.6],
  ]);
  if (kind === 'Right') return 90;
  if (kind === 'Straight') return 180;
  if (fromFigure) return kind === 'Acute' ? rng.int(15, 72) : rng.int(108, 165);
  if (difficulty === 'hard') {
    const near = rng.bool(0.6);
    if (kind === 'Acute') return near ? rng.pick([89, 88.5, 89.9, 87, 1, 0.5]) : rng.int(5, 89) + rng.pick([0, 0.5]);
    return near ? rng.pick([90.5, 91, 179, 179.5, 92]) : rng.int(91, 179) + rng.pick([0, 0.5]);
  }
  return kind === 'Acute' ? rng.int(5, 85) : rng.int(95, 175);
}

export const classifyAngles = defineTopic({
  id: 'geo.classify-angles',
  subject: 'geometry',
  category: 'Basics of Geometry',
  title: 'Classifying Angles',
  description: 'Classify angles as acute, right, obtuse or straight from a figure or a measure.',
  instruction: 'Classify each angle as acute, right, obtuse, or straight.',
  multipleChoice: true,
  defaultCount: 12,
  options: [
    {
      type: 'select',
      id: 'source',
      label: 'Given',
      default: 'any',
      choices: [
        { value: 'any', label: 'By difficulty (figures, then measures)' },
        { value: 'figure', label: 'A figure' },
        { value: 'measure', label: 'The measure' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const src = strOpt(ctx, 'source');
    const fromFigure = src === 'figure' || (src === 'any' && (difficulty === 'easy' || (difficulty === 'medium' && rng.bool())));
    const v = pickMeasure(rng, difficulty, fromFigure);
    const [P, Q, R] = letters(rng, 3) as [string, string, string];
    const cls = classOf(v);
    const answer = cls;
    const distractors = rng.shuffle(CLASSES.filter((c) => c !== cls));
    const reason =
      cls === 'Right' ? 'The angle measures exactly $90^\\circ$.' : cls === 'Straight' ? 'The angle measures exactly $180^\\circ$ (its sides form a line).' : cls === 'Acute' ? 'The angle measures less than $90^\\circ$.' : 'The angle measures more than $90^\\circ$ and less than $180^\\circ$.';
    if (fromFigure) {
      const start = rng.int(0, 359);
      const s = rng.sign();
      const V: Pt = [0, 0];
      const A = mul(dirDeg(start), 1.3);
      const C = mul(dirDeg(start + s * v), 1.3);
      const b = new DiagramBuilder(70);
      ray(b, V, A, 0.08);
      ray(b, V, C, 0.08);
      b.dot(V);
      if (v === 90) b.rightAngle(V, A, C, 11);
      else if (v === 180) b.arc(V, b.px(16), s > 0 ? start : start - 180, s > 0 ? start + 180 : start);
      else b.angleArc(V, A, C, 16);
      const away = v === 180 ? mul(dirDeg(start - s * 90), 1) : mul(add(unit(A), unit(C)), -1);
      nameAt(b, V, Q, away, 10);
      nameAt(b, mul(A, 1.04), P, A, 8);
      nameAt(b, mul(C, 1.04), R, C, 8);
      return {
        question: `Classify $\\angle ${P}${Q}${R}$.`,
        answer,
        steps: [reason],
        distractors,
        diagram: b.build(`Angle ${P}${Q}${R}`),
        check: { kind: 'geometry.classifyAngle', pts: [A, V, C], right: v === 90, straight: v === 180 },
      };
    }
    return {
      question: `$m\\angle ${P}${Q}${R} = ${v}^\\circ$`,
      answer,
      steps: [reason],
      distractors,
      check: { kind: 'geometry.classifyAngle' },
    };
  },
});

