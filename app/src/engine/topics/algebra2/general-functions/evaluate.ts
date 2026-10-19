/** Evaluating functions: f(a), f(g(a)) and f of an expression such as f(x + 1). */
import { attempt, boolOpt, defineTopic, distinctDistractors, opt, pickVar, strOpt } from '../../../generator';
import type { Rng } from '../../../rng';
import { m, num, paren } from '../../../tex';
import type { Difficulty, ProblemContent } from '../../../types';
import { absFn, CATEGORY_FUNC, compose, Frac, polyFn, Poly, polySub, radicalFn, randomPoly, rationalFn, type Fn } from './common';

function pickFn(rng: Rng, d: Difficulty): Fn {
  const kind = rng.pick(
    d === 'easy' ? ['lin', 'quad', 'quad'] : d === 'medium' ? ['quad', 'cubic', 'abs', 'rational'] : ['rational', 'radical', 'quad', 'cubic', 'abs'],
  );
  switch (kind) {
    case 'lin':
      return polyFn(randomPoly(rng, 1, 9));
    case 'quad':
      return polyFn(randomPoly(rng, 2, d === 'easy' ? 5 : 8));
    case 'cubic':
      return polyFn(randomPoly(rng, 3, 5));
    case 'abs':
      return absFn(rng.pick([1, 1, 2, -1, 3]), rng.signedInt(1, 4, true), rng.signedInt(1, 8, true), rng.int(-6, 6));
    case 'rational': {
      const [p, q, r, s] = attempt('rational-fn', () => {
        const t = [rng.signedInt(1, 5, true), rng.int(-8, 8), rng.pick([1, 1, 2, 3]), rng.signedInt(1, 6, true)] as const;
        return t[0] * t[3] === t[1] * t[2] ? null : t;
      });
      return rationalFn(p, q, r, s);
    }
    default:
      return radicalFn(rng.pick([1, 1, 2, 3, -1]), rng.int(1, 4), rng.int(-6, 9), rng.int(-5, 5));
  }
}

const NAMES = ['f', 'g', 'h'];

function numericWrong(fn: Fn, a: Frac, value: Frac): Array<Frac | null> {
  const out: Array<Frac | null> = [fn.at(a.neg())];
  if (fn.poly) {
    const p = fn.poly;
    // (−a)^k read as −a^k
    let w = Frac.ZERO;
    for (let i = 0; i <= p.degree; i++) w = w.add(p.coef(i).mul(a.sign < 0 && i % 2 === 0 && i > 0 ? a.abs().pow(i).neg() : a.pow(i)));
    out.push(w, value.sub(p.coef(0)).sub(p.coef(0)));
  } else if (fn.kind === 'rational') out.push(value.isZero() ? null : value.inv());
  out.push(value.neg());
  return out;
}

