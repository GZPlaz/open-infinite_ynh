/** Functions of several variables, limits, partial derivatives and the chain rule. */
import { Frac } from '../../fraction';
import { attempt, offset } from '../../generator';
import type { Rng } from '../../rng';
import { m, num } from '../../tex';
import type { Difficulty } from '../../types';
import { diff, evalExact, mt, norm, scale, randF, randMono, sorted, taskTopic, tex, wrongD, type MX } from './common';

const CAT = 'Partial Derivatives';
const fdef = (f: MX, vars: readonly string[], name = 'f') => `${name}(${vars.join(', ')}) = ${tex(f)}`;
const bump = (f: MX, k: number): MX => norm([...f, mt(offset(k))]);

// ---------------------------------------------------------------- functions of several variables

interface Cond {
  l: string;
  rel: string;
  r: string;
}
const condTex = (cs: readonly Cond[]) => `\\left\\{(x, y) \\mid ${cs.map((c) => `${c.l} ${c.rel} ${c.r}`).join(',\\ ')}\\right\\}`;
const FLIP: Record<string, string> = { '\\le': '\\ge', '\\ge': '\\le', '<': '>', '>': '<', '\\neq': '=' };
const STRICT: Record<string, string> = { '\\le': '<', '<': '\\le', '\\ge': '>', '>': '\\ge', '\\neq': '>' };

function domainTemplate(rng: Rng, d: Difficulty): { f: string; conds: Cond[]; alt: string } {
  const a = rng.int(1, 5);
  const c = rng.int(1, 4);
  const pool: Array<() => { f: string; conds: Cond[]; alt: string }> = [
    () => ({ f: `\\sqrt{${a * a} - x^{2} - y^{2}}`, conds: [{ l: 'x^{2} + y^{2}', rel: '\\le', r: String(a * a) }], alt: String(a) }),
    () => ({ f: `\\ln(y - x^{2})`, conds: [{ l: 'y', rel: '>', r: 'x^{2}' }], alt: '-x^{2}' }),
    () => ({ f: `\\sqrt{y - ${c === 1 ? '' : c}x^{2}}`, conds: [{ l: 'y', rel: '\\ge', r: `${c === 1 ? '' : c}x^{2}` }], alt: `${c === 1 ? '' : c}x` }),
    () => ({ f: `\\frac{${a}}{x - ${c === 1 ? '' : c}y}`, conds: [{ l: 'x', rel: '\\neq', r: `${c === 1 ? '' : c}y` }], alt: `-${c === 1 ? '' : c}y` }),
    () => ({ f: `\\ln(${c} - x - y)`, conds: [{ l: 'x + y', rel: '<', r: String(c) }], alt: String(-c) }),
  ];
  if (d !== 'easy')
    pool.push(
      () => ({ f: `\\sqrt{x^{2} + y^{2} - ${a * a}}`, conds: [{ l: 'x^{2} + y^{2}', rel: '\\ge', r: String(a * a) }], alt: String(a) }),
      () => ({ f: `\\ln(${a * a} - x^{2} - ${c === 1 ? '' : c}y^{2})`, conds: [{ l: `x^{2} + ${c === 1 ? '' : c}y^{2}`, rel: '<', r: String(a * a) }], alt: String(a) }),
      () => ({ f: `\\sqrt{x} + \\sqrt{y - ${c}}`, conds: [{ l: 'x', rel: '\\ge', r: '0' }, { l: 'y', rel: '\\ge', r: String(c) }], alt: String(-c) }),
      () => ({ f: `\\frac{\\sqrt{y - x}}{x + ${c}}`, conds: [{ l: 'y', rel: '\\ge', r: 'x' }, { l: 'x', rel: '\\neq', r: String(-c) }], alt: String(c) }),
    );
  return rng.pick(pool)();
}

const LEVELS = ['Circles centered at the origin', 'Ellipses centered at the origin', 'Hyperbolas', 'Parabolas', 'Parallel lines', 'Lines through the origin'] as const;
type Level = (typeof LEVELS)[number];

