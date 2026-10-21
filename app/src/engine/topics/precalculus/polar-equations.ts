/** Converting equations between polar and rectangular form. */
import { Frac } from '../../fraction';
import { defineTopic, distinctDistractors, strOpt } from '../../generator';
import type { Rng } from '../../rng';
import { m, scaled, sum, term } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';

interface Pair {
  polar: string;
  rect: string;
  wrongPolar: string[];
  wrongRect: string[];
  /** substitution used, shown in the steps */
  hint: string;
}

type Kind = 'circle0' | 'circleY' | 'circleX' | 'hline' | 'vline' | 'line' | 'ray' | 'xy' | 'hyper' | 'parab' | 'conic' | 'circleXY';
const KINDS: Record<Difficulty, Kind[]> = {
  easy: ['circle0', 'circleY', 'circleX', 'hline', 'vline'],
  medium: ['circleY', 'circleX', 'hline', 'vline', 'line', 'ray', 'circleXY'],
  hard: ['line', 'xy', 'hyper', 'parab', 'conic', 'circleXY'],
};

const T = '\\theta';
const sinT = `\\sin${T}`;
const cosT = `\\cos${T}`;

function build(rng: Rng, kind: Kind): Pair {
  const k = rng.signedInt(1, 9, true);
  const c = rng.signedInt(1, 9, true);
  switch (kind) {
    case 'circle0': {
      const a = rng.int(2, 9);
      return {
        polar: `r = ${a}`,
        rect: `x^{2} + y^{2} = ${a * a}`,
        wrongPolar: [`r = ${a * a}`, `r = ${a}${sinT}`, `${T} = ${a}`],
        wrongRect: [`x^{2} + y^{2} = ${a}`, `x + y = ${a}`, `x^{2} - y^{2} = ${a * a}`],
        hint: `r^{2} = x^{2} + y^{2}`,
      };
    }
    case 'circleY':
    case 'circleX': {
      const [fn, other, v, w] = kind === 'circleY' ? [sinT, cosT, 'y', 'x'] : [cosT, sinT, 'x', 'y'];
      return {
        polar: `r = ${term(k, fn)}`,
        rect: `x^{2} + y^{2} = ${term(k, v)}`,
        wrongPolar: [`r = ${term(k, other)}`, `r = ${term(-k, fn)}`, `r^{2} = ${term(k, fn)}`],
        wrongRect: [`x^{2} + y^{2} = ${term(k, w)}`, `x^{2} + y^{2} = ${term(-k, v)}`, `x^{2} + y^{2} = ${k * k}`],
        hint: `r^{2} = x^{2} + y^{2},\\ ${v} = r${fn}`,
      };
    }
    case 'hline':
    case 'vline': {
      const [fn, other, v, w] = kind === 'hline' ? ['\\csc', '\\sec', 'y', 'x'] : ['\\sec', '\\csc', 'x', 'y'];
      return {
        polar: `r = ${term(c, `${fn}${T}`)}`,
        rect: `${v} = ${c}`,
        wrongPolar: [`r = ${term(c, `${other}${T}`)}`, `r = ${term(c, kind === 'hline' ? sinT : cosT)}`, `r = ${term(-c, `${fn}${T}`)}`],
        wrongRect: [`${w} = ${c}`, `${v} = ${-c}`, `x^{2} + y^{2} = ${c * c}`],
        hint: kind === 'hline' ? `y = r${sinT}` : `x = r${cosT}`,
      };
    }
    case 'line': {
      const a = rng.signedInt(1, 5, true);
      const b = rng.signedInt(1, 5, true);
      const cc = rng.int(1, 12);
      const den = sum([{ coef: a, sym: cosT }, { coef: b, sym: sinT }]);
      const denSwap = sum([{ coef: a, sym: sinT }, { coef: b, sym: cosT }]);
      return {
        polar: `r = \\frac{${cc}}{${den}}`,
        rect: `${sum([{ coef: a, sym: 'x' }, { coef: b, sym: 'y' }])} = ${cc}`,
        wrongPolar: [`r = \\frac{${cc}}{${denSwap}}`, `r = ${scaled(cc, den)}`, `r = \\frac{${den}}{${cc}}`],
        wrongRect: [`${sum([{ coef: b, sym: 'x' }, { coef: a, sym: 'y' }])} = ${cc}`, `${sum([{ coef: a, sym: 'x' }, { coef: b, sym: 'y' }])} = ${-cc}`, `${sum([{ coef: a, sym: 'x' }, { coef: -b, sym: 'y' }])} = ${cc}`],
        hint: `x = r${cosT},\\ y = r${sinT}`,
      };
    }
    case 'ray': {
      const opts: Array<[string, string, string[]]> = [
        ['y = x', '\\frac{\\pi}{4}', ['\\frac{3\\pi}{4}', '\\frac{\\pi}{3}', '\\frac{\\pi}{6}']],
        ['y = -x', '\\frac{3\\pi}{4}', ['\\frac{\\pi}{4}', '\\frac{2\\pi}{3}', '\\frac{5\\pi}{6}']],
        ['y = \\sqrt{3}x', '\\frac{\\pi}{3}', ['\\frac{\\pi}{6}', '\\frac{2\\pi}{3}', '\\frac{\\pi}{4}']],
        ['y = -\\sqrt{3}x', '\\frac{2\\pi}{3}', ['\\frac{\\pi}{3}', '\\frac{5\\pi}{6}', '\\frac{3\\pi}{4}']],
        ['y = \\frac{\\sqrt{3}}{3}x', '\\frac{\\pi}{6}', ['\\frac{\\pi}{3}', '\\frac{5\\pi}{6}', '\\frac{\\pi}{4}']],
        ['y = -\\frac{\\sqrt{3}}{3}x', '\\frac{5\\pi}{6}', ['\\frac{\\pi}{6}', '\\frac{2\\pi}{3}', '\\frac{3\\pi}{4}']],
      ];
      const [rect, ang, wrong] = rng.pick(opts);
      return {
        polar: `${T} = ${ang}`,
        rect,
        wrongPolar: wrong.map((w) => `${T} = ${w}`),
        wrongRect: opts.filter((o) => o[0] !== rect).slice(0, 3).map((o) => o[0]),
        hint: `\\tan${T} = \\frac{y}{x}`,
      };
    }
    case 'xy': {
      return {
        polar: `r^{2} = ${term(2 * c, `\\csc 2${T}`)}`,
        rect: `xy = ${c}`,
        wrongPolar: [`r^{2} = ${term(c, `\\csc 2${T}`)}`, `r^{2} = ${term(2 * c, `\\sec 2${T}`)}`, `r = ${term(2 * c, `\\csc 2${T}`)}`],
        wrongRect: [`xy = ${2 * c}`, `x^{2} - y^{2} = ${c}`, `xy = ${-c}`],
        hint: `xy = r^{2}${cosT}${sinT} = \\frac{r^{2}}{2}\\sin 2${T}`,
      };
    }
    case 'hyper': {
      return {
        polar: `r^{2} = ${term(c, `\\sec 2${T}`)}`,
        rect: `x^{2} - y^{2} = ${c}`,
        wrongPolar: [`r^{2} = ${term(c, `\\csc 2${T}`)}`, `r^{2} = ${term(c, `\\cos 2${T}`)}`, `r = ${term(c, `\\sec 2${T}`)}`],
        wrongRect: [`x^{2} + y^{2} = ${c}`, `y^{2} - x^{2} = ${c}`, `xy = ${c}`],
        hint: `x^{2} - y^{2} = r^{2}(\\cos^{2}${T} - \\sin^{2}${T}) = r^{2}\\cos 2${T}`,
      };
    }
    case 'parab': {
      const a = rng.signedInt(1, 4, true);
      const ts = `\\tan${T}\\sec${T}`;
      return {
        polar: `r = ${term(new Frac(1, a), ts)}`,
        rect: `y = ${term(a, 'x^{2}')}`,
        wrongPolar: [`r = ${term(a, ts)}`, `r = ${term(new Frac(1, a), `\\cot${T}\\csc${T}`)}`, `r = ${term(new Frac(1, a), `\\sin${T}\\cos${T}`)}`],
        wrongRect: [`x = ${term(a, 'y^{2}')}`, `y = ${term(-a, 'x^{2}')}`, `y = ${term(a, 'x')}`],
        hint: `r${sinT} = ${term(a, `r^{2}\\cos^{2}${T}`)}`,
      };
    }
    case 'conic': {
      const p = rng.int(1, 6);
      const sgn = rng.pick([1, -1]);
      // r = p/(1 − sgn·cosθ) ⇒ r = p + sgn·x ⇒ y² = 2p·sgn·x + p²
      return {
        polar: `r = \\frac{${p}}{1 ${sgn > 0 ? '-' : '+'} ${cosT}}`,
        rect: `y^{2} = ${sum([{ coef: 2 * p * sgn, sym: 'x' }, { coef: p * p }])}`,
        wrongPolar: [`r = \\frac{${p}}{1 ${sgn > 0 ? '+' : '-'} ${cosT}}`, `r = \\frac{${p}}{1 ${sgn > 0 ? '-' : '+'} ${sinT}}`, `r = \\frac{${2 * p}}{1 ${sgn > 0 ? '-' : '+'} ${cosT}}`],
        wrongRect: [`y^{2} = ${sum([{ coef: -2 * p * sgn, sym: 'x' }, { coef: p * p }])}`, `x^{2} = ${sum([{ coef: 2 * p * sgn, sym: 'y' }, { coef: p * p }])}`, `y^{2} = ${sum([{ coef: p * sgn, sym: 'x' }, { coef: p }])}`],
        hint: `r = ${p} ${sgn > 0 ? '+' : '-'} r${cosT} = ${p} ${sgn > 0 ? '+' : '-'} x`,
      };
    }
    case 'circleXY':
    default: {
      const a = rng.signedInt(1, 5, true) * 2;
      const b = rng.signedInt(1, 5, true) * 2;
      return {
        polar: `r = ${sum([{ coef: a, sym: cosT }, { coef: b, sym: sinT }])}`,
        rect: `x^{2} + y^{2} = ${sum([{ coef: a, sym: 'x' }, { coef: b, sym: 'y' }])}`,
        wrongPolar: [`r = ${sum([{ coef: b, sym: cosT }, { coef: a, sym: sinT }])}`, `r = ${sum([{ coef: -a, sym: cosT }, { coef: -b, sym: sinT }])}`, `r^{2} = ${sum([{ coef: a, sym: cosT }, { coef: b, sym: sinT }])}`],
        wrongRect: [`x^{2} + y^{2} = ${sum([{ coef: b, sym: 'x' }, { coef: a, sym: 'y' }])}`, `x^{2} + y^{2} = ${sum([{ coef: -a, sym: 'x' }, { coef: -b, sym: 'y' }])}`, `x + y = ${sum([{ coef: a, sym: 'x' }, { coef: b, sym: 'y' }])}`],
        hint: `r^{2} = x^{2} + y^{2},\\ x = r${cosT},\\ y = r${sinT}`,
      };
    }
  }
}

