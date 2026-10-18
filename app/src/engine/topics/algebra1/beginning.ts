/** Beginning Algebra: order of operations with variables, simplifying expressions. */
import { attempt, boolOpt, defineTopic, distinctDistractors, offset, opt, strOpt } from '../../generator';
import type { Rng } from '../../rng';
import { m, sum, type Term } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';

// ================================================================ order of operations

type Op = '+' | '-' | '*' | '/' | '^';
type Node =
  | { k: 'num'; v: number }
  | { k: 'var'; name: string }
  | { k: 'sub'; name: string; v: number }
  | { k: 'op'; op: Op; l: Node; r: Node };

const PREC: Record<Op, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 3 };
/** Letters that the evaluator never reads as constants (no e, i, o, l, x). */
const LETTERS = ['a', 'b', 'c', 'h', 'j', 'k', 'm', 'n', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'y', 'z'];

type Env = Record<string, number>;

function value(n: Node, env: Env): number {
  switch (n.k) {
    case 'num':
    case 'sub':
      return n.v;
    case 'var':
      return env[n.name]!;
    case 'op': {
      const a = value(n.l, env);
      const b = value(n.r, env);
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
  }
}

const isLeaf = (n: Node) => n.k !== 'op';

function needsParens(child: Node, parent: Op, side: 'l' | 'r'): boolean {
  if (child.k !== 'op') return false;
  if (parent === '^') return true;
  const pc = PREC[child.op];
  const pp = PREC[parent];
  return pc < pp || (pc === pp && side === 'r');
}

/** Coefficient-style product written without a sign: 3m, mp, 4(m + 2). */
function juxtaposed(n: Node & { k: 'op' }): boolean {
  if (n.op !== '*') return false;
  if (!isLeaf(n.l) || (n.l.k === 'num' && n.l.v < 0)) return false;
  const rightLetter = n.r.k === 'var' || n.r.k === 'sub';
  if (n.l.k === 'num' && n.l.v === 1) return false;
  if ((n.l.k === 'var' || n.l.k === 'sub') && (n.r.k === 'var' || n.r.k === 'sub') && n.l.name === n.r.name) return false;
  if (rightLetter) return true;
  if (needsParens(n.r, '*', 'r')) return n.r.k === 'op' && (n.r.op === '+' || n.r.op === '-');
  return n.r.k === 'op' && n.r.op === '^' && (n.r.l.k === 'var' || n.r.l.k === 'sub');
}

function render(n: Node, first = true, juxt = false): string {
  switch (n.k) {
    case 'num':
      return n.v < 0 && !first ? `(${n.v})` : String(n.v);
    case 'var':
      return n.name;
    case 'sub':
      return juxt || (n.v < 0 && !first) ? `(${n.v})` : String(n.v);
    case 'op':
      break;
  }
  const wrap = (c: Node, side: 'l' | 'r', isFirst: boolean, j = false) =>
    needsParens(c, n.op, side) ? `(${render(c, true)})` : render(c, isFirst, j);
  if (n.op === '^') {
    const base = (n.l.k === 'num' && n.l.v < 0) || n.l.k === 'sub' ? `(${value(n.l, {})})` : wrap(n.l, 'l', first);
    return `${base}^{${render(n.r)}}`;
  }
  if (juxtaposed(n)) {
    // after substitution the values are parenthesised: 3(4), (4)(-2)
    const left = n.l.k === 'sub' ? `(${n.l.v})` : render(n.l, first);
    const right = n.r.k === 'sub' ? `(${n.r.v})` : wrap(n.r, 'r', false, true);
    return `${left}${right}`;
  }
  const sym = n.op === '*' ? '\\times' : n.op === '/' ? '\\div' : n.op;
  return `${wrap(n.l, 'l', first)} ${sym} ${wrap(n.r, 'r', false)}`;
}

function substitute(n: Node, env: Env): Node {
  if (n.k === 'var') return { k: 'sub', name: n.name, v: env[n.name]! };
  if (n.k === 'op') return { ...n, l: substitute(n.l, env), r: substitute(n.r, env) };
  return n;
}

/** Evaluate the next operation in conventional order; null when finished. */
function reduceOnce(root: Node): Node | null {
  if (isLeaf(root)) return null;
  type Cand = { path: Array<'l' | 'r'>; inParens: number; prec: number; order: number };
  const cands: Cand[] = [];
  let order = 0;
  const walk = (n: Node, path: Array<'l' | 'r'>, depth: number) => {
    if (n.k !== 'op') return;
    walk(n.l, [...path, 'l'], depth + (needsParens(n.l, n.op, 'l') ? 1 : 0));
    if (isLeaf(n.l) && isLeaf(n.r)) cands.push({ path, inParens: depth, prec: PREC[n.op], order: order++ });
    else order++;
    walk(n.r, [...path, 'r'], depth + (needsParens(n.r, n.op, 'r') ? 1 : 0));
  };
  walk(root, [], 0);
  cands.sort((a, b) => b.inParens - a.inParens || b.prec - a.prec || a.order - b.order);
  const target = cands[0]!.path;
  const replace = (n: Node, depth: number): Node => {
    if (depth === target.length) return { k: 'num', v: value(n, {}) };
    if (n.k !== 'op') return n;
    return target[depth] === 'l' ? { ...n, l: replace(n.l, depth + 1) } : { ...n, r: replace(n.r, depth + 1) };
  };
  return replace(root, 0);
}

/** Left-to-right evaluation ignoring precedence (parentheses and coefficient products kept): a common slip. */
function naive(n: Node, env: Env): number | null {
  const flat = (x: Node, group: boolean): Array<number | Op> | null => {
    if (x.k !== 'op') return [value(x, env)];
    if (group || juxtaposed(x) || x.op === '^') {
      if (x.op === '^' || juxtaposed(x)) return [value(x, env)];
      const v = naive(x, env);
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
    acc = value({ k: 'op', op, l: { k: 'num', v: acc }, r: { k: 'num', v: b } }, {});
  }
  return acc;
}

interface OoConfig {
  leaves: number;
  ops: Op[];
  max: number;
  varMax: number;
  vars: number;
}

const OO: Record<Difficulty, OoConfig> = {
  easy: { leaves: 3, ops: ['+', '-', '*'], max: 9, varMax: 6, vars: 2 },
  medium: { leaves: 4, ops: ['+', '-', '*', '/'], max: 10, varMax: 8, vars: 2 },
  hard: { leaves: 5, ops: ['+', '-', '*', '/'], max: 12, varMax: 9, vars: 3 },
};

function grow(rng: Rng, leaves: number, cfg: OoConfig, letters: string[], exponents: boolean, env: Env): Node | null {
  if (leaves === 1) {
    if (letters.length && rng.bool(0.55)) return { k: 'var', name: rng.pick(letters) };
    return { k: 'num', v: rng.int(1, cfg.max) };
  }
  if (exponents && leaves === 2 && rng.bool(0.35)) {
    const e = rng.bool(0.8) ? 2 : 3;
    const base: Node = letters.length && rng.bool(0.6) ? { k: 'var', name: rng.pick(letters) } : { k: 'num', v: rng.int(2, e === 2 ? 6 : 3) };
    if (base.k === 'var' && e === 3 && Math.abs(env[base.name]!) > 4) return null;
    return { k: 'op', op: '^', l: base, r: { k: 'num', v: e } };
  }
  const op = rng.pick(cfg.ops);
  const nl = rng.int(1, leaves - 1);
  const l = grow(rng, nl, cfg, letters, exponents, env);
  const r = grow(rng, leaves - nl, cfg, letters, exponents, env);
  if (!l || !r) return null;
  // no trivial pieces such as m - m, 1 × k or (w + 2) ÷ (w + 2)
  if (render(l) === render(r) && op !== '*') return null;
  if ((op === '*' || op === '/') && ((l.k === 'num' && l.v === 1) || (r.k === 'num' && r.v === 1))) return null;
  if (op === '/') {
    const rv = value(r, env);
    const lv = value(l, env);
    if (rv === 0 || lv % rv !== 0 || Math.abs(rv) === 1) return null;
  }
  return { k: 'op', op, l, r };
}

function okTree(n: Node, env: Env, negatives: boolean): boolean {
  if (n.k !== 'op') return true;
  const v = value(n, env);
  if (!Number.isInteger(v) || Math.abs(v) > 200) return false;
  if (!negatives && v < 0) return false;
  return okTree(n.l, env, negatives) && okTree(n.r, env, negatives);
}

function usedVars(n: Node, out = new Set<string>()): Set<string> {
  if (n.k === 'var') out.add(n.name);
  if (n.k === 'op') {
    usedVars(n.l, out);
    usedVars(n.r, out);
  }
  return out;
}

export const orderOfOperationsAlg1 = defineTopic({
  id: 'alg1.order-of-operations',
  subject: 'algebra1',
  category: 'Beginning Algebra',
  title: 'Order of Operations',
  description: 'Evaluate expressions with the order of operations, substituting given values for variables.',
  instruction: (o) =>
    o.task === 'numeric' ? 'Evaluate each expression.' : o.task === 'evaluate' ? 'Evaluate each using the values given.' : 'Evaluate each expression, using the values given.',
  multipleChoice: true,
  defaultCount: 12,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Expressions',
      default: 'evaluate',
      choices: [
        { value: 'evaluate', label: 'With variables (evaluate)' },
        { value: 'numeric', label: 'Numbers only' },
        { value: 'mixed', label: 'Mixed' },
      ],
    },
    opt.negatives(true),
    { type: 'boolean', id: 'exponents', label: 'Include exponents', default: true },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const negatives = boolOpt(ctx, 'negatives');
    const exponents = boolOpt(ctx, 'exponents') && difficulty !== 'easy';
    const task = strOpt(ctx, 'task');
    const withVars = task === 'evaluate' || (task === 'mixed' && rng.bool(0.6));
    const cfg = OO[difficulty];
    const { tree, env } = attempt('alg1-order-of-operations', () => {
      const letters = withVars ? rng.sample(LETTERS, rng.int(difficulty === 'easy' ? 1 : 2, cfg.vars)) : [];
      const env: Env = {};
      for (const l of letters) env[l] = negatives && rng.bool(0.4) ? -rng.int(1, cfg.varMax) : rng.int(2, cfg.varMax);
      const t = grow(rng, cfg.leaves, cfg, letters, exponents, env);
      if (!t || !okTree(t, env, negatives)) return null;
      if (withVars && usedVars(t).size === 0) return null;
      const nv = naive(t, env);
      if (nv === value(t, env) && rng.bool(0.6)) return null;
      return { tree: t, env };
    });
    const answerValue = value(tree, env);
    const used = [...usedVars(tree)].sort();
    const steps: string[] = [];
    let cur: Node = tree;
    if (used.length) {
      cur = substitute(tree, env);
      steps.push(`Substitute: $${render(cur)}$`);
    }
    for (;;) {
      const next = reduceOnce(cur);
      if (!next) break;
      cur = next;
      steps.push(m(`= ${render(cur)}`));
    }
    const answer = m(String(answerValue));
    const nv = naive(tree, env);
    const distractors = distinctDistractors(
      answer,
      [nv === null ? null : m(String(nv)), m(String(-answerValue)), m(String(answerValue + rng.pick([2, -2, 10, -10])))],
      (k) => m(String(answerValue + offset(k))),
    );
    const assign = used.map((v) => m(`${v} = ${env[v]}`));
    const useText = assign.length === 0 ? '' : assign.length === 1 ? `; use ${assign[0]}` : `; use ${assign.slice(0, -1).join(', ')}${assign.length > 2 ? ',' : ''} and ${assign.at(-1)}`;
    return {
      question: `${m(render(tree))}${useText}`,
      answer,
      steps,
      distractors,
      check: { kind: 'algebra1.evaluate' },
    };
  },
});

