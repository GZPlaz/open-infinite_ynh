/** Right triangles: converse of the Pythagorean theorem, special right triangles, angles of elevation and depression. */
import { DiagramBuilder, type Pt } from '../../diagram';
import { Frac } from '../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, strOpt } from '../../generator';
import { simplifySqrt } from '../../radical';
import type { Rng } from '../../rng';
import { decimal, m, roundTo, withUnit } from '../../tex';
import type { ProblemContent } from '../../types';
import { triples } from './common';
import { angleLabel, centroid, orient, sideText } from './kit';

// ---------------------------------------------------------------- converse of the Pythagorean theorem

type Kind = 'Acute' | 'Right' | 'Obtuse' | 'Not a triangle';
const KINDS: Kind[] = ['Acute', 'Right', 'Obtuse', 'Not a triangle'];

/** A side length given by its square: integer when a perfect square, else a radical. */
const sideTex = (sq: number): string => {
  const { out, inside } = simplifySqrt(sq);
  return inside === 1 ? String(out) : `\\sqrt{${sq}}`;
};

export const pythagoreanConverse = defineTopic({
  id: 'geo.pythagorean-converse',
  subject: 'geometry',
  category: 'Right Triangles and Trigonometry',
  title: 'Converse of the Pythagorean Theorem',
  description: 'Classify a triangle as acute, right or obtuse from its side lengths (or decide it is not a triangle).',
  instruction: (o) => (o.notTriangle ? 'State whether each set of side lengths forms an acute, right, or obtuse triangle, or no triangle at all.' : 'State whether each triangle with the given side lengths is acute, right, or obtuse.'),
  multipleChoice: true,
  defaultCount: 12,
  options: [{ type: 'boolean', id: 'notTriangle', label: 'Include lengths that do not form a triangle', default: true }],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const allowNone = boolOpt(ctx, 'notTriangle');
    const target = rng.weighted<Kind>([
      ['Acute', 3],
      ['Right', 3],
      ['Obtuse', 3],
      ['Not a triangle', allowNone ? 1.5 : 0],
    ]);
    const hi = difficulty === 'easy' ? 20 : difficulty === 'medium' ? 40 : 60;
    // squares of the three sides
    const sq = attempt('converse', () => {
      if (target === 'Right') {
        if (difficulty === 'hard' && rng.bool(0.6)) {
          const a2 = rng.int(2, 60);
          const b2 = rng.int(2, 60);
          if (Math.sqrt(a2 + b2) > hi) return null;
          return [a2, b2, a2 + b2];
        }
        const [a, b, c] = rng.pick(triples(hi));
        return [a * a, b * b, c * c];
      }
      const useRoots = difficulty === 'hard' && rng.bool(0.5);
      const pick = () => (useRoots ? rng.int(2, 80) : rng.int(2, hi) ** 2);
      const s = [pick(), pick(), pick()].sort((x, y) => x - y) as [number, number, number];
      const [a, b, c] = s.map(Math.sqrt) as [number, number, number];
      const d = s[0] + s[1] - s[2];
      const k: Kind = a + b <= c + 1e-12 ? 'Not a triangle' : d === 0 ? 'Right' : d > 0 ? 'Acute' : 'Obtuse';
      if (k !== target) return null;
      // keep the call non-obvious: near-right for acute/obtuse at medium/hard
      if (k !== 'Not a triangle' && difficulty !== 'easy' && Math.abs(d) > s[2] * 0.35) return null;
      if (k === 'Not a triangle' && a + b === c && rng.bool(0.5)) return null;
      return s;
    });
    const order = rng.shuffle([0, 1, 2]);
    const shown = order.map((i) => sideTex(sq[i]!));
    const [a2, b2, c2] = sq as [number, number, number];
    const answer = target;
    const steps =
      target === 'Not a triangle'
        ? [`The two shorter sides do not add up to more than the longest side, so no triangle is formed.`]
        : [
            `Compare the square of the longest side with the sum of the squares of the other two.`,
            m(`${a2} + ${b2} = ${a2 + b2} ${a2 + b2 === c2 ? '=' : a2 + b2 > c2 ? '>' : '<'} ${c2}`),
            `The triangle is ${target.toLowerCase()}.`,
          ];
    return {
      question: m(shown.join(', ')),
      answer,
      steps,
      distractors: rng.shuffle(KINDS.filter((k) => k !== answer)),
      check: { kind: 'geometry.converse' },
    };
  },
});

