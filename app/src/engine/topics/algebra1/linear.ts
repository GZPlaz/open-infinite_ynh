/** Linear relations and functions: slope, graphing and writing lines, |x| graphs, linear inequalities, variation. */
import { graphPlane, plot, shadeBetween, type Diagram, type DiagramBuilder, type Window } from '../../diagram';
import { Frac } from '../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, offset, opt, strOpt } from '../../generator';
import type { Rng } from '../../rng';
import { linear, m, num, scaled, sum, term, tuple } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { drawLine, isLess, isStrict, latticePoints, lineAt, lineX, lineY, slopeInterceptTex, standardForm, standardTex, type Line, type Rel } from './helpers';

const GR = 10;

/** A random non-vertical line with a visible pair of lattice points. */
function randomLine(rng: Rng, d: Difficulty, opts: { fractions?: boolean; maxB?: number } = {}): Line {
  return attempt('line', () => {
    const den = opts.fractions ?? d !== 'easy' ? rng.pick([1, 1, 2, 3, 4, 5]) : 1;
    const mm = new Frac(rng.signedInt(1, den === 1 ? (d === 'easy' ? 4 : 5) : 2 * den, true), den);
    const b = new Frac(rng.int(-(opts.maxB ?? 6), opts.maxB ?? 6));
    const l = lineY(mm, b);
    if (latticePoints(l, GR - 2).length < 2) return null;
    return l;
  });
}

const ptTex = (p: readonly [number, number]) => tuple([p[0], p[1]]);

// ================================================================ slope from two points

function slopeAnswer(dx: number, dy: number): string {
  return dx === 0 ? 'Undefined' : m(num(new Frac(dy, dx)));
}

export const slopeFromPoints = defineTopic({
  id: 'alg1.slope',
  subject: 'algebra1',
  category: 'Linear Relations and Functions',
  title: 'Finding Slope',
  description: 'Find the slope of a line through two points, or from its graph.',
  instruction: (o) => (o.given === 'graph' ? 'Find the slope of each line.' : o.given === 'points' ? 'Find the slope of the line through each pair of points.' : 'Find the slope of each line.'),
  multipleChoice: true,
  defaultCount: 12,
  options: [
    {
      type: 'select',
      id: 'given',
      label: 'Given',
      default: 'points',
      choices: [
        { value: 'points', label: 'Two points' },
        { value: 'graph', label: 'A graph' },
        { value: 'mixed', label: 'Mixed' },
      ],
    },
    { type: 'boolean', id: 'special', label: 'Include zero and undefined slopes', default: true },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty: d } = ctx;
    const givenOpt = strOpt(ctx, 'given');
    const graph = givenOpt === 'graph' || (givenOpt === 'mixed' && rng.bool(0.4));
    const special = boolOpt(ctx, 'special') && rng.bool(0.15);
    const R = graph ? 8 : d === 'easy' ? 9 : d === 'medium' ? 12 : 20;
    const { A, B } = attempt('slope points', () => {
      const A: [number, number] = [rng.int(-R, R), rng.int(-R, R)];
      const B: [number, number] = [rng.int(-R, R), rng.int(-R, R)];
      const dx = B[0] - A[0];
      const dy = B[1] - A[1];
      if (dx === 0 && dy === 0) return null;
      if ((dx === 0 || dy === 0) !== special) return null;
      const s = dx === 0 ? null : new Frac(dy, dx);
      if (s && d === 'easy' && !s.isInt() && rng.bool(0.6)) return null;
      if (s && d !== 'easy' && s.isInt() && rng.bool(0.5)) return null;
      if (graph && Math.hypot(dx, dy) < 3) return null;
      return { A, B };
    });
    const dx = B[0] - A[0];
    const dy = B[1] - A[1];
    const answer = slopeAnswer(dx, dy);
    const steps = graph
      ? [`Two points on the line: $${ptTex(A)}$ and $${ptTex(B)}$.`, `Rise $= ${dy}$, run $= ${dx}$: $m = \\frac{${dy}}{${dx}}$${dx === 0 ? ', a vertical line (slope Undefined)' : ` $= ${num(new Frac(dy, dx))}$`}`]
      : [`$m = \\frac{y_2 - y_1}{x_2 - x_1} = \\frac{${B[1]} - ${A[1] < 0 ? `(${A[1]})` : A[1]}}{${B[0]} - ${A[0] < 0 ? `(${A[0]})` : A[0]}} = \\frac{${dy}}{${dx}}$`];
    if (!graph && dx !== 0 && !(new Frac(dy, dx).isInt() && dx === 1)) steps.push(`$m = ${num(new Frac(dy, dx))}$`);
    if (!graph && dx === 0) steps.push('The run is $0$: the line is vertical, so its slope is Undefined.');
    const distractors = distinctDistractors(
      answer,
      [dy === 0 ? 'Undefined' : slopeAnswer(dy, dx), dx === 0 ? m('0') : slopeAnswer(dx, -dy), dx === 0 || dy === 0 ? (dx === 0 ? m('1') : 'Undefined') : slopeAnswer(dx, dy + dx), slopeAnswer(-dy, dx)],
      (k) => m(num(new Frac(dy, dx || 1).add(k))),
    );
    let question: string;
    let diagram: Diagram | undefined;
    if (graph) {
      const { b, w } = graphPlane(GR, 2);
      drawLine(b, dx === 0 ? lineX(A[0]) : lineY(new Frac(dy, dx), new Frac(A[1]).sub(new Frac(dy, dx).mul(A[0]))), w);
      b.dot(A, false, 'accent');
      b.dot(B, false, 'accent');
      diagram = b.build('Line through two marked points');
      question = 'The line graphed below.';
    } else question = `${m(ptTex(A))}, ${m(ptTex(B))}`;
    return { question, answer, steps, distractors, diagram, check: { kind: 'algebra1.slope' } };
  },
});

