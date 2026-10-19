/** Graphing quadratic functions and two-variable quadratic inequalities. */
import { graphPlane, plot, shadeBetween } from '../../../diagram';
import { Frac } from '../../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, strOpt } from '../../../generator';
import { Poly } from '../../../polynomial';
import type { Rng } from '../../../rng';
import { m, num, paren, tuple } from '../../../tex';
import type { Difficulty, ProblemContent, SelectOptionDef } from '../../../types';
import { CATEGORY_QUAD, intTriple, rootsTex, vertexFormTex } from './common';

interface Parabola {
  a: Frac;
  h: Frac;
  k: Frac;
}

const RANGE = 10;

const polyOf = (p: Parabola): Poly => Poly.of(p.a.mul(p.h).mul(p.h).add(p.k), p.a.mul(p.h).mul(-2), p.a);

/** Vertex in window, enough of the curve visible. */
function visible(p: Parabola): boolean {
  if (Math.abs(p.h.value) > 6 || Math.abs(p.k.value) > 8) return false;
  // the arms must reach |y − k| ≥ 4 inside the window
  const room = p.a.sign > 0 ? RANGE - p.k.value : p.k.value + RANGE;
  return room >= 3;
}

function pickParabola(rng: Rng, d: Difficulty, easyRoots: boolean): Parabola {
  return attempt('parabola', () => {
    if (d === 'hard') {
      const a = rng.pick([new Frac(1), new Frac(-1), new Frac(2), new Frac(-2), new Frac(3), new Frac(-3), new Frac(1, 2), new Frac(-1, 2)]);
      const b = new Frac(rng.int(-9, 9));
      const c = new Frac(rng.int(-9, 9));
      const h = b.neg().div(a.mul(2));
      const k = c.sub(b.mul(b).div(a.mul(4)));
      const p = { a, h, k };
      if (h.isInt() && k.isInt() && rng.bool(0.7)) return null;
      return visible(p) && k.d <= 8 ? p : null;
    }
    const a = d === 'easy' ? new Frac(rng.sign()) : rng.pick([new Frac(1), new Frac(-1), new Frac(2), new Frac(-2), new Frac(1, 2), new Frac(-1, 2)]);
    const h = new Frac(rng.int(d === 'easy' ? -4 : -5, d === 'easy' ? 4 : 5));
    const k = new Frac(rng.int(-7, 7));
    const p = { a, h, k };
    if (!visible(p)) return null;
    if (!polyOf(p).isIntegral()) return null;
    if (easyRoots) {
      const r = k.neg().div(a);
      if (r.sign > 0 && ![1, 4, 9, 16].includes(r.value)) return null;
      if (r.sign <= 0 && rng.bool(0.75)) return null;
    }
    return p;
  });
}

const FORM_OPTION: SelectOptionDef = {
  type: 'select',
  id: 'form',
  label: 'Equation form',
  default: 'standard',
  choices: [
    { value: 'standard', label: 'Standard form y = ax² + bx + c' },
    { value: 'vertex', label: 'Vertex form y = a(x − h)² + k' },
    { value: 'mixed', label: 'Mixed' },
  ],
};

function rhsTex(rng: Rng, p: Parabola, form: string): { tex: string; vertexForm: boolean } {
  const vertexForm = form === 'vertex' || (form === 'mixed' && rng.bool());
  return { tex: vertexForm ? vertexFormTex(p.a, p.h, p.k) : polyOf(p).toTex(), vertexForm };
}

