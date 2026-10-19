/** Graphing exponential and logarithmic functions with asymptotes and intercepts. */
import { graphPlane, plot, plotParam } from '../../../diagram';
import { Frac } from '../../../fraction';
import { attempt, boolOpt, defineTopic } from '../../../generator';
import type { Rng } from '../../../rng';
import { linear, m, num, term, tuple } from '../../../tex';
import type { Difficulty, ProblemContent } from '../../../types';
import { CATEGORY, baseTex, fr, logOf, powTex } from './common';

const RANGE = 10;

/** `b^{n}` for an integer n, avoiding a visible exponent 1 on parenthesised bases. */
function powNum(b: Frac, n: number): string {
  if (n === 1) return b.isInt() ? baseTex(b) : `\\left(${b.toTex()}\\right)`;
  return powTex(b, String(n));
}

function pickA(rng: Rng, d: Difficulty, reflect: boolean): Frac {
  const pool: Frac[] =
    d === 'easy' ? [fr(1)] : d === 'medium' ? [fr(1), fr(1), fr(2), fr(3)] : [fr(2), fr(3), fr(1, 2), fr(4), fr(1)];
  let a = rng.pick(pool);
  if (reflect && rng.bool(d === 'easy' ? 0.3 : 0.45)) a = a.neg();
  return a;
}

/** `a · core + k` in tidy form. */
function withA(a: Frac, core: string, isLog: boolean): string {
  if (isLog) return term(a, core);
  if (a.eq(1)) return core;
  if (a.eq(-1)) return `-${core}`;
  return `${a.toTex()} \\cdot ${core}`;
}

function plusK(s: string, k: number): string {
  return k === 0 ? s : k > 0 ? `${s} + ${k}` : `${s} - ${-k}`;
}

export const expGraph = defineTopic({
  id: 'alg2.explog.exp-graph',
  subject: 'algebra2',
  category: CATEGORY,
  title: 'Graphing Exponential Functions',
  description: 'Graph y = a·b^(x − h) + k and identify the asymptote, y-intercept, domain and range.',
  instruction: (o) =>
    o.domainRange
      ? 'Identify the asymptote, y-intercept, domain and range, then graph each function.'
      : 'Identify the asymptote and y-intercept, then graph each function.',
  multipleChoice: false,
  defaultCount: 6,
  options: [
    { type: 'boolean', id: 'reflect', label: 'Include reflections (negative a)', default: true },
    { type: 'boolean', id: 'fracBase', label: 'Include bases between 0 and 1 (decay)', default: true },
    { type: 'boolean', id: 'domainRange', label: 'Also state domain and range', default: true },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty: d } = ctx;
    const reflect = boolOpt(ctx, 'reflect');
    const fracBase = boolOpt(ctx, 'fracBase');
    const p = attempt('exp-graph', () => {
      const bases: Frac[] = d === 'medium' ? [fr(2), fr(3), fr(4)] : [fr(2), fr(3)];
      if (fracBase) bases.push(fr(1, 2), fr(1, 3), ...(d === 'hard' ? [fr(1, 2), fr(1, 4)] : []));
      const b = rng.pick(bases);
      const a = pickA(rng, d, reflect);
      let h = rng.int(-3, 3);
      let k = rng.int(-5, 5);
      if (d === 'easy') {
        if (rng.bool()) h = 0;
        else k = 0;
        if (h === 0 && k === 0) return null;
      } else if (d === 'hard' && (h === 0 || k === 0)) return null;
      const yint = a.mul(b.pow(-h)).add(k);
      if (yint.d > 32 || Math.abs(yint.value) > 40) return null;
      return { a, b, h, k, yint };
    });
    const { a, b, h, k, yint } = p;
    const fx = plusK(withA(a, powTex(b, linear(1, -h)), false), k);
    const f = (x: number) => a.value * b.value ** (x - h) + k;
    const above = a.sign > 0;

    const { b: blank } = graphPlane(RANGE, 2);
    const { b: g, w } = graphPlane(RANGE, 2);
    g.segment([-RANGE, k], [RANGE, k], { dash: true, ink: 'muted', weight: 1.2 });
    plot(g, f, w);
    if (Math.abs(yint.value) <= RANGE) g.dot([0, yint.value], false, 'accent');
    if (Math.abs(a.value + k) <= RANGE && Math.abs(h) <= RANGE) g.dot([h, a.value + k], false, 'accent');

    const rangeTex = `y ${above ? '>' : '<'} ${k}`;
    let answer = `Asymptote: ${m(`y = ${k}`)}; y-intercept: ${m(tuple([0, yint]))}`;
    if (boolOpt(ctx, 'domainRange')) answer += `; domain: all real numbers; range: ${m(rangeTex)}`;
    const growth = b.value > 1;
    const steps = [
      `Horizontal asymptote: ${m(`y = ${k}`)} (the vertical shift).`,
      `y-intercept: ${m(`y = ${[plusK(withA(a, powNum(b, -h), false), k), num(yint)].filter((t, i, all) => i === 0 || t !== all[0]).join(' = ')}`)}`,
      `Key point at ${m(`x = ${h}`)}: ${m(tuple([h, a.add(k)]))}; next point ${m(tuple([h + 1, a.mul(b).add(k)]))}.`,
      `The base ${m(baseTex(b))} ${growth ? 'is greater than 1' : 'is between 0 and 1'} and ${m(`a ${above ? '>' : '<'} 0`)}, so the graph ${growth === above ? 'rises' : 'falls'} from left to right and lies ${above ? 'above' : 'below'} the asymptote.`,
    ];
    return {
      question: m(`y = ${fx}`),
      answer,
      steps,
      diagram: blank.build('Blank coordinate plane'),
      answerDiagram: g.build(`Graph of y = ${fx} with dashed asymptote y = ${k}`),
      check: { kind: 'alg2-explog.graph', type: 'exp' },
    };
  },
});

