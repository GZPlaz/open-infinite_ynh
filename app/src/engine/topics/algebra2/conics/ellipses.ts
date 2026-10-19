/** Ellipses: features and graphs from an equation, and equations from given features. */
import { plotParam } from '../../../diagram';
import { Frac } from '../../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, offset, strOpt } from '../../../generator';
import type { Rng } from '../../../rng';
import { m, num, sum } from '../../../tex';
import type { Difficulty, ProblemContent } from '../../../types';
import { blankPlane, CATEGORY, fields, fr, generalTex, overTex, plane, plusRoot, primitive, ptTex, rootTex } from './common';

/** (x − h)²/X + (y − k)²/Y = 1 */
interface Ell {
  h: Frac;
  k: Frac;
  X: number;
  Y: number;
}

export const ellipseTex = (e: Ell) => `${overTex('x', e.h, e.X)} + ${overTex('y', e.k, e.Y)} = 1`;

/** The two points center ± √sq along an axis, smaller first. */
export function pairTex(h: Frac, k: Frac, along: 'x' | 'y', sq: number): [string, string] {
  const one = (s: 1 | -1) => (along === 'x' ? ptTex(plusRoot(h, s, sq), num(k)) : ptTex(num(h), plusRoot(k, s, sq)));
  return [one(-1), one(1)];
}

export const andTex = ([p, q]: [string, string]) => `${m(p)} and ${m(q)}`;

/** 2√sq in simplest form. */
export const doubleRootTex = (sq: number) => rootTex(4 * sq);

interface PropsOpts {
  c2?: number;
  half?: boolean;
}

function propsAnswer(e: Ell, o: PropsOpts = {}): string {
  const wide = e.X > e.Y;
  const a2 = Math.max(e.X, e.Y);
  const b2 = Math.min(e.X, e.Y);
  const c2 = o.c2 ?? a2 - b2;
  const major = wide ? 'x' : 'y';
  const minor = wide ? 'y' : 'x';
  return fields([
    ['Center', m(ptTex(e.h, e.k))],
    ['Vertices', andTex(pairTex(e.h, e.k, major, a2))],
    ['Co-vertices', andTex(pairTex(e.h, e.k, minor, b2))],
    ['Foci', andTex(pairTex(e.h, e.k, major, c2))],
    ['Major axis length', m(o.half ? rootTex(a2) : doubleRootTex(a2))],
    ['Minor axis length', m(o.half ? rootTex(b2) : doubleRootTex(b2))],
  ]);
}

function pickGraphEllipse(rng: Rng, d: Difficulty, orient: string): Ell {
  return attempt('ellipse', () => {
    const a = rng.int(2, d === 'easy' ? 6 : 8);
    const b = rng.int(1, a - 1);
    const wide = orient === 'horizontal' ? true : orient === 'vertical' ? false : rng.bool();
    const [rx, ry] = wide ? [a, b] : [b, a];
    const span = d === 'easy' ? 3 : 6;
    const atOrigin = d === 'easy' && rng.bool(0.4);
    const h = atOrigin ? 0 : rng.int(-span, span);
    const k = atOrigin ? 0 : rng.int(-span, span);
    if (Math.abs(h) + rx > 10 || Math.abs(k) + ry > 10) return null;
    return { h: fr(h), k: fr(k), X: rx * rx, Y: ry * ry };
  });
}

const orientationOpt = {
  type: 'select' as const,
  id: 'orientation',
  label: 'Major axis',
  default: 'mixed',
  choices: [
    { value: 'mixed', label: 'Horizontal and vertical' },
    { value: 'horizontal', label: 'Horizontal only' },
    { value: 'vertical', label: 'Vertical only' },
  ],
};