function levelTemplate(rng: Rng, d: Difficulty): { f: string; kind: Level } {
  const a = rng.int(2, 5);
  const b = rng.intExcept(1, 6, [a]);
  const s = (k: number) => (k === 1 ? '' : String(k));
  const kind = rng.pick(LEVELS);
  const opts: Record<Level, string[]> = {
    'Circles centered at the origin': [`x^{2} + y^{2}`, `${a}x^{2} + ${a}y^{2}`, `\\sqrt{x^{2} + y^{2}}`, `e^{x^{2} + y^{2}}`, `\\ln(x^{2} + y^{2} + ${b})`],
    'Ellipses centered at the origin': [`${s(a)}x^{2} + ${s(b)}y^{2}`, `\\sqrt{${s(b)}x^{2} + ${s(a)}y^{2}}`, `e^{${s(a)}x^{2} + ${s(b)}y^{2}}`],
    Hyperbolas: [`${s(a)}x^{2} - ${s(b)}y^{2}`, `${s(a)}xy`, `${s(b)}y^{2} - ${s(a)}x^{2}`],
    Parabolas: [`y - ${s(a)}x^{2}`, `x + ${s(b)}y^{2}`, `${s(a)}x^{2} + y`],
    'Parallel lines': [`${s(a)}x + ${s(b)}y`, `${s(a)}x - ${s(b)}y + ${b}`, `e^{${s(a)}x - y}`],
    'Lines through the origin': [`\\frac{y}{x}`, `\\frac{${a}y}{x}`, `\\frac{x}{y}`],
  };
  const pool = opts[kind];
  return { f: d === 'easy' ? pool[0]! : rng.pick(pool), kind };
}

type FTask = 'evaluate' | 'domain' | 'level';

export const severalVariables = taskTopic<FTask>({
  id: 'mv.partial.functions',
  title: 'Functions of Several Variables',
  description: 'Evaluate functions of two and three variables, find domains and describe level curves.',
  category: CAT,
  instruction: 'Answer each question.',
  tasks: [
    { value: 'evaluate', label: 'Evaluate' },
    { value: 'domain', label: 'Domain' },
    { value: 'level', label: 'Level curves' },
  ],
  mix: { easy: ['evaluate', 'domain', 'level'], medium: ['evaluate', 'domain', 'level'], hard: ['evaluate', 'domain', 'level'] },
  build(task, { rng, difficulty }) {
    switch (task) {
      case 'evaluate': {
        const three = difficulty === 'hard';
        const vars = three ? ['x', 'y', 'z'] : ['x', 'y'];
        const { f, pt, v } = attempt('evaluate', () => {
          const f = sorted(randF(rng, difficulty === 'hard' ? 'medium' : difficulty === 'medium' ? 'hard' : 'easy', vars, difficulty === 'hard'));
          const pt = vars.map(() => rng.int(-3, 3));
          const v = evalExact(f, Object.fromEntries(vars.map((x, i) => [x, pt[i]!])));
          return v ? { f, pt, v } : null;
        });
        const name = `f(${pt.join(', ')})`;
        const ans = (x: Frac | null) => m(`${name} = ${num(x ?? v.add(7))}`);
        const swapped = evalExact(f, Object.fromEntries(vars.map((x, i) => [x, pt[(i + 1) % vars.length]!])));
        const negd = evalExact(f, Object.fromEntries(vars.map((x, i) => [x, i === 0 ? -pt[0]! : pt[i]!])));
        return {
          question: `Evaluate ${m(name)} for ${m(fdef(f, vars))}.`,
          answer: ans(v),
          steps: [`Substitute ${vars.map((x, i) => m(`${x} = ${pt[i]}`)).join(', ')}.`, ans(v)],
          wrongs: [ans(swapped), ans(negd), ans(v.neg())],
          fallback: (k) => ans(v.add(offset(k))),
          check: { kind: 'multivariable.evaluate' },
        };
      }
      case 'domain': {
        const t = domainTemplate(rng, difficulty);
        const ans = (cs: readonly Cond[]) => m(condTex(cs));
        const mut = (i: number, ch: (c: Cond) => Cond) => t.conds.map((c, j) => (j === i ? ch(c) : c));
        const last = t.conds.length - 1;
        return {
          question: `Find the domain of ${m(`f(x, y) = ${t.f}`)}.`,
          answer: ans(t.conds),
          steps: [/sqrt/.test(t.f) ? 'The expression under a square root must be non-negative.' : /ln/.test(t.f) ? 'The argument of a logarithm must be positive.' : 'The denominator cannot be zero.', ans(t.conds)],
          wrongs: [ans(mut(0, (c) => ({ ...c, rel: FLIP[c.rel]! }))), ans(mut(last, (c) => ({ ...c, rel: STRICT[c.rel]! }))), ans(mut(0, (c) => ({ ...c, r: t.alt })))],
          fallback: (k) => ans(mut(0, (c) => ({ ...c, r: `${c.r} + ${k}` }))),
          check: { kind: 'multivariable.domain' },
        };
      }
      case 'level':
      default: {
        const t = levelTemplate(rng, difficulty);
        const near: Record<Level, Level[]> = {
          'Circles centered at the origin': ['Ellipses centered at the origin', 'Parabolas', 'Lines through the origin'],
          'Ellipses centered at the origin': ['Circles centered at the origin', 'Hyperbolas', 'Parabolas'],
          Hyperbolas: ['Ellipses centered at the origin', 'Parabolas', 'Lines through the origin'],
          Parabolas: ['Hyperbolas', 'Circles centered at the origin', 'Parallel lines'],
          'Parallel lines': ['Lines through the origin', 'Parabolas', 'Hyperbolas'],
          'Lines through the origin': ['Parallel lines', 'Hyperbolas', 'Circles centered at the origin'],
        };
        return {
          question: `Describe the level curves ${m('f(x, y) = k')} of ${m(`f(x, y) = ${t.f}`)}.`,
          answer: t.kind,
          steps: [`Set ${m(`${t.f} = k`)} and simplify.`, `The level curves are ${t.kind.toLowerCase()}.`],
          wrongs: near[t.kind],
          fallback: () => null,
          check: { kind: 'multivariable.level' },
        };
      }
    }
  },
});

