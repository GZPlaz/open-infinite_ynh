/** Hyperbolas: features and graphs from an equation, and equations from given features. */
import { plotParam } from '../../../diagram';
import { Frac } from '../../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, offset, strOpt } from '../../../generator';
import type { Rng } from '../../../rng';
import { linear, m, num, sum } from '../../../tex';
import type { Difficulty, ProblemContent } from '../../../types';
import { blankPlane, CATEGORY, dashedLine, fields, fr, generalTex, overTex, plane, primitive, ptTex, rootTex, shiftTex } from './common';
import { andTex, pairTex } from './ellipses';

/** t = 'x': (x − h)²/A − (y − k)²/B = 1;  t = 'y': (y − k)²/A − (x − h)²/B = 1. a² = A, b² = B. */
interface Hyp {
  h: Frac;
  k: Frac;
  t: 'x' | 'y';
  A: number;
  B: number;
}

const hyperbolaTex = (e: Hyp) =>
  e.t === 'x' ? `${overTex('x', e.h, e.A)} - ${overTex('y', e.k, e.B)} = 1` : `${overTex('y', e.k, e.A)} - ${overTex('x', e.h, e.B)} = 1`;

/** Asymptote slope |b/a| (horizontal) or |a/b| (vertical), when a and b are integers. */
function slopeOf(e: Hyp): Frac {
  const a = Math.round(Math.sqrt(e.A));
  const b = Math.round(Math.sqrt(e.B));
  return e.t === 'x' ? new Frac(b, a) : new Frac(a, b);
}

const asymTex = (e: Hyp, s: Frac) => [s, s.neg()].map((v) => `y = ${linear(v, e.k.sub(v.mul(e.h)))}`) as [string, string];

interface PropsOpts {
  c2?: number;
  slope?: Frac;
}

function propsAnswer(e: Hyp, o: PropsOpts = {}): string {
  return fields([
    ['Center', m(ptTex(e.h, e.k))],
    ['Vertices', andTex(pairTex(e.h, e.k, e.t, e.A))],
    ['Foci', andTex(pairTex(e.h, e.k, e.t, o.c2 ?? e.A + e.B))],
    ['Asymptotes', andTex(asymTex(e, o.slope ?? slopeOf(e)))],
  ]);
}

function pickOrient(rng: Rng, o: string): 'x' | 'y' {
  return o === 'horizontal' ? 'x' : o === 'vertical' ? 'y' : rng.bool() ? 'x' : 'y';
}

function pickGraph(rng: Rng, d: Difficulty, orient: string): Hyp {
  return attempt('hyperbola', () => {
    const a = rng.int(1, d === 'easy' ? 5 : 6);
    const b = rng.int(1, d === 'easy' ? 5 : 6);
    const t = pickOrient(rng, orient);
    const span = d === 'easy' ? 3 : 5;
    const atOrigin = d === 'easy' && rng.bool(0.4);
    const h = atOrigin ? 0 : rng.int(-span, span);
    const k = atOrigin ? 0 : rng.int(-span, span);
    const along = t === 'x' ? h : k;
    if (Math.abs(along) + a > 8 || (a === 1 && b === 1 && d !== 'easy')) return null;
    return { h: fr(h), k: fr(k), t, A: a * a, B: b * b };
  });
}

const orientationOpt = {
  type: 'select' as const,
  id: 'orientation',
  label: 'Transverse axis',
  default: 'mixed',
  choices: [
    { value: 'mixed', label: 'Horizontal and vertical' },
    { value: 'horizontal', label: 'Horizontal only' },
    { value: 'vertical', label: 'Vertical only' },
  ],
};

