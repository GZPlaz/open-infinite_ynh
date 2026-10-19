/** Evaluating integer expressions with the order of operations. */
import { attempt, boolOpt, defineTopic, distinctDistractors, offset } from '../../generator';
import type { Rng } from '../../rng';
import { m } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { CAT } from './common';

type Op = '+' | '-' | '*' | '/' | '^';
type Node = { k: 'num'; v: number } | { k: 'op'; op: Op; l: Node; r: Node };

const PREC: Record<Op, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 3 };
const SYMBOL: Record<Op, string> = { '+': '+', '-': '-', '*': '\\times', '/': '\\div', '^': '^' };

function value(n: Node): number {
  if (n.k === 'num') return n.v;
  const a = value(n.l);
  const b = value(n.r);
  switch (n.op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '*':
      return a * b;
    case '/':
      return a / b;
    case '^':
      return a ** b;
  }
}

/** Parentheses are needed for lower precedence, and for any equal-precedence right operand. */
function needsParens(child: Node, parent: Op, side: 'l' | 'r'): boolean {
  if (child.k === 'num') return false;
  if (parent === '^') return true;
  const pc = PREC[child.op];
  const pp = PREC[parent];
  return pc < pp || (pc === pp && side === 'r');
}

function render(n: Node, first = true): string {
  if (n.k === 'num') return n.v < 0 && !first ? `(${n.v})` : String(n.v);
  const wrap = (c: Node, side: 'l' | 'r', isFirst: boolean) =>
    needsParens(c, n.op, side) ? `(${render(c, true)})` : render(c, isFirst);
  if (n.op === '^') {
    const base = n.l.k === 'num' && n.l.v < 0 ? `(${n.l.v})` : wrap(n.l, 'l', first);
    return `${base}^{${render(n.r)}}`;
  }
  return `${wrap(n.l, 'l', first)} ${SYMBOL[n.op]} ${wrap(n.r, 'r', false)}`;
}

/** Evaluate one operation, following the conventional order; returns null when done. */
function reduceOnce(root: Node): Node | null {
  if (root.k === 'num') return null;
  type Cand = { path: Array<'l' | 'r'>; inParens: boolean; prec: number; order: number };
  const cands: Cand[] = [];
  let order = 0;
  const walk = (n: Node, path: Array<'l' | 'r'>, inParens: boolean) => {
    if (n.k === 'num') return;
    walk(n.l, [...path, 'l'], inParens || needsParens(n.l, n.op, 'l'));
    if (n.l.k === 'num' && n.r.k === 'num') cands.push({ path, inParens, prec: PREC[n.op], order: order++ });
    else order++;
    walk(n.r, [...path, 'r'], inParens || needsParens(n.r, n.op, 'r'));
  };
  walk(root, [], false);
  cands.sort((a, b) => Number(b.inParens) - Number(a.inParens) || b.prec - a.prec || a.order - b.order);
  const target = cands[0]!.path;
  const replace = (n: Node, depth: number): Node => {
    if (depth === target.length) return { k: 'num', v: value(n) };
    if (n.k === 'num') return n;
    const dir = target[depth]!;
    return dir === 'l' ? { ...n, l: replace(n.l, depth + 1) } : { ...n, r: replace(n.r, depth + 1) };
  };
  return replace(root, 0);
}

/** Left-to-right evaluation that ignores precedence but respects parentheses (a common mistake). */
function naive(n: Node): number | null {
  const flat = (x: Node, forceGroup: boolean): Array<number | Op> | null => {
    if (x.k === 'num') return [x.v];
    if (forceGroup) {
      const v = naive(x);
      return v === null ? null : [v];
    }
    const l = flat(x.l, needsParens(x.l, x.op, 'l'));
    const r = flat(x.r, needsParens(x.r, x.op, 'r'));
    return l && r ? [...l, x.op, ...r] : null;
  };
  const toks = flat(n, false);
  if (!toks) return null;
  let acc = toks[0] as number;
  for (let i = 1; i < toks.length; i += 2) {
    const op = toks[i] as Op;
    const b = toks[i + 1] as number;
    if (op === '/' && (b === 0 || acc % b !== 0)) return null;
    acc = value({ k: 'op', op, l: { k: 'num', v: acc }, r: { k: 'num', v: b } });
  }
  return acc;
}

