/** Trigonometric functions of any angle: special-angle exact values and values from a point on the terminal side. */
import { attempt, defineTopic, distinctDistractors, strOpt } from '../../generator';
import { gcd } from '../../fraction';
import type { Rng } from '../../rng';
import { m, tuple } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { pickUnit, unitsOpt } from './angles';
import { angleTex, COFUNCTION, Exact, fnAt, mod360, QUADRANTS, RECIPROCAL, referenceAngle, SIX, trigExact, type TrigFn } from './exact';
import { standardPosition } from './figures';

const POOL = ['0', '1', '-1', '\\frac{1}{2}', '-\\frac{1}{2}', '\\frac{\\sqrt{2}}{2}', '-\\frac{\\sqrt{2}}{2}', '\\frac{\\sqrt{3}}{2}', '-\\frac{\\sqrt{3}}{2}', '\\sqrt{3}', '-\\sqrt{3}', '\\frac{\\sqrt{3}}{3}', '2', '-2'];

const exTex = (e: Exact | null): string => (e ? m(e.toTex()) : 'Undefined');

function pickSpecialAngle(rng: Rng, d: Difficulty, rad: boolean): number {
  return attempt('special angle', () => {
    const lim = { easy: [0, 360], medium: [-360, 720], hard: [-1080, 1080] }[d] as [number, number];
    const step = rng.pick(rad ? [30, 45, 60, 90] : [30, 45]);
    const deg = rng.int(Math.ceil(lim[0] / step), Math.floor(lim[1] / step)) * step;
    if (deg % 90 === 0 && rng.bool(0.7)) return null;
    if (d === 'easy' && deg >= 360) return null;
    return deg;
  });
}

const pointGroups: Record<Difficulty, Array<[number, number]>> = {
  easy: [
    [3, 4],
    [6, 8],
    [5, 12],
    [8, 15],
  ],
  medium: [
    [3, 4],
    [5, 12],
    [8, 15],
    [7, 24],
    [1, 2],
    [2, 3],
    [1, 3],
    [2, 5],
  ],
  hard: [
    [7, 24],
    [20, 21],
    [9, 40],
    [2, 7],
    [3, 5],
    [4, 7],
    [5, 6],
    [3, 8],
  ],
};