export const hyperbolaGraph = defineTopic({
  id: 'alg2.conic.hyperbola-graph',
  subject: 'algebra2',
  title: 'Graphing Hyperbolas',
  description: 'Find the center, vertices, foci and asymptotes of a hyperbola, and graph both branches.',
  category: CATEGORY,
  instruction: (o) =>
    o.graph
      ? 'Identify the center, vertices, foci, and equations of the asymptotes of each hyperbola. Then sketch the graph.'
      : 'Identify the center, vertices, foci, and equations of the asymptotes of each hyperbola.',
  multipleChoice: true,
  defaultCount: 6,
  options: [
    orientationOpt,
    {
      type: 'select',
      id: 'form',
      label: 'Equation form',
      default: 'auto',
      choices: [
        { value: 'auto', label: 'By difficulty' },
        { value: 'standard', label: 'Standard form' },
        { value: 'general', label: 'General form (complete the square)' },
      ],
    },
    { type: 'boolean', id: 'graph', label: 'Graph the hyperbola', default: true },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const formOpt = strOpt(ctx, 'form');
    const general = formOpt === 'general' || (formOpt !== 'standard' && difficulty === 'hard');
    const e = pickGraph(rng, difficulty, strOpt(ctx, 'orientation'));
    const { A, B } = e;
    const h = e.h.value;
    const k = e.k.value;
    const a = Math.sqrt(A);
    const b = Math.sqrt(B);
    const c2 = A + B;
    const s = slopeOf(e);
    const steps: string[] = [];
    let question: string;
    if (!general) question = hyperbolaTex(e);
    else {
      const co =
        e.t === 'x'
          ? primitive({ A: B, C: -A, D: -2 * B * h, E: 2 * A * k, F: B * h * h - A * k * k - A * B }, false)
          : primitive({ A: -A, C: B, D: 2 * A * h, E: -2 * B * k, F: B * k * k - A * h * h - A * B }, false);
      question = `${generalTex(co, e.t === 'y')} = 0`;
      const g = Math.abs(B / (e.t === 'x' ? co.A : co.C));
      const lead = e.t === 'x' ? [{ coef: B / g, sym: overTex('x', e.h, 1) }, { coef: -A / g, sym: overTex('y', e.k, 1) }] : [{ coef: B / g, sym: overTex('y', e.k, 1) }, { coef: -A / g, sym: overTex('x', e.h, 1) }];
      steps.push(`Group and complete the square: $${sum(lead)} = ${(A * B) / g}$`);
      steps.push(`Divide both sides by $${(A * B) / g}$: $${hyperbolaTex(e)}$`);
    }
    steps.push(`Center $${ptTex(e.h, e.k)}$; the positive term contains $${e.t}$, so the transverse axis is ${e.t === 'x' ? 'horizontal' : 'vertical'}.`);
    steps.push(`$a = ${a}$, $b = ${b}$, $c = \\sqrt{a^{2} + b^{2}} = \\sqrt{${c2}}${rootTex(c2) === `\\sqrt{${c2}}` ? '' : ` = ${rootTex(c2)}`}$`);
    steps.push(`Asymptotes: $${shiftTex('y', e.k)} = \\pm ${s.eq(1) ? '' : num(s)}${e.h.isZero() ? 'x' : `(${shiftTex('x', e.h)})`}$`);

    const answer = propsAnswer(e);
    const distractors = distinctDistractors(
      answer,
      [
        a !== b ? propsAnswer(e, { slope: s.inv() }) : null,
        A !== B ? propsAnswer(e, { c2: Math.abs(A - B) }) : null,
        propsAnswer({ ...e, t: e.t === 'x' ? 'y' : 'x' }),
        h !== 0 || k !== 0 ? propsAnswer({ ...e, h: e.h.neg(), k: e.k.neg() }) : null,
      ],
      (n) => (c2 + offset(n) > 0 ? propsAnswer(e, { c2: c2 + offset(n) }) : null),
    );

    let diagram;
    let answerDiagram;
    if (boolOpt(ctx, 'graph')) {
      diagram = blankPlane();
      const { b: bd, w } = plane();
      for (const sg of [-1, 1]) {
        if (e.t === 'x') plotParam(bd, (u) => h + sg * a * Math.cosh(u), (u) => k + b * Math.sinh(u), -3.5, 3.5, w, {}, 400);
        else plotParam(bd, (u) => h + b * Math.sinh(u), (u) => k + sg * a * Math.cosh(u), -3.5, 3.5, w, {}, 400);
      }
      for (const v of [s, s.neg()]) dashedLine(bd, w, v.value, -1, k - v.value * h);
      bd.dot([h, k]);
      answerDiagram = bd.build(`Hyperbola centered at (${h}, ${k}) opening ${e.t === 'x' ? 'left and right' : 'up and down'}, with dashed asymptotes`);
    }
    return {
      question: m(question),
      answer,
      steps,
      distractors,
      diagram,
      answerDiagram,
      check: { kind: 'alg2-conics.props', conic: 'hyperbola' },
    };
  },
});

// ---------------------------------------------------------------- writing equations

type Given = 'vertices-foci' | 'center-vertex-focus' | 'vertices-conjugate' | 'vertices-asymptotes';

