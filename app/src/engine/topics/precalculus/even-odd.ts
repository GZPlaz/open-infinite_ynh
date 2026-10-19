/** Even and odd functions: the algebraic test f(−x) = ±f(x). */
import { attempt, defineTopic, distinctDistractors } from '../../generator';
import { Poly } from '../../polynomial';
import type { Rng } from '../../rng';
import { linear, m, sum } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';

type Parity = 'Even' | 'Odd' | 'Neither';
const CHOICES = ['Even', 'Odd', 'Neither', 'Both even and odd'] as const;

interface Fn {
  tex: string;
  /** f(−x) simplified. */
  neg: string;
  parity: Parity;
}

function randPoly(rng: Rng, parity: Parity, maxDeg: number): Poly {
  return attempt('parity-poly', () => {
    const evens = [0, 2, 4, 6].filter((k) => k <= maxDeg);
    const odds = [1, 3, 5].filter((k) => k <= maxDeg);
    let powers: number[];
    if (parity === 'Even') powers = rng.sample(evens, rng.int(2, Math.min(3, evens.length)));
    else if (parity === 'Odd') powers = rng.sample(odds, rng.int(1, Math.min(3, odds.length)));
    else powers = [...rng.sample(evens, rng.int(1, 2)), ...rng.sample(odds, rng.int(1, 2))];
    const c: number[] = Array.from({ length: maxDeg + 1 }, () => 0);
    for (const k of powers) c[k] = rng.signedInt(1, 9, true);
    const p = new Poly(c);
    if (p.degree < 1) return null;
    if (parity === 'Odd' && p.degree === 1 && rng.bool(0.7)) return null;
    return p;
  });
}

const negPoly = (p: Poly) => new Poly(p.c.map((x, i) => (i % 2 ? x.neg() : x)));

function polyFn(rng: Rng, parity: Parity, maxDeg: number): Fn {
  const p = randPoly(rng, parity, maxDeg);
  return { tex: p.toTex(), neg: negPoly(p).toTex(), parity };
}

