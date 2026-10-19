/** Parabolas: properties and graphs from an equation, and equations from given features. */
import { plotParam } from '../../../diagram';
import { Frac } from '../../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, strOpt } from '../../../generator';
import type { Rng } from '../../../rng';
import { m, num, scaled, sum, term } from '../../../tex';
import type { Difficulty, ProblemContent } from '../../../types';
import { blankPlane, CATEGORY, dashedLine, fields, fr, generalTex, lcmDen, plane, primitive, ptTex, shiftTex, sqTex } from './common';

type Orient = 'v' | 'h';

/** Vertex (h, k), directed focal distance p: (x − h)² = 4p(y − k) or (y − k)² = 4p(x − h). */
interface Par {
  o: Orient;
  h: Frac;
  k: Frac;
  p: Frac;
}

const aOf = (P: Par): Frac => P.p.mul(4).inv();
const focusOf = (P: Par): [Frac, Frac] => (P.o === 'v' ? [P.h, P.k.add(P.p)] : [P.h.add(P.p), P.k]);
const directrixTex = (P: Par): string => (P.o === 'v' ? `y = ${num(P.k.sub(P.p))}` : `x = ${num(P.h.sub(P.p))}`);
const axisTex = (P: Par): string => (P.o === 'v' ? `x = ${num(P.h)}` : `y = ${num(P.k)}`);
const opensOf = (P: Par): string => (P.o === 'v' ? (P.p.sign > 0 ? 'up' : 'down') : P.p.sign > 0 ? 'right' : 'left');
const vertexTex = (P: Par): string => ptTex(P.h, P.k);

/** `y = \frac{1}{8}(x - 2)^{2} + 3` or `x = -2(y + 1)^{2} - 4`. */
function vertexFormTex(P: Par, a: Frac = aOf(P)): string {
  return P.o === 'v'
    ? `y = ${sum([{ coef: a, sym: sqTex('x', P.h) }, { coef: P.k }])}`
    : `x = ${sum([{ coef: a, sym: sqTex('y', P.k) }, { coef: P.h }])}`;
}

/** `(x - 2)^{2} = 8(y - 3)`. */
function conicFormTex(P: Par): string {
  const [sqV, linV, sqC, linC] = P.o === 'v' ? ['x', 'y', P.h, P.k] : ['y', 'x', P.k, P.h];
  const q = P.p.mul(4);
  const rhs = linC.isZero() ? term(q, linV) : q.eq(1) ? shiftTex(linV, linC) : scaled(q, shiftTex(linV, linC));
  return `${sqTex(sqV, sqC)} = ${rhs}`;
}

const pTex = (P: Par) => `$p = \\frac{1}{4a} = ${num(P.p)}$`;

function propsAnswer(P: Par): string {
  const [fx, fy] = focusOf(P);
  return fields([
    ['Vertex', m(vertexTex(P))],
    ['Focus', m(ptTex(fx, fy))],
    ['Directrix', m(directrixTex(P))],
    ['Axis of symmetry', m(axisTex(P))],
    ['Opens', opensOf(P)],
  ]);
}

function featureSteps(P: Par): string[] {
  const [fx, fy] = focusOf(P);
  return [
    `The parabola opens ${opensOf(P)} because $p ${P.p.sign > 0 ? '>' : '<'} 0$.`,
    `Focus ($p$ units from the vertex along the axis): $${ptTex(fx, fy)}$`,
    `Directrix ($p$ units on the other side of the vertex): $${directrixTex(P)}$; axis of symmetry: $${axisTex(P)}$`,
  ];
}

const A_EXPANDED = [1, 2, 3].map((v) => fr(v)).concat([fr(1, 2)]).flatMap((v) => [v, v.neg()]);
const P_EASY = [1, 2].flatMap((v) => [fr(v), fr(-v)]);
const P_MEDIUM = [fr(1, 4), fr(1, 2), fr(1), fr(3, 2), fr(2), fr(3)].flatMap((v) => [v, v.neg()]);
const P_HARD = [fr(1, 4), fr(1, 2), fr(3, 4), fr(1), fr(3, 2), fr(2), fr(5, 2), fr(3)].flatMap((v) => [v, v.neg()]);

