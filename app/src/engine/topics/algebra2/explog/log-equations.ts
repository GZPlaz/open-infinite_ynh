/** Logarithmic equations: one log (simple) and combined logs with extraneous solutions (hard). */
import { Frac } from '../../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, offset, opt, pickVar } from '../../../generator';
import type { Rng } from '../../../rng';
import { decimal, linear, m, num, sum, term } from '../../../tex';
import type { Difficulty, ProblemContent } from '../../../types';
import { CATEGORY, fr, logOf, powTex, type Base } from './common';

function answerList(v: string, xs: Frac[]): string {
  if (!xs.length) return 'No solution';
  return m(`${v} = ${xs.map((x) => num(x)).join(', ')}`);
}

function plus(s: string, k: number): string {
  return k === 0 ? s : k > 0 ? `${s} + ${k}` : `${s} - ${-k}`;
}

// ------------------------------------------------------------ simple

interface Simple {
  question: string;
  answer: string;
  steps: string[];
  wrong: Array<string | null>;
  solutions: number[];
}

function simple(rng: Rng, d: Difficulty, v: string, fractions: boolean, natural: boolean): Simple {
  const forms = d === 'easy' ? ['lin', 'lin', 'base', 'ten'] : d === 'medium' ? ['lin', 'coef', 'equal', 'base', 'neg'] : ['coef', 'equal', 'square', 'neg', ...(natural ? ['ln', 'ln'] : [])];
  return attempt('log-eq-simple', () => {
    const form = rng.pick(forms);
    const b = rng.pick([2, 3, 4, 5, 6, 7]);
    const B = fr(b);
    const ans = (xs: Frac[]) => answerList(v, xs);
    if (form === 'lin' || form === 'ten' || form === 'neg' || form === 'coef') {
      const base: Base = form === 'ten' ? fr(10) : B;
      const bv = form === 'ten' ? 10 : b;
      const n = form === 'neg' ? -rng.int(1, 3) : rng.int(1, form === 'ten' ? 2 : 3);
      if (form === 'neg' && !fractions) return null;
      const pw = new Frac(bv).pow(n);
      if (pw.value > 350) return null;
      const p = d === 'easy' ? rng.pick([1, 1, 2, 3]) : rng.int(1, 6);
      const q = rng.int(-12, 12);
      const x = pw.sub(q).div(p);
      if (!fractions && !x.isInt()) return null;
      if (Math.abs(x.value) > 120) return null;
      const inner = linear(p, q, v);
      const L = logOf(base, inner);
      let lhs = L;
      let pre: string[] = [];
      if (form === 'coef') {
        const a = rng.int(2, 5);
        const c = rng.signedInt(1, 9, true);
        lhs = plus(term(a, L), c);
        const rhs = a * n + c;
        pre = [m(`${term(a, L)} = ${rhs - c}`), m(`${L} = ${n}`)];
        return {
          question: m(`${lhs} = ${rhs}`),
          answer: ans([x]),
          steps: [...pre, `Exponential form: ${m(`${inner} = ${powTex(base, String(n))}${pw.isInt() && n !== 1 ? ` = ${pw.toTex()}` : ''}`)}`, m(`${v} = ${num(x)}`)],
          wrong: [ans([new Frac(rhs).sub(q).div(p)]), ans([new Frac(bv * n).sub(q).div(p)]), ans([pw.add(q).div(p)])],
          solutions: [x.value],
        };
      }
      return {
        question: m(`${lhs} = ${n}`),
        answer: ans([x]),
        steps: [`Exponential form: ${m(`${inner} = ${n === 1 ? String(bv) : powTex(base, String(n))}${n !== 1 ? ` = ${pw.toTex()}` : ''}`)}`, m(`${v} = ${num(x)}`)],
        wrong: [ans([new Frac(bv * n).sub(q).div(p)]), ans([new Frac(n).pow(Math.abs(bv) > 6 ? 2 : bv).sub(q).div(p)]), ans([pw.add(q).div(p)]), p !== 1 ? ans([pw.sub(q)]) : null],
        solutions: [x.value],
      };
    }
    if (form === 'base') {
      const r = rng.int(2, 9);
      const n = rng.int(2, r <= 3 ? 5 : 3);
      const N = r ** n;
      if (N > 1000) return null;
      return {
        question: m(`\\log_{${v}} ${N} = ${n}`),
        answer: ans([fr(r)]),
        steps: [`Exponential form: ${m(`${v}^{${n}} = ${N}`)}`, `A base must be positive, so ${m(`${v} = \\sqrt${n === 2 ? '' : `[${n}]`}{${N}} = ${r}`)}`],
        wrong: [ans([new Frac(N, n)]), ans([fr(N * n)]), ans([fr(n)]), ans([fr(-r)])],
        solutions: [r],
      };
    }
    if (form === 'equal') {
      const x = new Frac(rng.int(-6, 12));
      const p = rng.int(1, 6);
      let r = rng.int(1, 6);
      if (r === p) r = p + rng.int(1, 3);
      const q = rng.int(-10, 15);
      const s = x.mul(p).add(q).sub(x.mul(r));
      const at = x.mul(p).add(q);
      if (at.value <= 0 || !s.isInt() || Math.abs(s.value) > 30) return null;
      const base: Base = rng.bool(0.25) ? fr(10) : rng.bool(0.2) && natural ? 'e' : B;
      return {
        question: m(`${logOf(base, linear(p, q, v))} = ${logOf(base, linear(r, s, v))}`),
        answer: ans([x]),
        steps: [`One-to-one property: ${m(`${linear(p, q, v)} = ${linear(r, s, v)}`)}`, m(`${term(p - r, v)} = ${s.sub(q).toTex()}`), `${m(`${v} = ${num(x)}`)}; both arguments equal ${m(at.toTex())} there, which is positive.`],
        wrong: [ans([s.add(q).div(p - r)]), ans([x.neg()]), ans([s.sub(q).div(p + r)])],
        solutions: [x.value],
      };
    }
    if (form === 'square') {
      const r = rng.int(2, 9);
      const n = rng.int(2, 4);
      const pw = b ** n;
      const q = pw - r * r;
      if (pw > 300 || q === 0 || Math.abs(q) > 60) return null;
      const inner = sum([{ coef: 1, sym: `${v}^{2}` }, { coef: q }]);
      return {
        question: m(`${logOf(B, inner)} = ${n}`),
        answer: m(`${v} = ${r}, -${r}`),
        steps: [`Exponential form: ${m(`${inner} = ${pw}`)}`, m(`${v}^{2} = ${r * r}`), `${m(`${v} = \\pm ${r}`)} (both make ${m(inner)} positive)`],
        wrong: [m(`${v} = ${r}`), m(`${v} = ${pw - q}`), m(`${v} = ${Math.abs(b * n - q) === r ? r + 2 : Math.abs(b * n - q)}, -${Math.abs(b * n - q) === r ? r + 2 : Math.abs(b * n - q)}`)],
        solutions: [r, -r],
      };
    }
    // ln (px + q) = n, or a·ln(px + q) + c = d
    const n = rng.intExcept(-2, 4, [0]);
    const p = rng.int(1, 5);
    const q = rng.int(-9, 9);
    const x = (Math.exp(n) - q) / p;
    const inner = linear(p, q, v);
    const en = n === 1 ? 'e' : `e^{${n}}`;
    const top = q === 0 ? en : `${en} ${q > 0 ? '-' : '+'} ${Math.abs(q)}`;
    const exact = p === 1 ? top : `\\frac{${top}}{${p}}`;
    const a = rng.bool() ? rng.int(2, 4) : 1;
    const c = a === 1 ? 0 : rng.signedInt(1, 9, true);
    const lhs = plus(term(a, `\\ln ${/[+-]/.test(inner) || p !== 1 ? `(${inner})` : inner}`), c);
    const rhs = a * n + c;
    const mk = (tex: string, val: number) => m(`${v} = ${tex} \\approx ${decimal(val, 3)}`);
    const shift = (core: string, k: number) => (k === 0 ? core : `${core} ${k > 0 ? '+' : '-'} ${Math.abs(k)}`);
    const over = (t: string) => (p === 1 ? t : `\\frac{${t}}{${p}}`);
    return {
      question: m(`${lhs} = ${rhs}`),
      answer: mk(exact, x),
      steps: [...(a !== 1 || c !== 0 ? [m(`\\ln (${inner}) = ${n}`)] : []), `Exponential form: ${m(`${inner} = ${en}`)}`, mk(exact, x)],
      wrong: [
        q !== 0 ? mk(over(shift(en, q)), (Math.exp(n) + q) / p) : null,
        mk(over(shift(`10^{${n}}`, -q)), (10 ** n - q) / p),
        mk(over(shift(term(n, "e"), -q)), (n * Math.E - q) / p),
        a !== 1 ? mk(over(shift(`e^{${rhs}}`, -q)), (Math.exp(rhs) - q) / p) : null,
      ],
      solutions: [x],
    };
  });
}