// ---------------------------------------------------------------- limits

type LimKind = 'continuous' | 'factor' | 'dne' | 'zero';
const DNE = 'Does not exist';

export const multiLimits = taskTopic<LimKind>({
  id: 'mv.partial.limits',
  title: 'Limits and Continuity of Multivariable Functions',
  description: 'Evaluate limits of functions of two variables, or show that they do not exist by approaching along different paths.',
  category: CAT,
  instruction: 'Find each limit, if it exists.',
  tasks: [
    { value: 'continuous', label: 'Direct substitution' },
    { value: 'factor', label: 'Factor and cancel' },
    { value: 'dne', label: 'Does not exist (two paths)' },
    { value: 'zero', label: 'Limit zero (squeeze / polar)' },
  ],
  mix: { easy: ['continuous', 'factor', 'dne'], medium: ['continuous', 'factor', 'dne', 'zero'], hard: ['factor', 'dne', 'zero', 'dne'] },
  build(task, { rng, difficulty }) {
    const lim = (pt: readonly number[], body: string) => m(`\\displaystyle \\lim_{(x, y) \\to (${pt.join(', ')})} ${body}`);
    const k = rng.int(1, 4);
    const s = (n: number) => (n === 1 ? '' : String(n));
    switch (task) {
      case 'continuous': {
        const { N, D, pt, v } = attempt('continuous', () => {
          const N = sorted(randF(rng, 'easy', ['x', 'y'], false));
          const D = norm([mt(1, randMono(rng, ['x', 'y'], 1, 2)), mt(rng.signedInt(1, 5, true), { [rng.pick(['x', 'y'])]: 1 }), mt(rng.int(1, 6))]);
          const pt = [rng.int(-3, 3), rng.int(-3, 3)];
          const env = { x: pt[0]!, y: pt[1]! };
          const dv = evalExact(D, env)!;
          if (dv.isZero()) return null;
          return { N, D, pt, v: evalExact(N, env)!.div(dv) };
        });
        const ans = (x: Frac) => m(num(x));
        const env = { x: pt[0]!, y: pt[1]! };
        return {
          question: lim(pt, `\\frac{${tex(N)}}{${tex(D)}}`),
          answer: ans(v),
          steps: ['The function is continuous at the point (the denominator is not zero), so substitute.', ans(v)],
          wrongs: [ans(v.neg()), ans(evalExact(N, env)!), ans(evalExact(N, { x: pt[1]!, y: pt[0]! })!.div(evalExact(D, env)!))],
          fallback: (j) => ans(v.add(offset(j))),
          check: { kind: 'multivariable.limit' },
        };
      }
      case 'factor': {
        const a = rng.signedInt(1, 4, true);
        const b = rng.signedInt(1, 4, true);
        const forms: Array<() => { body: string; pt: number[]; v: Frac; step: string }> = [
          () => ({ body: `\\frac{x^{2} - ${s(k * k)}y^{2}}{x - ${s(k)}y}`, pt: [k * a, a], v: new Frac(2 * k * a), step: `\\frac{(x - ${s(k)}y)(x + ${s(k)}y)}{x - ${s(k)}y} = x + ${s(k)}y` }),
          () => ({ body: `\\frac{x^{3} - y^{3}}{x - y}`, pt: [a, a], v: new Frac(3 * a * a), step: `\\frac{(x - y)(x^{2} + xy + y^{2})}{x - y} = x^{2} + xy + y^{2}` }),
          () => ({ body: `\\frac{xy - ${s(k)}y}{x - ${k}}`, pt: [k, b], v: new Frac(b), step: `\\frac{y(x - ${k})}{x - ${k}} = y` }),
          () => ({ body: `\\frac{x - y}{\\sqrt{x} - \\sqrt{y}}`, pt: [k * k, k * k], v: new Frac(2 * k), step: `\\frac{(\\sqrt{x} - \\sqrt{y})(\\sqrt{x} + \\sqrt{y})}{\\sqrt{x} - \\sqrt{y}} = \\sqrt{x} + \\sqrt{y}` }),
          () => ({ body: `\\frac{x^{2}y - ${s(k * k)}y}{x - ${k}}`, pt: [k, b], v: new Frac(2 * k * b), step: `\\frac{y(x - ${k})(x + ${k})}{x - ${k}} = y(x + ${k})` }),
        ];
        const f = rng.pick(forms)();
        const ans = (x: Frac) => m(num(x));
        return {
          question: lim(f.pt, f.body),
          answer: ans(f.v),
          steps: [m(f.step), ans(f.v)],
          wrongs: [DNE, ans(Frac.ZERO.eq(f.v) ? new Frac(1) : Frac.ZERO), ans(f.v.add(f.v.sign >= 0 ? 1 : -1))],
          fallback: (j) => ans(f.v.add(offset(j) * 2)),
          check: { kind: 'multivariable.limit' },
        };
      }
      case 'dne': {
        const along = (p1: string, v1: Frac, p2: string, v2: Frac) => `Along ${m(p1)} the value is ${m(num(v1))}; along ${m(p2)} it is ${m(num(v2))}.`;
        const c = rng.int(1, 5);
        const j = rng.int(1, 4);
        const forms: Array<() => { body: string; why: string; vals: [Frac, Frac] }> = [
          () => ({ body: `\\frac{${s(c)}x^{2} - ${s(c * j)}y^{2}}{x^{2} + ${s(j)}y^{2}}`, why: along('y = 0', new Frac(c), 'x = 0', new Frac(-c)), vals: [new Frac(c), new Frac(-c)] }),
          () => ({ body: `\\frac{${s(c)}xy}{x^{2} + ${s(j)}y^{2}}`, why: along('y = 0', new Frac(0), 'y = x', new Frac(c, 1 + j)), vals: [new Frac(0), new Frac(c, 1 + j)] }),
          () => ({ body: `\\frac{${s(c)}x^{2}}{x^{2} + ${s(j)}y^{2}}`, why: along('y = 0', new Frac(c), 'x = 0', new Frac(0)), vals: [new Frac(c), new Frac(0)] }),
          () => ({ body: `\\frac{${s(c)}x^{2}y}{x^{4} + ${s(j)}y^{2}}`, why: along('y = 0', new Frac(0), 'y = x^{2}', new Frac(c, 1 + j)), vals: [new Frac(0), new Frac(c, 1 + j)] }),
          () => ({ body: `\\frac{${s(c)}xy^{2}}{${s(j)}x^{2} + y^{4}}`, why: along('x = 0', new Frac(0), 'x = y^{2}', new Frac(c, 1 + j)), vals: [new Frac(0), new Frac(c, 1 + j)] }),
          () => ({ body: `\\frac{x + ${s(c)}y}{x - ${s(j)}y}`, why: along('y = 0', new Frac(1), 'x = 0', new Frac(-c, j)), vals: [new Frac(1), new Frac(-c, j)] }),
        ];
        const f = rng.pick(difficulty === 'easy' ? forms.slice(0, 3) : forms)();
        return {
          question: lim([0, 0], f.body),
          answer: DNE,
          steps: [f.why, 'Different paths give different values, so the limit does not exist.'],
          wrongs: [m(num(f.vals[0])), m(num(f.vals[1])), m(f.vals[0].isZero() || f.vals[1].isZero() ? '1' : '0')],
          fallback: (j) => m(String(j + 1)),
          check: { kind: 'multivariable.limit' },
        };
      }
      case 'zero':
      default: {
        const k2 = rng.int(1, 9);
        const j2 = rng.int(1, 3);
        const forms = [`\\frac{${s(k2)}x^{2}y}{x^{2} + ${s(j2)}y^{2}}`, `\\frac{${s(k2)}x^{3}}{x^{2} + ${s(j2)}y^{2}}`, `\\frac{${s(k2)}xy}{\\sqrt{x^{2} + ${s(j2)}y^{2}}}`, `\\frac{${s(k2)}x^{2}y^{2}}{${s(j2)}x^{2} + y^{2}}`, `\\frac{${s(k2)}xy^{2}}{x^{2} + ${s(j2)}y^{2}}`];
        const body = rng.pick(forms);
        return {
          question: lim([0, 0], body),
          answer: m('0'),
          steps: [`In polar coordinates the expression is ${m('r')} times a bounded function of ${m('\\theta')}.`, m(`\\text{As } r \\to 0, \\text{ the limit is } 0`)],
          wrongs: [DNE, m(String(k2)), m(`\\frac{${k2}}{${j2 + 1}}`)],
          fallback: (jj) => m(String(k2 + jj)),
          check: { kind: 'multivariable.limit' },
        };
      }
    }
  },
});