export const hyperbolaWrite = defineTopic({
  id: 'alg2.conic.hyperbola-write',
  subject: 'algebra2',
  title: 'Writing Equations of Hyperbolas',
  description: 'Write the standard-form equation of a hyperbola from its vertices, foci, conjugate axis or asymptotes.',
  category: CATEGORY,
  instruction: 'Use the information provided to write the standard form equation of each hyperbola.',
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
        { value: 'vertices-foci', label: 'Vertices and foci' },
        { value: 'center-vertex-focus', label: 'Center, a vertex and a focus' },
        { value: 'vertices-conjugate', label: 'Vertices and conjugate axis length' },
        { value: 'vertices-asymptotes', label: 'Vertices and asymptotes' },
      ],
    },
    orientationOpt,
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const g = strOpt(ctx, 'given');
    const pool: Given[] = difficulty === 'easy' ? ['vertices-foci', 'vertices-conjugate'] : ['vertices-foci', 'center-vertex-focus', 'vertices-conjugate', 'vertices-asymptotes'];
    const given: Given = g === 'mixed' || !g ? rng.pick(pool) : (g as Given);
    const t = pickOrient(rng, strOpt(ctx, 'orientation'));
    const span = difficulty === 'easy' ? 0 : difficulty === 'medium' ? 6 : 9;
    const h = fr(rng.int(-span, span));
    const k = fr(rng.int(-span, span));
    const max = difficulty === 'hard' ? 12 : 8;
    const usesFoci = given === 'vertices-foci' || given === 'center-vertex-focus';
    const r = attempt('hyperbola-write', () => {
      const a = rng.int(1, max - 1);
      if (usesFoci) {
        const c = rng.int(a + 1, max + 1);
        return { a, b2: c * c - a * a, c, b: 0 };
      }
      const b = rng.int(1, max);
      return a === b && rng.bool(0.7) ? null : { a, b2: b * b, c: 0, b };
    });
    const { a, b2, c } = r;
    const a2 = a * a;
    const e: Hyp = { h, k, t, A: a2, B: b2 };
    const vs = pairTex(h, k, t, a2);
    const fs = pairTex(h, k, t, c * c);
    const steps: string[] = [];
    let question: string;
    if (given === 'vertices-foci') {
      question = fields([
        ['Vertices', andTex(vs)],
        ['Foci', andTex(fs)],
      ]);
      steps.push(`Center (midpoint of the vertices): $${ptTex(h, k)}$; $a = ${a}$, $c = ${c}$`);
    } else if (given === 'center-vertex-focus') {
      const s = rng.bool() ? 1 : 0;
      question = fields([
        ['Center', m(ptTex(h, k))],
        ['Vertex', m(vs[s]!)],
        ['Focus', m(fs[rng.bool() ? s : 1 - s]!)],
      ]);
      steps.push(`$a$ = distance from the center to the vertex $= ${a}$; $c$ = distance from the center to the focus $= ${c}$`);
    } else if (given === 'vertices-conjugate') {
      question = fields([
        ['Vertices', andTex(vs)],
        ['Conjugate axis length', m(String(2 * r.b))],
      ]);
      steps.push(`Center (midpoint of the vertices): $${ptTex(h, k)}$; $a = ${a}$; $2b = ${2 * r.b}$ so $b = ${r.b}$`);
    } else {
      const s = slopeOf(e);
      question = fields([
        ['Vertices', andTex(vs)],
        ['Asymptotes', andTex(asymTex(e, s))],
      ]);
      steps.push(`Center (midpoint of the vertices): $${ptTex(h, k)}$; $a = ${a}$`);
      steps.push(`The asymptote slopes are $\\pm ${t === 'x' ? '\\frac{b}{a}' : '\\frac{a}{b}'} = \\pm ${num(s)}$, so $b = ${r.b}$`);
    }
    if (usesFoci) steps.push(`$b^{2} = c^{2} - a^{2} = ${c * c} - ${a2} = ${b2}$`);
    steps.push(`The transverse axis is ${t === 'x' ? 'horizontal' : 'vertical'}, so the $${t}$-term is positive with $a^{2} = ${a2}$ under it.`);
    const answer = m(hyperbolaTex(e));
    steps.push(answer);

    const distractors = distinctDistractors(
      answer,
      [
        m(hyperbolaTex({ ...e, t: t === 'x' ? 'y' : 'x' })),
        a2 !== b2 ? m(hyperbolaTex({ ...e, A: b2, B: a2 })) : null,
        usesFoci ? m(hyperbolaTex({ ...e, B: c * c + a2 })) : r.b > 1 ? m(hyperbolaTex({ ...e, B: r.b })) : null,
        !h.isZero() || !k.isZero() ? m(hyperbolaTex({ ...e, h: h.neg(), k: k.neg() })) : null,
      ],
      (n) => (b2 + offset(n) > 0 ? m(hyperbolaTex({ ...e, B: b2 + offset(n) })) : null),
    );
    return {
      question,
      answer,
      steps,
      distractors,
      check: { kind: 'alg2-conics.write', conic: 'hyperbola' },
    };
  },
});
