/** Graphing rational functions: asymptotes, holes and intercepts. */
import { graphPlane, plot } from '../../../diagram';
import { Frac } from '../../../fraction';
import { attempt, boolOpt, defineTopic } from '../../../generator';
import { Poly } from '../../../polynomial';
import { m, num, sum, tuple } from '../../../tex';
import type { ProblemContent } from '../../../types';
import { RATIONAL_CATEGORY } from './expressions';
import { lin, pgcd, polyFactoredTex, rationalRoots, reduce } from './ratpoly';

function distinctRoots(p: Poly): Frac[] {
  const out: Frac[] = [];
  if (p.degree < 1) return out;
  for (const r of rationalRoots(p).roots) if (!out.some((x) => x.eq(r))) out.push(r);
  return out.sort((a, b) => a.cmp(b));
}

export const graphRational = defineTopic({
  id: 'alg2.rational.graph',
  subject: 'algebra2',
  title: 'Graphing Rational Functions',
  description: 'Find vertical and horizontal asymptotes, holes and intercepts, then graph the function.',
  category: RATIONAL_CATEGORY,
  instruction: 'Identify the asymptotes, holes and intercepts, then graph each function.',
  multipleChoice: false,
  defaultCount: 6,
  options: [
    { type: 'boolean', id: 'holes', label: 'Include holes (medium/hard)', default: true },
    { type: 'boolean', id: 'intercepts', label: 'List intercepts', default: true },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const holes = boolOpt(ctx, 'holes') && difficulty !== 'easy';
    const showInt = boolOpt(ctx, 'intercepts');
    const built = attempt('rational-graph', () => {
      let N: Poly;
      let D: Poly;
      let tex: string;
      const kind =
        difficulty === 'easy' ? 'shifted' : difficulty === 'medium' ? rng.pick(['shifted', 'linear', 'linear', ...(holes ? ['hole'] : [])]) : rng.pick(['linear', 'twoVA', ...(holes ? ['hole', 'hole'] : ['twoVA'])]);
      const h = rng.int(-6, 6);
      if (kind === 'shifted') {
        // a/(x − h) + k
        const a = rng.signedInt(1, difficulty === 'easy' ? 4 : 8, true);
        const k = rng.int(-5, 5);
        N = Poly.of(a - k * h, k);
        D = lin(1, -h);
        tex = sum([{ coef: Math.sign(a), sym: `\\frac{${Math.abs(a)}}{${D.toTex()}}` }, { coef: k }]);
      } else if (kind === 'linear') {
        // (px + q)/(rx + s)
        const r = rng.pick([1, 1, 2]);
        const p = rng.signedInt(1, 4, true) * r;
        const q = rng.int(-8, 8);
        const s = r === 2 ? 2 * rng.int(-4, 4) : -h;
        N = lin(p, q);
        D = lin(r, s);
        tex = `\\frac{${N.toTex()}}{${D.toTex()}}`;
      } else if (kind === 'twoVA') {
        // c(x − a)/((x − b)(x − e)) or c/((x − b)(x − e))
        const [b, e] = [rng.int(-6, 6), rng.int(-6, 6)];
        if (b === e) return null;
        const c = rng.signedInt(1, 4, true);
        N = rng.bool(0.6) ? lin(c, -c * rng.int(-6, 6)) : Poly.of(c * rng.int(1, 3));
        D = lin(1, -b).mul(lin(1, -e));
        tex = `\\frac{${N.toTex()}}{${D.toTex()}}`;
      } else {
        // hole: (x − a)·L / ((x − a)(x − b))
        const a = rng.int(-6, 6);
        const b = rng.int(-6, 6);
        if (a === b) return null;
        const L = rng.bool(0.7) ? lin(rng.signedInt(1, 3, true), rng.int(-6, 6)) : Poly.of(rng.signedInt(1, 6, true));
        N = lin(1, -a).mul(L);
        D = lin(1, -a).mul(lin(1, -b));
        tex = `\\frac{${N.toTex()}}{${D.toTex()}}`;
      }
      if (N.isZero()) return null;
      const red = reduce(N, D);
      if (red.D.degree < 1) return null;
      const va = distinctRoots(red.D);
      const g = pgcd(N, D);
      const holePts = distinctRoots(g).map((x) => [x, red.N.eval(x).div(red.D.eval(x))] as const);
      if (kind === 'hole' && holePts.length === 0) return null;
      if (kind !== 'hole' && holePts.length > 0) return null;
      const ha = red.N.degree < red.D.degree ? Frac.ZERO : red.N.lead().div(red.D.lead());
      if (red.N.degree > red.D.degree) return null;
      const xi = distinctRoots(red.N).filter((x) => !va.some((y) => y.eq(x)) && !holePts.some((h) => h[0].eq(x)));
      const zeroBad = [...va, ...holePts.map((p) => p[0])].some((x) => x.isZero());
      const yi = zeroBad ? null : red.N.eval(0).div(red.D.eval(0));
      const inWin = (f: Frac, lim = 8) => Math.abs(f.value) <= lim;
      const grid = (f: Frac) => (f.mul(24).isInt());
      if (![...va, ha, ...xi, ...holePts.flatMap((p) => [p[0], p[1]])].every((f) => inWin(f))) return null;
      if (yi && !inWin(yi, 9)) return null;
      if (![...va, ...holePts.map((p) => p[0])].every(grid)) return null;
      if (va.some((x) => x.eq(ha)) && rng.bool(0.5)) return null;
      return { N, D, tex, va, ha, holePts, xi, yi, red };
    });
    const { N, D, tex, va, ha, holePts, xi, yi, red } = built;
    const question = `f(x) = ${tex}`;
    const parts: string[] = [];
    parts.push(`Vertical asymptote${va.length > 1 ? 's' : ''}: ${va.map((x) => m(`x = ${num(x)}`)).join(', ')}`);
    parts.push(`Horizontal asymptote: ${m(`y = ${num(ha)}`)}`);
    if (holePts.length) parts.push(`Hole: ${holePts.map(([x, y]) => m(tuple([x, y]))).join(', ')}`);
    if (showInt && xi.length) parts.push(`$x$-intercept${xi.length > 1 ? 's' : ''}: ${xi.map((x) => m(tuple([num(x), '0']))).join(', ')}`);
    if (showInt && yi) parts.push(`$y$-intercept: ${m(tuple(['0', num(yi)]))}`);
    const answer = parts.join('; ');

    const blank = graphPlane(10, 2);
    const solved = graphPlane(10, 2);
    for (const x of va) solved.b.segment([x.value, -10], [x.value, 10], { dash: true, ink: 'muted', weight: 1.2 });
    solved.b.segment([-10, ha.value], [10, ha.value], { dash: true, ink: 'muted', weight: 1.2 });
    const f = (x: number) => {
      const d = D.evalNum(x);
      return d === 0 ? NaN : N.evalNum(x) / d;
    };
    plot(solved.b, f, solved.w, {}, 480);
    for (const [x, y] of holePts) solved.b.dot([x.value, y.value], true, 'accent');
    if (showInt) {
      for (const x of xi) solved.b.dot([x.value, 0], false, 'accent');
      if (yi && Math.abs(yi.value) <= 10) solved.b.dot([0, yi.value], false, 'accent');
    }
    const steps = [
      `Factor: ${m(`f(x) = \\frac{${polyFactoredTex(N, 'x')}}{${polyFactoredTex(D, 'x')}}`)}`,
      ...(holePts.length ? [`The common factor cancels, leaving a hole at ${holePts.map(([x, y]) => m(tuple([x, y]))).join(', ')}.`] : []),
      `Vertical asymptotes where the reduced denominator is zero: ${va.map((x) => m(`x = ${num(x)}`)).join(', ')}.`,
      red.N.degree < red.D.degree ? `The degree of the numerator is less than that of the denominator, so ${m('y = 0')}.` : `Equal degrees: ${m(`y = ${num(ha)}`)}, the ratio of the leading coefficients.`,
    ];
    return {
      question: m(question),
      answer,
      steps,
      diagram: blank.b.build('Blank coordinate plane'),
      answerDiagram: solved.b.build(`Graph of ${question}`),
      check: { kind: 'alg2-radicals-rational.ratgraph' },
    };
  },
});