export const logGraph = defineTopic({
  id: 'alg2.explog.log-graph',
  subject: 'algebra2',
  category: CATEGORY,
  title: 'Graphing Logarithmic Functions',
  description: 'Graph y = a·log_b(x − h) + k and identify the asymptote, x-intercept, domain and range.',
  instruction: (o) =>
    o.domainRange
      ? 'Identify the asymptote, x-intercept, domain and range, then graph each function.'
      : 'Identify the asymptote and x-intercept, then graph each function.',
  multipleChoice: false,
  defaultCount: 6,
  options: [
    { type: 'boolean', id: 'reflect', label: 'Include reflections (negative a)', default: true },
    { type: 'boolean', id: 'fracBase', label: 'Include bases between 0 and 1 (hard)', default: true },
    { type: 'boolean', id: 'domainRange', label: 'Also state domain and range', default: true },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty: d } = ctx;
    const reflect = boolOpt(ctx, 'reflect');
    const p = attempt('log-graph', () => {
      const bases: Frac[] = d === 'easy' ? [fr(2), fr(3), fr(4)] : [fr(2), fr(3), fr(4), fr(5)];
      if (d === 'hard' && boolOpt(ctx, 'fracBase')) bases.push(fr(1, 2), fr(1, 3));
      const b = rng.pick(bases);
      const a = pickA(rng, d, reflect);
      let h = rng.int(-5, 5);
      let k = rng.int(-4, 4);
      if (d === 'easy') {
        if (rng.bool()) h = 0;
        else k = 0;
        if (h === 0 && k === 0) return null;
      } else if (d === 'hard' && (h === 0 || k === 0)) return null;
      // x-intercept h + b^(−k/a) must be rational
      const e = new Frac(-k).div(a);
      if (!e.isInt() || Math.abs(e.value) > 3) return null;
      const xint = b.pow(e.value).add(h);
      if (xint.d > 16 || xint.value > 9.5) return null;
      return { a, b, h, k, xint, e: e.value };
    });
    const { a, b, h, k, xint } = p;
    const inner = linear(1, -h);
    const fx = plusK(withA(a, logOf(b, inner), true), k);
    const lb = Math.log(b.value);

    const { b: blank } = graphPlane(RANGE, 2);
    const { b: g, w } = graphPlane(RANGE, 2);
    g.segment([h, -RANGE], [h, RANGE], { dash: true, ink: 'muted', weight: 1.2 });
    // parametrise by y so the steep part near the asymptote is drawn smoothly
    plotParam(g, (t) => {
      const e = Math.exp(((t - k) / a.value) * lb);
      return e < 1e-4 ? NaN : h + e;
    }, (t) => t, -RANGE, RANGE, w, {}, 400);
    g.dot([xint.value, 0], false, 'accent');
    const one = h + 1;
    if (one <= RANGE && Math.abs(k) <= RANGE) g.dot([one, k], false, 'accent');

    let answer = `Asymptote: ${m(`x = ${h}`)}; x-intercept: ${m(tuple([xint, 0]))}`;
    if (boolOpt(ctx, 'domainRange')) answer += `; domain: ${m(`x > ${h}`)}; range: all real numbers`;
    const steps = [
      `Vertical asymptote: ${m(`x = ${h}`)} (where the argument ${m(inner)} is 0).`,
      `x-intercept: ${a.eq(1) ? '' : `${m(`${withA(a, logOf(b, inner), true)} = ${-k}`)}, so `}${m(`${logOf(b, inner)} = ${p.e}`)}, so ${m(`x = ${plusK(powNum(b, p.e), h)}`)}, giving ${m(tuple([xint, 0]))}.`,
      `Key point: ${m(tuple([h + 1, k]))}; then ${m(tuple([b.add(h), a.add(k)]))}.`,
      `Domain ${m(`x > ${h}`)}; the graph approaches the asymptote but never touches it.`,
    ];
    return {
      question: m(`y = ${fx}`),
      answer,
      steps,
      diagram: blank.build('Blank coordinate plane'),
      answerDiagram: g.build(`Graph of y = ${fx} with dashed asymptote x = ${h}`),
      check: { kind: 'alg2-explog.graph', type: 'log' },
    };
  },
});
