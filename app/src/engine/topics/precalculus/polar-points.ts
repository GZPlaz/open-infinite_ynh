/** Converting points between polar and rectangular coordinates. */
import { Frac } from '../../fraction';
import { attempt, defineTopic, distinctDistractors, strOpt } from '../../generator';
import { simplifySqrt } from '../../radical';
import type { Rng } from '../../rng';
import { decimal, m, tuple } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { Surd, angleTex, reduceTurn, trigExact } from './common';

/** Special angles as fractions of π in [0, 2). */
const SPECIAL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((k) => new Frac(k, 6)).concat([1, 3, 5, 7].map((k) => new Frac(k, 4)));

const pt = (a: string, b: string) => m(tuple([a, b]));

/** Polar coordinates (r, θ) with r ≥ 0, 0 ≤ θ < 2π giving integer-friendly rectangular points. */
export function nicePolar(rng: Rng, d: Difficulty): { r: Surd; t: Frac } {
  const t = rng.pick(SPECIAL);
  const k = rng.int(1, d === 'easy' ? 4 : 6);
  const quarter = t.d === 4;
  const axis = t.d === 1 || (t.d === 2 && t.n % 2 === 1);
  const r = quarter ? Surd.of(k, 2) : axis ? Surd.of(k) : Surd.of(2 * k);
  return { r, t };
}

export const polarPoints = defineTopic({
  id: 'precalc.polar.points',
  subject: 'precalculus',
  category: 'Polar Coordinates and Complex Numbers',
  title: 'Converting Polar and Rectangular Coordinates',
  description: 'Convert points between polar (r, θ) and rectangular (x, y) coordinates.',
  instruction: (o) =>
    `Convert each point as indicated. Use ${o.angles === 'degrees' ? 'degrees' : 'radians'} with $r \\ge 0$ and ${o.angles === 'degrees' ? '$0^\\circ \\le \\theta < 360^\\circ$' : '$0 \\le \\theta < 2\\pi$'}; round non-special angles to the nearest hundredth (tenth of a degree).`,
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
        { value: 'toRect', label: 'Polar to rectangular' },
        { value: 'toPolar', label: 'Rectangular to polar' },
      ],
    },
    {
      type: 'select',
      id: 'angles',
      label: 'Angles',
      default: 'radians',
      choices: [
        { value: 'radians', label: 'Radians' },
        { value: 'degrees', label: 'Degrees' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const deg = strOpt(ctx, 'angles') === 'degrees';
    const dOpt = strOpt(ctx, 'direction');
    const dir = dOpt === 'mixed' ? rng.pick(['toRect', 'toPolar']) : dOpt;
    const A = (t: Frac) => angleTex(t, deg);
    const steps: string[] = [];
    let question: string;
    let answer: string;
    let wrongs: string[];
    let check: Record<string, unknown>;

    if (dir === 'toRect') {
      let { r, t } = nicePolar(rng, difficulty);
      let shownT = t;
      if (difficulty === 'hard') {
        if (rng.bool(0.4)) r = r.neg();
        if (rng.bool(0.5)) shownT = t.sub(2);
      }
      const { cos, sin } = trigExact(t);
      const x = r.mul(cos);
      const y = r.mul(sin);
      question = `Convert ${pt(r.toTex(), A(shownT))} to rectangular coordinates.`;
      steps.push(m(`x = r\\cos\\theta = ${r.sign < 0 ? `(${r.toTex()})` : r.toTex()}\\left(${cos.toTex()}\\right) = ${x.toTex()}`));
      steps.push(m(`y = r\\sin\\theta = ${r.sign < 0 ? `(${r.toTex()})` : r.toTex()}\\left(${sin.toTex()}\\right) = ${y.toTex()}`));
      answer = pt(x.toTex(), y.toTex());
      wrongs = [pt(y.toTex(), x.toTex()), pt(x.neg().toTex(), y.toTex()), pt(x.toTex(), y.neg().toTex()), pt(x.neg().toTex(), y.neg().toTex())];
      check = { kind: 'precalculus.polarPoint', dir };
    } else if (difficulty === 'hard' && rng.bool(0.5)) {
      // a non-special angle: integer point, rounded angle
      const { x, y } = attempt('polar-round', () => {
        const x = rng.signedInt(1, 9, true);
        const y = rng.signedInt(1, 9, true);
        return Math.abs(x) === Math.abs(y) ? null : { x, y };
      });
      const n2 = x * x + y * y;
      const { out, inside } = simplifySqrt(n2);
      const rTex = Surd.of(out, inside).toTex();
      let th = Math.atan2(y, x);
      if (th < 0) th += 2 * Math.PI;
      const show = (a: number) => (deg ? `${decimal((a * 180) / Math.PI, 1)}^\\circ` : decimal(a, 2));
      question = `Convert ${pt(String(x), String(y))} to polar coordinates.`;
      steps.push(m(`r = \\sqrt{${x * x} + ${y * y}} = ${rTex}`));
      steps.push(`${m(`\\tan\\theta = \\frac{${y}}{${x}}`)}; the point is in quadrant ${['I', 'II', 'III', 'IV'][Math.floor(th / (Math.PI / 2))]}, so ${m(`\\theta \\approx ${show(th)}`)}.`);
      answer = pt(rTex, show(th));
      const ref = Math.atan(y / x);
      const wrap = (a: number) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      wrongs = [pt(rTex, show(wrap(ref))), pt(rTex, show(wrap(th + Math.PI))), pt(String(n2), show(th)), pt(rTex, show(wrap(Math.PI / 2 - th)))];
      check = { kind: 'precalculus.polarPoint', dir, tol: 0.06 };
    } else {
      const { r, t } = nicePolar(rng, difficulty);
      const { cos, sin } = trigExact(t);
      const x = r.mul(cos);
      const y = r.mul(sin);
      question = `Convert ${pt(x.toTex(), y.toTex())} to polar coordinates.`;
      steps.push(m(`r = \\sqrt{x^{2} + y^{2}} = ${r.toTex()}`));
      if (!x.isZero()) steps.push(`${m(`\\tan\\theta = \\frac{y}{x} = ${y.mul(Surd.of(1)).isZero() ? '0' : (y.value / x.value === 1 ? '1' : y.value / x.value === -1 ? '-1' : `${y.value / x.value > 0 ? '' : '-'}${Math.abs(y.value / x.value) > 1 ? '\\sqrt{3}' : '\\frac{\\sqrt{3}}{3}'}`)}`)}, with ${m('\\theta')} in the quadrant of the point.`);
      steps.push(m(`\\theta = ${A(t)}`));
      answer = pt(r.toTex(), A(t));
      const alt = [reduceTurn(t.add(1)), reduceTurn(new Frac(1).sub(t)), reduceTurn(t.neg())];
      wrongs = [...alt.map((a) => pt(r.toTex(), A(a))), pt(r.mul(r).toTex(), A(t)), pt(r.toTex(), A(reduceTurn(new Frac(1, 2).sub(t))))];
      check = { kind: 'precalculus.polarPoint', dir };
    }
    const distractors = distinctDistractors(answer, wrongs, (k) => pt(String(k + 1), A(new Frac(k, 6))));
    return { question, answer, steps, distractors, check };
  },
});