// ---------------------------------------------------------------- partial derivatives

type PTask = 'first' | 'second' | 'mixed' | 'three' | 'atPoint';

const dname = (vs: string) => `f_{${vs}}`;
const dOf = (f: MX, vs: string): MX => [...vs].reduce((g, v) => diff(g, v), f);
const segList = (items: Array<[string, MX]>) => items.map(([n, e]) => m(`${n} = ${tex(e)}`)).join(', ');

export const partialDerivatives = taskTopic<PTask>({
  id: 'mv.partial.partial-derivatives',
  title: 'Partial Derivatives',
  description: 'First and higher-order partial derivatives, including mixed partials and functions of three variables.',
  category: CAT,
  instruction: 'Find the indicated partial derivatives.',
  tasks: [
    { value: 'first', label: 'First partials (two variables)' },
    { value: 'second', label: 'Second partials' },
    { value: 'mixed', label: 'Mixed partials' },
    { value: 'three', label: 'Three variables' },
    { value: 'atPoint', label: 'Partial at a point' },
  ],
  mix: { easy: ['first', 'atPoint', 'first'], medium: ['first', 'second', 'mixed', 'three'], hard: ['first', 'second', 'mixed', 'three'] },
  build(task, { rng, difficulty }) {
    const vars = task === 'three' ? ['x', 'y', 'z'] : ['x', 'y'];
    if (task === 'atPoint') {
      const v = rng.pick(['x', 'y']);
      const { f, pt, val } = attempt('atPoint', () => {
        const f = sorted(randF(rng, difficulty === 'easy' ? 'easy' : 'medium', vars, difficulty !== 'easy'));
        const pt = [rng.int(-3, 3), rng.int(-3, 3)];
        const val = evalExact(diff(f, v), { x: pt[0]!, y: pt[1]! });
        return val ? { f, pt, val } : null;
      });
      const name = `${dname(v)}(${pt.join(', ')})`;
      const ans = (x: Frac | null) => m(`${name} = ${num(x ?? val.add(5))}`);
      const env = { x: pt[0]!, y: pt[1]! };
      const other = v === 'x' ? 'y' : 'x';
      return {
        question: `Find ${m(name)} for ${m(fdef(f, vars))}.`,
        answer: ans(val),
        steps: [m(`${dname(v)} = ${tex(diff(f, v))}`), ans(val)],
        wrongs: [ans(evalExact(diff(f, other), env)), ans(evalExact(f, env)), ans(evalExact(wrongD(f, v, 'power'), env))],
        fallback: (k) => ans(val.add(offset(k))),
        check: { kind: 'multivariable.partials' },
      };
    }
    const f = sorted(randF(rng, difficulty, vars, difficulty !== 'easy'));
    const names: string[] = task === 'first' ? ['x', 'y'] : task === 'second' ? ['xx', 'yy'] : task === 'mixed' ? (difficulty === 'hard' ? ['xy', 'yx'] : ['xy']) : ['x', 'y', 'z'];
    const right = names.map((n) => [dname(n), dOf(f, n)] as [string, MX]);
    const flagged = (flag: 'chain' | 'sign' | 'power') =>
      names.map((n) => {
        const last = n.at(-1)!;
        const before = dOf(f, n.slice(0, -1));
        return [dname(n), wrongD(before, last, flag)] as [string, MX];
      });
    const swapped = names.map((n, i) => [dname(n), right[(i + 1) % names.length]![1]] as [string, MX]);
    const answer = segList(right);
    return {
      question: `Find ${names.map((n) => m(dname(n))).join(names.length > 2 ? ', ' : ' and ').replace(/, (\$[^$]*\$)$/, ', and $1')} for ${m(fdef(f, vars))}.`,
      answer,
      steps: [...(task === 'second' || task === 'mixed' ? [segList(vars.map((v) => [dname(v), diff(f, v)] as [string, MX]))] : []), answer],
      wrongs: [segList(flagged('chain')), segList(flagged('sign')), segList(flagged('power')), names.length > 1 && task !== 'mixed' ? segList(swapped) : null],
      fallback: (k) => segList(right.map(([n, e], i) => [n, i === k % right.length ? bump(e, k) : e] as [string, MX])),
      check: { kind: 'multivariable.partials' },
    };
  },
});