function pickOrient(rng: Rng, choice: string): Orient {
  return choice === 'vertical' ? 'v' : choice === 'horizontal' ? 'h' : rng.bool(0.6) ? 'v' : 'h';
}

/** Focus, vertex and directrix all comfortably inside the ±10 window. */
function fits(P: Par): boolean {
  const lim = 9;
  const [fx, fy] = focusOf(P);
  const d = P.o === 'v' ? P.k.sub(P.p) : P.h.sub(P.p);
  return [P.h, P.k, fx, fy, d].every((v) => Math.abs(v.value) <= lim);
}

type GraphForm = 'vertex' | 'conic' | 'expanded' | 'general';

export const parabolaGraph = defineTopic({
  id: 'alg2.conic.parabola-graph',
  subject: 'algebra2',
  title: 'Properties of Parabolas',
  description: 'Find the vertex, focus, directrix, axis of symmetry and direction of opening of a parabola, and graph it.',
  category: CATEGORY,
  instruction: (o) =>
    o.graph
      ? 'Identify the vertex, focus, directrix, axis of symmetry, and direction of opening of each parabola. Then sketch the graph.'
      : 'Identify the vertex, focus, directrix, axis of symmetry, and direction of opening of each parabola.',
  multipleChoice: true,
  defaultCount: 6,
  options: [
    {
      type: 'select',
      id: 'orientation',
      label: 'Axis of symmetry',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'Vertical and horizontal' },
        { value: 'vertical', label: 'Vertical only (y = …)' },
        { value: 'horizontal', label: 'Horizontal only (x = …)' },
      ],
    },
    {
      type: 'select',
      id: 'form',
      label: 'Equation form',
      default: 'auto',
      choices: [
        { value: 'auto', label: 'By difficulty' },
        { value: 'vertex', label: 'Vertex form' },
        { value: 'general', label: 'General form (complete the square)' },
      ],
    },
    { type: 'boolean', id: 'graph', label: 'Graph the parabola', default: true },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const o = pickOrient(rng, strOpt(ctx, 'orientation'));
    const formOpt = strOpt(ctx, 'form');
    const forms: GraphForm[] =
      formOpt === 'vertex'
        ? difficulty === 'easy'
          ? ['vertex']
          : ['vertex', 'conic']
        : formOpt === 'general'
          ? ['expanded', 'general']
          : { easy: ['vertex'] as GraphForm[], medium: ['vertex', 'conic'] as GraphForm[], hard: ['expanded', 'general'] as GraphForm[] }[difficulty];
    const form = rng.pick(forms);
    const span = difficulty === 'easy' ? 4 : difficulty === 'medium' ? 6 : 5;

    const P = attempt('parabola-graph', () => {
      let p: Frac;
      if (form === 'expanded') {
        p = rng.pick(A_EXPANDED).mul(4).inv();
      } else if (form === 'general') p = rng.pick(P_HARD);
      else p = rng.pick(difficulty === 'easy' ? P_EASY : difficulty === 'medium' ? P_MEDIUM : P_HARD);
      const P: Par = { o, h: fr(rng.int(-span, span)), k: fr(rng.int(-span, span)), p };
      if (difficulty === 'easy' && rng.bool(0.25)) P[rng.bool() ? 'h' : 'k'] = fr(0);
      if (form === 'expanded') {
        const a = aOf(P);
        const lin = P.o === 'v' ? P.h : P.k;
        // integer coefficients in y = ax² + bx + c
        if (!a.mul(lin).mul(2).isInt() || !a.mul(lin).mul(lin).isInt()) return null;
      }
      return fits(P) ? P : null;
    });

    const a = aOf(P);
    const steps: string[] = [];
    let question: string;
    const vf = P.o === 'v' ? 'y = a(x - h)^{2} + k' : 'x = a(y - k)^{2} + h';
    const cf = P.o === 'v' ? '(x - h)^{2} = 4p(y - k)' : '(y - k)^{2} = 4p(x - h)';
    if (form === 'vertex' || form === 'expanded') {
      if (form === 'vertex') question = vertexFormTex(P);
      else {
        const lin = P.o === 'v' ? P.h : P.k;
        const c0 = a.mul(lin).mul(lin).add(P.o === 'v' ? P.k : P.h);
        const [s, t] = P.o === 'v' ? ['x', 'y'] : ['y', 'x'];
        question = `${t} = ${sum([{ coef: a, sym: `${s}^{2}` }, { coef: a.mul(lin).mul(-2), sym: s }, { coef: c0 }])}`;
        steps.push(`Complete the square: $${vertexFormTex(P)}$`);
      }
      steps.push(`Compare with $${vf}$: vertex $${vertexTex(P)}$, $a = ${num(a)}$`);
      steps.push(pTex(P));
    } else {
      if (form === 'conic') question = conicFormTex(P);
      else {
        // (sq − c)² − 4p(lin − d) = 0, scaled to integers
        const [hh, kk] = P.o === 'v' ? [P.h, P.k] : [P.k, P.h];
        const raw = { sq: fr(1), lin1: hh.mul(-2), lin2: P.p.mul(-4), c: hh.mul(hh).add(P.p.mul(4).mul(kk)) };
        const L = lcmDen([raw.lin1, raw.lin2, raw.c]);
        const ints = primitive({ sq: L, lin1: raw.lin1.mul(L).value, lin2: raw.lin2.mul(L).value, c: raw.c.mul(L).value });
        const mult = rng.pick([1, 1, -1, 2]);
        const k = (v: number) => v * mult;
        question =
          P.o === 'v'
            ? `${generalTex({ A: k(ints.sq), C: 0, D: k(ints.lin1), E: k(ints.lin2), F: k(ints.c) })} = 0`
            : `${generalTex({ A: 0, C: k(ints.sq), D: k(ints.lin2), E: k(ints.lin1), F: k(ints.c) }, true)} = 0`;
        steps.push(`Isolate the squared variable and complete the square: $${conicFormTex(P)}$`);
      }
      steps.push(`Compare with $${cf}$: vertex $${vertexTex(P)}$, $4p = ${num(P.p.mul(4))}$, so $p = ${num(P.p)}$`);
    }
    steps.push(...featureSteps(P));

    const answer = propsAnswer(P);
    const flipped: Par = { ...P, p: P.p.neg() };
    const usedA: Par = { ...P, p: a };
    const signs: Par = { ...P, h: P.h.neg(), k: P.k.neg() };
    const distractors = distinctDistractors(answer, [propsAnswer(flipped), propsAnswer(usedA), P.h.isZero() && P.k.isZero() ? null : propsAnswer(signs)], (n) =>
      propsAnswer({ ...P, p: P.p.mul(n + 1) }),
    );

    const graph = boolOpt(ctx, 'graph');
    let diagram;
    let answerDiagram;
    if (graph) {
      diagram = blankPlane();
      const { b, w } = plane();
      const hv = P.h.value;
      const kv = P.k.value;
      const av = a.value;
      if (P.o === 'v') plotParam(b, (t) => hv + t, (t) => kv + av * t * t, -14, 14, w, {}, 560);
      else plotParam(b, (t) => hv + av * t * t, (t) => kv + t, -14, 14, w, {}, 560);
      const [fx, fy] = focusOf(P);
      if (P.o === 'v') dashedLine(b, w, 0, 1, -P.k.sub(P.p).value);
      else dashedLine(b, w, 1, 0, -P.h.sub(P.p).value);
      b.dot([hv, kv]);
      b.dot([fx.value, fy.value], false, 'accent');
      answerDiagram = b.build(`Parabola with vertex (${P.h}, ${P.k}) opening ${opensOf(P)}, focus and dashed directrix`);
    }

    return {
      question: m(question),
      answer,
      steps,
      distractors,
      diagram,
      answerDiagram,
      check: { kind: 'alg2-conics.props', conic: 'parabola' },
    };
  },
});