/** Find the vertex from standard form: steps. */
function vertexSteps(p: Parabola, vertexForm: boolean): string[] {
  const poly = polyOf(p);
  if (vertexForm) {
    return [`The equation is in vertex form $y = a(x - h)^{2} + k$ with $a = ${num(p.a)}$, $h = ${num(p.h)}$, $k = ${num(p.k)}$.`];
  }
  const a = poly.coef(2);
  const b = poly.coef(1);
  return [
    `Axis of symmetry: $x = -\\frac{b}{2a} = -\\frac{${num(b)}}{2${paren(a)}} = ${num(p.h)}$`,
    `Vertex $y$-value: $y = ${poly.toTex(paren(p.h))} = ${num(p.k)}$`,
  ].map((s) => s.replace(/-\\frac\{-/g, '\\frac{'));
}

export const graphingQuadratics = defineTopic({
  id: 'alg2.quad.graph',
  subject: 'algebra2',
  category: CATEGORY_QUAD,
  title: 'Graphing Quadratic Functions',
  description: 'Find the vertex, axis of symmetry and intercepts of a parabola, then graph it.',
  instruction: (o) =>
    o.intercepts
      ? 'Identify the vertex, axis of symmetry, and intercepts of each. Then sketch the graph.'
      : 'Identify the vertex and axis of symmetry of each. Then sketch the graph.',
  multipleChoice: false,
  defaultCount: 6,
  options: [FORM_OPTION, { type: 'boolean', id: 'intercepts', label: 'Also find the intercepts', default: true }],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const intercepts = boolOpt(ctx, 'intercepts');
    const p = pickParabola(rng, difficulty, intercepts && difficulty === 'easy');
    const { tex, vertexForm } = rhsTex(rng, p, strOpt(ctx, 'form'));
    const poly = polyOf(p);
    const f = (x: number) => poly.evalNum(x);
    const steps = vertexSteps(p, vertexForm);
    const vertex = tuple([p.h, p.k]);
    steps.push(`Vertex: $${vertex}$; axis of symmetry: $x = ${num(p.h)}$`);
    const parts = [`Vertex: $${vertex}$`, `axis of symmetry: $x = ${num(p.h)}$`];

    const { b, w } = graphPlane(RANGE, 2);
    const blank = graphPlane(RANGE, 2).b.build('Blank coordinate plane');
    b.segment([p.h.value, -RANGE], [p.h.value, RANGE], { dash: true, ink: 'muted', weight: 1 });
    plot(b, f, w);
    b.dot([p.h.value, p.k.value], false, 'accent');

    if (intercepts) {
      const c0 = poly.coef(0);
      steps.push(`$y$-intercept: $x = 0$ gives $y = ${num(c0)}$`);
      parts.push(`y-intercept: $${tuple([0, c0])}$`);
      if (Math.abs(c0.value) <= RANGE) b.dot([0, c0.value], false, 'accent');
      const [A, B, C] = intTriple(poly);
      const D = B * B - 4 * A * C;
      if (D < 0) {
        steps.push(`$x$-intercepts: $b^{2} - 4ac < 0$, so the parabola never crosses the $x$-axis.`);
        parts.push('x-intercepts: none');
      } else {
        const roots = rootsTex(A, B, C);
        const rootsNum = D === 0 ? [-B / (2 * A)] : [(-B + Math.sqrt(D)) / (2 * A), (-B - Math.sqrt(D)) / (2 * A)];
        rootsNum.forEach((r) => Math.abs(r) <= RANGE && b.dot([r, 0], false, 'accent'));
        steps.push(`$x$-intercepts: solve $${poly.toTex()} = 0$: $x = ${roots.join(', ')}$`);
        const pts = roots.map((r) => `\\left(${r}, 0\\right)`).join(', ');
        parts.push(roots.length === 1 ? `x-intercept: $${pts}$` : `x-intercepts: $${pts}$`);
      }
    }
    steps.push(`The parabola opens ${p.a.sign > 0 ? 'upward' : 'downward'}; plot the vertex and points on each side, then sketch.`);

    return {
      question: m(`y = ${tex}`),
      answer: parts.join('; '),
      steps,
      diagram: blank,
      answerDiagram: b.build(`Parabola y = ${tex} with vertex ${p.h.toString()}, ${p.k.toString()}`),
      check: { kind: 'alg2-quadratics-functions.quadGraph' },
    };
  },
});

type Rel = '<' | '>' | '\\le' | '\\ge';

export const graphingQuadraticInequalities = defineTopic({
  id: 'alg2.quad.graph-inequality',
  subject: 'algebra2',
  category: CATEGORY_QUAD,
  title: 'Graphing Quadratic Inequalities',
  description: 'Graph y < ax² + bx + c and similar: dashed or solid parabola, shaded above or below.',
  instruction: 'Sketch the graph of each inequality.',
  multipleChoice: true,
  defaultCount: 6,
  options: [FORM_OPTION],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const p = pickParabola(rng, difficulty, false);
    const { tex, vertexForm } = rhsTex(rng, p, strOpt(ctx, 'form'));
    const poly = polyOf(p);
    const f = (x: number) => poly.evalNum(x);
    const rel = rng.pick<Rel>(['<', '>', '\\le', '\\ge']);
    const strict = rel === '<' || rel === '>';
    const below = rel === '<' || rel === '\\le';

    const steps = vertexSteps(p, vertexForm);
    steps.push(`Vertex: $${tuple([p.h, p.k])}$; the parabola opens ${p.a.sign > 0 ? 'upward' : 'downward'}.`);
    steps.push(strict ? `The inequality is strict, so draw the boundary $y = ${tex}$ dashed.` : `The inequality includes equality, so draw the boundary $y = ${tex}$ solid.`);
    const tests: Array<[number, number]> = [
      [0, 0],
      [0, 1],
      [1, 0],
      [0, -1],
    ];
    const [tx, ty] = tests.find(([x, y]) => poly.eval(x).value !== y)!;
    const fv = poly.eval(tx);
    const holds = below ? (strict ? ty < fv.value : ty <= fv.value) : strict ? ty > fv.value : ty >= fv.value;
    steps.push(
      `Test $${tuple([tx, ty])}$: $${ty} ${rel} ${num(fv)}$ is ${holds ? 'true' : 'false'}, so shade the region ${holds ? 'containing' : 'not containing'} it (${below ? 'below' : 'above'} the parabola).`,
    );

    const { b, w } = graphPlane(RANGE, 2);
    const blank = graphPlane(RANGE, 2).b.build('Blank coordinate plane');
    if (below) shadeBetween(b, () => w.y0, f, w);
    else shadeBetween(b, f, () => w.y1, w);
    plot(b, f, w, { dash: strict });

    const describe = (dashed: boolean, under: boolean) => `${dashed ? 'Dashed' : 'Solid'} parabola $y = ${tex}$, shaded ${under ? 'below' : 'above'}`;
    const answer = describe(strict, below);
    const distractors = distinctDistractors(answer, [describe(strict, !below), describe(!strict, below), describe(!strict, !below)], () => null);

    return {
      question: m(`y ${rel} ${tex}`),
      answer,
      steps,
      distractors,
      diagram: blank,
      answerDiagram: b.build(`Graph of y ${rel} ${tex}`),
      check: { kind: 'alg2-quadratics-functions.quadIneq' },
    };
  },
});
