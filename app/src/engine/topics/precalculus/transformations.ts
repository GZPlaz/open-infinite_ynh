/** Transformations of parent functions: describe, write, and graph g(x) = a·f(b(x − h)) + k. */
import { graphPlane, plot } from '../../diagram';
import { Frac } from '../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, strOpt } from '../../generator';
import type { Rng } from '../../rng';
import { linear, m, num, scaled, sum, term } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';

type ParentId = 'sq' | 'cube' | 'abs' | 'sqrt' | 'cbrt' | 'recip';

interface Parent {
  tex: string;
  name: string;
  f: (x: number) => number;
  apply: (u: string) => string;
  even: boolean;
}

const PARENTS: Record<ParentId, Parent> = {
  sq: { tex: 'x^{2}', name: 'quadratic', f: (x) => x * x, apply: (u) => (u === 'x' ? 'x^{2}' : `(${u})^{2}`), even: true },
  cube: { tex: 'x^{3}', name: 'cubic', f: (x) => x ** 3, apply: (u) => (u === 'x' ? 'x^{3}' : `(${u})^{3}`), even: false },
  abs: { tex: '|x|', name: 'absolute value', f: Math.abs, apply: (u) => (u === 'x' ? '|x|' : `\\left|${u}\\right|`), even: true },
  sqrt: { tex: '\\sqrt{x}', name: 'square root', f: (x) => (x < 0 ? NaN : Math.sqrt(x)), apply: (u) => `\\sqrt{${u}}`, even: false },
  cbrt: { tex: '\\sqrt[3]{x}', name: 'cube root', f: Math.cbrt, apply: (u) => `\\sqrt[3]{${u}}`, even: false },
  recip: { tex: '\\frac{1}{x}', name: 'reciprocal', f: (x) => 1 / x, apply: (u) => `\\frac{1}{${u}}`, even: false },
};

interface T {
  a: Frac;
  b: Frac;
  h: number;
  k: number;
}

function gTex(pid: ParentId, t: T): string {
  const u = t.b.eq(1) ? linear(1, -t.h) : t.h === 0 ? term(t.b, 'x') : scaled(t.b, linear(1, -t.h));
  let main: string;
  if (pid === 'recip') {
    // a·1/u written as one fraction
    const n = t.a.abs();
    main = `${t.a.sign < 0 ? '-' : ''}\\frac{${n.n}}{${n.d === 1 ? '' : n.d}${n.d === 1 || u === 'x' || /^[\d\\]/.test(u) ? u : `(${u})`}}`;
  } else main = sum([{ coef: t.a, sym: PARENTS[pid].apply(u) }]);
  return t.k === 0 ? main : `${main} ${t.k < 0 ? '-' : '+'} ${Math.abs(t.k)}`;
}

const gFn = (pid: ParentId, t: T) => (x: number) => t.a.value * PARENTS[pid].f(t.b.value * (x - t.h)) + t.k;

const units = (n: number) => `$${Math.abs(n)}$ unit${Math.abs(n) === 1 ? '' : 's'}`;

/** Phrases in a fixed order: reflections, stretches, translations. */
function phrases(t: T): string[] {
  const out: string[] = [];
  if (t.a.sign < 0) out.push('reflection across the $x$-axis');
  if (t.b.sign < 0) out.push('reflection across the $y$-axis');
  const A = t.a.abs();
  if (!A.eq(1)) out.push(`vertical ${A.cmp(1) > 0 ? 'stretch' : 'compression'} by a factor of $${num(A)}$`);
  const B = t.b.abs();
  if (!B.eq(1)) out.push(`horizontal ${B.cmp(1) > 0 ? 'compression' : 'stretch'} by a factor of $${num(B.inv())}$`);
  if (t.h !== 0) out.push(`shift ${units(t.h)} ${t.h < 0 ? 'left' : 'right'}`);
  if (t.k !== 0) out.push(`shift ${units(t.k)} ${t.k < 0 ? 'down' : 'up'}`);
  return out;
}

function describe(t: T): string {
  const p = phrases(t);
  const s = p.join(', ');
  return `${s.charAt(0).toUpperCase()}${s.slice(1)}.`;
}

function pickT(rng: Rng, d: Difficulty, pid: ParentId): T {
  return attempt('transform', () => {
    const h = rng.int(-5, 5);
    const k = rng.int(-5, 5);
    let a = new Frac(1);
    let b = new Frac(1);
    if (d === 'easy') a = new Frac(rng.bool(0.35) ? -1 : 1);
    else {
      const mags = pid === 'recip' ? [1, 2, 3, 4] : [1, 2, 3, 4, new Frac(1, 2), new Frac(1, 3)];
      a = Frac.of(rng.pick(mags)).mul(rng.bool(0.4) ? -1 : 1);
    }
    if (d === 'hard' && pid !== 'recip') {
      if (pid === 'sqrt' && rng.bool(0.4)) b = new Frac(-1);
      else if (rng.bool(0.7)) b = Frac.of(rng.pick([2, 3, new Frac(1, 2), new Frac(1, 3)]));
      // a vertical and a horizontal stretch at once is ambiguous for power functions
      if (!b.abs().eq(1) && !a.abs().eq(1)) a = new Frac(a.sign);
    }
    const t = { a, b, h, k };
    if (phrases(t).length < (d === 'easy' ? 1 : 2)) return null;
    if (d !== 'easy' && h === 0 && k === 0) return null;
    return t;
  });
}