export const ellipseGraph = defineTopic({
  id: 'alg2.conic.ellipse-graph',
  subject: 'algebra2',
  title: 'Graphing Ellipses',
  description: 'Find the center, vertices, co-vertices, foci and axis lengths of an ellipse, and graph it.',
  category: CATEGORY,
  instruction: (o) =>
    o.graph
      ? 'Identify the center, vertices, co-vertices, foci, length of the major axis, and length of the minor axis of each ellipse. Then sketch the graph.'
      : 'Identify the center, vertices, co-vertices, foci, length of the major axis, and length of the minor axis of each ellipse.',
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
    { type: 'boolean', id: 'graph', label: 'Graph the ellipse', default: true },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const formOpt = strOpt(ctx, 'form');
    const general = formOpt === 'general' || (formOpt !== 'standard' && difficulty === 'hard');
    const e = pickGraphEllipse(rng, difficulty, strOpt(ctx, 'orientation'));
    const { X, Y } = e;
    const h = e.h.value;
    const k = e.k.value;
    const wide = X > Y;
    const a2 = Math.max(X, Y);
    const b2 = Math.min(X, Y);
    const c2 = a2 - b2;
    const steps: string[] = [];
    let question: string;
    if (!general) question = ellipseTex(e);
    else {
      const co = primitive({ A: Y, C: X, D: -2 * Y * h, E: -2 * X * k, F: Y * h * h + X * k * k - X * Y });
      question = `${generalTex(co)} = 0`;
      const g = Y / co.A;
      steps.push(`Group and complete the square: $${sum([{ coef: co.A, sym: overTex('x', e.h, 1) }, { coef: co.C, sym: overTex('y', e.k, 1) }])} = ${(X * Y) / g}$`);
      steps.push(`Divide both sides by $${(X * Y) / g}$: $${ellipseTex(e)}$`);
    }
    steps.push(`Center $${ptTex(e.h, e.k)}$; the larger denominator is under $${wide ? 'x' : 'y'}$, so the major axis is ${wide ? 'horizontal' : 'vertical'}.`);
    steps.push(`$a = \\sqrt{${a2}} = ${rootTex(a2)}$, $b = \\sqrt{${b2}} = ${rootTex(b2)}$, $c = \\sqrt{a^{2} - b^{2}} = \\sqrt{${c2}}${rootTex(c2) === `\\sqrt{${c2}}` ? '' : ` = ${rootTex(c2)}`}$`);
    steps.push(`Major axis length $2a = ${doubleRootTex(a2)}$, minor axis length $2b = ${doubleRootTex(b2)}$`);

    const answer = propsAnswer(e);
    const distractors = distinctDistractors(
      answer,
      [
        propsAnswer(e, { c2: a2 + b2 }),
        propsAnswer({ ...e, X: Y, Y: X }),
        propsAnswer(e, { half: true }),
        h !== 0 || k !== 0 ? propsAnswer({ ...e, h: e.h.neg(), k: e.k.neg() }) : null,
      ],
      (n) => (c2 + offset(n) > 0 ? propsAnswer(e, { c2: c2 + offset(n) }) : null),
    );

    let diagram;
    let answerDiagram;
    if (boolOpt(ctx, 'graph')) {
      diagram = blankPlane();
      const { b, w } = plane();
      const rx = Math.sqrt(X);
      const ry = Math.sqrt(Y);
      plotParam(b, (t) => h + rx * Math.cos(t), (t) => k + ry * Math.sin(t), 0, 2 * Math.PI, w, {}, 240);
      b.dot([h, k]);
      const c = Math.sqrt(c2);
      for (const s of [-1, 1]) b.dot(wide ? [h + s * c, k] : [h, k + s * c], false, 'accent');
      answerDiagram = b.build(`Ellipse centered at (${h}, ${k}) with ${wide ? 'horizontal' : 'vertical'} major axis; foci marked`);
    }
    return {
      question: m(question),
      answer,
      steps,
      distractors,
      diagram,
      answerDiagram,
      check: { kind: 'alg2-conics.props', conic: 'ellipse' },
    };
  },
});

// ---------------------------------------------------------------- writing equations

type Given = 'vertices-covertices' | 'vertices-foci' | 'center-vertex-focus' | 'foci-major';

