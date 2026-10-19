/** Angles and angle measure: standard position, radians ↔ degrees, DMS, coterminal angles. */
import { Frac } from '../../fraction';
import { attempt, defineTopic, distinctDistractors, offset, strOpt } from '../../generator';
import type { Rng } from '../../rng';
import { decimal, m } from '../../tex';
import type { Difficulty, GeneratorContext, ProblemContent, SelectOptionDef } from '../../types';
import { angleTex, degTex, mod360, piTex, QUADRANTS, quadrantOf, radFrac, referenceAngle, type AngleUnit } from './exact';
import { standardPosition } from './figures';

export const unitsOpt = (def: 'deg' | 'rad' | 'mixed' = 'mixed', id = 'units'): SelectOptionDef => ({
  type: 'select',
  id,
  label: 'Angle units',
  default: def,
  choices: [
    { value: 'mixed', label: 'Degrees and radians' },
    { value: 'deg', label: 'Degrees only' },
    { value: 'rad', label: 'Radians only' },
  ],
});

export function pickUnit(ctx: GeneratorContext, id = 'units'): AngleUnit {
  const u = strOpt(ctx, id);
  return u === 'deg' || u === 'rad' ? u : ctx.rng.bool() ? 'deg' : 'rad';
}

/** Radian denominators used for angles in terms of π, by difficulty. */
const RAD_DENOMS: Record<Difficulty, number[]> = { easy: [6, 4, 3, 2], medium: [6, 4, 3], hard: [6, 4, 3, 12] };

/**
 * A random angle (in degrees) that is a "nice" radian measure when the unit is
 * radians, within [lo, hi] degrees; never quadrantal unless allowed.
 */
function randomAngle(rng: Rng, d: Difficulty, unit: AngleUnit, lo: number, hi: number, allowQuadrantal = false): number {
  return attempt('angle', () => {
    let deg: number;
    if (unit === 'deg') deg = rng.int(Math.ceil(lo / 5), Math.floor(hi / 5)) * 5;
    else {
      const n = rng.pick(RAD_DENOMS[d]);
      const step = 180 / n;
      deg = rng.int(Math.ceil(lo / step), Math.floor(hi / step)) * step;
    }
    if (deg === 0) return null;
    if (!allowQuadrantal && deg % 90 === 0) return null;
    return deg;
  });
}

// ---------------------------------------------------------------- standard position

function quadAnswer(q: number, ref: number, unit: AngleUnit): string {
  return `Quadrant ${QUADRANTS[((q % 4) + 4) % 4]}, reference angle ${m(angleTex(ref, unit))}`;
}

