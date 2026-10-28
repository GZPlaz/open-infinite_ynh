/** Applications of the Laws of Sines and Cosines: navigation, surveying, towers, lighthouses and land plots. */
import { attempt, defineTopic, distinctDistractors, strOpt } from '../../generator';
import type { Rng } from '../../rng';
import { decimal, m, roundTo } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { solveTriangle, type Givens } from './triangle';

type Scenario = 'ships' | 'shipsBearing' | 'river' | 'riverWidth' | 'tower' | 'plane' | 'lake' | 'lighthouse' | 'plot';

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const NAMES = ['Amara', 'Bruno', 'Chen', 'Dalia', 'Emeka', 'Freya', 'Goran', 'Hira', 'Ivan', 'Jaya', 'Kofi', 'Leila', 'Marco', 'Noor', 'Oskar', 'Paloma'];

/** Quadrant bearing for an azimuth (degrees clockwise from north): `N 40° E`. */
function bearing(az: number): string {
  if (az < 90) return `N ${az}° E`;
  if (az < 180) return `S ${180 - az}° E`;
  if (az < 270) return `S ${az - 180}° W`;
  return `N ${360 - az}° W`;
}

interface Built {
  story: string;
  unit: string;
  value: number;
  law: 'sines' | 'cosines' | 'both';
  steps: string[];
  wrong: number[];
  params: Record<string, number>;
}

function one(g: Givens) {
  const s = solveTriangle(g);
  if (s.length !== 1) throw new Error('application: triangle not unique');
  return s[0]!;
}

