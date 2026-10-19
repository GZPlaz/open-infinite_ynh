/** Two-step equations: ax + b = c, x/a + b = c, (x + b)/a = c, … */
import { Frac } from '../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, offset, opt, pickVar } from '../../generator';
import { linear, m, num, sum } from '../../tex';
import type { ProblemContent } from '../../types';
import { CAT } from './common';

type Form = 'ax+b' | 'b-ax' | 'x/a+b' | '(x+b)/a' | 'frac-coef';

export const twoStepEquations = defineTopic({
  id: 'prealg.two-step',
  subject: 'prealgebra',
  category: CAT.equations,
  title: 'Two-Step Equations',
  description: 'Undo addition/subtraction, then multiplication/division.',
  instruction: 'Solve each equation.',
  multipleChoice: true,
  defaultCount: 16,
  options: [opt.negatives(true), opt.fractionAnswers(false), opt.variedVariables(true)],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const negatives = boolOpt(ctx, 'negatives');
    const fractions = boolOpt(ctx, 'fractions');
    const v = pickVar(rng, boolOpt(ctx, 'variedVars'));
    const forms: Form[] =
      difficulty === 'easy' ? ['ax+b', 'x/a+b'] : difficulty === 'medium' ? ['ax+b', 'b-ax', 'x/a+b', '(x+b)/a'] : ['b-ax', '(x+b)/a', 'frac-coef', 'x/a+b'];

    const p = attempt('two-step', () => {
      const form = rng.pick(negatives ? forms : forms.filter((f) => f !== 'b-ax'));
      const max = difficulty === 'easy' ? 10 : 15;
      const a = rng.signedInt(2, difficulty === 'easy' ? 9 : 12, negatives && form !== 'b-ax');
      const b = rng.signedInt(1, max, negatives);
      let x: Frac;
      if (fractions && (form === 'ax+b' || form === 'b-ax')) {
        x = new Frac(rng.signedInt(1, max * 2, negatives), Math.abs(a));
        if (x.isInt()) return null;
      } else {
        x = new Frac(rng.signedInt(1, max, negatives));
      }
      let lhs: string;
      let c: Frac;
      const steps: string[] = [];
      switch (form) {
        case 'ax+b':
          c = x.mul(a).add(b);
          lhs = linear(a, b, v);
          steps.push(`${b > 0 ? 'Subtract' : 'Add'} $${Math.abs(b)}$: $${sum([{ coef: a, sym: v }])} = ${num(c.sub(b))}$`);
          steps.push(`Divide by $${a}$: $${v} = ${num(x)}$`);
          break;
        case 'b-ax':
          c = new Frac(b).sub(x.mul(a));
          lhs = sum([{ coef: b }, { coef: -a, sym: v }]);
          steps.push(`${b > 0 ? 'Subtract' : 'Add'} $${Math.abs(b)}$: $${sum([{ coef: -a, sym: v }])} = ${num(c.sub(b))}$`);
          steps.push(`Divide by $${-a}$: $${v} = ${num(x)}$`);
          break;
        case 'x/a+b': {
          // x is a multiple of a so the quotient is an integer
          x = new Frac(rng.signedInt(1, 8, negatives) * a);
          c = x.div(a).add(b);
          const fracPart = a < 0 ? `-\\frac{${v}}{${-a}}` : `\\frac{${v}}{${a}}`;
          lhs = sum([{ coef: 1, sym: fracPart }, { coef: b }]);
          steps.push(`${b > 0 ? 'Subtract' : 'Add'} $${Math.abs(b)}$: $${fracPart} = ${num(c.sub(b))}$`);
          steps.push(`Multiply by $${a}$: $${v} = ${num(x)}$`);
          break;
        }
        case '(x+b)/a': {
          const aa = Math.abs(a);
          const q = rng.signedInt(1, 9, negatives);
          x = new Frac(q * aa - b);
          if (x.isZero()) return null;
          c = new Frac(q);
          lhs = `\\frac{${linear(1, b, v)}}{${aa}}`;
          steps.push(`Multiply by $${aa}$: $${linear(1, b, v)} = ${q * aa}$`);
          steps.push(`${b > 0 ? 'Subtract' : 'Add'} $${Math.abs(b)}$: $${v} = ${num(x)}$`);
          break;
        }
        case 'frac-coef': {
          const den = rng.int(2, 5);
          const nu = rng.signedInt(1, den * 2, negatives);
          const k = new Frac(nu, den);
          if (k.isInt() || k.d !== den) return null;
          x = new Frac(rng.signedInt(1, 6, negatives) * den);
          c = x.mul(k).add(b);
          lhs = sum([{ coef: k, sym: v }, { coef: b }]);
          steps.push(`${b > 0 ? 'Subtract' : 'Add'} $${Math.abs(b)}$: $${sum([{ coef: k, sym: v }])} = ${num(c.sub(b))}$`);
          steps.push(`Multiply by $${num(k.inv())}$: $${v} = ${num(x)}$`);
          break;
        }
      }
      if (!c.isInt() || Math.abs(c.value) > 120) return null;
      if (!negatives && (c.sign < 0 || x.sign < 0)) return null;
      return { lhs, c, x, steps };
    });

    const answer = m(`${v} = ${num(p.x)}`);
    const unitStep = new Frac(1, p.x.d);
    const distractors = distinctDistractors(
      answer,
      [m(`${v} = ${num(p.x.neg())}`), m(`${v} = ${num(p.x.add(unitStep.mul(2)))}`), p.x.isZero() ? null : m(`${v} = ${num(p.x.inv())}`)],
      (k) => m(`${v} = ${num(p.x.add(unitStep.mul(offset(k))))}`),
    );
    return {
      question: m(`${p.lhs} = ${num(p.c)}`),
      answer,
      steps: p.steps,
      distractors,
      check: { kind: 'linear', variable: v, solution: p.x.value },
    };
  },
});
