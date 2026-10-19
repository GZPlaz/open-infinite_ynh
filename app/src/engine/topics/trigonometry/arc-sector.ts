/** Arc length and sector area, with central angles in degrees or radians. */
import { Frac } from '../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, offset, opt, strOpt, UNITS } from '../../generator';
import { decimal, m, roundTo, withUnit } from '../../tex';
import type { ProblemContent } from '../../types';
import { unitsOpt, pickUnit } from './angles';
import { angleTex, piLabel, piTex, radFrac } from './exact';
import { sectorFigure } from './figures';

type Find = 'arc' | 'area' | 'radius' | 'angle';

export const arcSector = defineTopic({
  id: 'trig.angles.arc-sector',
  subject: 'trigonometry',
  title: 'Arc Length and Sector Area',
  description: 'Use s = rθ and A = ½r²θ to find arc lengths, sector areas, radii and central angles.',
  category: 'Angles and Angle Measure',
  instruction: (o) => {
    const round = o.answerForm === 'round' ? ' Round to the nearest tenth.' : ' Leave answers in terms of π.';
    return o.find === 'arc' ? `Find the length of each arc.${round}` : o.find === 'area' ? `Find the area of each sector.${round}` : `Find each indicated measure.${round}`;
  },
  multipleChoice: true,
  defaultCount: 8,
  options: [
    {
      type: 'select',
      id: 'find',
      label: 'Find',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'arc', label: 'Arc length' },
        { value: 'area', label: 'Sector area' },
      ],
    },
    unitsOpt('mixed', 'angleUnits'),
    opt.rounding('exact'),
    opt.units(true),
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const aUnit = pickUnit(ctx, 'angleUnits');
    const exact = strOpt(ctx, 'answerForm') === 'exact';
    const unit = boolOpt(ctx, 'units') ? rng.pick(UNITS) : undefined;
    const f = strOpt(ctx, 'find');
    const base: 'arc' | 'area' = f === 'arc' || f === 'area' ? f : rng.bool() ? 'arc' : 'area';
    const inverse = difficulty === 'hard' && rng.bool(0.5);
    const find: Find = !inverse ? base : base === 'arc' ? rng.pick(['radius', 'angle'] as const) : 'radius';

    const rMax = { easy: 12, medium: 20, hard: 30 }[difficulty];
    const steps = { easy: [30, 45, 60, 90], medium: [15, 20, 30, 36, 45], hard: [10, 15, 18, 20, 24, 30, 40, 45] }[difficulty];
    const { r, deg } = attempt('sector', () => {
      const s = rng.pick(steps);
      const d = rng.int(1, Math.floor(350 / s)) * s;
      if (d === 180 && difficulty !== 'easy') return null;
      return { r: rng.int(2, rMax), deg: d };
    });
    const th = radFrac(deg); // θ = th·π
    const arcF = th.mul(r); // s = arcF·π
    const areaF = th.mul(r * r).div(2); // A = areaF·π
    const len = (k: Frac, power = 1): { tex: string; approx: boolean } => {
      if (exact) return { tex: withUnit(piTex(k), unit, power), approx: false };
      const v = k.value * Math.PI;
      return { tex: withUnit(decimal(v), unit, power), approx: Math.abs(roundTo(v, 1) - v) > 1e-9 };
    };
    const plain = (v: number, power = 1) => withUnit(decimal(v), unit, power);
    const eqTex = (lhs: string, x: { tex: string; approx: boolean }) => `${lhs} ${x.approx ? '\\approx' : '='} ${x.tex}`;
    const thetaTex = angleTex(deg, aUnit);
    const thetaRad = piTex(th);
    const angleLabel = aUnit === 'deg' ? thetaTex : piLabel(th);
    const fig = (rLabel: string) => sectorFigure(rng, deg, rLabel, angleLabel, `Sector with central angle ${deg} degrees`);
    const conv = aUnit === 'deg' ? m(`\\theta = ${thetaTex} = ${thetaRad}`) + ' radians.' : null;

    if (find === 'arc' || find === 'area') {
      const isArc = find === 'arc';
      const k = isArc ? arcF : areaF;
      const power = isArc ? 1 : 2;
      const ans = len(k, power);
      const lhs = isArc ? 's' : 'A';
      const answer = m(eqTex(lhs, ans));
      const alt = (x: Frac | number, pw = power) => m(typeof x === 'number' ? `${lhs} ${exact && Number.isInteger(x) ? '=' : '\\approx'} ${plain(x, pw)}` : eqTex(lhs, len(x, pw)));
      const cands = isArc
        ? [alt(r * deg), alt(arcF.mul(2)), alt(arcF.div(2)), alt(areaF)]
        : [alt((r * r * deg) / 2), alt(areaF.mul(2)), alt(arcF), alt(areaF.mul(4))];
      return {
        question: `Find the ${isArc ? 'arc length' : 'area of the sector'}: ${m(`r = ${withUnit(String(r), unit)}`)}, ${m(`\\theta = ${thetaTex}`)}`,
        answer,
        steps: [
          ...(conv ? [conv] : []),
          isArc ? m(`s = r\\theta = ${r}\\left(${thetaRad}\\right) = ${piTex(arcF)}${exact ? '' : ` \\approx ${decimal(arcF.value * Math.PI)}`}`) : m(`A = \\frac{1}{2}r^{2}\\theta = \\frac{1}{2}(${r})^{2}\\left(${thetaRad}\\right) = ${piTex(areaF)}${exact ? '' : ` \\approx ${decimal(areaF.value * Math.PI)}`}`),
        ],
        distractors: distinctDistractors(answer, cands, (n) => alt(k.add(new Frac(offset(n), k.d)))),
        diagram: fig(withUnit(String(r), unit)),
        check: { kind: 'trigonometry.sector' },
      };
    }

    if (find === 'radius') {
      const fromArc = base === 'arc';
      const given = fromArc ? `s = ${withUnit(piTex(arcF), unit)}` : `A = ${withUnit(piTex(areaF), unit, 2)}`;
      const answer = m(`r = ${withUnit(String(r), unit)}`);
      const alt = (x: number) => m(`r ${Number.isInteger(x) ? '=' : '\\approx'} ${plain(x)}`);
      return {
        question: `Find the radius: ${m(given)}, ${m(`\\theta = ${thetaTex}`)}`,
        answer,
        steps: [
          ...(conv ? [conv] : []),
          fromArc ? m(`r = \\frac{s}{\\theta} = \\frac{${piTex(arcF)}}{${thetaRad}} = ${r}`) : m(`r^{2} = \\frac{2A}{\\theta} = \\frac{2\\left(${piTex(areaF)}\\right)}{${thetaRad}} = ${r * r}`),
          ...(fromArc ? [] : [m(`r = \\sqrt{${r * r}} = ${r}`)]),
        ],
        distractors: distinctDistractors(answer, fromArc ? [alt(r * 2), alt(roundTo(r / 2, 1)), alt(roundTo(arcF.value, 1))] : [alt(r * r), alt(r * 2), alt(roundTo(Math.sqrt(areaF.mul(2).div(th).value / 2), 1))], (n) => alt(r + offset(n))),
        diagram: fig('r'),
        check: { kind: 'trigonometry.sector' },
      };
    }

    // central angle (radians) from s and r
    const answer = m(`\\theta = ${thetaRad}`);
    const alt = (x: Frac) => m(`\\theta = ${piTex(x)}`);
    return {
      question: `Find the central angle in radians: ${m(`s = ${withUnit(piTex(arcF), unit)}`)}, ${m(`r = ${withUnit(String(r), unit)}`)}`,
      answer,
      steps: [m(`\\theta = \\frac{s}{r} = \\frac{${piTex(arcF)}}{${r}} = ${thetaRad}`)],
      distractors: distinctDistractors(answer, [alt(th.mul(2)), alt(th.div(2)), alt(arcF.mul(r)), alt(th.mul(r).inv())], (n) => alt(th.add(new Frac(offset(n), th.d * 2)))),
      diagram: sectorFigure(rng, deg, withUnit(String(r), unit), '\\theta', 'Sector with unknown central angle'),
      check: { kind: 'trigonometry.sector' },
    };
  },
});