// ---------------------------------------------------------------- special right triangles

/** k·√r with r ∈ {1, 2, 3, 6}. */
class Surd {
  constructor(
    readonly k: Frac,
    readonly r: number,
  ) {}
  static int(n: number, r = 1) {
    return new Surd(new Frac(n), r);
  }
  times(n: Frac | number): Surd {
    return new Surd(this.k.mul(n), this.r);
  }
  /** × √q */
  timesRoot(q: number): Surd {
    const { out, inside } = simplifySqrt(this.r * q);
    return new Surd(this.k.mul(out), inside);
  }
  /** ÷ √q */
  overRoot(q: number): Surd {
    return this.timesRoot(q).times(new Frac(1, q));
  }
  get value() {
    return this.k.value * Math.sqrt(this.r);
  }
  tex(): string {
    const n = this.k.n;
    const d = this.k.d;
    const root = this.r === 1 ? '' : `\\sqrt{${this.r}}`;
    const numer = root ? (n === 1 ? root : `${n}${root}`) : String(n);
    return d === 1 ? numer : `\\frac{${numer}}{${d}}`;
  }
}

type Special = '45' | '30';
type Role = 'short' | 'long' | 'hyp';

export const specialRightTriangles = defineTopic({
  id: 'geo.special-right',
  subject: 'geometry',
  category: 'Right Triangles and Trigonometry',
  title: 'Special Right Triangles',
  description: '45°-45°-90° and 30°-60°-90° triangles: find the missing sides in simplest radical form.',
  instruction: 'Find the value of each variable. Leave your answers in simplest radical form.',
  multipleChoice: true,
  defaultCount: 9,
  options: [
    {
      type: 'select',
      id: 'type',
      label: 'Triangles',
      default: 'both',
      choices: [
        { value: 'both', label: 'Both kinds' },
        { value: '45', label: '45°-45°-90° only' },
        { value: '30', label: '30°-60°-90° only' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const t = strOpt(ctx, 'type');
    const kind: Special = t === 'both' ? rng.pick<Special>(['45', '30']) : (t as Special);
    const roles: Role[] = kind === '45' ? ['short', 'hyp'] : ['short', 'long', 'hyp'];
    const givenRole: Role = difficulty === 'easy' ? 'short' : rng.pick(roles.filter((r) => difficulty === 'hard' || r !== 'short' || rng.bool(0.3)));
    const k = rng.int(2, difficulty === 'easy' ? 12 : 16);
    const given = difficulty === 'hard' && rng.bool(0.5) ? Surd.int(k, kind === '45' ? rng.pick([2, 3]) : rng.pick([2, 3])) : Surd.int(k);
    // the short leg (the leg for 45-45-90)
    let s: Surd;
    if (givenRole === 'short') s = given;
    else if (givenRole === 'hyp') s = kind === '45' ? given.overRoot(2) : given.times(new Frac(1, 2));
    else s = given.overRoot(3);
    const sides: Record<Role, Surd> = kind === '45' ? { short: s, long: s, hyp: s.timesRoot(2) } : { short: s, long: s.timesRoot(3), hyp: s.times(2) };
    // figure: right angle at R, leg R→A is the long leg (adjacent to the 30° angle at A)
    const adj = sides.long.value;
    const opp = sides.short.value;
    const raw: Pt[] = [[0, 0], [adj, 0], [0, opp]];
    const P = orient(raw, rng.pick([0, 90, 180, 270]) + rng.int(-15, 15), rng.bool());
    const [R, A, B] = P as [Pt, Pt, Pt];
    const b = new DiagramBuilder(150 / Math.max(adj, opp));
    b.polygon(P, { weight: 1.4 });
    b.rightAngle(R, A, B, 10);
    const inside = centroid(P);
    const unknowns = roles.filter((r) => r !== givenRole);
    if (kind === '45') unknowns.splice(0, unknowns.length, ...(givenRole === 'short' ? ['long', 'hyp'] : ['short', 'long']) as Role[]);
    const vars = ['x', 'y'];
    const labelOf = (r: Role) => (r === givenRole ? given.tex() : vars[unknowns.indexOf(r)]!);
    const seg: Record<Role, [Pt, Pt]> = { long: [R, A], short: [R, B], hyp: [A, B] };
    for (const r of ['long', 'short', 'hyp'] as Role[]) sideText(b, seg[r][0], seg[r][1], labelOf(r), inside, 3);
    if (kind === '45') {
      angleLabel(b, A, R, B, '45^\\circ', { radiusPx: 15 });
    } else {
      angleLabel(b, A, R, B, '30^\\circ', { radiusPx: 15 });
      if (rng.bool()) angleLabel(b, B, A, R, '60^\\circ', { radiusPx: 13 });
    }
    const fmt = (vals: Surd[]) => vals.map((v, i) => m(`${vars[i]} = ${v.tex()}`)).join(', ');
    const answer = fmt(unknowns.map((r) => sides[r]));
    // common mistakes: swapping √2/√3 roles, multiplying instead of dividing, swapping x and y
    const wrongSets: Surd[][] = [
      [...unknowns].reverse().map((r) => sides[r]),
      unknowns.map((r) => (r === 'hyp' ? sides.hyp.times(new Frac(1, 2)).timesRoot(kind === '45' ? 1 : 3) : sides[r].timesRoot(kind === '45' ? 2 : 3))),
      unknowns.map((r) => (r === 'hyp' ? (kind === '45' ? s.times(2) : s.timesRoot(2)) : r === 'long' ? (kind === '45' ? s.timesRoot(2) : s.times(2)) : given.timesRoot(2))),
      unknowns.map((r) => sides[r].times(2)),
    ];
    const steps: string[] = [];
    if (kind === '45') steps.push('In a 45°-45°-90° triangle the legs are equal and the hypotenuse is $\\sqrt{2}$ times a leg.');
    else steps.push('In a 30°-60°-90° triangle the hypotenuse is twice the short leg and the long leg is $\\sqrt{3}$ times the short leg.');
    if (givenRole !== 'short') steps.push(m(`${kind === '45' ? '\\text{leg}' : '\\text{short leg}'} = ${s.tex()}`));
    steps.push(answer);
    const lengths: Array<[Pt, Pt, string]> = (['long', 'short', 'hyp'] as Role[]).map((r) => [seg[r][0], seg[r][1], labelOf(r)]);
    return {
      question: kind === '45' ? `Find $x$ and $y$.` : `Find $x$ and $y$.`,
      answer,
      steps,
      distractors: distinctDistractors(answer, wrongSets.map(fmt), (n) => fmt(unknowns.map((r) => sides[r].times(n + 2)))),
      diagram: b.build(kind === '45' ? '45-45-90 right triangle' : '30-60-90 right triangle'),
      check: { kind: 'geometry.solve', eqs: [], lengths, angles: [[R, A, B, kind === '45' ? '45' : '30']], given: [given.tex()] },
    };
  },
});

// ---------------------------------------------------------------- angles of elevation and depression

type Q3 = 'h' | 'd' | 's' | 'angle';
interface Context {
  kind: 'elevation' | 'depression';
  /** what is given (besides the angle) and what is asked */
  known: Array<'h' | 'd' | 's'>;
  ask: Q3;
  unit: string;
  range: [number, number];
  text: (v: Record<string, string>, name: string) => string;
}

const NAMES = ['Ava', 'Jamal', 'Priya', 'Mateo', 'Lena', 'Kenji', 'Sofia', 'Omar', 'Grace', 'Diego', 'Noor', 'Ethan'];

const CONTEXTS: Context[] = [
  { kind: 'elevation', known: ['d'], ask: 'h', unit: 'ft', range: [20, 120], text: (v) => `From a point ${v.d} from the base of a tree, the angle of elevation to the top of the tree is ${v.angle}. How tall is the tree?` },
  { kind: 'elevation', known: ['s'], ask: 'h', unit: 'm', range: [30, 150], text: (v) => `A kite string is ${v.s} long and makes an angle of elevation of ${v.angle} with the ground. How high is the kite?` },
  { kind: 'elevation', known: ['d'], ask: 's', unit: 'm', range: [25, 200], text: (v, n) => `${n} stands ${v.d} from the base of a building and sees the top of the building at an angle of elevation of ${v.angle}. How far is it in a straight line from ${n} to the top of the building?` },
  { kind: 'elevation', known: ['h'], ask: 'd', unit: 'm', range: [30, 140], text: (v) => `From a boat, the angle of elevation to the top of a ${v.h} cliff is ${v.angle}. How far is the boat from the base of the cliff?` },
  { kind: 'elevation', known: ['s'], ask: 'h', unit: 'ft', range: [12, 40], text: (v) => `A ${v.s} ladder leans against a wall, making an angle of ${v.angle} with the ground. How high up the wall does the ladder reach?` },
  { kind: 'depression', known: ['h'], ask: 'd', unit: 'ft', range: [60, 250], text: (v) => `From the top of a ${v.h} lighthouse, the angle of depression to a boat is ${v.angle}. How far is the boat from the base of the lighthouse?` },
  { kind: 'depression', known: ['h'], ask: 's', unit: 'ft', range: [800, 5000], text: (v) => `A plane flying at an altitude of ${v.h} spots the start of a runway at an angle of depression of ${v.angle}. How far is the plane from the runway, in a straight line?` },
  { kind: 'depression', known: ['h'], ask: 'd', unit: 'm', range: [20, 120], text: (v) => `A drone hovering ${v.h} above a field spots a hiker at an angle of depression of ${v.angle}. How far is the hiker from the point directly below the drone?` },
  { kind: 'depression', known: ['d'], ask: 'h', unit: 'm', range: [40, 300], text: (v, n) => `${n}, at the top of a tower, sees a car ${v.d} from the base of the tower at an angle of depression of ${v.angle}. How tall is the tower?` },
  { kind: 'elevation', known: ['s', 'h'], ask: 'angle', unit: 'ft', range: [10, 40], text: (v) => `A ${v.s} ramp rises ${v.h} from the ground. What angle of elevation does the ramp make with the ground?` },
  { kind: 'depression', known: ['h', 'd'], ask: 'angle', unit: 'm', range: [20, 200], text: (v, n) => `${n} looks down from a window ${v.h} above the ground at a bench ${v.d} from the base of the building. What is the angle of depression?` },
  { kind: 'elevation', known: ['d', 'h'], ask: 'angle', unit: 'ft', range: [30, 200], text: (v) => `A flagpole ${v.h} tall casts a shadow ${v.d} long. What is the angle of elevation of the sun?` },
];

const FN = { sin: Math.sin, cos: Math.cos, tan: Math.tan };
const rad = (d: number) => (d * Math.PI) / 180;
const degOf = (r: number) => (r * 180) / Math.PI;

export const elevationDepression = defineTopic({
  id: 'geo.elevation-depression',
  subject: 'geometry',
  category: 'Right Triangles and Trigonometry',
  title: 'Angles of Elevation and Depression',
  description: 'Right-triangle trigonometry word problems with angles of elevation and depression.',
  instruction: 'Solve each problem. Round lengths and angles to the nearest tenth.',
  multipleChoice: true,
  defaultCount: 6,
  options: [{ type: 'boolean', id: 'angles', label: 'Include finding the angle', default: true }],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const allowAngle = boolOpt(ctx, 'angles') && difficulty !== 'easy';
    const pool = CONTEXTS.filter((c) => (c.ask === 'angle' ? allowAngle && (difficulty === 'hard' || rng.bool(0.4)) : difficulty !== 'easy' || c.ask === 'h' || c.ask === 'd'));
    const c = rng.pick(pool);
    const name = rng.pick(NAMES);
    return c.ask === 'angle' ? angleProblem(rng, c, name, difficulty === 'hard') : sideProblem(rng, c, name, difficulty === 'hard');
  },
});

function sideProblem(rng: Rng, c: Context, name: string, hard: boolean): ProblemContent {
  const theta = rng.int(hard ? 8 : 15, hard ? 78 : 70);
  const kn = c.known[0]!;
  const kv = hard ? rng.int(c.range[0], c.range[1]) + rng.pick([0, 0.5]) : rng.int(c.range[0], c.range[1]);
  const t = rad(theta);
  // triangle: h opposite θ, d adjacent, s hypotenuse
  const tri = kn === 'h' ? { h: kv, d: kv / Math.tan(t), s: kv / Math.sin(t) } : kn === 'd' ? { h: kv * Math.tan(t), d: kv, s: kv / Math.cos(t) } : { h: kv * Math.sin(t), d: kv * Math.cos(t), s: kv };
  const ask = c.ask as 'h' | 'd' | 's';
  const val = tri[ask];
  const pair = new Set([kn, ask]);
  const fn: 'sin' | 'cos' | 'tan' = pair.has('h') && pair.has('d') ? 'tan' : pair.has('h') ? 'sin' : 'cos';
  const num = fn === 'tan' ? 'h' : fn === 'sin' ? 'h' : 'd';
  const den = fn === 'tan' ? 'd' : 's';
  const frac = (n: string, d: string) => `\\frac{${n}}{${d}}`;
  const sym = (q: string) => (q === ask ? 'x' : String(kv));
  const eq = `\\${fn}(${theta}^\\circ) = ${frac(sym(num), sym(den))}`;
  const solved = num === ask ? `${kv}\\${fn}(${theta}^\\circ)` : `\\frac{${kv}}{\\${fn}(${theta}^\\circ)}`;
  const fmt = (v: number) => {
    const r = roundTo(v, 1);
    return m(`${Math.abs(r - v) > 1e-9 ? '\\approx ' : ''}${withUnit(decimal(v, 1), c.unit)}`);
  };
  const answer = fmt(val);
  const f = FN[fn](t);
  const other = fn === 'tan' ? Math.sin(t) : fn === 'sin' ? Math.tan(t) : Math.sin(t);
  const wrong = [num === ask ? kv / f : kv * f, num === ask ? kv * other : kv / other, num === ask ? kv * FN[fn](rad(90 - theta)) : kv / FN[fn](rad(90 - theta))];
  const v = { h: withUnit(String(kv), c.unit), d: withUnit(String(kv), c.unit), s: withUnit(String(kv), c.unit), angle: `${theta}^\\circ` };
  const vv = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, `$${x}$`]));
  const what = { h: 'the height', d: 'the horizontal distance', s: 'the line-of-sight distance' };
  return {
    question: c.text(vv, name),
    answer,
    steps: [
      `Let $x$ be ${what[ask]}.${c.kind === 'depression' ? ` The angle of depression equals the angle of elevation from the ground, $${theta}^\\circ$.` : ''}`,
      m(eq),
      m(`x = ${solved} \\approx ${decimal(val, 1)}`),
    ],
    distractors: distinctDistractors(answer, wrong.filter((w) => w > 0).map(fmt), (n) => fmt(val + n * 1.7)),
    check: { kind: 'geometry.solve', eqs: [eq], names: { '': 'x' }, given: [String(kv), `${theta}^\\circ`] },
  };
}