export const anglesStandardPosition = defineTopic({
  id: 'trig.angles.standard-position',
  subject: 'trigonometry',
  title: 'Angles and Angle Measure',
  description: 'Draw angles in standard position, read angles from figures, and name quadrants and reference angles.',
  category: 'Angles and Angle Measure',
  instruction: (o) =>
    o.task === 'draw'
      ? 'Draw each angle in standard position. Name the quadrant of the terminal side and the reference angle.'
      : o.task === 'identify'
        ? 'Find the measure of each angle.'
        : o.task === 'quadrant'
          ? 'State the quadrant in which the terminal side of each angle lies and find its reference angle.'
          : 'Draw, identify or classify each angle in standard position as indicated.',
  multipleChoice: true,
  defaultCount: 8,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Task',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'draw', label: 'Draw in standard position' },
        { value: 'identify', label: 'Find the angle shown' },
        { value: 'quadrant', label: 'Quadrant and reference angle' },
      ],
    },
    unitsOpt('deg'),
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const unit = pickUnit(ctx);
    const t = strOpt(ctx, 'task');
    const task = t === 'draw' || t === 'identify' || t === 'quadrant' ? t : rng.pick(['draw', 'identify', 'quadrant'] as const);
    const range = { easy: [0, 360], medium: [-360, 720], hard: [-1080, 1080] }[difficulty] as [number, number];

    if (task === 'identify') {
      // terminal side from a quadrant + a labelled reference angle; rotation count from the difficulty
      const refs = unit === 'deg' ? [15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75] : difficulty === 'hard' ? [15, 30, 45, 60, 75] : [30, 45, 60];
      const ref = rng.pick(refs);
      const q = rng.int(0, 3);
      const a = [ref, 180 - ref, 180 + ref, 360 - ref][q]!;
      const turns = difficulty === 'easy' ? [0] : difficulty === 'medium' ? [0, -1] : [-2, -1, 1];
      const k = rng.pick(turns);
      const deg = a + 360 * k;
      const answer = m(`\\theta = ${angleTex(deg, unit)}`);
      const alt = (x: number) => m(`\\theta = ${angleTex(x, unit)}`);
      const mirrors = [180 - a, 360 - a, a + 180].map((x) => mod360(x) + 360 * k);
      return {
        question: `Find the measure of ${m('\\theta')}.`,
        answer,
        steps: [
          `The terminal side is in Quadrant ${QUADRANTS[q]} with reference angle ${m(angleTex(ref, unit))}, so it points at ${m(angleTex(a, unit))}.`,
          k === 0 ? `The rotation is counterclockwise and less than one turn: ${m(`\\theta = ${angleTex(deg, unit)}`)}.` : `Add ${m(`${k}`)} full turn${Math.abs(k) > 1 ? 's' : ''}: ${m(`\\theta = ${angleTex(a, unit)} ${k < 0 ? '-' : '+'} ${Math.abs(k) === 1 ? '' : Math.abs(k)}${unit === 'deg' ? '(360^\\circ)' : '(2\\pi)'} = ${angleTex(deg, unit)}`)}.`,
        ],
        distractors: distinctDistractors(answer, [...mirrors.map(alt), alt(-deg)], (n) => alt(deg + offset(n) * (unit === 'deg' ? 10 : 15))),
        diagram: standardPosition({ deg, thetaLabel: '\\theta', refLabel: angleTex(ref, unit).replace(/\\frac\{(\d*)\\pi\}\{(\d+)\}/, '$1\\pi/$2') }, `Angle theta in standard position; reference angle ${ref} degrees`),
        check: { kind: 'trigonometry.stdpos', task },
      };
    }

    const deg = randomAngle(rng, difficulty, unit, range[0], range[1]);
    const q = quadrantOf(deg);
    const ref = referenceAngle(deg);
    const answer = quadAnswer(q, ref, unit);
    const a = mod360(deg);
    const steps = [
      deg === a
        ? `${m(angleTex(deg, unit))} is between ${m(angleTex(90 * q, unit))} and ${m(angleTex(90 * q + 90, unit))}: Quadrant ${QUADRANTS[q]}.`
        : `Coterminal angle: ${m(`${angleTex(deg, unit)} ${deg < a ? '+' : '-'} ${Math.abs(a - deg) === 360 ? '' : Math.abs(a - deg) / 360}${unit === 'deg' ? '(360^\\circ)' : '(2\\pi)'} = ${angleTex(a, unit)}`)}, in Quadrant ${QUADRANTS[q]}.`,
      `Reference angle: ${m(
        q === 0
          ? `${angleTex(a, unit)}`
          : q === 1
            ? `${angleTex(180, unit)} - ${angleTex(a, unit)} = ${angleTex(ref, unit)}`
            : q === 2
              ? `${angleTex(a, unit)} - ${angleTex(180, unit)} = ${angleTex(ref, unit)}`
              : `${angleTex(360, unit)} - ${angleTex(a, unit)} = ${angleTex(ref, unit)}`,
      )}.`,
    ];
    const distractors = distinctDistractors(
      answer,
      [quadAnswer(q, 90 - ref, unit), quadAnswer(q + 1, ref, unit), quadAnswer(q - 1, ref, unit), quadAnswer(q + 2, 90 - ref, unit)],
      (n) => quadAnswer(q + n, ref, unit),
    );
    if (task === 'draw') {
      return {
        question: m(angleTex(deg, unit)),
        answer,
        steps,
        distractors,
        diagram: standardPosition({}, 'Blank coordinate axes'),
        answerDiagram: standardPosition({ deg }, `Angle of ${deg} degrees in standard position`),
        check: { kind: 'trigonometry.stdpos', task },
      };
    }
    return { question: m(angleTex(deg, unit)), answer, steps, distractors, check: { kind: 'trigonometry.stdpos', task } };
  },
});