// ================================================================ graphing lines

export const graphingLines = defineTopic({
  id: 'alg1.graph-linear',
  subject: 'algebra1',
  category: 'Linear Relations and Functions',
  title: 'Graphing Linear Equations',
  description: 'Graph lines given in slope-intercept or standard form, including horizontal and vertical lines.',
  instruction: 'Sketch the graph of each line.',
  multipleChoice: false,
  defaultCount: 6,
  options: [
    {
      type: 'select',
      id: 'form',
      label: 'Form',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'Mixed' },
        { value: 'slope-intercept', label: 'Slope-intercept form' },
        { value: 'standard', label: 'Standard form' },
      ],
    },
    { type: 'boolean', id: 'hv', label: 'Include horizontal and vertical lines', default: true },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty: d } = ctx;
    const formOpt = strOpt(ctx, 'form');
    const form = formOpt === 'mixed' ? (d === 'easy' ? 'slope-intercept' : rng.pick(['slope-intercept', 'standard'])) : formOpt;
    const hv = boolOpt(ctx, 'hv') && rng.bool(0.15);
    let l: Line;
    if (hv) l = rng.bool() ? lineX(rng.signedInt(1, 7, true)) : lineY(0, rng.signedInt(1, 7, true));
    else l = randomLine(rng, d);
    const { A, B, C } = standardForm(l);
    const eq = form === 'standard' && !hv ? standardTex(A, B, C) : slopeInterceptTex(l);
    const pts = latticePoints(l, GR - 2);
    // two well-separated lattice points
    const P = l.m === null ? ([l.b.value, 0] as [number, number]) : pts.find((p) => p[0] === 0) ?? pts[0]!;
    const Q = pts.filter((p) => p !== P && (p[0] !== P[0] || p[1] !== P[1])).sort((u, v) => Math.hypot(v[0] - P[0], v[1] - P[1]) - Math.hypot(u[0] - P[0], u[1] - P[1]))[0]!;
    const steps: string[] = [];
    if (l.m === null) steps.push(`$${eq}$ is a vertical line: every point has $x = ${num(l.b)}$.`);
    else if (l.m.isZero()) steps.push(`$${eq}$ is a horizontal line: every point has $y = ${num(l.b)}$.`);
    else {
      if (form === 'standard') steps.push(`Solve for $y$: $${slopeInterceptTex(l)}$`);
      steps.push(`Slope $${num(l.m)}$, $y$-intercept $${num(l.b)}$.`);
    }
    steps.push(`Plot $${ptTex(P)}$ and $${ptTex(Q)}$ and draw the line through them.`);
    const { b, w } = graphPlane(GR, 2);
    drawLine(b, l, w);
    b.dot(P, false, 'accent');
    b.dot(Q, false, 'accent');
    return {
      question: m(eq),
      answer: `Line through $${ptTex(P)}$ and $${ptTex(Q)}$`,
      steps,
      diagram: graphPlane(GR, 2).b.build('Blank coordinate plane'),
      answerDiagram: b.build(`Graph of ${eq}`),
      check: { kind: 'algebra1.lineGraph' },
    };
  },
});