// ================================================================ simplifying expressions

type Chunk =
  | { kind: 'var'; c: number; v: number }
  | { kind: 'const'; c: number }
  | { kind: 'group'; m: number; inner: Array<{ c: number; v: number | null }> };

const SIMP: Record<Difficulty, { combine: string[]; distribute: string[]; coef: number; mult: number; constant: number }> = {
  easy: { combine: ['VV', 'VCV', 'CVV', 'VCC'], distribute: ['G', 'GC', 'GV'], coef: 9, mult: 6, constant: 10 },
  medium: { combine: ['VCVC', 'CVCV', 'VVCV'], distribute: ['GV', 'VG', 'GC', 'CG', 'GG'], coef: 10, mult: 7, constant: 12 },
  hard: { combine: ['VCVCV', 'VVCVC', 'CVVCV'], distribute: ['GG', 'GVG', 'VGG', 'GGC'], coef: 10, mult: 8, constant: 15 },
};

function renderChunks(chunks: Chunk[], vars: string[]): string {
  let out = '';
  chunks.forEach((ch, i) => {
    let neg: boolean;
    let body: string;
    if (ch.kind === 'var') {
      neg = ch.c < 0;
      body = Math.abs(ch.c) === 1 ? vars[ch.v]! : `${Math.abs(ch.c)}${vars[ch.v]}`;
    } else if (ch.kind === 'const') {
      neg = ch.c < 0;
      body = String(Math.abs(ch.c));
    } else {
      neg = ch.m < 0;
      body = `${Math.abs(ch.m) === 1 ? '' : Math.abs(ch.m)}(${sum(ch.inner.map((t) => ({ coef: t.c, sym: t.v === null ? '' : vars[t.v]! })))})`;
    }
    if (i === 0) out = neg ? `-${body}` : body;
    else out += neg ? ` - ${body}` : ` + ${body}`;
  });
  return out;
}