export const evaluatingFunctions = defineTopic({
  id: 'alg2.func.evaluate',
  subject: 'algebra2',
  category: CATEGORY_FUNC,
  title: 'Evaluating Functions',
  description: 'Evaluate polynomial, absolute value, rational and radical functions at numbers, expressions and compositions.',
  instruction: 'Evaluate each function.',
  multipleChoice: true,
  defaultCount: 12,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Inputs',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'Mixed' },
        { value: 'numeric', label: 'Numbers only' },
        { value: 'expression', label: 'Expressions, e.g. f(x + 1)' },
      ],
    },
    opt.variedVariables(true),
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const task = strOpt(ctx, 'task');
    const varied = boolOpt(ctx, 'variedVars');
    const v = pickVar(rng, varied);
    const name = varied ? rng.pick(NAMES) : 'f';
    const mode =
      task === 'expression'
        ? 'expression'
        : task === 'numeric'
          ? difficulty === 'hard' && rng.bool(0.35)
            ? 'composition'
            : 'numeric'
          : rng.weighted<string>(
              difficulty === 'easy'
                ? [['numeric', 3], ['expression', 1]]
                : difficulty === 'medium'
                  ? [['numeric', 2], ['expression', 1]]
                  : [['numeric', 2], ['expression', 1], ['composition', 1]],
            );
    const def = (n: string, fn: Fn) => m(`${n}(${v}) = ${fn.sub(v)}`);

    if (mode === 'expression') {
      return attempt('evaluate-expression', () => {
        const p = difficulty === 'easy' ? randomPoly(rng, rng.pick([1, 2]), 6) : randomPoly(rng, 2, 6);
        if (p.degree < 1) return null;
        let u: Poly;
        if (difficulty === 'easy') u = rng.bool(0.3) ? Poly.of(0, -1) : Poly.of(0, rng.signedInt(2, 5, true));
        else if (difficulty === 'medium') u = Poly.of(rng.signedInt(1, 5, true), 1);
        else u = rng.bool(0.25) ? Poly.of(0, 0, 1) : Poly.of(rng.signedInt(1, 4, true), rng.signedInt(2, 3, true));
        const uTex = u.toTex(v);
        const req = `${name}(${uTex})`;
        const ans = compose(p, u);
        const show = (q: Poly) => m(`${req} = ${q.toTex(v)}`);
        // wrong: u applied outside; only the leading term substituted; (αx + β)^k as (αx)^k + β^k
        const outside = compose(u, p);
        const leadTerm = new Poly(p.c.map((c, i) => (i === p.degree ? c : Frac.ZERO)));
        const leadOnly = p.sub(leadTerm).add(compose(leadTerm, u));
        let split = Poly.of(0);
        for (let i = 0; i <= p.degree; i++) {
          const parts = u.c.map((c, j) => Poly.of(...Array(j).fill(0), c).powInt(i));
          const s = i === 0 ? Poly.of(1) : parts.reduce((acc, x) => acc.add(x), Poly.of(0));
          split = split.add(s.scale(p.coef(i)));
        }
        const answer = show(ans);
        const distractors = distinctDistractors(answer, [show(outside), show(leadOnly), show(split), show(ans.sub(Poly.of(2 * (u.coef(0).value || 1))))], (k) =>
          show(ans.add(Poly.of(k))),
        );
        const steps = [`Replace every $${v}$ with $${u.isZero() ? '0' : uTex}$: $${req} = ${polySub(p, `(${uTex})`)}$`, `Simplify: $${req} = ${ans.toTex(v)}$`];
        return {
          question: `${def(name, polyFn(p))}. Find $${req}$.`,
          answer,
          steps,
          distractors,
          check: { kind: 'alg2-quadratics-functions.funcEval' },
        };
      });
    }

    if (mode === 'composition') {
      return attempt('evaluate-composition', () => {
        const f = polyFn(randomPoly(rng, rng.pick([1, 2]), 5));
        const g = polyFn(randomPoly(rng, rng.pick([1, 2]), 5));
        const a = new Frac(rng.int(-4, 4));
        const ga = g.at(a)!;
        const val = f.at(ga)!;
        if (Math.abs(ga.value) > 15 || Math.abs(val.value) > 400) return null;
        const req = `f(g(${num(a)}))`;
        const show = (x: Frac | null) => (x ? m(`${req} = ${num(x)}`) : null);
        const answer = show(val)!;
        const distractors = distinctDistractors(
          answer,
          [show(g.at(f.at(a)!)), show(f.at(a)!.mul(ga)), show(f.at(a)!.add(ga)), show(val.neg())],
          (k) => show(val.add(k)),
        );
        return {
          question: `${def('f', f)} and ${def('g', g)}. Find $${req}$.`,
          answer,
          steps: [`$g(${num(a)}) = ${g.sub(paren(a))} = ${num(ga)}$`, `$f(${num(ga)}) = ${f.sub(paren(ga))} = ${num(val)}$`],
          distractors,
          check: { kind: 'alg2-quadratics-functions.funcEval' },
        };
      });
    }

    return attempt('evaluate-numeric', () => {
      const fn = pickFn(rng, difficulty);
      const a =
        difficulty === 'hard' && fn.kind === 'poly' && rng.bool(0.5)
          ? new Frac(rng.signedInt(1, 5, true), rng.pick([2, 3]))
          : new Frac(rng.bool(0.1) ? 0 : rng.signedInt(1, difficulty === 'easy' ? 5 : 8, true));
      const val = fn.at(a);
      if (!val || Math.abs(val.value) > 500 || val.d > 36) return null;
      if (fn.kind === 'rational' && val.isInt() && rng.bool(0.5)) return null;
      const req = `${name}(${num(a)})`;
      const show = (x: Frac | null) => (x ? m(`${req} = ${num(x)}`) : null);
      const answer = show(val)!;
      const distractors = distinctDistractors(answer, numericWrong(fn, a, val).map(show), (k) => show(val.add(k)));
      return {
        question: `${def(name, fn)}. Find $${req}$.`,
        answer,
        steps: [`Substitute $${v} = ${num(a)}$: $${req} = ${fn.sub(paren(a))}$`, `$${req} = ${num(val)}$`],
        distractors,
        check: { kind: 'alg2-quadratics-functions.funcEval' },
      };
    });
  },
});