export const ellipseWrite = defineTopic({
  id: 'alg2.conic.ellipse-write',
  subject: 'algebra2',
  title: 'Writing Equations of Ellipses',
  description: 'Write the standard-form equation of an ellipse from its vertices, co-vertices, foci or axis lengths.',
  category: CATEGORY,
  instruction: 'Use the information provided to write the standard form equation of each ellipse.',
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
        { value: 'vertices-covertices', label: 'Vertices and co-vertices' },
        { value: 'vertices-foci', label: 'Vertices and foci' },
        { value: 'center-vertex-focus', label: 'Center, a vertex and a focus' },
        { value: 'foci-major', label: 'Foci and major axis length' },
      ],
    },
    orientationOpt,
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const g = strOpt(ctx, 'given');
    const pool: Given[] = difficulty === 'easy' ? ['vertices-covertices', 'vertices-foci'] : ['vertices-covertices', 'vertices-foci', 'center-vertex-focus', 'foci-major'];
    const given: Given = g === 'mixed' || !g ? rng.pick(pool) : (g as Given);
    const orient = strOpt(ctx, 'orientation');
    const wide = orient === 'horizontal' ? true : orient === 'vertical' ? false : rng.bool();
    const span = difficulty === 'easy' ? 0 : difficulty === 'medium' ? 6 : 9;
    const h = fr(rng.int(-span, span));
    const k = fr(rng.int(-span, span));
    const aMax = difficulty === 'hard' ? 12 : 9;
    const usesFoci = given !== 'vertices-covertices';
    const { a, other } = attempt('ellipse-write', () => {
      const a = rng.int(2, aMax);
      const other = rng.int(1, a - 1); // b, or c when foci are given
      return { a, other };
    });
    const a2 = a * a;
    const b2 = usesFoci ? a2 - other * other : other * other;
    const c = usesFoci ? other : 0;
    const e: Ell = wide ? { h, k, X: a2, Y: b2 } : { h, k, X: b2, Y: a2 };
    const major = wide ? 'x' : 'y';
    const minor = wide ? 'y' : 'x';
    const vs = pairTex(h, k, major, a2);
    const fs = pairTex(h, k, major, c * c);
    const steps: string[] = [];
    let question: string;
    if (given === 'vertices-covertices') {
      question = fields([
        ['Vertices', andTex(vs)],
        ['Co-vertices', andTex(pairTex(h, k, minor, b2))],
      ]);
      steps.push(`Center (midpoint of the vertices): $${ptTex(h, k)}$; $a = ${a}$, $b = ${other}$`);
    } else {
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
      } else {
        question = fields([
          ['Foci', andTex(fs)],
          ['Major axis length', m(String(2 * a))],
        ]);
        steps.push(`Center (midpoint of the foci): $${ptTex(h, k)}$; $2a = ${2 * a}$ so $a = ${a}$; $c = ${c}$`);
      }
      steps.push(`$b^{2} = a^{2} - c^{2} = ${a2} - ${c * c} = ${b2}$`);
    }
    steps.push(`The major axis is ${wide ? 'horizontal' : 'vertical'}, so $a^{2} = ${a2}$ goes under the $${major}$-term.`);
    const answer = m(ellipseTex(e));
    steps.push(answer);

    const withB2 = (v: number): Ell => (wide ? { ...e, Y: v } : { ...e, X: v });
    const distractors = distinctDistractors(
      answer,
      [
        m(ellipseTex({ ...e, X: e.Y, Y: e.X })),
        usesFoci ? m(ellipseTex(withB2(a2 + c * c))) : m(ellipseTex(wide ? { h, k, X: a, Y: other } : { h, k, X: other, Y: a })),
        !h.isZero() || !k.isZero() ? m(ellipseTex({ ...e, h: h.neg(), k: k.neg() })) : null,
        usesFoci ? m(ellipseTex(withB2(c * c))) : null,
      ],
      (n) => (b2 + offset(n) > 0 && b2 + offset(n) !== a2 ? m(ellipseTex(withB2(b2 + offset(n)))) : null),
    );
    return {
      question,
      answer,
      steps,
      distractors,
      check: { kind: 'alg2-conics.write', conic: 'ellipse' },
    };
  },
});
