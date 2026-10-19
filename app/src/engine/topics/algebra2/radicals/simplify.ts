/** Simplifying radicals (any index, with variables) and adding / subtracting radical expressions. */
import { attempt, boolOpt, defineTopic, distinctDistractors, offset, strOpt } from '../../../generator';
import { m } from '../../../tex';
import type { ProblemContent } from '../../../types';
import { FREE, joinTerms, radicandTex, radTex, rootTermTex, simplifyRootMono, varsTex, type Exps, type RootTerm } from './common';

const CATEGORY = 'Radical Functions and Rational Exponents';
const VAR_SETS = [['x'], ['x', 'y'], ['a', 'b'], ['m', 'n'], ['u', 'v'], ['x', 'y', 'z'], ['p', 'q']];

export const simplifyRadicals = defineTopic({
  id: 'alg2.radical.simplify',
  subject: 'algebra2',
  title: 'Simplifying Radicals',
  description: 'Write square roots and higher-index roots of monomials in simplest radical form.',
  category: CATEGORY,
  instruction: (o) => (o.variables ? 'Simplify. Assume all variables are positive.' : 'Simplify.'),
  multipleChoice: true,
  defaultCount: 12,
  options: [
    {
      type: 'select',
      id: 'index',
      label: 'Roots',
      default: 'any',
      choices: [
        { value: 'any', label: 'Square and higher roots' },
        { value: 'square', label: 'Square roots only' },
        { value: 'higher', label: 'Cube and higher roots only' },
      ],
    },
    { type: 'boolean', id: 'variables', label: 'Include variables', default: true },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const indexOpt = strOpt(ctx, 'index');
    const variables = boolOpt(ctx, 'variables');
    const higher = difficulty === 'easy' ? [3] : difficulty === 'medium' ? [3, 3, 4] : [3, 4, 5];
    const index = indexOpt === 'square' ? 2 : indexOpt === 'higher' ? rng.pick(higher) : difficulty === 'easy' ? rng.pick([2, 2, 2, 3]) : rng.pick([2, 2, ...higher]);
    const built = attempt('radical-simplify', () => {
      const maxOut = index === 2 ? (difficulty === 'easy' ? 6 : difficulty === 'medium' ? 9 : 12) : index === 3 ? (difficulty === 'hard' ? 5 : 4) : index === 4 ? 3 : 2;
      const o = rng.int(variables && rng.bool(0.15) ? 1 : 2, maxOut);
      const inside = variables && rng.bool(0.1) ? 1 : rng.pick(FREE[index]!);
      const neg = index % 2 === 1 && difficulty !== 'easy' && rng.bool(0.3);
      const c = (neg ? -1 : 1) * o ** index * inside;
      if (Math.abs(c) > 3000) return null;
      const k = difficulty !== 'easy' && rng.bool(0.35) ? rng.int(2, 5) * (difficulty === 'hard' && rng.bool(0.3) ? -1 : 1) : 1;
      const exps: Exps = {};
      if (variables) {
        const vs = difficulty === 'easy' ? [rng.pick(['x', 'n', 'a', 'v', 'k'])] : difficulty === 'medium' ? rng.pick(VAR_SETS.slice(0, 5)) : rng.pick(VAR_SETS);
        const maxE = difficulty === 'easy' ? 7 : difficulty === 'medium' ? 9 : 14;
        for (const v of vs) exps[v] = rng.int(1, maxE);
        if (!Object.values(exps).some((e) => e >= index)) return null;
      }
      if (o === 1 && !Object.values(exps).some((e) => e >= index)) return null;
      return { c, k, o, inside, exps };
    });
    const { c, k, o, exps } = built;
    const vars = Object.keys(exps);
    const question = `${k === 1 ? '' : k}${radTex(index, radicandTex(c, exps))}`;
    const ans = simplifyRootMono(c, exps, index, k);
    const answerTex = rootTermTex(ans);
    const sign = c < 0 ? -1 : 1;

    const perfectExps: Exps = Object.fromEntries(vars.map((v) => [v, index * Math.floor(exps[v]! / index)]));
    const perfect = radTex(index, radicandTex(sign * o ** index, perfectExps));
    const rest = { ...ans.inV };
    const steps: string[] = [];
    const restTex = ans.inC !== 1 || varsTex(rest) ? ` \\cdot ${radTex(index, radicandTex(ans.inC, rest))}` : '';
    steps.push(m(`${question} = ${k === 1 ? '' : k}${perfect}${restTex}`));
    steps.push(m(`= ${answerTex}`));

    const variant = (t: Partial<RootTerm>): string | null => {
      const r = { ...ans, ...t };
      return r.coef === 0 ? null : m(rootTermTex(r));
    };
    const keptInside: Exps = Object.fromEntries(vars.map((v) => [v, exps[v]!]));
    const subtracted: Exps = Object.fromEntries(vars.map((v) => [v, Math.max(0, exps[v]! - index)]));
    const distractors = distinctDistractors(
      m(answerTex),
      [
        vars.length ? variant({ inV: Object.fromEntries(vars.map((v) => [v, exps[v]! % index || 0])), out: subtracted }) : null,
        variant({ coef: k * sign * o ** (index - 1) }),
        vars.length ? variant({ inV: keptInside }) : variant({ inC: ans.inC * o }),
        variant({ coef: k * sign * (o + 1) }),
        variant({ inC: ans.inC === 1 ? o : ans.inC * index }),
      ],
      (n) => variant({ coef: ans.coef + offset(n) }),
    );
    return {
      question: m(question),
      answer: m(answerTex),
      steps,
      distractors,
      check: { kind: 'alg2-radicals-rational.radical', vars, positive: true },
    };
  },
});