function build(rng: Rng, s: Scenario): Built | null {
  const who = rng.pick(NAMES);
  switch (s) {
    case 'ships':
    case 'shipsBearing': {
      const v1 = rng.int(8, 30);
      const v2 = rng.intExcept(8, 30, [v1]);
      const t = rng.pick([1.5, 2, 2.5, 3, 4]);
      let gamma: number;
      let story: string;
      const params: Record<string, number> = { v1, v2, t };
      if (s === 'ships') {
        gamma = rng.int(25, 150);
        params.gamma = gamma;
        story = `Two ships leave a harbor at the same time. One travels at ${v1} miles per hour and the other at ${v2} miles per hour, and the angle between their courses is ${gamma}°. How far apart are they after ${t} hours?`;
      } else {
        const alpha = rng.int(10, 80);
        const beta = rng.int(10, 80);
        gamma = 180 - alpha - beta;
        if (gamma < 20) return null;
        params.alpha = alpha;
        params.beta = beta;
        story = `Two ships leave port at noon. The first sails on a bearing of N ${alpha}° E at ${v1} miles per hour; the second sails on a bearing of S ${beta}° E at ${v2} miles per hour. How far apart are they after ${t} hours?`;
      }
      const a = v1 * t;
      const b = v2 * t;
      const c = Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(rad(gamma)));
      return {
        story,
        unit: 'mi',
        value: c,
        law: 'cosines',
        steps: [
          ...(s === 'shipsBearing' ? [`The angle between the courses is ${m(`180^\\circ - ${params.alpha}^\\circ - ${params.beta}^\\circ = ${gamma}^\\circ`)}.`] : []),
          `The ships have traveled ${m(`${decimal(a)}`)} and ${m(`${decimal(b)}`)} miles.`,
          m(`d = \\sqrt{${decimal(a)}^{2} + ${decimal(b)}^{2} - 2(${decimal(a)})(${decimal(b)})\\cos ${gamma}^\\circ} \\approx ${decimal(c)}`),
        ],
        wrong: [Math.sqrt(a * a + b * b), Math.sqrt(a * a + b * b + 2 * a * b * Math.cos(rad(gamma))), a + b - c / 2, Math.sqrt(Math.abs(v1 * v1 + v2 * v2 - 2 * v1 * v2 * Math.cos(rad(gamma))))],
        params,
      };
    }
    case 'river':
    case 'riverWidth': {
      const d = rng.int(60, 400);
      const alpha = rng.int(35, 85);
      const beta = rng.int(35, 85);
      if (alpha + beta > 160) return null;
      const t = one({ A: alpha, B: beta, c: d });
      const width = t.b * Math.sin(rad(alpha));
      const base = `To measure across a river, ${who} marks points A and B ${d} feet apart on one bank. A tree T stands on the far bank, with angle TAB = ${alpha}° and angle TBA = ${beta}°.`;
      const steps = [m(`m\\angle T = 180^\\circ - ${alpha}^\\circ - ${beta}^\\circ = ${180 - alpha - beta}^\\circ`), m(`AT = \\frac{${d}\\sin ${beta}^\\circ}{\\sin ${180 - alpha - beta}^\\circ} \\approx ${decimal(t.b)}`)];
      if (s === 'river')
        return { story: `${base} How far is the tree from point A?`, unit: 'ft', value: t.b, law: 'sines', steps, wrong: [t.a, (d * Math.sin(rad(alpha))) / Math.sin(rad(180 - alpha - beta)), width, (d * Math.sin(rad(beta))) / Math.sin(rad(alpha + beta + 10))], params: { d, alpha, beta } };
      return {
        story: `${base} How wide is the river (the perpendicular distance from T to the line AB)?`,
        unit: 'ft',
        value: width,
        law: 'sines',
        steps: [...steps, m(`w = AT\\sin ${alpha}^\\circ \\approx ${decimal(width)}`)],
        wrong: [t.b, t.b * Math.cos(rad(alpha)), t.a * Math.sin(rad(alpha)), d * Math.tan(rad(alpha)) / 2],
        params: { d, alpha, beta },
      };
    }
    case 'tower': {
      const alpha = rng.int(5, 25);
      const beta = rng.int(15, 50);
      const d = rng.int(40, 200);
      // anchor A, base B, top C: A = β, B = 90° + α, AB = d
      const t = one({ A: beta, B: 90 + alpha, c: d });
      return {
        story: `A vertical tower stands on a hillside that rises at ${alpha}° from the horizontal. A guy wire is anchored ${d} feet downhill from the base of the tower and makes an angle of ${beta}° with the hillside. How tall is the tower?`,
        unit: 'ft',
        value: t.a,
        law: 'sines',
        steps: [`The angle at the base between the downhill slope and the tower is ${m(`90^\\circ + ${alpha}^\\circ = ${90 + alpha}^\\circ`)}.`, m(`\\text{Angle at the top} = 180^\\circ - ${beta}^\\circ - ${90 + alpha}^\\circ = ${90 - alpha - beta}^\\circ`), m(`h = \\frac{${d}\\sin ${beta}^\\circ}{\\sin ${90 - alpha - beta}^\\circ} \\approx ${decimal(t.a)}`)],
        wrong: [d * Math.tan(rad(beta)), (d * Math.sin(rad(beta))) / Math.sin(rad(90 - beta)), (d * Math.sin(rad(beta + alpha))) / Math.sin(rad(90 - alpha - beta)), t.b],
        params: { d, alpha, beta },
      };
    }
    case 'plane': {
      const d1 = rng.int(50, 400);
      const d2 = rng.int(50, 400);
      const az1 = rng.pick([10, 20, 30, 40, 50, 60, 70, 80].map((x) => x + 90 * rng.int(0, 3)));
      const az2 = attempt('second leg', () => {
        const x = rng.int(1, 35) * 10;
        const turn = Math.abs(((x - az1 + 540) % 360) - 180);
        return turn < 30 || turn > 150 || x % 90 === 0 || az1 % 90 === 0 ? null : x;
      });
      const x = d1 * Math.sin(rad(az1)) + d2 * Math.sin(rad(az2));
      const y = d1 * Math.cos(rad(az1)) + d2 * Math.cos(rad(az2));
      const dist = Math.hypot(x, y);
      const turn = Math.abs(((az2 - az1 + 540) % 360) - 180);
      const inc = 180 - turn;
      return {
        story: `A pilot flies ${d1} miles on a bearing of ${bearing(az1)}, then turns and flies ${d2} miles on a bearing of ${bearing(az2)}. How far is the plane from its starting point?`,
        unit: 'mi',
        value: dist,
        law: 'cosines',
        steps: [`The angle between the two legs at the turning point is ${m(`180^\\circ - ${turn}^\\circ = ${inc}^\\circ`)}.`, m(`d = \\sqrt{${d1}^{2} + ${d2}^{2} - 2(${d1})(${d2})\\cos ${inc}^\\circ} \\approx ${decimal(dist)}`)],
        wrong: [Math.sqrt(d1 * d1 + d2 * d2 - 2 * d1 * d2 * Math.cos(rad(turn))), Math.sqrt(d1 * d1 + d2 * d2), d1 + d2, Math.abs(d1 - d2) + 10],
        params: { d1, d2, az1, az2 },
      };
    }
    case 'lake': {
      const p = rng.int(80, 900);
      const q = rng.intExcept(80, 900, [p]);
      const gamma = rng.int(30, 140);
      const c = Math.sqrt(p * p + q * q - 2 * p * q * Math.cos(rad(gamma)));
      return {
        story: `To find the length of a lake, a surveyor stands at a point C that is ${p} meters from one end A and ${q} meters from the other end B. The angle ACB measures ${gamma}°. How long is the lake?`,
        unit: 'm',
        value: c,
        law: 'cosines',
        steps: [m(`AB = \\sqrt{${p}^{2} + ${q}^{2} - 2(${p})(${q})\\cos ${gamma}^\\circ} \\approx ${decimal(c)}`)],
        wrong: [Math.sqrt(p * p + q * q), Math.sqrt(p * p + q * q + 2 * p * q * Math.cos(rad(gamma))), (p + q) * Math.sin(rad(gamma / 2)) * 1.3, Math.abs(p - q) + 5],
        params: { p, q, gamma },
      };
    }
    case 'lighthouse': {
      const alpha = rng.int(15, 50);
      const beta = rng.int(alpha + 15, Math.min(150, alpha + 90));
      const d = rng.int(2, 15);
      const t = one({ A: alpha, B: 180 - beta, c: d });
      return {
        story: `A ship sailing a straight course sees a lighthouse at an angle of ${alpha}° from its course. After the ship sails ${d} miles farther, the angle between the course and the lighthouse is ${beta}°. How far is the ship from the lighthouse at the second sighting?`,
        unit: 'mi',
        value: t.a,
        law: 'sines',
        steps: [m(`\\text{Angle at the second position} = 180^\\circ - ${beta}^\\circ = ${180 - beta}^\\circ`), m(`\\text{Angle at the lighthouse} = ${beta}^\\circ - ${alpha}^\\circ = ${beta - alpha}^\\circ`), m(`d = \\frac{${d}\\sin ${alpha}^\\circ}{\\sin ${beta - alpha}^\\circ} \\approx ${decimal(t.a)}`)],
        wrong: [t.b, (d * Math.sin(rad(beta))) / Math.sin(rad(beta - alpha)), (d * Math.sin(rad(alpha))) / Math.sin(rad(beta)), d * Math.tan(rad(alpha))],
        params: { d, alpha, beta },
      };
    }
    case 'plot': {
      const sides = [rng.int(20, 120), rng.int(20, 120), rng.int(20, 120)].sort((x, y) => x - y);
      const [a, b, c] = sides as [number, number, number];
      if (a + b <= c * 1.15) return null;
      const C = deg(Math.acos((a * a + b * b - c * c) / (2 * a * b)));
      return {
        story: `A triangular garden plot has sides of ${a} feet, ${b} feet and ${c} feet. ${who} wants to know the largest angle of the plot. Find it to the nearest tenth of a degree.`,
        unit: '°',
        value: C,
        law: 'cosines',
        steps: [`The largest angle is opposite the longest side, ${m(`${c}`)}.`, m(`\\cos C = \\frac{${a}^{2} + ${b}^{2} - ${c}^{2}}{2(${a})(${b})} \\Rightarrow C \\approx ${decimal(C)}^\\circ`)],
        wrong: [180 - C, deg(Math.acos((b * b + c * c - a * a) / (2 * b * c))), deg(Math.acos((a * a + c * c - b * b) / (2 * a * c))), C / 2 + 20],
        params: { a, b, c },
      };
    }
  }
}