export const logEqSimple = defineTopic({
  id: 'alg2.explog.log-eq-simple',
  subject: 'algebra2',
  category: CATEGORY,
  title: 'Logarithmic Equations (Simple)',
  description: 'Solve equations with a single logarithm, e.g. log₃(x + 2) = 4, by rewriting in exponential form.',
  instruction: 'Solve each equation.',
  multipleChoice: true,
  defaultCount: 12,
  options: [opt.fractionAnswers(false), { type: 'boolean', id: 'natural', label: 'Include natural logs (hard)', default: true }, opt.variedVariables(false)],
  generate(ctx): ProblemContent {
    const { rng, difficulty: d } = ctx;
    const v = pickVar(rng, boolOpt(ctx, 'variedVars'));
    const s = simple(rng, d, v, boolOpt(ctx, 'fractions'), boolOpt(ctx, 'natural'));
    const fallback = (k: number) => answerList(v, [new Frac(Math.round(s.solutions[0]!) + offset(k) * 3)]);
    return {
      question: s.question,
      answer: s.answer,
      steps: s.steps,
      distractors: distinctDistractors(
        s.answer,
        s.wrong.filter((w) => !w || boolOpt(ctx, 'fractions') || !/\\frac/.test(w) || /\\frac/.test(s.answer)),
        fallback,
      ),
      check: { kind: 'alg2-explog.solve', variable: v, solutions: s.solutions, places: 3 },
    };
  },
});