// ---------------------------------------------------------------- writing equations

type Given = 'focus-directrix' | 'vertex-focus' | 'vertex-directrix' | 'vertex-point';

const A_POINT: Record<Difficulty, Frac[]> = {
  easy: [1, 2, 3].flatMap((v) => [fr(v), fr(-v)]),
  medium: [fr(1, 2), fr(1), fr(2), fr(3), fr(1, 4)].flatMap((v) => [v, v.neg()]),
  hard: [fr(1, 3), fr(2, 3), fr(3, 2), fr(1, 2), fr(3, 4), fr(1, 4), fr(4, 3), fr(5, 2)].flatMap((v) => [v, v.neg()]),
};

export const parabolaWrite = defineTopic({
  id: 'alg2.conic.parabola-write',
  subject: 'algebra2',
  title: 'Writing Equations of Parabolas',
  description: 'Write the vertex-form equation of a parabola from its focus, directrix, vertex or a point.',
  category: CATEGORY,
  instruction: 'Use the information provided to write the vertex form equation of each parabola.',
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'given',
      label: 'Given information',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'Mixed' },
        { value: 'focus-directrix', label: 'Focus and directrix' },
        { value: 'vertex-focus', label: 'Vertex and focus' },
        { value: 'vertex-directrix', label: 'Vertex and directrix' },
        { value: 'vertex-point', label: 'Vertex and a point' },
      ],
    },
    {
      type: 'select',
      id: 'orientation',
      label: 'Axis of symmetry',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'Vertical and horizontal' },
        { value: 'vertical', label: 'Vertical only (y = …)' },
        { value: 'horizontal', label: 'Horizontal only (x = …)' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const o = pickOrient(rng, strOpt(ctx, 'orientation'));
    const g = strOpt(ctx, 'given');
    const given: Given = g === 'mixed' || !g ? rng.pick<Given>(['focus-directrix', 'vertex-focus', 'vertex-directrix', 'vertex-point']) : (g as Given);
    const span = difficulty === 'easy' ? 4 : difficulty === 'medium' ? 6 : 8;
    const steps: string[] = [];
    let question: string;
    let P: Par;
    // swap coordinates for horizontal parabolas: "along" is the axis coordinate
    const pt = (along: Frac, across: Frac) => (o === 'v' ? ptTex(across, along) : ptTex(along, across));
    const lineTex = (v: Frac) => (o === 'v' ? `y = ${num(v)}` : `x = ${num(v)}`);

    if (given === 'vertex-point') {
      const r = attempt('parabola-point', () => {
        const a = rng.pick(A_POINT[difficulty]);
        const across = fr(difficulty === 'easy' && rng.bool(0.4) ? 0 : rng.int(-span, span));
        const along = fr(difficulty === 'easy' && rng.bool(0.4) ? 0 : rng.int(-span, span));
        const d = rng.pick([1, 2, 3, 4].filter((v) => a.mul(v * v).isInt()));
        if (d === undefined) return null;
        const dd = rng.bool() ? d : -d;
        const val = along.add(a.mul(dd * dd));
        if (Math.abs(val.value) > 30 || Math.abs(across.value + dd) > 12) return null;
        return { a, across, along, dd, val };
      });
      P = o === 'v' ? { o, h: r.across, k: r.along, p: r.a.mul(4).inv() } : { o, h: r.along, k: r.across, p: r.a.mul(4).inv() };
      const point = pt(r.val, r.across.add(r.dd));
      question = fields([
        ['Vertex', m(vertexTex(P))],
        ['Axis of symmetry', m(axisTex(P))],
        ['Passes through', m(point)],
      ]);
      const [lhs, sq] = o === 'v' ? ['y', 'x'] : ['x', 'y'];
      const vf = `${lhs} = ${sum([{ coef: 1, sym: `a${sqTex(sq, r.across)}` }, { coef: r.along }])}`;
      steps.push(`Start from $${vf}$`);
      steps.push(`Substitute $${point}$: $${num(r.val)} = ${sum([{ coef: r.dd * r.dd, sym: 'a' }, { coef: r.along }])}$`);
      steps.push(`$a = ${num(r.a)}$`);
    } else {
      P = attempt('parabola-write', () => {
        let p: Frac;
        if (difficulty === 'hard') p = rng.pick([fr(1, 8), fr(1, 4), fr(3, 8), fr(1, 2), fr(3, 4), fr(3, 2), fr(5, 2), fr(2), fr(3)].flatMap((v) => [v, v.neg()]));
        else p = fr(rng.signedInt(1, difficulty === 'easy' ? 3 : 4, true));
        const atOrigin = difficulty === 'easy' && rng.bool(0.5);
        const h = fr(atOrigin ? 0 : rng.int(-span, span));
        const k = fr(atOrigin ? 0 : rng.int(-span, span));
        const Q: Par = { o, h, k, p };
        if (given === 'focus-directrix' && difficulty === 'hard' && rng.bool(0.5)) {
          // focus and directrix an odd distance apart: fractional vertex
          const half = fr(rng.signedInt(1, 5, true), 2);
          const shift = fr(1, 2);
          const Q2: Par = o === 'v' ? { o, h, k: k.add(shift), p: half } : { o, h: h.add(shift), k, p: half };
          return Math.abs(focusOf(Q2)[o === 'v' ? 1 : 0].value) <= 12 ? Q2 : null;
        }
        if (given === 'focus-directrix' && !focusOf(Q).every((c) => c.isInt())) return null;
        const along = o === 'v' ? k : h;
        return Math.abs(along.add(p).value) <= 12 && Math.abs(along.sub(p).value) <= 12 ? Q : null;
      });
      const along = o === 'v' ? P.k : P.h;
      const [fx, fy] = focusOf(P);
      const F = ptTex(fx, fy);
      const D = lineTex(along.sub(P.p));
      if (given === 'focus-directrix') {
        question = fields([
          ['Focus', m(F)],
          ['Directrix', m(D)],
        ]);
        steps.push(`The vertex is halfway between the focus and the directrix: $${vertexTex(P)}$`);
        steps.push(`$p$ is the directed distance from the vertex to the focus: $p = ${num(P.p)}$`);
      } else if (given === 'vertex-focus') {
        question = fields([
          ['Vertex', m(vertexTex(P))],
          ['Focus', m(F)],
        ]);
        steps.push(`$p$ is the directed distance from the vertex to the focus: $p = ${num(P.p)}$`);
      } else {
        question = fields([
          ['Vertex', m(vertexTex(P))],
          ['Directrix', m(D)],
        ]);
        steps.push(`$p$ is the directed distance from the directrix to the vertex: $p = ${num(P.p)}$`);
      }
      steps.push(`$a = \\frac{1}{4p} = ${num(aOf(P))}$`);
    }
    const answer = m(vertexFormTex(P));
    steps.push(answer);

    const a = aOf(P);
    const swapped: Par = { ...P, o: P.o === 'v' ? 'h' : 'v' };
    const signErr: Par = !P.h.isZero() ? { ...P, h: P.h.neg() } : !P.k.isZero() ? { ...P, k: P.k.neg() } : swapped;
    const distractors = distinctDistractors(
      answer,
      [m(vertexFormTex(P, P.p.mul(4))), m(vertexFormTex(P, a.neg())), m(vertexFormTex(signErr)), m(vertexFormTex(swapped))],
      (n) => m(vertexFormTex(P, a.mul(n + 1))),
    );
    return {
      question,
      answer,
      steps,
      distractors,
      check: { kind: 'alg2-conics.write', conic: 'parabola' },
    };
  },
});
