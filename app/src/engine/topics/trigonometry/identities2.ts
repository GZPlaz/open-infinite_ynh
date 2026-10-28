/** Fundamental identities, verifying identities, and product-to-sum / sum-to-product identities. */
import { Frac } from '../../fraction';
import { defineTopic, distinctDistractors, strOpt } from '../../generator';
import type { Rng } from '../../rng';
import { m } from '../../tex';
import type { ProblemContent } from '../../types';
import { pickUnit, unitsOpt } from './angles';
import { angleTex, Exact, sinExact, cosExact } from './exact';

const CATEGORY = 'Trigonometric Identities and Equations';

/** An expression template: `@` stands for the variable. */
interface Ex {
  t: string;
  f: (x: number) => number;
}

const S = Math.sin;
const C = Math.cos;
const T = Math.tan;
const ex = (t: string, f: (x: number) => number): Ex => ({ t, f });
const render = (e: Ex | string, v: string) => (typeof e === 'string' ? e : e.t).replace(/@/g, v);

const PTS = [0.31, 0.77, 1.13, 2.05, 2.71, 3.62, 4.4, 5.17, -0.58, -1.94];
/** Numerically different (at some point where both are defined). */
function differs(f: (x: number) => number, g: (x: number) => number): boolean {
  return PTS.some((x) => {
    const a = f(x);
    const b = g(x);
    return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) < 1e6 && Math.abs(b) < 1e6 && Math.abs(a - b) > 1e-6 * Math.max(1, Math.abs(a));
  });
}

const pickVar = (rng: Rng) => rng.pick(['x', '\\theta', 'x', '\\alpha']);

// ---------------------------------------------------------------- fundamental identities

const FORMS: Record<string, Ex> = {
  sin: ex('\\sin @', S),
  cos: ex('\\cos @', C),
  tan: ex('\\tan @', T),
  cot: ex('\\cot @', (x) => 1 / T(x)),
  sec: ex('\\sec @', (x) => 1 / C(x)),
  csc: ex('\\csc @', (x) => 1 / S(x)),
  one: ex('1', () => 1),
  sin2: ex('\\sin^{2} @', (x) => S(x) ** 2),
  cos2: ex('\\cos^{2} @', (x) => C(x) ** 2),
  tan2: ex('\\tan^{2} @', (x) => T(x) ** 2),
  sec2: ex('\\sec^{2} @', (x) => 1 / C(x) ** 2),
  csc2: ex('\\csc^{2} @', (x) => 1 / S(x) ** 2),
  onePlusCos: ex('1 + \\cos @', (x) => 1 + C(x)),
  oneMinusSin: ex('1 - \\sin @', (x) => 1 - S(x)),
  oneMinusCos: ex('1 - \\cos @', (x) => 1 - C(x)),
  secCsc: ex('\\sec @\\csc @', (x) => 1 / (S(x) * C(x))),
  twoCsc2: ex('2\\csc^{2} @', (x) => 2 / S(x) ** 2),
  sinCos: ex('\\sin @\\cos @', (x) => S(x) * C(x)),
};