export const lawsApplications = defineTopic({
  id: 'trig.laws.applications',
  subject: 'trigonometry',
  title: 'Applications of the Laws of Sines and Cosines',
  description: 'Navigation and bearings, surveying across rivers and lakes, towers on hills, lighthouses and land plots.',
  category: 'Laws of Sines and Cosines',
  instruction: 'Solve each problem. Round answers to the nearest tenth.',
  multipleChoice: true,
  defaultCount: 5,
  options: [
    {
      type: 'select',
      id: 'law',
      label: 'Law used',
      default: 'any',
      choices: [
        { value: 'any', label: 'Either law' },
        { value: 'sines', label: 'Law of Sines' },
        { value: 'cosines', label: 'Law of Cosines' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const law = strOpt(ctx, 'law');
    const pools: Record<Difficulty, Scenario[]> = {
      easy: ['ships', 'river', 'lake', 'plot'],
      medium: ['ships', 'river', 'lake', 'plot', 'tower', 'lighthouse'],
      hard: ['shipsBearing', 'riverWidth', 'tower', 'lighthouse', 'plane', 'plot'],
    };
    const sinesOnly: Scenario[] = ['river', 'riverWidth', 'tower', 'lighthouse'];
    const pool = pools[difficulty].filter((s) => (law === 'sines' ? sinesOnly.includes(s) : law === 'cosines' ? !sinesOnly.includes(s) : true));
    const { b, scenario } = attempt('application', () => {
      const scenario = rng.pick(pool.length ? pool : pools[difficulty]);
      const b = build(rng, scenario);
      return b ? { b, scenario } : null;
    });
    const isAngle = b.unit === '°';
    const fmt = (v: number) => {
      const rel = Math.abs(roundTo(v, 1) - v) > 1e-9 ? '\\approx' : '=';
      return isAngle ? m(`C ${rel} ${decimal(v)}^\\circ`) : m(`d ${rel} ${decimal(v)}\\text{ ${b.unit}}`);
    };
    const answer = fmt(b.value);
    const differs = (w: number) => Number.isFinite(w) && w > 0 && Math.abs(roundTo(w, 1) - roundTo(b.value, 1)) > 0.05;
    return {
      question: b.story,
      answer,
      steps: b.steps,
      distractors: distinctDistractors(answer, b.wrong.filter(differs).map(fmt), (k) => fmt(b.value * (1 + 0.12 * k))),
      check: { kind: 'trigonometry.lawapp', scenario, params: b.params },
    };
  },
});