// ================================================================ writing linear equations

type WriteTask = 'pointSlope' | 'twoPoints' | 'parallel' | 'perpendicular' | 'graph';

export const writingLines = defineTopic({
  id: 'alg1.write-linear',
  subject: 'algebra1',
  category: 'Linear Relations and Functions',
  title: 'Writing Linear Equations',
  description: 'Write the equation of a line from a point and slope, two points, a parallel or perpendicular line, or a graph.',
  instruction: (o) => `Write the ${o.answerForm === 'standard' ? 'standard form' : 'slope-intercept form'} of the equation of each line.`,
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Given',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'Mixed' },
        { value: 'pointSlope', label: 'A point and the slope' },
        { value: 'twoPoints', label: 'Two points' },
        { value: 'parallel', label: 'Parallel through a point' },
        { value: 'perpendicular', label: 'Perpendicular through a point' },
        { value: 'graph', label: 'A graph' },
      ],
    },
    {
      type: 'select',
      id: 'answerForm',
      label: 'Answer form',
      default: 'slope-intercept',
      choices: [
        { value: 'slope-intercept', label: 'Slope-intercept form' },
        { value: 'standard', label: 'Standard form' },
      ],
    },
    opt.fractionAnswers(true),
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty: d } = ctx;
    const taskOpt = strOpt(ctx, 'task');
    const task: WriteTask =
      taskOpt === 'mixed' ? rng.pick<WriteTask>(d === 'easy' ? ['pointSlope', 'twoPoints', 'graph'] : d === 'medium' ? ['pointSlope', 'twoPoints', 'parallel', 'perpendicular', 'graph'] : ['twoPoints', 'parallel', 'perpendicular']) : (taskOpt as WriteTask);
    const standard = strOpt(ctx, 'answerForm') === 'standard';
    const fractions = boolOpt(ctx, 'fractions') && d !== 'easy';
    const lineTex = (l: Line) => {
      if (!standard) return slopeInterceptTex(l);
      const s = standardForm(l);
      return standardTex(s.A, s.B, s.C);
    };
    // target line through a lattice point P
    const built = attempt('write line', () => {
      const den = fractions ? rng.pick([1, 2, 3, 4]) : 1;
      let slope: Frac | null = new Frac(rng.signedInt(1, den === 1 ? 5 : 2 * den, true), den);
      if (d === 'hard' && (task === 'parallel' || task === 'perpendicular') && rng.bool(0.15)) slope = rng.bool() ? new Frac(0) : null;
      const P: [number, number] = [rng.int(-6, 6), rng.int(-6, 6)];
      const l: Line = slope === null ? lineX(P[0]) : lineY(slope, new Frac(P[1]).sub(slope.mul(P[0])));
      if (l.m !== null && (!fractions && !l.b.isInt())) return null;
      if (l.m !== null && Math.abs(l.b.value) > 12) return null;
      if (task === 'twoPoints' || task === 'graph') {
        const pts = latticePoints(l, task === 'graph' ? 8 : 9).filter((p) => p[0] !== P[0]);
        if (!pts.length || l.m === null) return null;
        return { l, P, Q: rng.pick(pts) };
      }
      return { l, P, Q: null };
    });
    const { l, P, Q } = built;
    let question: string;
    let diagram: Diagram | undefined;
    const steps: string[] = [];
    let given: Line | null = null;
    switch (task) {
      case 'pointSlope':
        question = `Through ${m(ptTex(P))} with slope ${m(`m = ${num(l.m!)}`)}`;
        steps.push(`Point-slope form: $${linear(1, -P[1], 'y')} = ${P[0] === 0 ? term(l.m!, 'x') : scaled(l.m!, linear(1, -P[0]))}$`);
        break;
      case 'twoPoints':
        question = `Through ${m(ptTex(P))} and ${m(ptTex(Q!))}`;
        steps.push(`Slope: $m = \\frac{${Q![1]} - ${P[1] < 0 ? `(${P[1]})` : P[1]}}{${Q![0]} - ${P[0] < 0 ? `(${P[0]})` : P[0]}} = ${num(l.m!)}$`);
        break;
      case 'graph': {
        const { b, w } = graphPlane(GR, 2);
        drawLine(b, l, w);
        b.dot(P, false, 'accent');
        b.dot(Q!, false, 'accent');
        diagram = b.build('Graph of a line through two marked points');
        question = 'The line graphed below.';
        steps.push(`Read two points: $${ptTex(P)}$ and $${ptTex(Q!)}$, so $m = ${num(l.m!)}$.`);
        break;
      }
      case 'parallel':
      case 'perpendicular': {
        // the given line: same slope (parallel) or negative reciprocal (perpendicular), different intercept
        const gm: Frac | null = task === 'parallel' ? l.m : l.m === null ? new Frac(0) : l.m.isZero() ? null : l.m.inv().neg();
        const gb = attempt('given line', () => {
          const c = new Frac(rng.int(-8, 8));
          if (gm === null) return c.eq(P[0]) ? null : c;
          if (gm.mul(P[0]).add(c).eq(P[1])) return null;
          return c;
        });
        given = gm === null ? lineX(gb) : lineY(gm, gb);
        const gs = standardForm(given);
        const gtex = d === 'hard' && given.m !== null && !given.m.isZero() && rng.bool(0.5) ? standardTex(gs.A, gs.B, gs.C) : slopeInterceptTex(given);
        question = `Through ${m(ptTex(P))}, ${task} to ${m(gtex)}`;
        if (given.m === null) steps.push(`The given line is vertical, so the new line is ${task === 'parallel' ? 'vertical' : 'horizontal'}.`);
        else if (task === 'parallel') steps.push(`Parallel lines have equal slopes: $m = ${num(given.m)}$`);
        else steps.push(given.m.isZero() ? 'The given line is horizontal, so the new line is vertical.' : `Perpendicular slope is the negative reciprocal of $${num(given.m)}$: $m = ${num(l.m!)}$`);
        break;
      }
    }
    if (l.m !== null && !l.m.isZero()) steps.push(`Solve for $b$: $${P[1]} = ${l.m.eq(1) ? '' : l.m.eq(-1) ? '-' : num(l.m)}(${P[0]}) + b$, so $b = ${num(l.b)}$`);
    const answerTex = lineTex(l);
    if (standard) steps.push(`Standard form: $${answerTex}$`);
    else steps.push(`$${answerTex}$`);
    const answer = m(answerTex);
    // common mistakes
    const wrong: Array<Line | null> = [];
    if (l.m !== null) {
      wrong.push(lineY(l.m.neg(), new Frac(P[1]).add(l.m.mul(P[0]))));
      wrong.push(lineY(l.m, new Frac(P[1]).add(l.m.mul(P[0]))));
      if (!l.m.isZero()) wrong.push(lineY(l.m.inv(), new Frac(P[1]).sub(l.m.inv().mul(P[0]))));
      if (task === 'perpendicular' && !l.m.isZero()) wrong.push(lineY(l.m.inv().neg(), new Frac(P[1]).add(l.m.inv().mul(P[0]))));
      if (task === 'parallel' && given && given.m !== null) wrong.push(given);
      wrong.push(lineY(l.m, l.b.neg()));
    } else {
      wrong.push(lineY(0, P[1]), lineX(-P[0] || P[1] || 1), lineY(0, P[0]));
    }
    const distractors = distinctDistractors(
      answer,
      wrong.filter((w): w is Line => w !== null).map((w) => m(lineTex(w))),
      (k) => m(lineTex(l.m === null ? lineX(l.b.add(offset(k))) : lineY(l.m, l.b.add(offset(k))))),
    );
    return { question, answer, steps, distractors, diagram, check: { kind: 'algebra1.lineThrough' } };
  },
});