/** [expression, answer form, single term (can take a coefficient)] by difficulty. */
const SIMPLIFY: Record<'easy' | 'medium' | 'hard', Array<[string, string, boolean]>> = {
  easy: [
    ['\\sin @\\cot @', 'cos', true],
    ['\\cos @\\tan @', 'sin', true],
    ['\\frac{\\sin @}{\\tan @}', 'cos', true],
    ['\\frac{\\tan @}{\\sec @}', 'sin', true],
    ['\\frac{\\cot @}{\\csc @}', 'cos', true],
    ['\\tan @\\csc @', 'sec', true],
    ['\\cot @\\sec @', 'csc', true],
    ['\\frac{\\csc @}{\\sec @}', 'cot', true],
    ['\\sec @\\sin @', 'tan', true],
    ['\\csc @\\cos @', 'cot', true],
    ['\\frac{1}{\\cot @}', 'tan', true],
    ['\\frac{\\sec @}{\\csc @}', 'tan', true],
  ],
  medium: [
    ['\\frac{1 - \\cos^{2} @}{\\sin @}', 'sin', true],
    ['\\frac{1 - \\sin^{2} @}{\\cos @}', 'cos', true],
    ['\\sec^{2} @ - \\tan^{2} @', 'one', false],
    ['(1 + \\tan^{2} @)\\cos^{2} @', 'one', true],
    ['\\csc^{2} @ - \\cot^{2} @', 'one', false],
    ['\\frac{\\sec^{2} @ - 1}{\\tan @}', 'tan', true],
    ['\\cos^{2} @(\\sec^{2} @ - 1)', 'sin2', true],
    ['\\sin @(\\csc @ - \\sin @)', 'cos2', true],
    ['\\cos @(\\sec @ - \\cos @)', 'sin2', true],
    ['\\sin^{2} @\\sec^{2} @', 'tan2', true],
    ['(1 - \\sin @)(1 + \\sin @)', 'cos2', true],
    ['(\\sec @ - 1)(\\sec @ + 1)', 'tan2', true],
    ['\\frac{\\tan^{2} @}{\\sec^{2} @}', 'sin2', true],
    ['(1 + \\cot^{2} @)\\sin^{2} @', 'one', true],
  ],
  hard: [
    ['\\csc @ - \\cot @\\cos @', 'sin', false],
    ['\\sec @ - \\tan @\\sin @', 'cos', false],
    ['\\frac{\\sin^{2} @}{1 - \\cos @}', 'onePlusCos', true],
    ['\\frac{\\cos^{2} @}{1 + \\sin @}', 'oneMinusSin', true],
    ['\\frac{\\sin^{2} @}{1 + \\cos @}', 'oneMinusCos', true],
    ['\\tan @ + \\cot @', 'secCsc', false],
    ['\\frac{1}{1 + \\cos @} + \\frac{1}{1 - \\cos @}', 'twoCsc2', false],
    ['\\frac{\\sec @}{\\tan @ + \\cot @}', 'sin', true],
    ['\\frac{1 + \\tan^{2} @}{1 + \\cot^{2} @}', 'tan2', true],
    ['\\cot @ + \\frac{\\sin @}{1 + \\cos @}', 'csc', false],
    ['\\frac{\\cos @}{1 - \\sin @} - \\tan @', 'sec', false],
    ['\\frac{1}{\\tan @ + \\cot @}', 'sinCos', true],
  ],
};

export const fundamentalIdentities = defineTopic({
  id: 'trig.identities.fundamental',
  subject: 'trigonometry',
  title: 'Fundamental Identities',
  description: 'Simplify expressions with the reciprocal, quotient and Pythagorean identities.',
  category: CATEGORY,
  instruction: 'Simplify each expression.',
  multipleChoice: true,
  defaultCount: 12,
  options: [],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const v = pickVar(rng);
    const [expr, form, single] = rng.pick(SIMPLIFY[difficulty]);
    const k = single ? rng.pick([1, 1, 2, 3]) : 1;
    const target = FORMS[form]!;
    const coef = (t: string) => {
      if (k === 1) return t;
      if (/ [+-] /.test(t) && !t.startsWith('\\frac')) return `${k}(${t})`;
      const lead = /^(\d+)(.*)$/.exec(t);
      return lead ? `${k * Number(lead[1])}${lead[2]}` : `${k}${t}`;
    };
    const q = coef(render(expr, v));
    const answer = m(coef(render(target, v)));
    const tf = (x: number) => k * target.f(x);
    const pool = Object.values(FORMS).filter((e) => differs((x) => k * e.f(x), tf));
    const cands = rng.shuffle(pool).map((e) => m(coef(render(e, v))));
    const steps: string[] = [];
    if (/\\(tan|cot|sec|csc)/.test(expr)) steps.push(`Rewrite in sines and cosines: ${m(`\\tan ${v} = \\frac{\\sin ${v}}{\\cos ${v}}, \\; \\sec ${v} = \\frac{1}{\\cos ${v}}, \\; \\csc ${v} = \\frac{1}{\\sin ${v}}`)}.`);
    if (/\^\{2\}/.test(expr)) steps.push(`Use ${m(`\\sin^{2} ${v} + \\cos^{2} ${v} = 1`)} (and ${m(`1 + \\tan^{2} ${v} = \\sec^{2} ${v}`)}, ${m(`1 + \\cot^{2} ${v} = \\csc^{2} ${v}`)}).`);
    steps.push(m(`${q} = ${coef(render(target, v))}`));
    return {
      question: m(q),
      answer,
      steps,
      distractors: distinctDistractors(answer, cands, () => null),
      check: { kind: 'trigonometry.identity' },
    };
  },
});