/** Non-polynomial templates (medium / hard). */
function templateFn(rng: Rng, parity: Parity, hard: boolean): Fn {
  const a = rng.signedInt(1, 9, true);
  const c = rng.int(1, 9);
  const h = rng.signedInt(1, 5, true);
  const opts: Array<() => Fn> = [];
  if (parity === 'Even') {
    opts.push(
      () => ({ tex: `\\frac{${a}}{x^{2} + ${c}}`, neg: `\\frac{${a}}{x^{2} + ${c}}`, parity }),
      () => ({ tex: sum([{ coef: a, sym: '|x|' }, { coef: h }]), neg: sum([{ coef: a, sym: '|x|' }, { coef: h }]), parity }),
      () => ({ tex: `\\sqrt{x^{2} + ${c}}`, neg: `\\sqrt{x^{2} + ${c}}`, parity }),
    );
    if (hard) {
      opts.push(
        () => ({ tex: `\\frac{x^{4} - ${c}}{${sum([{ coef: a, sym: 'x^{2}' }, { coef: h * h }])}}`, neg: `\\frac{x^{4} - ${c}}{${sum([{ coef: a, sym: 'x^{2}' }, { coef: h * h }])}}`, parity }),
        () => ({ tex: `x^{2}\\sqrt{x^{2} + ${c}}`, neg: `x^{2}\\sqrt{x^{2} + ${c}}`, parity }),
        () => ({ tex: `\\frac{x}{${sum([{ coef: 1, sym: 'x^{3}' }, { coef: -c, sym: 'x' }])}}`, neg: `\\frac{x}{${sum([{ coef: 1, sym: 'x^{3}' }, { coef: -c, sym: 'x' }])}}`, parity }),
      );
    }
  } else if (parity === 'Odd') {
    opts.push(
      () => ({ tex: `\\frac{${linear(a, 0)}}{x^{2} + ${c}}`, neg: `-\\frac{${linear(a, 0)}}{x^{2} + ${c}}`, parity }),
      () => ({ tex: sum([{ coef: a, sym: 'x|x|' }]), neg: sum([{ coef: -a, sym: 'x|x|' }]), parity }),
      () => ({ tex: sum([{ coef: a, sym: '\\sqrt[3]{x}' }, { coef: h, sym: 'x^{3}' }]), neg: sum([{ coef: -a, sym: '\\sqrt[3]{x}' }, { coef: -h, sym: 'x^{3}' }]), parity }),
    );
    if (hard) {
      opts.push(
        () => ({ tex: `\\frac{${sum([{ coef: 1, sym: 'x^{3}' }, { coef: -c, sym: 'x' }])}}{x^{2} + ${h * h}}`, neg: `-\\frac{${sum([{ coef: 1, sym: 'x^{3}' }, { coef: -c, sym: 'x' }])}}{x^{2} + ${h * h}}`, parity }),
        () => ({ tex: sum([{ coef: a, sym: 'x\\sqrt{x^{2} + ' + c + '}' }]), neg: sum([{ coef: -a, sym: 'x\\sqrt{x^{2} + ' + c + '}' }]), parity }),
        () => ({ tex: `\\frac{x^{2} + ${c}}{x^{3}}`, neg: `-\\frac{x^{2} + ${c}}{x^{3}}`, parity }),
      );
    }
  } else {
    opts.push(
      () => ({ tex: `\\frac{${a}}{${linear(1, -h)}}`, neg: `\\frac{${a}}{${linear(-1, -h)}}`, parity }),
      () => ({ tex: `\\left|${linear(1, -h)}\\right|`, neg: `\\left|${linear(-1, -h)}\\right|`, parity }),
      () => ({ tex: `\\sqrt{x + ${c}}`, neg: `\\sqrt{${linear(-1, c)}}`, parity }),
      () => ({ tex: sum([{ coef: a, sym: '|x|' }, { coef: h, sym: 'x' }]), neg: sum([{ coef: a, sym: '|x|' }, { coef: -h, sym: 'x' }]), parity }),
    );
    if (hard) {
      opts.push(
        () => ({ tex: `\\frac{x^{2}}{x^{3} + ${c}}`, neg: `\\frac{x^{2}}{${c} - x^{3}}`, parity }),
        () => ({ tex: `\\frac{${linear(1, h)}}{x^{2} + ${c}}`, neg: `\\frac{${linear(-1, h)}}{x^{2} + ${c}}`, parity }),
      );
    }
  }
  return rng.pick(opts)();
}

/** f(x) with every x replaced by (−x). */
const substituted = (tex: string) => tex.replace(/x/g, '(-x)');

export const evenOdd = defineTopic({
  id: 'precalc.functions.even-odd',
  subject: 'precalculus',
  category: 'Functions',
  title: 'Even and Odd Functions',
  description: 'Decide algebraically whether a function is even, odd, or neither by comparing f(−x) with f(x).',
  instruction: 'State whether each function is even, odd, or neither.',
  multipleChoice: true,
  defaultCount: 12,
  options: [],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const parity = rng.pick<Parity>(['Even', 'Odd', 'Neither']);
    const d: Difficulty = difficulty;
    const f: Fn = d === 'easy' || rng.bool(0.35) ? polyFn(rng, parity, d === 'easy' ? 4 : 6) : templateFn(rng, parity, d === 'hard');
    const steps = [m(`f(-x) = ${substituted(f.tex)}`), m(`f(-x) = ${f.neg}`)];
    steps.push(
      parity === 'Even'
        ? `${m('f(-x) = f(x)')}, so the function is even.`
        : parity === 'Odd'
          ? `${m('f(-x) = -f(x)')}, so the function is odd.`
          : `${m('f(-x)')} equals neither ${m('f(x)')} nor ${m('-f(x)')}, so the function is neither.`,
    );
    const answer = parity;
    return {
      question: m(`f(x) = ${f.tex}`),
      answer,
      steps,
      distractors: distinctDistractors(answer, CHOICES.filter((c) => c !== answer), () => null),
      check: { kind: 'precalculus.parity' },
    };
  },
});