export const addRadicals = defineTopic({
  id: 'alg2.radical.add',
  subject: 'algebra2',
  title: 'Adding and Subtracting Radical Expressions',
  description: 'Simplify each radical, then combine like radicals.',
  category: CATEGORY,
  instruction: (o) => (o.variables ? 'Simplify. Assume all variables are positive.' : 'Simplify.'),
  multipleChoice: true,
  defaultCount: 12,
  options: [
    { type: 'boolean', id: 'variables', label: 'Include variables (medium/hard)', default: true },
    { type: 'boolean', id: 'cube', label: 'Include cube roots (medium/hard)', default: true },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const useVars = boolOpt(ctx, 'variables') && difficulty !== 'easy' && rng.bool(0.6);
    const n = boolOpt(ctx, 'cube') && difficulty !== 'easy' && rng.bool(0.35) ? 3 : 2;
    const v = rng.pick(['x', 'a', 'n', 'm', 'k', 'p']);
    const twoGroups = !useVars && difficulty === 'hard' && n === 2 && rng.bool(0.5);

    interface T {
      c: number;
      k: number;
      u: number;
      s: number;
      group: number;
    }
    const built = attempt('radical-add', () => {
      const insides = n === 2 ? rng.sample([2, 3, 5, 6, 7], twoGroups ? 2 : 1) : rng.sample([2, 3, 4, 5], 1);
      const E = useVars ? rng.int(0, 2) : 0;
      const r = useVars ? rng.int(E === 0 ? 1 : 0, n - 1) : 0;
      const count = twoGroups ? 3 : difficulty === 'easy' ? 2 : difficulty === 'medium' ? rng.int(2, 3) : 3;
      const ts: T[] = Array.from({ length: count }, (_, i) => {
        const s = rng.int(0, E);
        return {
          c: rng.int(1, difficulty === 'easy' ? 4 : 6) * (i > 0 && rng.bool(0.45) ? -1 : 1),
          k: rng.int(1, n === 2 ? (difficulty === 'easy' ? 3 : 4) : 3),
          u: E - s,
          s,
          group: twoGroups ? (i === 0 ? 0 : i === 1 ? 1 : rng.int(0, 1)) : 0,
        };
      });
      if (!ts.some((t) => t.k > 1 || t.s > 0)) return null;
      const totals = insides.map((_, g) => ts.filter((t) => t.group === g).reduce((acc, t) => acc + t.c * t.k, 0));
      if (totals.some((x) => x === 0)) return null;
      const radicands = ts.map((t) => t.k ** n * insides[t.group]!);
      if (new Set(radicands.map((x, i) => `${x}|${ts[i]!.u}|${ts[i]!.s}`)).size < ts.length) return null;
      return { ts, insides, E, r, totals };
    });
    const { ts, insides, E, r, totals } = built;
    const radicand = (t: T) => radicandTex(t.k ** n * insides[t.group]!, useVars ? { [v]: n * t.s + r } : {});
    const qTerms = ts.map((t) => {
      const mag = `${Math.abs(t.c) === 1 ? '' : Math.abs(t.c)}${useVars ? varsTex({ [v]: t.u }) : ''}${radTex(n, radicand(t))}`;
      return t.c < 0 ? `-${mag}` : mag;
    });
    const question = joinTerms(qTerms);
    const term = (coef: number, g: number): RootTerm => ({ coef, out: useVars ? { [v]: E } : {}, index: n, inC: insides[g]!, inV: useVars ? { [v]: r } : {} });
    const simplifiedTerms = ts.map((t) => rootTermTex(term(t.c * t.k, t.group)));
    const groupTex = (vals: number[]) => joinTerms(vals.map((x, g) => (x === 0 ? '' : rootTermTex(term(x, g)))).filter(Boolean));
    const answerTex = groupTex(totals);
    const steps = [m(`= ${joinTerms(simplifiedTerms)}`), m(`= ${answerTex}`)];

    const naive = insides.map((_, g) => ts.filter((t) => t.group === g).reduce((acc, t) => acc + t.c, 0));
    const absSum = insides.map((_, g) => ts.filter((t) => t.group === g).reduce((acc, t) => acc + Math.abs(t.c) * t.k, 0));
    const wrong = (vals: number[]) => (vals.every((x) => x === 0) ? null : m(groupTex(vals)));
    const distractors = distinctDistractors(
      m(answerTex),
      [
        wrong(naive),
        wrong(absSum),
        wrong(totals.map((x) => -x)),
        insides.length === 1 ? m(rootTermTex({ ...term(totals[0]!, 0), inC: insides[0]! * ts.length })) : null,
      ],
      (k) => wrong(totals.map((x, i) => (i === 0 ? x + offset(k) : x))),
    );
    return {
      question: m(question),
      answer: m(answerTex),
      steps,
      distractors,
      check: { kind: 'alg2-radicals-rational.radical', vars: useVars ? [v] : [], positive: true },
    };
  },
});