// ================================================================ graphing absolute value equations

export const graphingAbsoluteValue = defineTopic({
  id: 'alg1.graph-abs',
  subject: 'algebra1',
  category: 'Linear Relations and Functions',
  title: 'Graphing Absolute Value Equations',
  description: 'Graph y = a|x − h| + k by locating the vertex and using the slopes a and −a.',
  instruction: 'Graph each equation.',
  multipleChoice: false,
  defaultCount: 6,
  options: [{ type: 'boolean', id: 'fracA', label: 'Fractional stretch factors (hard)', default: true }],
  generate(ctx): ProblemContent {
    const { rng, difficulty: d } = ctx;
    const h = d === 'easy' && rng.bool(0.5) ? 0 : rng.signedInt(1, 5, true);
    const k = d === 'easy' && h !== 0 ? 0 : rng.signedInt(1, 5, true);
    const a =
      d === 'easy'
        ? new Frac(rng.bool(0.8) ? 1 : -1)
        : d === 'medium'
          ? new Frac(rng.pick([1, -1, 2, -2, 3]))
          : boolOpt(ctx, 'fracA') && rng.bool(0.6)
            ? new Frac(rng.pick([1, -1, 2, -2, 3]), rng.pick([2, 3]))
            : new Frac(rng.pick([-3, -2, 2, 3, -1]));
    const inner = sum([{ coef: 1, sym: 'x' }, { coef: -h }]);
    const eq = `y = ${sum([{ coef: a, sym: `\\left|${inner}\\right|` }, { coef: k }])}`;
    const f = (x: number) => a.value * Math.abs(x - h) + k;
    const { b, w } = graphPlane(GR, 2);
    plot(b, f, w);
    b.dot([h, k], false, 'accent');
    const up = a.sign > 0;
    const step = a.d;
    const steps = [
      `Vertex: $${ptTex([h, k])}$.`,
      `From the vertex, move $${step}$ ${step === 1 ? 'unit' : 'units'} left or right and $${Math.abs(a.n)}$ ${up ? 'up' : 'down'}: points $${ptTex([h + step, k + a.n])}$ and $${ptTex([h - step, k + a.n])}$.`,
    ];
    return {
      question: m(eq),
      answer: `Vertex $${ptTex([h, k])}$, opens ${up ? 'up' : 'down'}`,
      steps,
      diagram: graphPlane(GR, 2).b.build('Blank coordinate plane'),
      answerDiagram: b.build(`Graph of ${eq}`),
      check: { kind: 'algebra1.absGraph' },
    };
  },
});