// ---------------------------------------------------------------- radians and degrees

export const radiansDegrees = defineTopic({
  id: 'trig.angles.radians-degrees',
  subject: 'trigonometry',
  title: 'Converting Between Degrees and Radians',
  description: 'Convert angle measures from degrees to radians and from radians to degrees.',
  category: 'Angles and Angle Measure',
  instruction: (o) => {
    const round = o.form === 'decimal';
    if (o.direction === 'toRad') return round ? 'Convert each degree measure into radians. Round to the nearest hundredth.' : 'Convert each degree measure into radians. Write each answer in terms of π.';
    if (o.direction === 'toDeg') return round ? 'Convert each radian measure into degrees. Round to the nearest tenth.' : 'Convert each radian measure into degrees.';
    return round ? 'Convert each angle measure. Round radians to the nearest hundredth and degrees to the nearest tenth.' : 'Convert each degree measure into radians and each radian measure into degrees.';
  },
  multipleChoice: true,
  defaultCount: 12,
  options: [
    {
      type: 'select',
      id: 'direction',
      label: 'Convert',
      default: 'any',
      choices: [
        { value: 'any', label: 'Both directions' },
        { value: 'toRad', label: 'Degrees to radians' },
        { value: 'toDeg', label: 'Radians to degrees' },
      ],
    },
    {
      type: 'select',
      id: 'form',
      label: 'Radian form',
      default: 'exact',
      choices: [
        { value: 'exact', label: 'Exact (multiples of π)' },
        { value: 'decimal', label: 'Decimals (rounded)' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const dir = strOpt(ctx, 'direction');
    const to = dir === 'toRad' || dir === 'toDeg' ? dir : rng.bool() ? 'toRad' : 'toDeg';
    const decimalForm = strOpt(ctx, 'form') === 'decimal';
    const lim = { easy: 360, medium: 720, hard: 1080 }[difficulty];
    const neg = true;
    const steps: { easy: number[]; medium: number[]; hard: number[] } = { easy: [30, 45], medium: [15, 20, 18], hard: [1, 5, 9, 22.5, 7.5] };
    const pickDeg = () =>
      attempt('deg', () => {
        const s = rng.pick(steps[difficulty]);
        const d = rng.int(neg ? -Math.floor(lim / s) : 1, Math.floor(lim / s)) * s;
        if (d === 0 || Math.abs(d) < 10) return null;
        if (difficulty === 'hard' && s === 1 && d % 15 === 0) return null;
        return d;
      });

    if (to === 'toRad') {
      const d = pickDeg();
      const f = radFrac(d);
      const qTex = degTex(d);
      if (decimalForm) {
        const v = (d * Math.PI) / 180;
        const answer = m(`\\approx ${decimal(v, 2)}`);
        const alt = (x: number) => m(`\\approx ${decimal(x, 2)}`);
        return {
          question: m(qTex),
          answer,
          steps: [m(`${qTex} \\cdot \\frac{\\pi}{180^\\circ} = ${piTex(f)} \\approx ${decimal(v, 2)}`)],
          distractors: distinctDistractors(answer, [alt(d / 180), alt((d * Math.PI) / 360), alt(v + Math.PI), alt(-v)], (n) => alt(v + offset(n) * 0.13)),
          check: { kind: 'trigonometry.convert', to: 'rad' },
        };
      }
      const answer = m(piTex(f));
      const alt = (x: Frac) => m(piTex(x));
      return {
        question: m(qTex),
        answer,
        steps: [m(`${qTex} \\cdot \\frac{\\pi}{180^\\circ} = \\frac{${d}\\pi}{180} = ${piTex(f)}`)],
        distractors: distinctDistractors(answer, [alt(f.inv()), alt(f.mul(2)), alt(f.div(2)), alt(f.neg())], (n) => alt(f.add(new Frac(offset(n), f.d)))),
        check: { kind: 'trigonometry.convert', to: 'rad' },
      };
    }

    // radians to degrees
    if (decimalForm) {
      const r = difficulty === 'easy' ? rng.int(2, 60) / 10 : difficulty === 'medium' ? rng.signedInt(5, 120, true) / 10 : rng.signedInt(50, 1500, true) / 100;
      const v = (r * 180) / Math.PI;
      const answer = m(`\\approx ${decimal(v)}^\\circ`);
      const alt = (x: number) => m(`\\approx ${decimal(x)}^\\circ`);
      return {
        question: m(`${r}\\text{ rad}`),
        answer,
        steps: [m(`${r} \\cdot \\frac{180^\\circ}{\\pi} \\approx ${decimal(v)}^\\circ`)],
        distractors: distinctDistractors(answer, [alt(r * 180), alt((r * Math.PI) / 180), alt(r * 90 / Math.PI), alt(-v)], (n) => alt(v + offset(n) * 4.5)),
        check: { kind: 'trigonometry.convert', to: 'deg' },
      };
    }
    const d = pickDeg();
    const f = radFrac(d);
    const answer = m(degTex(d));
    const alt = (x: number) => m(degTex(x));
    return {
      question: m(piTex(f)),
      answer,
      steps: [m(`${piTex(f)} \\cdot \\frac{180^\\circ}{\\pi} = ${degTex(d)}`)],
      distractors: distinctDistractors(answer, [alt(d * 2), alt(d / 2), alt(180 - d), alt(-d)], (n) => alt(d + offset(n) * 15)),
      check: { kind: 'trigonometry.convert', to: 'deg' },
    };
  },
});

// ---------------------------------------------------------------- degrees-minutes-seconds

/** `12^\circ 30' 18''` for a value in whole seconds. */
function dmsTex(totalSec: number): string {
  const sign = totalSec < 0 ? '-' : '';
  const t = Math.abs(totalSec);
  const D = Math.floor(t / 3600);
  const M = Math.floor((t % 3600) / 60);
  const S = t % 60;
  return `${sign}${D}^\\circ ${M}' ${S}''`;
}

function dmsParts(t: number) {
  return { D: Math.floor(t / 3600), M: Math.floor((t % 3600) / 60), S: t % 60 };
}

/** Decimal string of N / 10^places without trailing zeros. */
function fixed(n: number, places: number): string {
  const sign = n < 0 ? '-' : '';
  const a = Math.abs(n);
  const p = 10 ** places;
  const whole = Math.floor(a / p);
  let frac = String(a % p).padStart(places, '0').replace(/0+$/, '');
  if (frac) frac = `.${frac}`;
  return `${sign}${whole}${frac}`;
}

export const degreesMinutesSeconds = defineTopic({
  id: 'trig.angles.dms',
  subject: 'trigonometry',
  title: 'Degrees and Degrees-Minutes-Seconds',
  description: 'Convert between decimal degrees and degrees-minutes-seconds.',
  category: 'Angles and Angle Measure',
  instruction: (o) =>
    o.direction === 'toDMS'
      ? 'Convert each decimal degree measure into degrees-minutes-seconds. Round to the nearest second.'
      : o.direction === 'toDD'
        ? 'Convert each degree-minute-second measure into decimal degrees. Round to the nearest thousandth.'
        : 'Convert each angle measure into the other form. Round to the nearest second or thousandth of a degree.',
  multipleChoice: true,
  defaultCount: 12,
  options: [
    {
      type: 'select',
      id: 'direction',
      label: 'Convert',
      default: 'any',
      choices: [
        { value: 'any', label: 'Both directions' },
        { value: 'toDMS', label: 'Decimal degrees to DMS' },
        { value: 'toDD', label: 'DMS to decimal degrees' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const dir = strOpt(ctx, 'direction');
    const to = dir === 'toDMS' || dir === 'toDD' ? dir : rng.bool() ? 'toDMS' : 'toDD';
    const D = difficulty === 'easy' ? rng.int(1, 89) : difficulty === 'medium' ? rng.int(1, 179) : rng.int(0, 359);
    const sign = difficulty === 'hard' && rng.bool(0.3) ? -1 : 1;

    if (to === 'toDMS') {
      // decimal degrees given with `places` decimals: value = N / 10^places
      let places: number;
      let N: number;
      if (difficulty === 'hard') {
        places = rng.pick([3, 4]);
        N = D * 10 ** places + rng.int(1, 10 ** places - 1);
      } else {
        // exact: whole seconds, finite decimal
        const total = difficulty === 'easy' ? rng.int(1, 19) * 180 : rng.int(1, 399) * 9;
        const frac = total / 3600;
        places = 4;
        N = D * 10000 + Math.round(frac * 10000);
      }
      N *= sign;
      const ddTex = `${fixed(N, places)}^\\circ`;
      const exactSec = (Math.abs(N) * 3600) / 10 ** places;
      const sec = Math.round(exactSec);
      const approx = Math.abs(sec - exactSec) > 1e-9;
      const rel = approx ? '\\approx ' : '';
      const answer = m(`${rel}${dmsTex(sign * sec)}`);
      const alt = (s: number) => m(`${rel}${dmsTex(sign * s)}`);
      const p = dmsParts(sec);
      const fracDeg = exactSec / 3600 - p.D;
      const minutes = fracDeg * 60;
      const digits = String(Math.abs(N) % 10 ** places).padStart(places, '0');
      const misread = p.D * 3600 + (Number(digits.slice(0, 2)) % 60) * 60 + (Number(digits.slice(2) || '0') % 60);
      const hundred = p.D * 3600 + Math.floor(fracDeg * 100) * 60 + (Math.round((fracDeg * 100 - Math.floor(fracDeg * 100)) * 100) % 60);
      return {
        question: m(ddTex),
        answer,
        steps: [
          m(`${decimal(fracDeg, 6)}^\\circ \\times 60 = ${decimal(minutes, 4)}'`),
          m(`${decimal(minutes - p.M, 4)}' \\times 60 ${approx ? '\\approx' : '='} ${p.S}''`),
          `So ${m(`${ddTex} ${approx ? '\\approx' : '='} ${dmsTex(sign * sec)}`)}.`,
        ],
        distractors: distinctDistractors(answer, [alt(misread), alt(hundred), alt(p.D * 3600 + p.S * 60 + p.M), alt(sec + 60)], (n) => alt(sec + offset(n) * 61)),
        check: { kind: 'trigonometry.dms', to: 'dms' },
      };
    }

    // DMS to decimal degrees
    const total = difficulty === 'easy' ? rng.int(1, 19) * 180 : difficulty === 'medium' ? rng.int(1, 399) * 9 : rng.int(1, 3599);
    const sec = sign * (D * 3600 + total);
    const exact = Math.abs(sec) / 3600;
    const rounded = Math.round(exact * 1000) / 1000;
    const approx = Math.abs(rounded - exact) > 1e-12;
    const shown = approx ? rounded : exact;
    const ddTex = (v: number) => `${decimal(sign * v, 4)}^\\circ`;
    const rel = approx ? '\\approx ' : '';
    const answer = m(`${rel}${ddTex(shown)}`);
    const alt = (v: number) => m(`${rel}${ddTex(Math.round(v * 1000) / 1000)}`);
    const p = dmsParts(Math.abs(sec));
    return {
      question: m(dmsTex(sec)),
      answer,
      steps: [m(`${p.D} + \\frac{${p.M}}{60} + \\frac{${p.S}}{3600} ${approx ? '\\approx' : '='} ${decimal(shown, 4)}`), `So ${m(`${dmsTex(sec)} ${approx ? '\\approx' : '='} ${ddTex(shown)}`)}.`],
      distractors: distinctDistractors(
        answer,
        [alt(p.D + p.M / 100 + p.S / 10000), alt(p.D + p.M / 60 + p.S / 60), alt(p.D + p.M / 3600 + p.S / 60), alt(exact + 1 / 60)],
        (n) => alt(exact + offset(n) * 0.017),
      ),
      check: { kind: 'trigonometry.dms', to: 'dd' },
    };
  },
});

// ---------------------------------------------------------------- coterminal angles

export const coterminalAngles = defineTopic({
  id: 'trig.angles.coterminal',
  subject: 'trigonometry',
  title: 'Coterminal Angles',
  description: 'Find positive and negative coterminal angles, or the coterminal angle in one revolution.',
  category: 'Angles and Angle Measure',
  instruction: (o) =>
    o.task === 'posneg'
      ? 'Find a positive and a negative angle coterminal with each given angle.'
      : o.task === 'principal'
        ? 'Find a coterminal angle between 0° and 360° (or 0 and 2π).'
        : 'Find the coterminal angles as indicated.',
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Find',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'posneg', label: 'A positive and a negative coterminal angle' },
        { value: 'principal', label: 'The coterminal angle in [0°, 360°)' },
      ],
    },
    unitsOpt('mixed'),
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const unit = pickUnit(ctx);
    const t = strOpt(ctx, 'task');
    const task = t === 'posneg' || t === 'principal' ? t : rng.pick(['posneg', 'principal'] as const);
    const full = unit === 'deg' ? '360^\\circ' : '2\\pi';
    const A = (d: number) => angleTex(d, unit);

    if (task === 'posneg') {
      const range = { easy: [0, 360], medium: [-720, 720], hard: [-1440, 1440] }[difficulty] as [number, number];
      const deg = randomAngle(rng, difficulty, unit, range[0], range[1], true);
      const a = mod360(deg);
      const pos = [a, a + 360, a + 720].find((x) => x > 0 && x !== deg)!;
      const negA = [a - 360, a - 720].find((x) => x !== deg)!;
      const fmt = (p: number, n: number) => m(`${A(p)}, ${A(n)}`);
      const answer = fmt(pos, negA);
      const ks = (x: number) => (x - deg) / 360;
      const line = (x: number) => {
        const k = ks(x);
        return m(`${A(deg)} ${k > 0 ? '+' : '-'} ${Math.abs(k) === 1 ? '' : Math.abs(k)}(${full}) = ${A(x)}`);
      };
      return {
        question: m(A(deg)),
        answer,
        steps: [line(pos), line(negA)],
        distractors: distinctDistractors(answer, [fmt(deg + 180, deg - 180), deg % 180 === 0 ? null : fmt(Math.abs(360 - deg), -Math.abs(deg)), fmt(pos, negA + 90), fmt(pos - 90, negA)], (n) => fmt(pos + 45 * n, negA - 45 * n)),
        check: { kind: 'trigonometry.coterminal', task },
      };
    }

    const range = { easy: [-360, 720], medium: [-1080, 1080], hard: [-2160, 2160] }[difficulty] as [number, number];
    const deg = attempt('coterminal', () => {
      const d = randomAngle(rng, difficulty, unit, range[0], range[1], true);
      return d >= 0 && d < 360 ? null : d;
    });
    const a = mod360(deg);
    const k = (a - deg) / 360;
    const answer = m(A(a));
    const alt = (x: number) => m(A(x));
    return {
      question: m(A(deg)),
      answer,
      steps: [m(`${A(deg)} ${k > 0 ? '+' : '-'} ${Math.abs(k) === 1 ? '' : Math.abs(k)}(${full}) = ${A(a)}`)],
      distractors: distinctDistractors(answer, [alt(360 - a), alt(mod360(a + 180)), alt(Math.abs(deg) % 360 === a ? mod360(-deg + 180) : Math.abs(deg) % 360), alt(deg + 360 * (k + (k > 0 ? -1 : 1)))], (n) => alt(mod360(a + 30 * n))),
      check: { kind: 'trigonometry.coterminal', task },
    };
  },
});
