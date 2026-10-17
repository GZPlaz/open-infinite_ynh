/** Right-triangle trigonometry: ratios, missing sides, missing angles. */
import { DiagramBuilder, rotate, unit as unitVec, type Pt, add, mul } from '../../diagram';
import { Frac } from '../../fraction';
import { attempt, defineTopic, distinctDistractors, strOpt } from '../../generator';
import type { Rng } from '../../rng';
import { decimal, m, num } from '../../tex';
import type { ProblemContent } from '../../types';
import { triples } from './common';

type Fn = 'sin' | 'cos' | 'tan';
type Role = 'opp' | 'adj' | 'hyp';
type Task = 'ratio' | 'side' | 'angle';

const NAMES: Array<[string, string, string]> = [
  ['C', 'A', 'B'],
  ['Z', 'X', 'Y'],
  ['L', 'J', 'K'],
  ['R', 'P', 'Q'],
  ['W', 'U', 'V'],
];

const deg = (r: number) => (r * 180) / Math.PI;
const rad = (d: number) => (d * Math.PI) / 180;

/** Which function relates two sides as seen from the angle. */
function fnFor(a: Role, b: Role): { fn: Fn; num: Role; den: Role } {
  const s = new Set([a, b]);
  if (s.has('opp') && s.has('hyp')) return { fn: 'sin', num: 'opp', den: 'hyp' };
  if (s.has('adj') && s.has('hyp')) return { fn: 'cos', num: 'adj', den: 'hyp' };
  return { fn: 'tan', num: 'opp', den: 'adj' };
}

const FN = { sin: Math.sin, cos: Math.cos, tan: Math.tan };
const INV = { sin: Math.asin, cos: Math.acos, tan: Math.atan };

interface Figure {
  /** adjacent leg (R→A) and opposite leg (R→B), relative to the marked angle at A */
  adj: number;
  opp: number;
  labels: { adj: string; opp: string; hyp: string };
  names?: [string, string, string];
  angleLabel?: string;
}

function figure(rng: Rng, f: Figure, alt: string) {
  const hyp = Math.hypot(f.adj, f.opp);
  const scale = 125 / Math.max(f.adj, f.opp, hyp * 0.85);
  const b = new DiagramBuilder(scale);
  const turn = rng.pick([0, 90, 180, 270]) + rng.int(-15, 15);
  const flip = rng.bool();
  const place = (p: Pt): Pt => rotate(flip ? [-p[0], p[1]] : p, turn);
  const R = place([0, 0]);
  const A = place([f.adj, 0]);
  const B = place([0, f.opp]);
  const inside: Pt = [(R[0] + A[0] + B[0]) / 3, (R[1] + A[1] + B[1]) / 3];
  b.polygon([R, A, B], { weight: 1.4 });
  b.rightAngle(R, A, B, 10);
  if (f.labels.adj) b.sideLabel(R, A, f.labels.adj, inside);
  if (f.labels.opp) b.sideLabel(R, B, f.labels.opp, inside);
  if (f.labels.hyp) b.sideLabel(A, B, f.labels.hyp, inside);
  if (f.angleLabel) {
    b.angleArc(A, R, B, 20);
    const dir = DiagramBuilder.bisector(A, R, B);
    b.label(add(A, mul(dir, b.px(32))), f.angleLabel, 'c');
  }
  if (f.names) {
    const away = (p: Pt) => add(p, mul(unitVec([p[0] - inside[0], p[1] - inside[1]]), b.px(10)));
    b.label(away(R), f.names[0], 'c');
    b.label(away(A), f.names[1], 'c');
    b.label(away(B), f.names[2], 'c');
  }
  return b.build(alt);
}