interface Config {
  leaves: number;
  ops: Op[];
  max: number;
}

const CONFIG: Record<Difficulty, Config> = {
  easy: { leaves: 3, ops: ['+', '-', '*'], max: 12 },
  medium: { leaves: 4, ops: ['+', '-', '*', '/'], max: 12 },
  hard: { leaves: 5, ops: ['+', '-', '*', '/'], max: 15 },
};

function grow(rng: Rng, leaves: number, cfg: Config, negatives: boolean, exponents: boolean): Node | null {
  if (leaves === 1) {
    const v = rng.int(1, cfg.max);
    return { k: 'num', v: negatives && rng.bool(0.3) ? -v : v };
  }
  if (exponents && leaves === 2 && rng.bool(0.35)) {
    const e = rng.bool(0.75) ? 2 : 3;
    const b = rng.int(2, e === 2 ? 6 : 3);
    return { k: 'op', op: '^', l: { k: 'num', v: negatives && rng.bool(0.3) ? -b : b }, r: { k: 'num', v: e } };
  }
  const op = rng.pick(cfg.ops);
  const nl = rng.int(1, leaves - 1);
  const l = grow(rng, nl, cfg, negatives, exponents);
  const r = grow(rng, leaves - nl, cfg, negatives, exponents);
  if (!l || !r) return null;
  if (op === '/') {
    const rv = value(r);
    const lv = value(l);
    if (rv === 0 || lv % rv !== 0 || Math.abs(rv) === 1) return null;
  }
  return { k: 'op', op, l, r };
}

function ok(n: Node, negatives: boolean): boolean {
  if (n.k === 'num') return true;
  const v = value(n);
  if (!Number.isInteger(v) || Math.abs(v) > 150) return false;
  if (!negatives && v < 0) return false;
  return ok(n.l, negatives) && ok(n.r, negatives);
}

export const orderOfOperations = defineTopic({
  id: 'prealg.order-of-operations',
  subject: 'prealgebra',
  category: CAT.integers,
  title: 'Order of Operations',
  description: 'Evaluate integer expressions with parentheses, exponents, ×, ÷, + and −.',
  instruction: 'Evaluate each expression.',
  multipleChoice: true,
  defaultCount: 16,
  options: [
    { type: 'boolean', id: 'negatives', label: 'Allow negative numbers', default: false },
    { type: 'boolean', id: 'exponents', label: 'Include exponents', default: true },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const negatives = boolOpt(ctx, 'negatives');
    const exponents = boolOpt(ctx, 'exponents') && difficulty !== 'easy';
    const cfg = CONFIG[difficulty];
    const tree = attempt('order-of-operations', () => {
      const t = grow(rng, cfg.leaves, cfg, negatives, exponents);
      if (!t || !ok(t, negatives)) return null;
      // Make sure precedence matters at least sometimes: reject pure left-to-right chains half the time.
      if (naive(t) === value(t) && rng.bool(0.5)) return null;
      return t;
    });
    const answerValue = value(tree);
    const steps: string[] = [];
    let cur: Node | null = tree;
    for (;;) {
      cur = reduceOnce(cur);
      if (!cur) break;
      steps.push(m(`= ${render(cur)}`));
      if (cur.k === 'num') break;
    }
    const answer = m(String(answerValue));
    const nv = naive(tree);
    const distractors = distinctDistractors(
      answer,
      [nv === null ? null : m(String(nv)), m(String(-answerValue)), m(String(answerValue + rng.pick([2, -2, 10, -10])))],
      (k) => m(String(answerValue + offset(k))),
    );
    return {
      question: m(render(tree)),
      answer,
      steps,
      distractors,
      check: { kind: 'value', value: answerValue },
    };
  },
});