// ================================================================ graphing linear inequalities

/** `y rel …`, `x rel c` or `A x + B y rel C`, with its graph. */
export interface LinearIneq {
  l: Line;
  /** Relation for "y rel mx + b" (or "x rel c" for vertical lines). */
  rel: Rel;
  tex: string;
}

export function randomIneq(rng: Rng, d: Difficulty, standardAllowed: boolean, hv: boolean): LinearIneq {
  const rel = rng.pick<Rel>(['<', '>', '\\le', '\\ge']);
  if (hv) {
    const c = rng.signedInt(1, 6, true);
    const l = rng.bool() ? lineX(c) : lineY(0, c);
    return { l, rel, tex: `${l.m === null ? 'x' : 'y'} ${rel} ${c}` };
  }
  const l = randomLine(rng, d, { maxB: 6 });
  if (standardAllowed && rng.bool(0.5)) {
    const { A, B, C } = standardForm(l);
    // B y rel C − A x with B > 0 keeps "y rel", B < 0 reverses it
    const sgn = rng.bool() ? 1 : -1;
    const qRel = sgn * B > 0 ? rel : ({ '<': '>', '>': '<', '\\le': '\\ge', '\\ge': '\\le' } as const)[rel];
    return { l, rel, tex: `${sum([{ coef: sgn * A, sym: 'x' }, { coef: sgn * B, sym: 'y' }])} ${qRel} ${sgn * C}` };
  }
  return { l, rel, tex: `y ${rel} ${sum([{ coef: l.m!, sym: 'x' }, { coef: l.b }])}` };
}

/** Lower/upper bounds of the solution region at x (for shading). */
export function regionBounds(q: LinearIneq, w: Window): { lo: (x: number) => number; hi: (x: number) => number } {
  const big = w.y1 + 1;
  if (q.l.m === null) {
    const c = q.l.b.value;
    const ok = (x: number) => (isLess(q.rel) ? x < c : x > c);
    return { lo: (x) => (ok(x) ? -big : big), hi: (x) => (ok(x) ? big : -big) };
  }
  const f = (x: number) => q.l.m!.value * x + q.l.b.value;
  return isLess(q.rel) ? { lo: () => -big, hi: f } : { lo: f, hi: () => big };
}

export function drawIneqs(b: DiagramBuilder, w: Window, qs: LinearIneq[]): void {
  const bounds = qs.map((q) => regionBounds(q, w));
  shadeBetween(
    b,
    (x) => Math.max(...bounds.map((r) => r.lo(x))),
    (x) => Math.min(...bounds.map((r) => r.hi(x))),
    w,
  );
  for (const q of qs) drawLine(b, q.l, w, { dash: isStrict(q.rel) });
}