// ---------------------------------------------------------------- verifying identities

interface Chain {
  f: (x: number) => number;
  steps: string[];
  wrong: Ex[];
}

const CHAINS: Chain[] = [
  { f: (x) => S(x) * T(x), steps: ['\\sec @ - \\cos @', '\\frac{1}{\\cos @} - \\cos @', '\\frac{1 - \\cos^{2} @}{\\cos @}', '\\frac{\\sin^{2} @}{\\cos @}', '\\sin @\\tan @'], wrong: [ex('\\frac{1 - \\cos @}{\\cos @}', (x) => (1 - C(x)) / C(x)), ex('\\frac{\\cos^{2} @}{\\cos @}', C)] },
  { f: (x) => (1 + C(x)) / S(x), steps: ['\\frac{\\sin @}{1 - \\cos @}', '\\frac{\\sin @(1 + \\cos @)}{1 - \\cos^{2} @}', '\\frac{\\sin @(1 + \\cos @)}{\\sin^{2} @}', '\\frac{1 + \\cos @}{\\sin @}'], wrong: [ex('\\frac{\\sin @(1 + \\cos @)}{\\cos^{2} @}', (x) => (S(x) * (1 + C(x))) / C(x) ** 2), ex('\\frac{1 - \\cos @}{\\sin @}', (x) => (1 - C(x)) / S(x))] },
  { f: (x) => 1 / (S(x) * C(x)), steps: ['\\tan @ + \\cot @', '\\frac{\\sin @}{\\cos @} + \\frac{\\cos @}{\\sin @}', '\\frac{\\sin^{2} @ + \\cos^{2} @}{\\sin @\\cos @}', '\\frac{1}{\\sin @\\cos @}', '\\sec @\\csc @'], wrong: [ex('\\frac{\\sin @ + \\cos @}{\\sin @\\cos @}', (x) => (S(x) + C(x)) / (S(x) * C(x))), ex('\\frac{1}{\\sin @ + \\cos @}', (x) => 1 / (S(x) + C(x)))] },
  { f: (x) => C(x) ** 2, steps: ['(1 - \\sin @)(1 + \\sin @)', '1 - \\sin^{2} @', '\\cos^{2} @'], wrong: [ex('1 + \\sin^{2} @', (x) => 1 + S(x) ** 2), ex('1 - \\sin @', (x) => 1 - S(x))] },
  { f: (x) => T(x) ** 2, steps: ['\\frac{1 + \\tan^{2} @}{\\csc^{2} @}', '\\frac{\\sec^{2} @}{\\csc^{2} @}', '\\frac{\\sin^{2} @}{\\cos^{2} @}', '\\tan^{2} @'], wrong: [ex('\\frac{\\cos^{2} @}{\\sin^{2} @}', (x) => 1 / T(x) ** 2), ex('\\frac{\\sec^{2} @}{\\sin^{2} @}', (x) => 1 / (C(x) * S(x)) ** 2)] },
  { f: (x) => C(2 * x), steps: ['\\cos^{4} @ - \\sin^{4} @', '(\\cos^{2} @ - \\sin^{2} @)(\\cos^{2} @ + \\sin^{2} @)', '\\cos^{2} @ - \\sin^{2} @', '\\cos 2@'], wrong: [ex('(\\cos^{2} @ - \\sin^{2} @)^{2}', (x) => C(2 * x) ** 2), ex('\\cos^{2} @ + \\sin^{2} @', () => 1)] },
  { f: (x) => 2 * S(x) ** 2, steps: ['\\sin 2@\\tan @', '2\\sin @\\cos @ \\cdot \\frac{\\sin @}{\\cos @}', '2\\sin^{2} @', '1 - \\cos 2@'], wrong: [ex('2\\cos^{2} @', (x) => 2 * C(x) ** 2), ex('\\sin^{2} @', (x) => S(x) ** 2)] },
  { f: T, steps: ['\\frac{\\sin 2@}{1 + \\cos 2@}', '\\frac{2\\sin @\\cos @}{1 + 2\\cos^{2} @ - 1}', '\\frac{2\\sin @\\cos @}{2\\cos^{2} @}', '\\tan @'], wrong: [ex('\\frac{2\\sin @\\cos @}{2\\sin^{2} @}', (x) => 1 / T(x)), ex('\\frac{\\sin @}{2\\cos @}', (x) => T(x) / 2)] },
  { f: (x) => C(x) / T(x), steps: ['\\csc @ - \\sin @', '\\frac{1}{\\sin @} - \\sin @', '\\frac{1 - \\sin^{2} @}{\\sin @}', '\\frac{\\cos^{2} @}{\\sin @}', '\\cos @\\cot @'], wrong: [ex('\\frac{\\sin^{2} @}{\\sin @}', S), ex('\\frac{1 - \\sin @}{\\sin @}', (x) => (1 - S(x)) / S(x))] },
  { f: S, steps: ['\\frac{\\sec @}{\\cot @ + \\tan @}', '\\frac{\\frac{1}{\\cos @}}{\\frac{1}{\\sin @\\cos @}}', '\\frac{\\sin @\\cos @}{\\cos @}', '\\sin @'], wrong: [ex('\\frac{\\sin @}{\\cos @}', T), ex('\\frac{1}{\\sin @\\cos^{2} @}', (x) => 1 / (S(x) * C(x) ** 2))] },
  { f: (x) => C(x) ** 2 / T(x) ** 2, steps: ['\\cot^{2} @ - \\cos^{2} @', '\\cos^{2} @\\left(\\frac{1}{\\sin^{2} @} - 1\\right)', '\\cos^{2} @(\\csc^{2} @ - 1)', '\\cos^{2} @\\cot^{2} @'], wrong: [ex('\\cos^{2} @\\tan^{2} @', (x) => S(x) ** 2), ex('\\cos^{2} @(\\sec^{2} @ - 1)', (x) => S(x) ** 2)] },
  { f: (x) => 1 + S(2 * x), steps: ['(\\sin @ + \\cos @)^{2}', '\\sin^{2} @ + 2\\sin @\\cos @ + \\cos^{2} @', '1 + 2\\sin @\\cos @', '1 + \\sin 2@'], wrong: [ex('\\sin^{2} @ + \\cos^{2} @', () => 1), ex('1 + \\cos 2@', (x) => 1 + C(2 * x))] },
  { f: (x) => 1 + 2 * T(x) ** 2, steps: ['\\sec^{4} @ - \\tan^{4} @', '(\\sec^{2} @ - \\tan^{2} @)(\\sec^{2} @ + \\tan^{2} @)', '\\sec^{2} @ + \\tan^{2} @', '1 + 2\\tan^{2} @'], wrong: [ex('\\sec^{2} @ - \\tan^{2} @', () => 1), ex('1 + \\tan^{2} @', (x) => 1 / C(x) ** 2)] },
  { f: T, steps: ['\\frac{1 - \\cos 2@}{\\sin 2@}', '\\frac{2\\sin^{2} @}{2\\sin @\\cos @}', '\\frac{\\sin @}{\\cos @}', '\\tan @'], wrong: [ex('\\frac{2\\cos^{2} @}{2\\sin @\\cos @}', (x) => 1 / T(x)), ex('\\frac{\\cos @}{\\sin @}', (x) => 1 / T(x))] },
];