/** Expanded terms; `slip` models a distribution mistake inside groups. */
function expand(chunks: Chunk[], vars: string[], slip: 'none' | 'first-only' | 'sign' = 'none'): Term[] {
  const out: Term[] = [];
  for (const ch of chunks) {
    if (ch.kind === 'var') out.push({ coef: ch.c, sym: vars[ch.v]! });
    else if (ch.kind === 'const') out.push({ coef: ch.c });
    else
      ch.inner.forEach((t, j) => {
        let c = ch.m * t.c;
        if (j > 0 && slip === 'first-only') c = t.c;
        if (j > 0 && slip === 'sign' && ch.m < 0) c = -c;
        out.push({ coef: c, sym: t.v === null ? '' : vars[t.v]! });
      });
  }
  return out;
}

/** Combine like terms: variables in the given order, then the constant. */
function combine(terms: Term[], vars: string[]): Term[] {
  const coef = new Map<string, number>();
  for (const t of terms) coef.set(t.sym ?? '', (coef.get(t.sym ?? '') ?? 0) + Number(t.coef));
  return [...vars.map((v) => ({ coef: coef.get(v) ?? 0, sym: v })), { coef: coef.get('') ?? 0 }];
}

export const simplifyingExpressions = defineTopic({
  id: 'alg1.simplify-expressions',
  subject: 'algebra1',
  category: 'Beginning Algebra',
  title: 'Simplifying Algebraic Expressions',
  description: 'Combine like terms and use the distributive property to simplify expressions.',
  instruction: 'Simplify each expression.',
  multipleChoice: true,
  defaultCount: 12,
  options: [
    {
      type: 'select',
      id: 'type',
      label: 'Skills',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'Mixed' },
        { value: 'combine', label: 'Combining like terms only' },
        { value: 'distribute', label: 'With the distributive property' },
      ],
    },
    opt.negatives(true),
    opt.variedVariables(true),
    { type: 'boolean', id: 'twoVars', label: 'Two variables (medium and hard)', default: true },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const negatives = boolOpt(ctx, 'negatives');
    const cfg = SIMP[difficulty];
    const type = strOpt(ctx, 'type');
    const distribute = type === 'distribute' || (type === 'mixed' && rng.bool(0.6));
    const twoVars = boolOpt(ctx, 'twoVars') && difficulty !== 'easy' && rng.bool(0.5);
    const letters = boolOpt(ctx, 'variedVars') ? ['x', 'n', 'k', 'm', 'p', 'r', 'v', 'a', 'b'] : ['x'];
    const v1 = rng.pick(letters);
    const v2 = v1 === 'x' ? 'y' : rng.pick(['x', 'y', 'n', 'k', 'm', 'p', 'r', 'v', 'a', 'b'].filter((l) => l !== v1));
    const vars = twoVars ? [v1, v2].sort() : [v1];
    const chunks = attempt('simplify-expressions', () => {
      const shape = rng.pick(distribute ? cfg.distribute : cfg.combine);
      const coef = () => rng.signedInt(1, cfg.coef, negatives);
      const pickV = () => (twoVars ? rng.int(0, 1) : 0);
      const out: Chunk[] = [...shape].map<Chunk>((k) => {
        if (k === 'V') return { kind: 'var', c: coef(), v: pickV() };
        if (k === 'C') return { kind: 'const', c: rng.signedInt(1, cfg.constant, negatives) };
        const mult = difficulty !== 'easy' && negatives && rng.bool(0.12) ? -1 : rng.signedInt(2, cfg.mult, negatives);
        const a = { c: coef(), v: pickV() as number | null };
        const b = twoVars && rng.bool(0.4) ? { c: coef(), v: 1 - (a.v as number) } : { c: rng.signedInt(1, cfg.constant, negatives), v: null };
        return { kind: 'group', m: mult, inner: rng.bool(0.3) && b.v === null ? [b, a] : [a, b] };
      });
      const terms = combine(expand(out, vars), vars);
      // every variable must survive, and the expression must actually need simplifying
      if (terms.slice(0, -1).some((t) => t.coef === 0)) return null;
      if (twoVars && !out.some((ch) => (ch.kind === 'var' && ch.v === 1) || (ch.kind === 'group' && ch.inner.some((t) => t.v === 1)))) return null;
      if (!twoVars && out.some((ch) => ch.kind === 'var' && ch.v === 1)) return null;
      if (terms.some((t) => Math.abs(Number(t.coef)) > 99)) return null;
      return out;
    });
    const steps: string[] = [];
    const expanded = expand(chunks, vars);
    if (chunks.some((c) => c.kind === 'group')) steps.push(`Distribute: $${sum(expanded)}$`);
    const result = sum(combine(expanded, vars));
    steps.push(`Combine like terms: $${result}$`);
    const answer = m(result);
    const slip1 = m(sum(combine(expand(chunks, vars, 'first-only'), vars)));
    const slip2 = m(sum(combine(expand(chunks, vars, 'sign'), vars)));
    const final = combine(expanded, vars);
    const constFlip = m(sum(final.map((t) => (t.sym ? t : { coef: -Number(t.coef) || rng.signedInt(1, 9, true) }))));
    const varFlip = m(sum(final.map((t, i) => (i === 0 ? { ...t, coef: -Number(t.coef) } : t))));
    const distractors = distinctDistractors(answer, [slip1, slip2, constFlip, varFlip], (k) =>
      m(sum(final.map((t) => (t.sym ? t : { coef: Number(t.coef) + offset(k) })))),
    );
    return {
      question: m(renderChunks(chunks, vars)),
      answer,
      steps,
      distractors,
      check: { kind: 'equivalent', vars },
    };
  },
});