export const polarEquations = defineTopic({
  id: 'precalc.polar.equations',
  subject: 'precalculus',
  category: 'Polar Coordinates and Complex Numbers',
  title: 'Converting Polar and Rectangular Equations',
  description: 'Rewrite rectangular equations in polar form and polar equations in rectangular form.',
  instruction: 'Convert each equation as indicated.',
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'direction',
      label: 'Direction',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'Both directions' },
        { value: 'toPolar', label: 'Rectangular to polar' },
        { value: 'toRect', label: 'Polar to rectangular' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const kind = rng.pick(KINDS[difficulty]);
    const pair = build(rng, kind);
    const dOpt = strOpt(ctx, 'direction');
    const dir = dOpt === 'mixed' ? rng.pick(['toPolar', 'toRect']) : dOpt;
    const toPolar = dir === 'toPolar';
    const [from, to, wrong] = toPolar ? [pair.rect, pair.polar, pair.wrongPolar] : [pair.polar, pair.rect, pair.wrongRect];
    const question = `Convert ${m(from)} to ${toPolar ? 'polar' : 'rectangular'} form.`;
    const answer = m(to);
    const steps = [`Use ${m(pair.hint)}.`, answer];
    const distractors = distinctDistractors(answer, wrong.map(m), (j) => m(`${to} + ${j}`));
    return { question, answer, steps, distractors, check: { kind: 'precalculus.polarEq' } };
  },
});
