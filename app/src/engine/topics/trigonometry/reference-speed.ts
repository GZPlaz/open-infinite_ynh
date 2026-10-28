/** Reference angles, and linear / angular speed word problems. */
import { Frac } from '../../fraction';
import { attempt, defineTopic, distinctDistractors, offset, strOpt } from '../../generator';
import type { Rng } from '../../rng';
import { decimal, m, roundTo } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { pickUnit, unitsOpt } from './angles';
import { angleTex, mod360, piTex, QUADRANTS, quadrantOf, referenceAngle, type AngleUnit } from './exact';

// ---------------------------------------------------------------- reference angles

function pickAngle(rng: Rng, d: Difficulty, unit: AngleUnit): number {
  const [lo, hi] = { easy: unit === 'rad' ? [-360, 720] : [0, 360], medium: [-360, 720], hard: [-1440, 1440] }[d];
  return attempt('reference angle', () => {
    let deg: number;
    if (unit === 'deg') deg = rng.int(Math.ceil(lo! / 5), Math.floor(hi! / 5)) * 5;
    else {
      const n = rng.pick(d === 'hard' ? [6, 4, 3, 12, 12] : [6, 4, 3]);
      const step = 180 / n;
      deg = rng.int(Math.ceil(lo! / step), Math.floor(hi! / step)) * step;
    }
    if (deg % 90 === 0) return null;
    if (d !== 'easy' && deg >= 0 && deg < 360 && rng.bool(0.7)) return null;
    return deg;
  });
}

export const referenceAngles = defineTopic({
  id: 'trig.angles.reference',
  subject: 'trigonometry',
  title: 'Reference Angles',
  description: 'Find the reference angle of angles in any quadrant, including negative angles and angles beyond one turn.',
  category: 'Angles and Angle Measure',
  instruction: 'Find the reference angle.',
  multipleChoice: true,
  defaultCount: 12,
  options: [unitsOpt('mixed')],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const unit = pickUnit(ctx);
    const deg = pickAngle(rng, difficulty, unit);
    const a = mod360(deg);
    const q = quadrantOf(a);
    const ref = referenceAngle(a);
    const A = (x: number) => angleTex(x, unit);
    const ans = (x: number) => m(`\\theta' = ${A(x)}`);
    const answer = ans(ref);
    const steps: string[] = [];
    if (a !== deg) {
      const k = (a - deg) / 360;
      steps.push(`Coterminal angle in one turn: ${m(`${A(deg)} ${k > 0 ? '+' : '-'} ${Math.abs(k) === 1 ? '' : Math.abs(k)}${unit === 'deg' ? '(360^\\circ)' : '(2\\pi)'} = ${A(a)}`)}.`);
    }
    steps.push(
      `${m(A(a))} is in Quadrant ${QUADRANTS[q]}: ${m(
        q === 0 ? `\\theta' = ${A(a)}` : q === 1 ? `\\theta' = ${A(180)} - ${A(a)} = ${A(ref)}` : q === 2 ? `\\theta' = ${A(a)} - ${A(180)} = ${A(ref)}` : `\\theta' = ${A(360)} - ${A(a)} = ${A(ref)}`,
      )}.`,
    );
    const cands = [ans(90 - ref), ans(a), ans(Math.abs(180 - a)), ans(Math.abs(deg) % 180 === ref ? 180 - ref : Math.abs(deg) % 180)];
    const step = unit === 'deg' ? 5 : 15;
    return {
      question: m(`\\theta = ${A(deg)}`),
      answer,
      steps,
      distractors: distinctDistractors(answer, cands.map((c) => (c.includes(`= ${A(0)}$`) ? null : c)), (k) => {
        const x = ref + offset(k) * step;
        return x > 0 && x < 90 ? ans(x) : null;
      }),
      check: { kind: 'trigonometry.refangle' },
    };
  },
});

// ---------------------------------------------------------------- linear and angular speed

/** Scenario ids are recomputed independently by the pack verifier. */
type Scenario = 'ferrisAngular' | 'ferrisLinear' | 'wheelMph' | 'rpmRad' | 'bikeRpm' | 'pulley' | 'gear' | 'satellite' | 'earth';