// ------------------------------------------------------------ hard (combined logs, extraneous solutions)

interface Hard {
  question: string;
  steps: string[];
  roots: Frac[];
  valid: Frac[];
  extraneous: Frac[];
  wrongCombine: Frac[] | null;
}

function intRoots(B: number, C: number): Frac[] | null {
  // x² + Bx + C = 0 with integer roots
  const D = B * B - 4 * C;
  if (D < 0) return null;
  const s = Math.round(Math.sqrt(D));
  if (s * s !== D || (-B + s) % 2 !== 0) return null;
  const r1 = (-B + s) / 2;
  const r2 = (-B - s) / 2;
  return r1 === r2 ? [new Frac(r1)] : [new Frac(r1), new Frac(r2)];
}

function hard(rng: Rng, d: Difficulty, v: string, natural: boolean): Hard {
  const forms = d === 'easy' ? ['sum', 'twice', 'diff'] : d === 'medium' ? ['sum', 'diff', 'three', 'twice'] : ['three', 'three', 'sum', 'diff', 'twice'];
  return attempt('log-eq-hard', () => {
    const form = rng.pick(forms);
    const b = rng.pick([2, 3, 4, 5, 6]);
    const B = fr(b);
    const lin = (p: number) => linear(1, p, v);
    if (form === 'sum') {
      const n = rng.int(1, d === 'easy' ? 3 : 4);
      const P = b ** n;
      if (P > (d === 'easy' ? 40 : 130)) return null;
      const pairs: Array<[number, number]> = [];
      for (let u = 1; u * u < P; u++) if (P % u === 0 && P / u <= 40) pairs.push([u, P / u]);
      if (!pairs.length) return null;
      let [u, w] = rng.pick(pairs);
      if (rng.bool()) [u, w] = [w, u];
      const r1 = rng.int(d === 'easy' ? 1 : -4, 9);
      const p = u - r1;
      const q = w - r1;
      if (Math.abs(p) > 15 || Math.abs(q) > 15 || p === q) return null;
      const roots = intRoots(p + q, p * q - P)!;
      const ok = (x: Frac) => x.add(p).sign > 0 && x.add(q).sign > 0;
      const quad = sum([{ coef: 1, sym: `${v}^{2}` }, { coef: p + q, sym: v }, { coef: p * q - P }]);
      return {
        question: m(`${logOf(B, lin(p))} + ${logOf(B, lin(q))} = ${n}`),
        steps: [
          `Product rule: ${m(`${logOf(B, `(${lin(p)})(${lin(q)})`, false)} = ${n}`)}`,
          `Exponential form: ${m(`(${lin(p)})(${lin(q)}) = ${P}`)}, so ${m(`${quad} = 0`)}`,
          `Candidates: ${m(roots.map((r) => `${v} = ${num(r)}`).join(',\\ '))}`,
          ...roots.filter((x) => !ok(x)).map((x) => `${m(`${v} = ${num(x)}`)} is extraneous (a logarithm of a negative number).`),
        ],
        roots,
        valid: roots.filter(ok),
        extraneous: roots.filter((x) => !ok(x)),
        wrongCombine: (P - p - q) % 2 === 0 ? [new Frac((P - p - q) / 2)] : null,
      };
    }
    if (form === 'diff') {
      const n = rng.int(1, 2);
      const P = b ** n;
      if (P > 36) return null;
      const none = d !== 'easy' && rng.bool(0.2);
      const t = none ? -rng.int(1, 5) : rng.int(1, 6);
      const x = rng.int(-5, 12);
      const q = t - x;
      const p = P * t - x;
      if (Math.abs(p) > 45) return null;
      const X = new Frac(x);
      const ok = t > 0;
      return {
        question: m(`${logOf(B, lin(p))} - ${logOf(B, lin(q))} = ${n}`),
        steps: [
          `Quotient rule: ${m(`${logOf(B, `\\frac{${lin(p)}}{${lin(q)}}`)} = ${n}`)}`,
          `Exponential form: ${m(`${lin(p)} = ${P}(${lin(q)})`)}`,
          `${m(`${v} = ${x}`)}${ok ? '' : `, but then ${m(`${lin(q)} = ${t}`)} is negative: extraneous, so there is no solution.`}`,
        ],
        roots: [X],
        valid: ok ? [X] : [],
        extraneous: ok ? [] : [X],
        wrongCombine: [new Frac(P - p - q, 2)],
      };
    }
    if (form === 'twice') {
      const r1 = rng.int(2, 9);
      const r2 = d === 'easy' ? -rng.int(1, 6) : rng.bool(0.2) ? rng.int(1, 9) : -rng.int(1, 8);
      if (r1 === r2) return null;
      const p = r1 + r2;
      const q = -r1 * r2;
      const base: Base = d === 'hard' && natural && rng.bool(0.4) ? 'e' : rng.bool(0.25) ? fr(10) : B;
      const rhsArg = p === 0 ? String(q) : linear(p, q, v);
      const roots = [new Frac(r1), new Frac(r2)];
      const ok = (x: Frac) => x.sign > 0;
      return {
        question: m(`${term(2, logOf(base, v))} = ${logOf(base, rhsArg)}`),
        steps: [
          `Power rule: ${m(`${logOf(base, `${v}^{2}`)} = ${logOf(base, rhsArg)}`)}`,
          `One-to-one: ${m(`${v}^{2} = ${rhsArg}`)}, so ${m(`${sum([{ coef: 1, sym: `${v}^{2}` }, { coef: -p, sym: v }, { coef: -q }])} = 0`)}`,
          `Candidates: ${m(`${v} = ${r1},\\ ${v} = ${r2}`)}`,
          ...roots.filter((x) => !ok(x)).map((x) => `${m(`${v} = ${num(x)}`)} is extraneous (${m(logOf(base, num(x), true))} is not defined).`),
        ],
        roots,
        valid: roots.filter(ok),
        extraneous: roots.filter((x) => !ok(x)),
        wrongCombine: p !== 2 ? [new Frac(q, 2 - p)] : null,
      };
    }
    // log(x + p) + log(x + q) = log(rx + s)
    const r1 = rng.int(-6, 10);
    const r2 = rng.int(-8, 10);
    if (r1 === r2) return null;
    const p = rng.int(-6, 8);
    const q = rng.int(-6, 8);
    if (p === q) return null;
    const r = p + q + r1 + r2;
    const s = p * q - r1 * r2;
    if (r === 0 && s <= 0) return null;
    if (Math.abs(r) > 20 || Math.abs(s) > 60) return null;
    const roots = [new Frac(r1), new Frac(r2)];
    const ok = (x: Frac) => x.add(p).sign > 0 && x.add(q).sign > 0 && x.mul(r).add(s).sign > 0;
    const valid = roots.filter(ok);
    if (!valid.length && rng.bool(0.8)) return null;
    const base: Base = natural && rng.bool(0.35) ? 'e' : rng.bool(0.2) ? fr(10) : B;
    const rhsArg = r === 0 ? String(s) : linear(r, s, v);
    const quad = sum([{ coef: 1, sym: `${v}^{2}` }, { coef: -(r1 + r2), sym: v }, { coef: r1 * r2 }]);
    return {
      question: m(`${logOf(base, lin(p))} + ${logOf(base, lin(q))} = ${logOf(base, rhsArg)}`),
      steps: [
        `Product rule, then one-to-one: ${m(`(${lin(p)})(${lin(q)}) = ${rhsArg}`)}`,
        `${m(`${quad} = 0`)}, candidates ${m(`${v} = ${r1},\\ ${v} = ${r2}`)}`,
        ...roots.filter((x) => !ok(x)).map((x) => `${m(`${v} = ${num(x)}`)} is extraneous (it makes an argument zero or negative).`),
      ],
      roots,
      valid,
      extraneous: roots.filter((x) => !ok(x)),
      wrongCombine: r !== 1 && (s - p - q) % (1 - r) === 0 ? [new Frac(s - p - q, 1 - r)] : null,
    };
  });
}