const SAMPLES = [-2.7, -1.3, 0.6, 1.7, 3.1, 4.4, 5.9];
function sameFn(f: (x: number) => number, g: (x: number) => number): boolean {
  return SAMPLES.every((x) => {
    const u = f(x);
    const v = g(x);
    return Number.isFinite(u) === Number.isFinite(v) && (!Number.isFinite(u) || Math.abs(u - v) < 1e-9);
  });
}

export const transformations = defineTopic({
  id: 'precalc.functions.transformations',
  subject: 'precalculus',
  category: 'Functions',
  title: 'Transformations of Functions',
  description: 'Describe or write transformations (shifts, reflections, stretches) of the parent functions; optionally graph them.',
  instruction: (o) => {
    const base = o.task === 'write' ? 'Write the transformed function g(x).' : o.task === 'describe' ? 'Describe the transformations from f(x) to g(x).' : 'Describe or write each transformation of f(x).';
    return o.graph ? `${base} Then graph g(x).` : base;
  },
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Task',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'Mixed' },
        { value: 'describe', label: 'Describe the transformations' },
        { value: 'write', label: 'Write the function' },
      ],
    },
    {
      type: 'select',
      id: 'parents',
      label: 'Parent functions',
      default: 'all',
      choices: [
        { value: 'all', label: 'All' },
        { value: 'basic', label: 'x², |x|, √x only' },
      ],
    },
    { type: 'boolean', id: 'graph', label: 'Graph the transformed function', default: false },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const tOpt = strOpt(ctx, 'task');
    const task = tOpt === 'mixed' ? rng.pick(['describe', 'write']) : tOpt;
    const pids: ParentId[] = strOpt(ctx, 'parents') === 'basic' ? ['sq', 'abs', 'sqrt'] : ['sq', 'cube', 'abs', 'sqrt', 'cbrt', 'recip'];
    const pid = rng.pick(pids);
    const P = PARENTS[pid];
    const t = pickT(rng, difficulty, pid);
    const g = gTex(pid, t);
    const fDef = m(`f(x) = ${P.tex}`);
    const gFun = gFn(pid, t);

    // wrong transformations, kept only when they really give a different function
    const mutants: T[] = [
      { ...t, h: -t.h },
      { ...t, k: -t.k },
      { ...t, a: t.a.neg() },
      { ...t, h: t.k, k: t.h },
      { ...t, a: t.a.abs().eq(1) ? t.a.mul(2) : t.a.inv() },
      { ...t, b: t.b.abs().eq(1) ? t.b : t.b.inv() },
      { ...t, h: -t.h, k: -t.k },
    ].filter((w) => phrases(w).length > 0 && !sameFn(gFn(pid, w), gFun));
    const uniq: T[] = [];
    for (const w of mutants) if (!uniq.some((u) => sameFn(gFn(pid, u), gFn(pid, w)))) uniq.push(w);

    let question: string;
    let answer: string;
    let render: (w: T) => string;
    if (task === 'describe') {
      question = `Describe the transformations from ${fDef} to ${m(`g(x) = ${g}`)}.`;
      render = describe;
    } else {
      const list = phrases(t).map((s) => `a ${s}`);
      const said = list.length === 1 ? list[0] : `${list.slice(0, -1).join(', ')}, and ${list.at(-1)}`;
      question = `Let ${fDef}. Write ${m('g(x)')}, the result of ${said}.`;
      render = (w) => m(`g(x) = ${gTex(pid, w)}`);
    }
    answer = render(t);
    const steps: string[] = [`Parent function: ${fDef} (${P.name}).`];
    if (!t.a.eq(1)) steps.push(`${m(`a = ${num(t.a)}`)}: ${t.a.sign < 0 ? 'reflect across the $x$-axis' : ''}${t.a.sign < 0 && !t.a.abs().eq(1) ? ' and ' : ''}${t.a.abs().eq(1) ? '' : `vertical ${t.a.abs().cmp(1) > 0 ? 'stretch' : 'compression'} by $${num(t.a.abs())}$`}.`);
    if (!t.b.eq(1)) steps.push(`${m(`b = ${num(t.b)}`)}: ${t.b.sign < 0 ? 'reflect across the $y$-axis' : `horizontal ${t.b.abs().cmp(1) > 0 ? 'compression' : 'stretch'} by $${num(t.b.abs().inv())}$`}.`);
    if (t.h !== 0) steps.push(`${m(`h = ${t.h}`)}: shift ${t.h < 0 ? 'left' : 'right'}.`);
    if (t.k !== 0) steps.push(`${m(`k = ${t.k}`)}: shift ${t.k < 0 ? 'down' : 'up'}.`);
    if (task === 'write') steps.push(answer);
    else steps.push(answer);

    const distractors = distinctDistractors(answer, uniq.map(render), (j) => render({ ...t, k: t.k + j * (t.k >= 0 ? 1 : -1) + (j > 2 ? 1 : 0) }));

    let diagram;
    let answerDiagram;
    if (boolOpt(ctx, 'graph')) {
      const q = graphPlane(10, 2);
      plot(q.b, P.f, q.w, { ink: 'muted', dash: true, role: undefined, weight: 1 });
      diagram = q.b.build(`Coordinate plane showing the parent function f(x) = ${P.tex} dashed`);
      const a = graphPlane(10, 2);
      plot(a.b, P.f, a.w, { ink: 'muted', dash: true, role: undefined, weight: 1 });
      plot(a.b, gFun, a.w);
      answerDiagram = a.b.build(`Graph of g(x) = ${g} with the parent function dashed`);
    }
    return {
      question,
      answer,
      steps,
      distractors,
      diagram,
      answerDiagram,
      check: { kind: 'precalculus.transform' },
    };
  },
});