interface Built {
  question: string;
  name: string;
  unit: string;
  value: number;
  steps: string[];
  wrong: number[];
  params: Record<string, number>;
}

const RIDERS = ['Ava', 'Ben', 'Carmen', 'Dev', 'Elif', 'Femi', 'Grace', 'Hiro', 'Imani', 'Jonas', 'Kai', 'Lucía', 'Mateo', 'Nia', 'Omar', 'Priya'];
const TAU = 2 * Math.PI;
const IN_PER_MI = 63360;
const EARTH = 3960;

function build(rng: Rng, s: Scenario): Built {
  const who = rng.pick(RIDERS);
  switch (s) {
    case 'ferrisAngular':
    case 'ferrisLinear': {
      const r = rng.int(10, 80);
      const T = rng.int(20, 120);
      const place = rng.pick(['A Ferris wheel at the county fair', 'The Ferris wheel on the pier', 'A giant observation wheel', 'The Ferris wheel at the amusement park']);
      const base = `${place} has a radius of ${r} feet and makes one revolution every ${T} seconds.`;
      if (s === 'ferrisAngular') {
        const w = TAU / T;
        return {
          question: `${base} Find its angular speed in radians per second.`,
          name: '\\omega',
          unit: 'rad/s',
          value: w,
          steps: [m(`\\omega = \\frac{2\\pi}{${T}}${new Frac(2, T).n === 2 ? '' : ` = ${piTex(new Frac(2, T))}`} \\approx ${decimal(w, 3)}\\text{ rad/s}`)],
          wrong: [360 / T, 1 / T, (TAU * r) / T, Math.PI / T],
          params: { r, T },
        };
      }
      const v = (TAU * r) / T;
      return {
        question: `${base} ${who} is riding on the rim. Find ${who}'s linear speed in feet per second.`,
        name: 'v',
        unit: 'ft/s',
        value: v,
        steps: [m(`v = \\frac{2\\pi r}{T} = \\frac{2\\pi(${r})}{${T}} \\approx ${decimal(v, 2)}\\text{ ft/s}`)],
        wrong: [(Math.PI * r) / T, r / T, (TAU * r * 60) / T, (4 * Math.PI * r) / T],
        params: { r, T },
      };
    }
    case 'wheelMph': {
      const d = rng.pick([20, 24, 26, 27, 28, 29, 30, 32]);
      const n = rng.int(100, 400);
      const v = (n * Math.PI * d * 60) / IN_PER_MI;
      const thing = rng.pick(['bicycle wheel', 'go-kart wheel', 'scooter wheel', 'wheelchair wheel']);
      return {
        question: `A ${thing} with a diameter of ${d} inches turns at ${n} revolutions per minute. How fast is it traveling, in miles per hour?`,
        name: 'v',
        unit: 'mph',
        value: v,
        steps: [
          m(`v = ${n}\\cdot \\pi(${d})\\text{ in/min} \\approx ${decimal(n * Math.PI * d, 1)}\\text{ in/min}`),
          m(`${decimal(n * Math.PI * d, 1)}\\cdot \\frac{60\\text{ min/h}}{63360\\text{ in/mi}} \\approx ${decimal(v, 2)}\\text{ mph}`),
        ],
        wrong: [(n * Math.PI * d) / IN_PER_MI, (n * TAU * d * 60) / IN_PER_MI, (n * d * 60) / IN_PER_MI, (n * Math.PI * d * 60) / 5280],
        params: { d, n },
      };
    }
    case 'rpmRad': {
      const n = rng.int(30, 2400);
      const w = (TAU * n) / 60;
      const thing = rng.pick(['A ceiling fan', 'A lathe', 'An electric drill', 'A record turntable', 'A washing-machine drum', 'A wind turbine rotor']);
      return {
        question: `${thing} turns at ${n} revolutions per minute. Find its angular speed in radians per second.`,
        name: '\\omega',
        unit: 'rad/s',
        value: w,
        steps: [m(`\\omega = ${n}\\cdot\\frac{2\\pi}{60} \\approx ${decimal(w, 2)}\\text{ rad/s}`)],
        wrong: [TAU * n, n / 60, (Math.PI * n) / 60, (360 * n) / 60],
        params: { n },
      };
    }
    case 'bikeRpm': {
      const d = rng.pick([20, 24, 26, 27, 28, 29]);
      const mph = rng.int(6, 25);
      const rpm = (mph * IN_PER_MI) / 60 / (Math.PI * d);
      return {
        question: `${who} rides a bicycle with ${d}-inch diameter wheels at ${mph} miles per hour. How many revolutions per minute do the wheels make?`,
        name: 'n',
        unit: 'rpm',
        value: rpm,
        steps: [m(`${mph}\\text{ mph} = \\frac{${mph}(63360)}{60} = ${decimal((mph * IN_PER_MI) / 60, 2)}\\text{ in/min}`), m(`n = \\frac{${decimal((mph * IN_PER_MI) / 60, 2)}}{\\pi(${d})} \\approx ${decimal(rpm, 2)}\\text{ rpm}`)],
        wrong: [(mph * IN_PER_MI) / 60 / (TAU * d), (mph * IN_PER_MI) / (Math.PI * d), (mph * 5280) / 60 / (Math.PI * d), (mph * IN_PER_MI) / 60 / d],
        params: { d, mph },
      };
    }
    case 'pulley': {
      const r1 = rng.int(2, 12);
      const r2 = rng.intExcept(2, 15, [r1]);
      const n1 = rng.int(60, 1800);
      const n2 = (n1 * r1) / r2;
      return {
        question: `A belt connects a pulley of radius ${r1} inches to a pulley of radius ${r2} inches. The first pulley turns at ${n1} rpm. How fast does the second pulley turn, in revolutions per minute?`,
        name: 'n',
        unit: 'rpm',
        value: n2,
        steps: [`The belt gives both rims the same linear speed: ${m(`${r1}(2\\pi)(${n1}) = ${r2}(2\\pi)n`)}.`, m(`n = \\frac{${r1}(${n1})}{${r2}} ${Math.abs(roundTo(n2, 2) - n2) > 1e-9 ? '\\approx' : '='} ${decimal(n2, 2)}\\text{ rpm}`)],
        wrong: [(n1 * r2) / r1, n1, (n1 * r1 * TAU) / r2, n1 * r1 * r2],
        params: { r1, r2, n1 },
      };
    }
    case 'gear': {
      const t1 = rng.int(10, 60);
      const t2 = rng.intExcept(8, 72, [t1]);
      const n1 = rng.int(20, 600);
      const n2 = (n1 * t1) / t2;
      return {
        question: `A gear with ${t1} teeth turning at ${n1} rpm meshes with a gear that has ${t2} teeth. Find the angular speed of the second gear in radians per minute.`,
        name: '\\omega',
        unit: 'rad/min',
        value: n2 * TAU,
        steps: [m(`n = \\frac{${t1}(${n1})}{${t2}} ${Math.abs(roundTo(n2, 2) - n2) > 1e-9 ? '\\approx' : '='} ${decimal(n2, 2)}\\text{ rpm}`), m(`\\omega = 2\\pi n \\approx ${decimal(n2 * TAU, 2)}\\text{ rad/min}`)],
        wrong: [((n1 * t2) / t1) * TAU, n2, n1 * TAU, n2 * Math.PI],
        params: { t1, t2, n1 },
      };
    }
    case 'satellite': {
      const h = rng.int(150, 22000);
      const T = roundTo(rng.int(15, 240) / 10, 1);
      const v = (TAU * (EARTH + h)) / T;
      return {
        question: `A satellite orbits ${h} miles above Earth's surface and completes one orbit every ${T} hours. Using 3960 miles for Earth's radius, find the satellite's linear speed in miles per hour.`,
        name: 'v',
        unit: 'mph',
        value: v,
        steps: [m(`r = 3960 + ${h} = ${EARTH + h}\\text{ mi}`), m(`v = \\frac{2\\pi(${EARTH + h})}{${T}} \\approx ${decimal(v, 2)}\\text{ mph}`)],
        wrong: [(TAU * h) / T, (Math.PI * (EARTH + h)) / T, TAU * (EARTH + h) * T, (TAU * EARTH) / T],
        params: { h, T, R: EARTH },
      };
    }
    case 'earth': {
      const L = rng.int(5, 65);
      const city = rng.pick(['a city', 'a research station', 'a lighthouse', 'an observatory', 'a village']);
      const v = (TAU * EARTH * Math.cos((L * Math.PI) / 180)) / 24;
      return {
        question: `Earth rotates once every 24 hours. Find the linear speed, in miles per hour, of ${city} at latitude ${L}° N. Use 3960 miles for Earth's radius.`,
        name: 'v',
        unit: 'mph',
        value: v,
        steps: [m(`r = 3960\\cos ${L}^\\circ \\approx ${decimal(EARTH * Math.cos((L * Math.PI) / 180), 2)}\\text{ mi}`), m(`v = \\frac{2\\pi r}{24} \\approx ${decimal(v, 2)}\\text{ mph}`)],
        wrong: [(TAU * EARTH) / 24, (TAU * EARTH * Math.sin((L * Math.PI) / 180)) / 24, (Math.PI * EARTH * Math.cos((L * Math.PI) / 180)) / 24, (TAU * EARTH * Math.cos(L)) / 24],
        params: { L, R: EARTH },
      };
    }
  }
}

