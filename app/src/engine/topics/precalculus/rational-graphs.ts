/** Graphing rational functions: vertical, horizontal and slant asymptotes, holes and intercepts. */
import { graphPlane, plot } from '../../diagram';
import { Frac } from '../../fraction';
import { attempt, defineTopic } from '../../generator';
import { Poly } from '../../polynomial';
import { linear, m, num, tuple } from '../../tex';
import type { ProblemContent } from '../../types';

/** Quotient and remainder of p ÷ d. */
export function polyDivide(p: Poly, d: Poly): { q: Poly; r: Poly } {
  let r = p;
  let q = Poly.of(0);
  while (!r.isZero() && r.degree >= d.degree) {
    const k = r.degree - d.degree;
    const c = r.lead().div(d.lead());
    const mono = new Poly([...Array.from({ length: k }, () => 0), c]);
    q = q.add(mono);
    r = r.sub(d.mul(mono));
  }
  return { q, r };
}

export const rationalGraphs = defineTopic({
  id: 'precalc.rational.graph',
  subject: 'precalculus',
  category: 'Polynomial and Rational Functions',
  title: 'Graphing Rational Functions',
  description: 'Find vertical, horizontal and slant asymptotes, holes and intercepts, then graph the rational function.',
  instruction: 'Identify the asymptotes, holes and intercepts of each function. Then graph it.',
  multipleChoice: false,
  defaultCount: 4,
  options: [
    { type: 'boolean', id: 'slant', label: 'Include slant asymptotes', default: true },
    { type: 'boolean', id: 'holes', label: 'Include holes', default: true },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const slantOk = ctx.options.slant === true;
    const holesOk = ctx.options.holes === true;
    const spec = attempt('rational-graph', () => {
      const slant = slantOk && difficulty === 'hard' && rng.bool(0.6);
      const degD = difficulty === 'easy' ? 1 : slant ? rng.pick([1, 1, 2]) : 2;
      const degN = slant ? degD + 1 : difficulty === 'easy' ? rng.int(0, 1) : rng.int(0, degD);
      const hole = holesOk && difficulty !== 'easy' && rng.bool(0.45);
      const vals = rng.sample([-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6], degN + degD + (hole ? 1 : 0));
      const roots = vals.slice(0, degN);
      const poles = vals.slice(degN, degN + degD);
      const s = hole ? vals[degN + degD]! : null;
      const a = new Frac(slant ? rng.pick([1, -1, 1, 2]) : rng.signedInt(1, degN === degD ? 3 : 6, true));
      const Nr = Poly.fromRoots(roots).scale(a);
      const Dr = Poly.fromRoots(poles);
      const N = s === null ? Nr : Nr.mul(Poly.linear(1, -s));
      const D = s === null ? Dr : Dr.mul(Poly.linear(1, -s));
      const reduced = (x: Frac) => Nr.eval(x).div(Dr.eval(x));
      let holeY: Frac | null = null;
      if (s !== null) {
        holeY = reduced(new Frac(s));
        if (Math.abs(holeY.value) > 8 || holeY.d > 6) return null;
      }
      let asym: Poly;
      if (degN < degD) asym = Poly.of(0);
      else if (degN === degD) asym = Poly.of(a);
      else {
        asym = polyDivide(Nr, Dr).q;
        if (!asym.isIntegral() || Math.abs(asym.coef(0).value) > 7) return null;
        // the slant line should not coincide with a removable feature
      }
      if (!N.isIntegral() || N.c.some((c) => Math.abs(c.value) > 60) || D.c.some((c) => Math.abs(c.value) > 60)) return null;
      const yInt = poles.includes(0) || s === 0 ? null : reduced(Frac.ZERO);
      if (yInt && (Math.abs(yInt.value) > 9 || yInt.d > 12)) return null;
      return { roots: roots.sort((x, y) => x - y), poles: poles.sort((x, y) => x - y), s, holeY, Nr, Dr, N, D, asym, slant: degN > degD, yInt };
    });
    const { roots, poles, s, holeY, Nr, Dr, N, D, asym, slant, yInt } = spec;
    const fTex = `\\frac{${N.toTex()}}{${D.toTex()}}`;
    const pt = (x: Frac | number, y: Frac | number) => m(tuple([x, y]));
    const parts = [
      `Vertical asymptotes: ${poles.map((p) => m(`x = ${p}`)).join(', ')}`,
      `${slant ? 'Slant' : 'Horizontal'} asymptote: ${m(`y = ${asym.toTex()}`)}`,
      `Holes: ${s === null ? 'none' : pt(s, holeY!)}`,
      `x-intercepts: ${roots.filter((r) => r !== s).map((r) => pt(r, 0)).join(', ') || 'none'}`,
      `y-intercept: ${yInt === null ? 'none' : pt(0, yInt)}`,
    ];
    const answer = parts.join('; ');
    const steps: string[] = [];
    const fact = (rs: number[]) => rs.map((r) => `(${linear(1, -r)})`).join('');
    if (D.degree > 1 || N.degree > 1 || s !== null) {
      const facs = `${fact(roots)}${s === null ? '' : `(${linear(1, -s)})`}`;
      const lead = Nr.lead();
      const top = !facs ? num(lead) : lead.eq(1) ? facs : lead.eq(-1) ? `-${facs}` : `${num(lead)}${facs}`;
      steps.push(`Factor: ${m(`f(x) = \\frac{${top}}{${fact(poles)}${s === null ? '' : `(${linear(1, -s)})`}}`)}`);
    }
    if (s !== null) steps.push(`The factor ${m(`(${linear(1, -s)})`)} cancels, leaving a hole at ${m(`x = ${s}`)}: ${m(`y = ${num(holeY!)}`)}.`);
    steps.push(`Zeros of the denominator give the vertical asymptotes ${poles.map((p) => m(`x = ${p}`)).join(', ')}.`);
    if (slant) steps.push(`Divide: ${m(`\\frac{${Nr.toTex()}}{${Dr.toTex()}} = ${asym.toTex()} + \\frac{${polyDivide(Nr, Dr).r.toTex()}}{${Dr.toTex()}}`)}, so the slant asymptote is ${m(`y = ${asym.toTex()}`)}.`);
    else steps.push(N.degree < D.degree ? 'The degree of the numerator is less than the degree of the denominator.' : 'The degrees are equal: the asymptote is the ratio of the leading coefficients.');

    const { b, w } = graphPlane(10, 2);
    const line = (x0: number, y0: number, x1: number, y1: number) => b.segment([x0, y0], [x1, y1], { dash: true, ink: 'muted', weight: 1 });
    for (const p of poles) line(p, -10, p, 10);
    if (!slant) line(-10, asym.evalNum(0), 10, asym.evalNum(0));
    else {
      const mm = asym.coef(1).value;
      const c = asym.coef(0).value;
      const xa = Math.max(-10, Math.min(...[-10, 10].map((y) => (y - c) / mm)));
      const xb = Math.min(10, Math.max(...[-10, 10].map((y) => (y - c) / mm)));
      line(xa, asym.evalNum(xa), xb, asym.evalNum(xb));
    }
    const f = (x: number) => (s !== null && Math.abs(x - s) < 1e-6 ? NaN : Nr.evalNum(x) / Dr.evalNum(x));
    plot(b, f, w);
    if (s !== null) b.dot([s, holeY!.value], true, 'accent');
    return {
      question: m(`f(x) = ${fTex}`),
      answer,
      steps,
      diagram: graphPlane(10, 2).b.build('Blank coordinate plane'),
      answerDiagram: b.build(`Graph of f(x) with dashed asymptotes`),
      check: { kind: 'precalculus.rationalGraph' },
    };
  },
});