export const verifyingIdentities = defineTopic({
  id: 'trig.identities.verifying',
  subject: 'trigonometry',
  title: 'Verifying Trigonometric Identities',
  description: 'Choose the expression identically equal to a given one, or the step that completes a proof of an identity.',
  category: CATEGORY,
  instruction: (o) =>
    o.task === 'equal' ? 'Choose the expression that is identically equal to the given expression.' : o.task === 'step' ? 'Choose the step that completes each proof.' : 'Choose the equivalent expression or the missing step of each proof.',
  multipleChoice: true,
  defaultCount: 8,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Question type',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'equal', label: 'Which expression is identically equal?' },
        { value: 'step', label: 'Which step completes the proof?' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const t = strOpt(ctx, 'task');
    const task = t === 'equal' || t === 'step' ? t : rng.pick(['equal', 'step'] as const);
    const v = pickVar(rng);
    const chains = difficulty === 'easy' ? CHAINS.filter((c) => c.steps.length <= 4) : CHAINS;
    const ch = rng.pick(chains);
    const others = CHAINS.filter((c) => c !== ch).flatMap((c) => c.steps.slice(1).map((s) => ex(s, c.f)));
    const pool = [...ch.wrong, ...rng.shuffle(others)].filter((e) => differs(e.f, ch.f)).map((e) => m(render(e, v)));

    if (task === 'equal') {
      const flip = rng.bool(0.3);
      const from = flip ? ch.steps.at(-1)! : ch.steps[0]!;
      const to = flip ? ch.steps[0]! : difficulty === 'hard' ? ch.steps.at(-1)! : rng.pick(ch.steps.slice(1));
      const answer = m(render(to, v));
      return {
        question: m(render(from, v)),
        answer,
        steps: ch.steps.map((s, i) => (i === 0 ? m(render(s, v)) : m(`= ${render(s, v)}`))),
        distractors: distinctDistractors(answer, pool, () => null),
        check: { kind: 'trigonometry.identityChoice', task },
      };
    }
    const blank = rng.int(1, ch.steps.length - 2 >= 1 ? ch.steps.length - 2 : 1);
    const shown = ch.steps.map((s, i) => (i === blank ? '\\boxed{?}' : render(s, v)));
    const answer = m(render(ch.steps[blank]!, v));
    return {
      question: `Complete the proof: ${m(shown.join(' = '))}`,
      answer,
      steps: ch.steps.map((s, i) => (i === 0 ? m(render(s, v)) : m(`= ${render(s, v)}`))),
      distractors: distinctDistractors(answer, pool, () => null),
      check: { kind: 'trigonometry.identityChoice', task },
    };
  },
});