export const linearAngularSpeed = defineTopic({
  id: 'trig.angles.linear-angular-speed',
  subject: 'trigonometry',
  title: 'Linear and Angular Speed',
  description: 'Word problems with wheels, Ferris wheels, pulleys, gears, satellites and Earth’s rotation, including unit conversions.',
  category: 'Angles and Angle Measure',
  instruction: 'Solve each problem. Round answers to the nearest hundredth (thousandth for values less than 1).',
  multipleChoice: true,
  defaultCount: 6,
  options: [
    {
      type: 'select',
      id: 'find',
      label: 'Find',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'angular', label: 'Angular speed' },
        { value: 'linear', label: 'Linear speed' },
        { value: 'rpm', label: 'Revolutions per minute' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const f = strOpt(ctx, 'find');
    const pools: Record<string, Record<Difficulty, Scenario[]>> = {
      angular: { easy: ['ferrisAngular', 'rpmRad'], medium: ['ferrisAngular', 'rpmRad', 'gear'], hard: ['gear', 'rpmRad', 'gear'] },
      linear: { easy: ['ferrisLinear'], medium: ['ferrisLinear', 'wheelMph', 'satellite'], hard: ['wheelMph', 'satellite', 'earth'] },
      rpm: { easy: ['pulley'], medium: ['pulley', 'bikeRpm'], hard: ['bikeRpm', 'pulley'] },
    };
    const pool = f === 'angular' || f === 'linear' || f === 'rpm' ? pools[f]![difficulty] : [...pools.angular![difficulty], ...pools.linear![difficulty], ...pools.rpm![difficulty]];
    const scenario = rng.pick(pool);
    const b = build(rng, scenario);
    const places = Math.abs(b.value) < 1 ? 3 : 2;
    const fmt = (v: number) => {
      const r = roundTo(v, places);
      return m(`${b.name} ${Math.abs(r - v) > 1e-9 ? '\\approx' : '='} ${decimal(v, places)}\\text{ ${b.unit}}`);
    };
    const answer = fmt(b.value);
    const differs = (w: number) => Number.isFinite(w) && w > 0 && Math.abs(roundTo(w, places) - roundTo(b.value, places)) > 0.5 * 10 ** -places;
    return {
      question: b.question,
      answer,
      steps: b.steps,
      distractors: distinctDistractors(answer, b.wrong.filter(differs).map(fmt), (k) => fmt(b.value * (1 + 0.15 * k))),
      check: { kind: 'trigonometry.speed', scenario, params: b.params },
    };
  },
});