// ---------------------------------------------------------------- chain rule

type CTask = 'dzdt' | 'partialST' | 'implicit2' | 'implicit3';

function tFn(rng: Rng, d: Difficulty, vars: readonly string[]): MX {
  if (vars.length === 1 && d !== 'easy' && rng.bool(0.6)) {
    const c = rng.signedInt(1, 4, true);
    const k = rng.int(1, 3);
    const fn = rng.pick(['exp', 'sin', 'cos'] as const);
    return norm([mt(c, {}, { fn, k, e: { t: 1 } }), ...(rng.bool(0.4) ? [mt(rng.signedInt(1, 3, true), { t: rng.int(1, 2) })] : [])]);
  }
  for (;;) {
    const f = norm([mt(rng.signedInt(1, 3, true), randMono(rng, vars, 1, 2)), mt(rng.signedInt(1, 3, true), randMono(rng, vars, 0, 1))]);
    if (vars.every((v) => f.some((t) => t.e[v]))) return f;
  }
}

export const chainRule = taskTopic<CTask>({
  id: 'mv.partial.chain-rule',
  title: 'The Chain Rule for Multivariable Functions',
  description: 'Chain rule for composite functions of several variables and implicit differentiation.',
  category: CAT,
  instruction: 'Use the chain rule to answer each question.',
  tasks: [
    { value: 'dzdt', label: 'dz/dt at a value of t' },
    { value: 'partialST', label: '∂z/∂s or ∂z/∂t at a point' },
    { value: 'implicit2', label: 'Implicit dy/dx' },
    { value: 'implicit3', label: 'Implicit ∂z/∂x or ∂z/∂y' },
  ],
  mix: { easy: ['dzdt', 'implicit2'], medium: ['dzdt', 'partialST', 'implicit2', 'implicit3'], hard: ['partialST', 'implicit3', 'dzdt'] },
  build(task, { rng, difficulty }) {
    switch (task) {
      case 'dzdt':
      case 'partialST': {
        const st = task === 'partialST';
        const inner = st ? ['s', 't'] : ['t'];
        const wrt = st ? rng.pick(['s', 't']) : 't';
        const { z, X, Y, p0, val, parts } = attempt('chain', () => {
          const z = sorted(randF(rng, 'easy', ['x', 'y'], false));
          const X = tFn(rng, difficulty, inner);
          const Y = tFn(rng, difficulty, inner);
          if (tex(X) === tex(Y)) return null;
          const p0 = inner.map(() => (st ? rng.int(-2, 2) : difficulty === 'easy' ? rng.int(-1, 2) : 0));
          const env = Object.fromEntries(inner.map((v, i) => [v, p0[i]!]));
          const x0 = evalExact(X, env);
          const y0 = evalExact(Y, env);
          const dx = evalExact(diff(X, wrt), env);
          const dy = evalExact(diff(Y, wrt), env);
          if (!x0 || !y0 || !dx || !dy) return null;
          const fx = evalExact(diff(z, 'x'), { x: x0, y: y0 })!;
          const fy = evalExact(diff(z, 'y'), { x: x0, y: y0 })!;
          const val = fx.mul(dx).add(fy.mul(dy));
          if (Math.abs(val.value) > 400) return null;
          return { z, X, Y, p0, val, parts: { fx, fy, dx, dy, x0, y0 } };
        });
        const lhs = st ? `\\frac{\\partial z}{\\partial ${wrt}}` : `\\frac{dz}{dt}`;
        const ans = (v: Frac) => m(`${lhs} = ${num(v)}`);
        const where = st ? `${m(`s = ${p0[0]}`)} and ${m(`t = ${p0[1]}`)}` : m(`t = ${p0[0]}`);
        const { fx, fy, dx, dy } = parts;
        return {
          question: `Find ${m(lhs)} when ${where} for ${m(`z = ${tex(z)}`)}, ${m(`x = ${tex(X)}`)}, and ${m(`y = ${tex(Y)}`)}.`,
          answer: ans(val),
          steps: [
            m(`${lhs} = \\frac{\\partial z}{\\partial x}\\frac{dx}{d${wrt}} + \\frac{\\partial z}{\\partial y}\\frac{dy}{d${wrt}}`.replace(/\\frac\{d([xy])\}\{d([st])\}/g, st ? '\\frac{\\partial $1}{\\partial $2}' : '\\frac{d$1}{d$2}')),
            m(`(x, y) = (${num(parts.x0)}, ${num(parts.y0)})`),
            m(`${lhs} = (${num(fx)})(${num(dx)}) + (${num(fy)})(${num(dy)}) = ${num(val)}`),
          ],
          wrongs: [ans(fx.add(fy)), ans(fx.mul(dy).add(fy.mul(dx))), ans(fx.mul(dx).sub(fy.mul(dy)))],
          fallback: (k) => ans(val.add(offset(k))),
          check: { kind: 'multivariable.chain', wrt, at: p0 },
        };
      }
      case 'implicit2':
      case 'implicit3':
      default: {
        const three = task === 'implicit3';
        const vars = three ? ['x', 'y', 'z'] : ['x', 'y'];
        const dep = three ? 'z' : 'y';
        const ind = three ? rng.pick(['x', 'y']) : 'x';
        const { F, Fi, Fd } = attempt('implicit', () => {
          const F = sorted(randF(rng, difficulty === 'hard' ? 'medium' : 'easy', vars, difficulty === 'hard'));
          const Fi = diff(F, ind);
          const Fd = diff(F, dep);
          if (!Fi.length || !Fd.length || Fd.every((t) => !Object.keys(t.e).length && !t.a)) return null;
          if (three && !diff(F, ind === 'x' ? 'y' : 'x').length) return null;
          return { F, Fi, Fd };
        });
        const c = rng.int(-9, 9);
        const lhs = three ? `\\frac{\\partial z}{\\partial ${ind}}` : '\\frac{dy}{dx}';
        const ratio = (top: MX, bot: MX, neg: boolean) => {
          const flip = top[0]!.c.sign < 0;
          return m(`${lhs} = ${neg !== flip ? '-' : ''}\\frac{${tex(flip ? scale(top, -1) : top)}}{${tex(bot)}}`);
        };
        const other = three ? diff(F, ind === 'x' ? 'y' : 'x') : Fi;
        return {
          question: `Find ${m(lhs)} if ${m(`${tex(F)} = ${c}`)}.`,
          answer: ratio(Fi, Fd, true),
          steps: [m(`F_{${ind}} = ${tex(Fi)},\\ F_{${dep}} = ${tex(Fd)}`), m(`${lhs} = -\\frac{F_{${ind}}}{F_{${dep}}}`), ratio(Fi, Fd, true)],
          wrongs: [ratio(Fi, Fd, false), ratio(Fd, Fi, true), three ? ratio(other, Fd, true) : ratio(Fd, Fi, false)],
          fallback: (k) => ratio(bump(Fi, k), Fd, true),
          check: { kind: 'multivariable.implicit', ind, dep, vars },
        };
      }
    }
  },
});