function angleProblem(rng: Rng, c: Context, name: string, hard: boolean): ProblemContent {
  const { tri } = attempt('elev-angle', () => {
    const big = rng.int(c.range[0], c.range[1]);
    const small = rng.int(Math.max(2, Math.round(big * 0.12)), Math.round(big * 0.85));
    const has = (q: string) => c.known.includes(q as 'h');
    // pair (h, s): s is the larger; (h, d): any
    let tri: { h: number; d?: number; s?: number };
    if (has('s')) tri = { h: small, s: big };
    else tri = rng.bool() ? { h: small, d: big } : { h: big, d: small };
    const th = has('s') ? Math.asin(tri.h / tri.s!) : Math.atan(tri.h / tri.d!);
    if (degOf(th) < 4 || degOf(th) > 80) return null;
    if (hard === false && degOf(th) < 8) return null;
    return { tri };
  });
  const fn: 'sin' | 'tan' = tri.s !== undefined ? 'sin' : 'tan';
  const den = (tri.s ?? tri.d)!;
  const ratio = `\\frac{${tri.h}}{${den}}`;
  const theta = degOf(fn === 'sin' ? Math.asin(tri.h / den) : Math.atan(tri.h / den));
  const fmt = (v: number) => m(`\\approx ${decimal(v, 1)}^\\circ`);
  const answer = fmt(theta);
  const v = { h: `$${withUnit(String(tri.h), c.unit)}$`, d: `$${withUnit(String(tri.d ?? 0), c.unit)}$`, s: `$${withUnit(String(tri.s ?? 0), c.unit)}$`, angle: '' };
  const r = tri.h / den;
  const wrong = [90 - theta, degOf(fn === 'sin' ? Math.atan(r) : Math.asin(Math.min(r, 0.99))), degOf(fn === 'sin' ? Math.acos(r) : Math.atan(1 / r))];
  return {
    question: c.text(v, name),
    answer,
    steps: [`Let $x$ be the angle.${c.kind === 'depression' ? ' The angle of depression equals the angle of elevation from the ground.' : ''}`, m(`\\${fn}(x^\\circ) = ${ratio}`), m(`x = \\${fn}^{-1}\\left(${ratio}\\right) \\approx ${decimal(theta, 1)}^\\circ`)],
    distractors: distinctDistractors(answer, wrong.map(fmt), (n) => fmt(theta + n * 2.3)),
    check: { kind: 'geometry.solve', eqs: [`\\${fn}(x^\\circ) = ${ratio}`], names: { '': 'x' }, given: [String(tri.h), String(den)] },
  };
}