export function shadeWords(q: LinearIneq): string {
  if (q.l.m === null) return isLess(q.rel) ? 'shade to the left' : 'shade to the right';
  return isLess(q.rel) ? 'shade below' : 'shade above';
}

export const graphingLinearInequalities = defineTopic({
  id: 'alg1.graph-linear-ineq',
  subject: 'algebra1',
  category: 'Linear Relations and Functions',
  title: 'Graphing Linear Inequalities',
  description: 'Graph two-variable linear inequalities: dashed or solid boundary line, then shade the solution half-plane.',
  instruction: 'Sketch the graph of each linear inequality.',
  multipleChoice: false,
  defaultCount: 6,
  options: [
    { type: 'boolean', id: 'standard', label: 'Standard form (medium and hard)', default: true },
    { type: 'boolean', id: 'hv', label: 'Include horizontal and vertical boundaries', default: true },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty: d } = ctx;
    const q = randomIneq(rng, d, boolOpt(ctx, 'standard') && d !== 'easy', boolOpt(ctx, 'hv') && rng.bool(0.2));
    const { b, w } = graphPlane(GR, 2);
    drawIneqs(b, w, [q]);
    const boundary = slopeInterceptTex(q.l);
    const style = isStrict(q.rel) ? 'Dashed' : 'Solid';
    const steps = [
      ...(q.tex.startsWith('y ') || q.tex.startsWith('x ') ? [] : [`Solve for $y$: $y ${q.rel} ${sum([{ coef: q.l.m!, sym: 'x' }, { coef: q.l.b }])}$`]),
      `Boundary: $${boundary}$, drawn ${style.toLowerCase()} because the inequality is ${isStrict(q.rel) ? 'strict' : 'not strict'}.`,
      `Test $(0, 0)$ or read the sign: ${shadeWords(q)}.`,
    ];
    return {
      question: m(q.tex),
      answer: `${style} boundary $${boundary}$; ${shadeWords(q)}`,
      steps,
      diagram: graphPlane(GR, 2).b.build('Blank coordinate plane'),
      answerDiagram: b.build(`Graph of ${q.tex}`),
      check: { kind: 'algebra1.shading', range: GR },
    };
  },
});

// ================================================================ direct and inverse variation

const VAR_PAIRS: ReadonlyArray<[string, string]> = [
  ['y', 'x'],
  ['y', 'x'],
  ['m', 'n'],
  ['p', 'q'],
  ['a', 'b'],
  ['r', 's'],
  ['w', 'v'],
];