export const logEqHard = defineTopic({
  id: 'alg2.explog.log-eq-hard',
  subject: 'algebra2',
  category: CATEGORY,
  title: 'Logarithmic Equations (Hard)',
  description: 'Combine logarithms with the product, quotient and power rules, solve, and reject extraneous solutions.',
  instruction: 'Solve each equation. Check for extraneous solutions.',
  multipleChoice: true,
  defaultCount: 10,
  options: [{ type: 'boolean', id: 'natural', label: 'Include natural logs', default: true }, opt.variedVariables(false)],
  generate(ctx): ProblemContent {
    const { rng, difficulty: d } = ctx;
    const v = pickVar(rng, boolOpt(ctx, 'variedVars'));
    const h = hard(rng, d, v, boolOpt(ctx, 'natural'));
    const answer = answerList(v, h.valid);
    const steps = [...h.steps, h.valid.length ? `Solution: ${answer}` : 'No solution'];
    const distractors = distinctDistractors(
      answer,
      [
        h.extraneous.length ? answerList(v, h.roots) : null,
        h.extraneous.length ? answerList(v, h.extraneous) : null,
        h.valid.length ? 'No solution' : null,
        h.wrongCombine?.every((x) => x.isInt()) ? answerList(v, h.wrongCombine) : null,
        answerList(v, h.roots.map((x) => x.neg())),
      ],
      (k) => answerList(v, [h.roots[0]!.add(offset(k))]),
    );
    return {
      question: h.question,
      answer,
      steps,
      distractors,
      check: { kind: 'alg2-explog.solve', variable: v, solutions: h.valid.map((x) => x.value), extraneous: h.extraneous.map((x) => x.value) },
    };
  },
});