export const trigRatios = defineTopic({
  id: 'geo.trig-ratios',
  subject: 'geometry',
  title: 'Right Triangle Trigonometry',
  description: 'SOH-CAH-TOA: trig ratios, missing sides and missing angles.',
  instruction: (o) =>
    o.task === 'ratio'
      ? 'Find the value of each trigonometric ratio.'
      : o.task === 'angle'
        ? 'Find the measure of each indicated angle. Round to the nearest tenth of a degree.'
        : o.task === 'side'
          ? 'Find the missing side. Round to the nearest tenth.'
          : 'Solve as indicated. Round to the nearest tenth.',
  multipleChoice: true,
  defaultCount: 9,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Find',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed (by difficulty)' },
        { value: 'ratio', label: 'Trig ratios' },
        { value: 'side', label: 'Missing sides' },
        { value: 'angle', label: 'Missing angles' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const opt = strOpt(ctx, 'task');
    const task: Task =
      opt !== 'any'
        ? (opt as Task)
        : difficulty === 'easy'
          ? 'ratio'
          : difficulty === 'medium'
            ? rng.pick<Task>(['side', 'side', 'ratio'])
            : rng.pick<Task>(['side', 'angle']);

    if (task === 'ratio') {
      const [p, q, h] = rng.pick(triples(41));
      const [adj, opp] = rng.bool() ? [p, q] : [q, p];
      const names = rng.pick(NAMES);
      const fn = rng.pick<Fn>(['sin', 'cos', 'tan']);
      const atA = rng.bool();
      // seen from B the legs swap roles
      const o = atA ? opp : adj;
      const a = atA ? adj : opp;
      const vertex = atA ? names[1] : names[2];
      const ratio = (f: Fn) => (f === 'sin' ? new Frac(o, h) : f === 'cos' ? new Frac(a, h) : new Frac(o, a));
      const value = ratio(fn);
      const words = { sin: '\\frac{\\text{opposite}}{\\text{hypotenuse}}', cos: '\\frac{\\text{adjacent}}{\\text{hypotenuse}}', tan: '\\frac{\\text{opposite}}{\\text{adjacent}}' };
      const raw = fn === 'sin' ? [o, h] : fn === 'cos' ? [a, h] : [o, a];
      const answer = m(num(value));
      return {
        question: m(`\\${fn} ${vertex}`),
        answer,
        steps: [m(`\\${fn} ${vertex} = ${words[fn]} = \\frac{${raw[0]}}{${raw[1]}}${value.n !== raw[0] ? ` = ${num(value)}` : ''}`)],
        distractors: distinctDistractors(
          answer,
          [value.inv(), ratio('sin'), ratio('cos'), ratio('tan'), new Frac(a, o)].map((f) => m(num(f))),
          (k) => m(num(new Frac(raw[0]! + k, raw[1]!))),
        ),
        diagram: figure(rng, { adj, opp, labels: { adj: String(adj), opp: String(opp), hyp: String(h) }, names }, `Right triangle ${names.join('')} with legs ${adj} and ${opp} and hypotenuse ${h}`),
        check: { kind: 'trig', task, fn, opp: o, adj: a, hyp: h, value: value.value },
      };
    }

    if (task === 'side') {
      const built = attempt('trig-side', () => {
        const theta = rng.int(20, 70);
        const knownRole = rng.pick<Role>(['opp', 'adj', 'hyp']);
        const unknownRole = rng.pick<Role>((['opp', 'adj', 'hyp'] as Role[]).filter((r) => r !== knownRole));
        const k = rng.int(difficulty === 'hard' ? 8 : 4, difficulty === 'hard' ? 40 : 20);
        const t = rad(theta);
        const sides = { opp: 0, adj: 0, hyp: 0 };
        if (knownRole === 'adj') Object.assign(sides, { adj: k, opp: k * Math.tan(t), hyp: k / Math.cos(t) });
        if (knownRole === 'opp') Object.assign(sides, { opp: k, adj: k / Math.tan(t), hyp: k / Math.sin(t) });
        if (knownRole === 'hyp') Object.assign(sides, { hyp: k, adj: k * Math.cos(t), opp: k * Math.sin(t) });
        const x = sides[unknownRole];
        if (x < 1) return null;
        return { theta, knownRole, unknownRole, k, sides, x };
      });
      const { theta, knownRole, unknownRole, k, sides, x } = built;
      const rel = fnFor(knownRole, unknownRole);
      const xInNumerator = rel.num === unknownRole;
      const ratioTex = xInNumerator ? `\\frac{x}{${k}}` : `\\frac{${k}}{x}`;
      const solved = xInNumerator ? `${k}\\${rel.fn} ${theta}^\\circ` : `\\frac{${k}}{\\${rel.fn} ${theta}^\\circ}`;
      const answer = m(`x \\approx ${decimal(x)}`);
      const t = rad(theta);
      const alt = (v: number) => m(`x \\approx ${decimal(v)}`);
      const other: Fn = rel.fn === 'sin' ? 'cos' : rel.fn === 'cos' ? 'sin' : 'sin';
      return {
        question: 'Find $x$.',
        answer,
        steps: [m(`\\${rel.fn} ${theta}^\\circ = ${ratioTex}`), m(`x = ${solved} \\approx ${decimal(x)}`)],
        distractors: distinctDistractors(
          answer,
          [alt(xInNumerator ? k / FN[rel.fn](t) : k * FN[rel.fn](t)), alt(xInNumerator ? k * FN[other](t) : k / FN[other](t)), alt(xInNumerator ? k * FN[rel.fn](rad(90 - theta)) : k / FN[rel.fn](rad(90 - theta)))],
          (n) => alt(x + n * 1.3),
        ),
        diagram: figure(
          rng,
          {
            adj: sides.adj,
            opp: sides.opp,
            labels: {
              adj: knownRole === 'adj' ? String(k) : unknownRole === 'adj' ? 'x' : '',
              opp: knownRole === 'opp' ? String(k) : unknownRole === 'opp' ? 'x' : '',
              hyp: knownRole === 'hyp' ? String(k) : unknownRole === 'hyp' ? 'x' : '',
            },
            angleLabel: `${theta}^\\circ`,
          },
          `Right triangle with a ${theta} degree angle; the ${knownRole === 'hyp' ? 'hypotenuse' : knownRole === 'opp' ? 'opposite leg' : 'adjacent leg'} is ${k}`,
        ),
        check: { kind: 'trig', task, theta, knownRole, unknownRole, known: k, value: x },
      };
    }

    // angle
    const built = attempt('trig-angle', () => {
      const pair = rng.pick<[Role, Role]>([
        ['opp', 'adj'],
        ['opp', 'hyp'],
        ['adj', 'hyp'],
      ]);
      const u = rng.int(3, 25);
      const v = rng.int(3, 25);
      const vals: Partial<Record<Role, number>> = {};
      vals[pair[0]] = u;
      vals[pair[1]] = v;
      if (pair[1] === 'hyp' && v <= u + 1) return null;
      const opp = vals.opp ?? Math.sqrt(vals.hyp! ** 2 - vals.adj! ** 2);
      const adj = vals.adj ?? Math.sqrt(vals.hyp! ** 2 - vals.opp! ** 2);
      const thetaDeg = deg(Math.atan2(opp, adj));
      if (thetaDeg < 12 || thetaDeg > 78) return null;
      return { pair, vals, opp, adj, thetaDeg };
    });
    const { pair, vals, opp, adj, thetaDeg } = built;
    const rel = fnFor(pair[0], pair[1]);
    const ratio = `\\frac{${vals[rel.num]}}{${vals[rel.den]}}`;
    const answer = m(`\\theta \\approx ${decimal(thetaDeg)}^\\circ`);
    const alt = (v: number) => m(`\\theta \\approx ${decimal(v)}^\\circ`);
    const r = vals[rel.num]! / vals[rel.den]!;
    const wrongFn: Fn = rel.fn === 'tan' ? 'sin' : 'tan';
    return {
      question: 'Find $\\theta$.',
      answer,
      steps: [m(`\\${rel.fn} \\theta = ${ratio}`), m(`\\theta = \\${rel.fn}^{-1}\\left(${ratio}\\right) \\approx ${decimal(thetaDeg)}^\\circ`)],
      distractors: distinctDistractors(
        answer,
        [alt(90 - thetaDeg), r <= 1 || wrongFn === 'tan' ? alt(deg(INV[wrongFn](r))) : null, alt(deg(INV.tan(1 / r)))],
        (n) => alt(thetaDeg + n * 2.1),
      ),
      diagram: figure(
        rng,
        {
          adj,
          opp,
          labels: { adj: vals.adj ? String(vals.adj) : '', opp: vals.opp ? String(vals.opp) : '', hyp: vals.hyp ? String(vals.hyp) : '' },
          angleLabel: '\\theta',
        },
        `Right triangle; find the angle theta`,
      ),
      check: { kind: 'trig', task, vals, value: thetaDeg },
    };
  },
});