export const variation = defineTopic({
  id: 'alg1.variation',
  subject: 'algebra1',
  category: 'Linear Relations and Functions',
  title: 'Direct and Inverse Variation',
  description: 'Find the constant of variation, write the variation equation and use it to find unknown values.',
  instruction: 'Solve each problem.',
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'type',
      label: 'Variation',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'Direct and inverse' },
        { value: 'direct', label: 'Direct only' },
        { value: 'inverse', label: 'Inverse only' },
      ],
    },
    {
      type: 'select',
      id: 'task',
      label: 'Find',
      default: 'solve',
      choices: [
        { value: 'solve', label: 'An unknown value' },
        { value: 'equation', label: 'The equation' },
        { value: 'constant', label: 'The constant of variation' },
        { value: 'mixed', label: 'Mixed' },
      ],
    },
    opt.variedVariables(true),
    opt.fractionAnswers(false),
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty: d } = ctx;
    const typeOpt = strOpt(ctx, 'type');
    const direct = typeOpt === 'direct' || (typeOpt === 'mixed' && rng.bool());
    const taskOpt = strOpt(ctx, 'task');
    const task = taskOpt === 'mixed' ? rng.pick(['solve', 'equation', 'constant']) : taskOpt;
    const fractions = boolOpt(ctx, 'fractions') || d === 'hard';
    const [Y, X] = boolOpt(ctx, 'variedVars') ? rng.pick(VAR_PAIRS) : ['y', 'x'];
    const p = attempt('variation', () => {
      const den = fractions && d !== 'easy' ? rng.pick([1, 2, 3, 4]) : 1;
      const k = new Frac(rng.signedInt(1, d === 'easy' ? 6 : 12, d !== 'easy') * (direct ? 1 : rng.int(1, 3)), den);
      if (!direct && k.abs().eq(1)) return null;
      const x1 = new Frac(rng.signedInt(1, d === 'easy' ? 6 : 12, d !== 'easy'));
      const y1 = direct ? k.mul(x1) : k.div(x1);
      if (!fractions && !y1.isInt()) return null;
      if (direct && k.eq(1)) return null;
      // second point: find y given x, or x given y
      const findY = rng.bool(0.65);
      const x2 = new Frac(rng.signedInt(1, d === 'easy' ? 9 : 15, d !== 'easy'));
      if (x2.eq(x1)) return null;
      const y2 = direct ? k.mul(x2) : k.div(x2);
      if (!fractions && !y2.isInt()) return null;
      if (!findY && (y2.isZero() || (!fractions && !(direct ? y2.div(k) : k.div(y2)).isInt()))) return null;
      if (y1.d > 12 || y2.d > 12) return null;
      return { k, x1, y1, x2, y2, findY };
    });
    const { k, x1, y1, x2, y2, findY } = p;
    const how = direct ? 'directly' : 'inversely';
    const intro = `${m(Y)} varies ${how} with ${m(X)}, and ${m(`${Y} = ${num(y1)}`)} when ${m(`${X} = ${num(x1)}`)}.`;
    const eqTex = (kk: Frac, dir: boolean) => (dir ? `${Y} = ${sum([{ coef: kk, sym: X }])}` : `${Y} = ${kk.sign < 0 ? '-' : ''}\\frac{${Math.abs(kk.n)}}{${kk.d === 1 ? '' : kk.d}${X}}`);
    const steps = [direct ? `$k = \\frac{${Y}}{${X}} = \\frac{${num(y1)}}{${num(x1)}} = ${num(k)}$` : `$k = ${X}${Y} = ${num(x1)} \\cdot ${y1.sign < 0 ? `(${num(y1)})` : num(y1)} = ${num(k)}$`];
    let question: string;
    let answer: string;
    let wrong: string[];
    let fallback: (j: number) => string;
    const kOther = direct ? x1.mul(y1) : y1.div(x1);
    if (task === 'constant') {
      question = `${intro} Find the constant of variation.`;
      answer = m(`k = ${num(k)}`);
      wrong = [m(`k = ${num(kOther)}`), m(`k = ${num(k.inv())}`), m(`k = ${num(k.neg())}`)];
      fallback = (j) => m(`k = ${num(k.add(offset(j)))}`);
    } else if (task === 'equation') {
      question = `${intro} Write the equation of variation.`;
      answer = m(eqTex(k, direct));
      steps.push(`$${eqTex(k, direct)}$`);
      wrong = [m(eqTex(kOther, !direct)), m(eqTex(k, !direct)), m(eqTex(k.inv(), direct)), m(eqTex(kOther, direct))];
      fallback = (j) => m(eqTex(k.add(offset(j)), direct));
    } else if (findY) {
      question = `${intro} Find ${m(Y)} when ${m(`${X} = ${num(x2)}`)}.`;
      answer = m(`${Y} = ${num(y2)}`);
      steps.push(`$${eqTex(k, direct)}$, so $${Y} = ${num(y2)}$ when $${X} = ${num(x2)}$`);
      wrong = [m(`${Y} = ${num(direct ? kOther.div(x2) : kOther.mul(x2))}`), m(`${Y} = ${num(direct ? x2.div(k) : x2.div(k))}`), m(`${Y} = ${num(y2.neg())}`)];
      fallback = (j) => m(`${Y} = ${num(y2.add(offset(j)))}`);
    } else {
      question = `${intro} Find ${m(X)} when ${m(`${Y} = ${num(y2)}`)}.`;
      answer = m(`${X} = ${num(x2)}`);
      steps.push(`$${eqTex(k, direct)}$, so $${X} = ${num(x2)}$ when $${Y} = ${num(y2)}$`);
      wrong = [m(`${X} = ${num(direct ? kOther.div(y2) : kOther.mul(y2))}`), m(`${X} = ${num(y2.mul(k))}`), m(`${X} = ${num(x2.neg())}`)];
      fallback = (j) => m(`${X} = ${num(x2.add(offset(j)))}`);
    }
    return { question, answer, steps, distractors: distinctDistractors(answer, wrong, fallback), check: { kind: 'algebra1.variation', task } };
  },
});

export { lineAt, ptTex, randomLine, GR };