export const trigFunctionsAnyAngle = defineTopic({
  id: 'trig.functions.any-angle',
  subject: 'trigonometry',
  title: 'Trig Functions of Any Angle',
  description: 'Exact values of all six trig functions using reference angles, and from a point on the terminal side.',
  category: 'Trigonometric Functions',
  instruction: (o) =>
    o.task === 'exact'
      ? 'Find the exact value of each trigonometric function.'
      : o.task === 'point'
        ? 'Find the exact value of the indicated trigonometric function of θ.'
        : o.task === 'six'
          ? 'Find the exact values of the six trigonometric functions of θ.'
          : 'Find the exact value of each trigonometric function.',
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Given',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'exact', label: 'A special angle' },
        { value: 'point', label: 'A point on the terminal side (one function)' },
        { value: 'six', label: 'A point on the terminal side (all six functions)' },
      ],
    },
    unitsOpt('mixed'),
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const t = strOpt(ctx, 'task');
    const task = t === 'exact' || t === 'point' || t === 'six' ? t : rng.pick(['exact', 'exact', 'point'] as const);

    if (task === 'exact') {
      const unit = pickUnit(ctx);
      const deg = pickSpecialAngle(rng, difficulty, unit === 'rad');
      const fn = rng.pick<TrigFn>(difficulty === 'easy' ? ['sin', 'cos', 'tan'] : SIX);
      const v = trigExact(fn, deg);
      const answer = exTex(v);
      const a = mod360(deg);
      const steps: string[] = [];
      if (a !== deg) steps.push(`Coterminal angle: ${m(angleTex(a, unit))}.`);
      if (a % 90 !== 0) {
        const q = Math.floor(a / 90);
        const ref = referenceAngle(a);
        const base = trigExact(fn, ref)!;
        steps.push(`Quadrant ${QUADRANTS[q]}, reference angle ${m(angleTex(ref, unit))}; ${m(`${fnAt(fn, angleTex(ref, unit))} = ${base.toTex()}`)}.`);
        steps.push(`${m(`\\${fn}`)} is ${v!.value > 0 ? 'positive' : 'negative'} in Quadrant ${QUADRANTS[q]}, so ${m(`${fnAt(fn, angleTex(deg, unit))} = ${v!.toTex()}`)}.`);
      } else {
        const x = Math.round(Math.cos((a * Math.PI) / 180));
        const y = Math.round(Math.sin((a * Math.PI) / 180));
        steps.push(`The terminal side passes through ${m(tuple([x, y]))} on the unit circle.`);
        steps.push(v ? m(`${fnAt(fn, angleTex(deg, unit))} = ${v.toTex()}`) : `${m(`\\${fn}`)} divides by ${m('0')} here, so it has no value (Undefined).`);
      }
      const ref = referenceAngle(a);
      const swapRef = a % 90 === 0 ? a + 90 : a % 180 < 90 ? a - ref + (90 - ref) : a + ref - (90 - ref);
      const cands = [
        v ? m(v.neg().toTex()) : null,
        exTex(trigExact(COFUNCTION[fn], deg)),
        exTex(trigExact(RECIPROCAL[fn], deg)),
        exTex(trigExact(fn, ref)),
        exTex(trigExact(fn, swapRef)),
      ];
      return {
        question: m(fnAt(fn, angleTex(deg, unit))),
        answer,
        steps,
        distractors: distinctDistractors(answer, cands, (k) => (k <= POOL.length ? m(POOL[k - 1]!) : null)),
        check: { kind: 'trigonometry.exact' },
      };
    }

    // point on the terminal side
    const [p, q] = attempt('point', () => {
      const [u, v] = rng.pick(pointGroups[difficulty]);
      const k = difficulty === 'easy' ? 1 : rng.pick([1, 1, 2]);
      if (gcd(u, v) !== 1 && k > 1) return null;
      return rng.bool() ? [u * k, v * k] : [v * k, u * k];
    });
    const x = p * rng.sign();
    const y = q * rng.sign();
    const r2 = x * x + y * y;
    const R = Exact.of(1, r2);
    const values: Record<TrigFn, Exact> = {
      sin: Exact.of(y).div(R),
      cos: Exact.of(x).div(R),
      tan: Exact.of(y).div(Exact.of(x)),
      csc: R.div(Exact.of(y)),
      sec: R.div(Exact.of(x)),
      cot: Exact.of(x).div(Exact.of(y)),
    };
    const rTex = R.toTex();
    const quadrant = QUADRANTS[x > 0 ? (y > 0 ? 0 : 3) : y > 0 ? 1 : 2];
    const pt = m(tuple([x, y]));
    const dirDeg = (Math.atan2(y, x) * 180) / Math.PI;
    const fig = standardPosition({ deg: dirDeg < 0 ? dirDeg + 360 : dirDeg, thetaLabel: '\\theta' }, `Angle theta whose terminal side passes through (${x}, ${y})`);
    const rStep = m(`r = \\sqrt{(${x})^{2} + (${y})^{2}} = ${rTex}`);
    const def: Record<TrigFn, string> = { sin: '\\frac{y}{r}', cos: '\\frac{x}{r}', tan: '\\frac{y}{x}', csc: '\\frac{r}{y}', sec: '\\frac{r}{x}', cot: '\\frac{x}{y}' };
    const raw: Record<TrigFn, [string, string]> = { sin: [`${y}`, rTex], cos: [`${x}`, rTex], tan: [`${y}`, `${x}`], csc: [rTex, `${y}`], sec: [rTex, `${x}`], cot: [`${x}`, `${y}`] };
    const rawTex = (f: TrigFn) => {
      const [n, d] = raw[f];
      return `\\frac{${n}}{${d}}`;
    };

    if (task === 'six') {
      const fmt = (vals: Record<TrigFn, Exact>) => SIX.map((f) => m(`\\${f} \\theta = ${vals[f].toTex()}`)).join(', ');
      const answer = fmt(values);
      const swapped: Record<TrigFn, Exact> = { sin: values.cos, cos: values.sin, tan: values.cot, cot: values.tan, csc: values.sec, sec: values.csc };
      const abs = Object.fromEntries(SIX.map((f) => [f, values[f].value < 0 ? values[f].neg() : values[f]])) as Record<TrigFn, Exact>;
      const recip: Record<TrigFn, Exact> = { sin: values.csc, csc: values.sin, cos: values.sec, sec: values.cos, tan: values.cot, cot: values.tan };
      const negAll = Object.fromEntries(SIX.map((f) => [f, values[f].neg()])) as Record<TrigFn, Exact>;
      const flipX = { ...values, cos: values.cos.neg(), sec: values.sec.neg(), tan: values.tan.neg(), cot: values.cot.neg() };
      return {
        question: `The point ${pt} is on the terminal side of ${m('\\theta')}.`,
        answer,
        steps: [rStep, ...SIX.map((f) => m(`\\${f} \\theta = ${def[f]} = ${rawTex(f)}${rawTex(f) === values[f].toTex() ? '' : ` = ${values[f].toTex()}`}`))],
        distractors: distinctDistractors(answer, [fmt(swapped), fmt(recip), fmt(abs), fmt(flipX), fmt(negAll)], (k) => fmt({ ...values, sin: values.sin.add(Exact.of(k)) })),
        diagram: fig,
        check: { kind: 'trigonometry.point' },
      };
    }

    const fn = rng.pick<TrigFn>(difficulty === 'easy' ? ['sin', 'cos', 'tan'] : SIX);
    const v = values[fn];
    const answer = m(`\\${fn} \\theta = ${v.toTex()}`);
    const alt = (e: Exact) => m(`\\${fn} \\theta = ${e.toTex()}`);
    return {
      question: `The point ${pt} is on the terminal side of ${m('\\theta')}. Find ${m(`\\${fn} \\theta`)}.`,
      answer,
      steps: [rStep, `${m('\\theta')} is in Quadrant ${quadrant}.`, m(`\\${fn} \\theta = ${def[fn]} = ${rawTex(fn)}${rawTex(fn) === v.toTex() ? '' : ` = ${v.toTex()}`}`)],
      distractors: distinctDistractors(answer, [alt(v.neg()), alt(values[COFUNCTION[fn]]), alt(values[RECIPROCAL[fn]]), alt(values[COFUNCTION[fn]].neg())], (k) => alt(v.add(Exact.of(k)))),
      diagram: fig,
      check: { kind: 'trigonometry.point' },
    };
  },
});