// ---------------------------------------------------------------- product-to-sum and sum-to-product

const kx = (k: number, v: string) => (k === 1 ? v : `${k}${v}`);

export const productSumIdentities = defineTopic({
  id: 'trig.identities.product-sum',
  subject: 'trigonometry',
  title: 'Product-to-Sum and Sum-to-Product Identities',
  description: 'Rewrite products as sums and sums as products, and use the identities to find exact values.',
  category: CATEGORY,
  instruction: (o) =>
    o.task === 'toSum' ? 'Write each product as a sum or difference.' : o.task === 'toProduct' ? 'Write each sum or difference as a product.' : o.task === 'evaluate' ? 'Use a product-to-sum or sum-to-product identity to find the exact value.' : 'Rewrite or evaluate each expression as indicated.',
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Problem type',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'toSum', label: 'Product to sum' },
        { value: 'toProduct', label: 'Sum to product' },
        { value: 'evaluate', label: 'Exact values' },
      ],
    },
    unitsOpt('deg'),
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const t = strOpt(ctx, 'task');
    const task = t === 'toSum' || t === 'toProduct' || t === 'evaluate' ? t : rng.pick(['toSum', 'toProduct', 'evaluate'] as const);
    const v = rng.pick(['x', '\\theta']);
    const maxK = difficulty === 'easy' ? 5 : 9;

    if (task === 'toSum') {
      const A = rng.int(2, maxK);
      const B = rng.int(1, A - 1);
      const kind = rng.pick(['sc', 'cc', 'ss', 'cs'] as const);
      const k = difficulty === 'hard' ? rng.pick([2, 4, 6]) : 1;
      const c = new Frac(k, 2);
      const lead = c.eq(1) ? '' : c.toTex();
      const prod = `${k === 1 ? '' : k}\\${kind[0] === 's' ? 'sin' : 'cos'} ${kx(A, v)}\\${kind[1] === 's' ? 'sin' : 'cos'} ${kx(B, v)}`;
      const sum = (f1: string, k1: number, op: string, f2: string, k2: number) => `${lead}\\left(\\${f1} ${kx(k1, v)} ${op} \\${f2} ${kx(k2, v)}\\right)`;
      const fs: Record<string, [string, number, string, string, number]> = {
        sc: ['sin', A + B, '+', 'sin', A - B],
        cs: ['sin', A + B, '-', 'sin', A - B],
        cc: ['cos', A - B, '+', 'cos', A + B],
        ss: ['cos', A - B, '-', 'cos', A + B],
      };
      const [f1, k1, op, f2, k2] = fs[kind]!;
      const answer = m(sum(f1, k1, op, f2, k2));
      const other = f1 === 'sin' ? 'cos' : 'sin';
      const cands = [
        m(sum(f1, k1, op === '+' ? '-' : '+', f2, k2)),
        m(sum(other, k1, op, other, k2)),
        m(`${k === 1 ? '' : k}\\left(\\${f1} ${kx(k1, v)} ${op} \\${f2} ${kx(k2, v)}\\right)`),
        m(sum(f1, A * B, op, f2, A - B)),
      ];
      const formula = { sc: '\\sin u\\cos w = \\frac{1}{2}[\\sin(u + w) + \\sin(u - w)]', cs: '\\cos u\\sin w = \\frac{1}{2}[\\sin(u + w) - \\sin(u - w)]', cc: '\\cos u\\cos w = \\frac{1}{2}[\\cos(u - w) + \\cos(u + w)]', ss: '\\sin u\\sin w = \\frac{1}{2}[\\cos(u - w) - \\cos(u + w)]' }[kind];
      return {
        question: m(prod),
        answer,
        steps: [m(formula), m(`${prod} = ${sum(f1, k1, op, f2, k2)}`)],
        distractors: distinctDistractors(answer, cands, (n) => m(sum(f1, k1 + n, op, f2, k2))),
        check: { kind: 'trigonometry.identity', form: 'sum' },
      };
    }

    if (task === 'toProduct') {
      const half1 = rng.int(2, maxK);
      const half2 = rng.int(1, half1 - 1);
      const [A, B] = [half1 + half2, half1 - half2];
      const kind = rng.pick(['s+s', 's-s', 'c+c', 'c-c'] as const);
      const f1 = kind[0] === 's' ? 'sin' : 'cos';
      const op = kind[1];
      const q = `\\${f1} ${kx(A, v)} ${op} \\${f1} ${kx(B, v)}`;
      const prod = (sign: string, coef: number, g1: string, k1: number, g2: string, k2: number) => `${sign}${coef}\\${g1} ${kx(k1, v)}\\${g2} ${kx(k2, v)}`;
      const table = { 's+s': ['', 'sin', 'cos'], 's-s': ['', 'cos', 'sin'], 'c+c': ['', 'cos', 'cos'], 'c-c': ['-', 'sin', 'sin'] } as const;
      const [sg, g1, g2] = table[kind];
      const answer = m(prod(sg, 2, g1, half1, g2, half2));
      const cands = [m(prod(sg, 2, g2, half1, g1, half2)), m(prod(sg === '-' ? '' : '-', 2, g1, half1, g2, half2)), m(prod(sg, 2, g1, A, g2, B)), m(`${sg}\\${g1} ${kx(half1, v)}\\${g2} ${kx(half2, v)}`)];
      return {
        question: m(q),
        answer,
        steps: [m(`\\frac{${A} + ${B}}{2} = ${half1}, \\; \\frac{${A} - ${B}}{2} = ${half2}`), m(`${q} = ${prod(sg, 2, g1, half1, g2, half2)}`)],
        distractors: distinctDistractors(answer, cands, (n) => m(prod(sg, 2, g1, half1 + n, g2, half2))),
        check: { kind: 'trigonometry.identity', form: 'product' },
      };
    }

    // exact values with special angles
    const unit = pickUnit(ctx);
    const odd = [15, 75, 105, 165, 195, 255, 285, 345];
    let A = 0;
    let B = 0;
    let product = true;
    let fa: 'sin' | 'cos' = 'sin';
    let fb: 'sin' | 'cos' = 'sin';
    let op: '+' | '-' = '+';
    for (let tries = 0; tries < 100; tries++) {
      A = rng.pick(odd.slice(1));
      B = rng.pick(odd.filter((x) => x < A));
      product = rng.bool();
      fa = rng.pick(['sin', 'cos'] as const);
      fb = rng.pick(['sin', 'cos'] as const);
      op = rng.pick(['+', '-'] as const);
      const h1 = (A + B) / 2;
      const h2 = (A - B) / 2;
      const zero = product ? false : (fa === 'sin' ? (op === '+' ? sinExact(h1).mul(cosExact(h2)) : cosExact(h1).mul(sinExact(h2))) : op === '+' ? cosExact(h1).mul(cosExact(h2)) : sinExact(h1).mul(sinExact(h2))).isZero();
      if (!zero) break;
    }
    let value: Exact;
    let q: string;
    let step: string;
    const sAt = (d: number) => sinExact(d);
    const cAt = (d: number) => cosExact(d);
    const At = angleTex(A, unit);
    const Bt = angleTex(B, unit);
    const P = (d: number) => angleTex(d, unit);
    if (product) {
      q = `\\${fa} ${At}\\${fb} ${Bt}`;
      if (fa === 'sin' && fb === 'cos') value = sAt(A + B).add(sAt(A - B)).scale(new Frac(1, 2));
      else if (fa === 'cos' && fb === 'sin') value = sAt(A + B).sub(sAt(A - B)).scale(new Frac(1, 2));
      else if (fa === 'cos') value = cAt(A - B).add(cAt(A + B)).scale(new Frac(1, 2));
      else value = cAt(A - B).sub(cAt(A + B)).scale(new Frac(1, 2));
      const g = fa === fb ? 'cos' : 'sin';
      step = m(`= \\frac{1}{2}\\left[\\${g}\\left(${P(fa === fb ? A - B : A + B)}\\right) ${fa === 'cos' && fb === 'sin' ? '-' : fa === 'sin' && fb === 'sin' ? '-' : '+'} \\${g}\\left(${P(fa === fb ? A + B : A - B)}\\right)\\right]`);
    } else {
      q = `\\${fa} ${At} ${op} \\${fa} ${Bt}`;
      const h1 = (A + B) / 2;
      const h2 = (A - B) / 2;
      if (fa === 'sin') value = op === '+' ? sAt(h1).mul(cAt(h2)).scale(2) : cAt(h1).mul(sAt(h2)).scale(2);
      else value = op === '+' ? cAt(h1).mul(cAt(h2)).scale(2) : sAt(h1).mul(sAt(h2)).scale(-2);
      step = m(`= ${fa === 'cos' && op === '-' ? '-' : ''}2\\${fa === 'sin' ? (op === '+' ? 'sin' : 'cos') : op === '+' ? 'cos' : 'sin'} ${P(h1)}\\${fa === 'sin' ? (op === '+' ? 'cos' : 'sin') : op === '+' ? 'cos' : 'sin'} ${P(h2)}`);
    }
    const answer = m(value.toTex());
    const pool = ['0', '1', '-1', '\\frac{1}{2}', '-\\frac{1}{2}', '\\frac{1}{4}', '-\\frac{1}{4}', '\\frac{\\sqrt{3}}{4}', '\\frac{\\sqrt{2}}{2}', '\\frac{\\sqrt{6}}{2}', '\\frac{2 + \\sqrt{3}}{4}', '\\frac{2 - \\sqrt{3}}{4}', '\\frac{\\sqrt{2}}{4}', '\\frac{\\sqrt{3}}{2}'];
    return {
      question: m(q),
      answer,
      steps: [step, m(`= ${value.toTex()}`)],
      distractors: distinctDistractors(answer, [m(value.neg().toTex()), m(value.scale(2).toTex()), m(value.scale(new Frac(1, 2)).toTex())], (n) => (n <= pool.length ? m(pool[n - 1]!) : null)),
      check: { kind: 'trigonometry.exact' },
    };
  },
});
