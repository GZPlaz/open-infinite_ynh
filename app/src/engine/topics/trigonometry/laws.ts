/** Oblique triangles: the Law of Sines (incl. the ambiguous case), the Law of Cosines, and triangle area. */
import { attempt, boolOpt, defineTopic, distinctDistractors, opt, strOpt, UNITS } from '../../generator';
import type { Rng } from '../../rng';
import { decimal, m, roundTo, withUnit } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { triangleFigure, type Tri } from './figures';
import { ANGLES, givenTex, isAngle, measureTex, partTex, SIDES, solveTriangle, type Givens, type Part } from './triangle';

const CATEGORY = 'Laws of Sines and Cosines';
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const OPP: Record<Part, Part> = { A: 'a', B: 'b', C: 'c', a: 'A', b: 'B', c: 'C' };

type Config = 'AAS' | 'ASA' | 'SAS' | 'SSS' | 'SSA';

const sideMax: Record<Difficulty, number> = { easy: 20, medium: 30, hard: 45 };

/** A random triangle with "nice" givens of the requested configuration (SSA: a unique triangle). */
function randomTriangle(rng: Rng, d: Difficulty, config: Config): { g: Givens; tri: Tri } {
  return attempt('triangle', () => {
    const L = () => (d === 'hard' && rng.bool(0.4) ? rng.int(40, sideMax[d] * 10) / 10 : rng.int(4, sideMax[d]));
    const ang = (lo: number, hi: number) => rng.int(lo, hi);
    const names = rng.shuffle(ANGLES);
    const [P, Q, R] = names as [Part, Part, Part];
    const p = OPP[P];
    const q = OPP[Q];
    const r = OPP[R];
    let g: Givens;
    if (config === 'AAS' || config === 'ASA') {
      const x = ang(20, 110);
      const y = ang(20, 140 - x + 10);
      if (x + y > 160) return null;
      // ASA: side between the two angles (opposite the third); AAS: side opposite one of them
      g = { [P]: x, [Q]: y, [config === 'ASA' ? r : p]: L() };
    } else if (config === 'SAS') {
      g = { [p]: L(), [q]: L(), [R]: ang(d === 'easy' ? 30 : 20, d === 'easy' ? 120 : 150) };
    } else if (config === 'SSS') {
      g = { [p]: L(), [q]: L(), [r]: L() };
      const [x, y, z] = [g[p]!, g[q]!, g[r]!].sort((u, v) => u - v);
      if (x! + y! <= z! * 1.12) return null;
    } else {
      // SSA with a unique triangle: the side opposite the given angle is the longer one
      const A0 = ang(25, 130);
      const s1 = L();
      const s2 = L();
      if (s1 <= s2 * 1.05) return null;
      g = { [P]: A0, [p]: s1, [q]: s2 };
    }
    const sols = solveTriangle(g);
    if (sols.length !== 1) return null;
    const tri = sols[0]!;
    if (Math.min(tri.A, tri.B, tri.C) < 12 || Math.max(tri.a, tri.b, tri.c) > 3.5 * Math.min(tri.a, tri.b, tri.c)) return null;
    return { g, tri };
  });
}

function figureFor(rng: Rng, tri: Tri, g: Givens, asked: Part[], unit?: string) {
  const sideLabel = (s: Part) => (g[s] !== undefined ? withUnit(String(g[s]), unit) : asked.includes(s) ? s : '');
  const angleLabel = (a: Part) => (g[a] !== undefined ? `${g[a]}^\\circ` : '');
  return triangleFigure(
    rng,
    tri,
    { names: ['A', 'B', 'C'], sides: [sideLabel('a'), sideLabel('b'), sideLabel('c')], angles: [angleLabel('A'), angleLabel('B'), angleLabel('C')] },
    `Triangle ABC with ${Object.entries(g)
      .map(([k, v]) => `${isAngle(k as Part) ? 'angle ' : 'side '}${k} = ${v}`)
      .join(', ')}`,
  );
}

const givensTex = (g: Givens, unit?: string) =>
  [...ANGLES, ...SIDES]
    .filter((p) => g[p] !== undefined)
    .map((p) => m(givenTex(p, g[p]!, unit)))
    .join(', ');

const ansOne = (p: Part, v: number) => m(measureTex(p, v));

/** Unknown parts of a triangle in display order. */
const unknownsOf = (g: Givens): Part[] => [...ANGLES, ...SIDES].filter((p) => g[p] === undefined);

const listAll = (t: Tri, parts: Part[], sub = '') => parts.map((p) => m(measureTex(p, t[p], sub))).join(', ');

/** Plausible wrong full solutions (for "solve the triangle" answers). */
function wrongSolutions(t: Tri, parts: Part[]): string[] {
  const ang = parts.filter(isAngle);
  const sid = parts.filter((p) => !isAngle(p));
  const swap = (list: Part[]): Tri | null => {
    if (list.length < 2) return null;
    const x = { ...t };
    x[list[0]!] = t[list[1]!];
    x[list[1]!] = t[list[0]!];
    return x;
  };
  const out: Array<Tri | null> = [swap(ang), swap(sid)];
  if (ang.length) {
    const x = { ...t };
    x[ang[0]!] = 180 - t[ang[0]!];
    out.push(x);
  }
  const s = { ...t };
  for (const p of sid) s[p] = t[p] * 1.12;
  out.push(s);
  return out.filter((x): x is Tri => x !== null).map((x) => listAll(x, parts));
}

const perturb = (t: Tri, parts: Part[], k: number): string => {
  const x = { ...t };
  for (const p of parts) x[p] = isAngle(p) ? t[p] + k : t[p] * (1 + 0.07 * k);
  return listAll(x, parts);
};

// ---------------------------------------------------------------- law of sines

/** SSA: givens A (angle), a (opposite), b, with a requested number of triangles. */
function ambiguous(rng: Rng): { g: Givens; sols: Tri[] } {
  return attempt('ssa', () => {
    const count = rng.pick([0, 1, 2, 2]);
    const obtuse = count < 2 && rng.bool(0.25);
    const A = obtuse ? rng.int(95, 140) : rng.int(25, 70);
    const b = rng.int(8, 40);
    const h = b * Math.sin(rad(A));
    let a: number;
    if (obtuse) a = count === 1 ? rng.int(b + 1, b + 15) : rng.int(Math.max(3, b - 15), b);
    else if (count === 0) a = rng.int(3, Math.max(3, Math.floor(h - 0.5)));
    else if (count === 1) a = rng.int(b, b + 15);
    else {
      // h is within half a unit of b for angles near 90°: no whole-number side fits, draw again
      if (Math.ceil(h + 0.5) > b - 1) return null;
      a = rng.int(Math.ceil(h + 0.5), b - 1);
    }
    const g: Givens = { A, a, b };
    const sols = solveTriangle(g);
    if (sols.length !== count) return null;
    const sinB = (b * Math.sin(rad(A))) / a;
    if (Math.abs(sinB - 1) < 0.03) return null;
    if (sols.some((t) => Math.min(t.A, t.B, t.C) < 3)) return null;
    return { g, sols };
  });
}

function ambiguousAnswer(sols: Tri[], parts: Part[]): string {
  if (sols.length === 0) return 'No triangle';
  if (sols.length === 1) return `One triangle: ${listAll(sols[0]!, parts)}`;
  return `Two triangles: ${listAll(sols[0]!, parts, '1')}; ${listAll(sols[1]!, parts, '2')}`;
}

export const lawOfSines = defineTopic({
  id: 'trig.laws.sines',
  subject: 'trigonometry',
  title: 'The Law of Sines',
  description: 'Find missing sides and angles with the Law of Sines, including the ambiguous case (SSA).',
  category: CATEGORY,
  instruction: (o) =>
    o.task === 'ambiguous'
      ? 'State the number of possible triangles, then solve each triangle. Round to the nearest tenth.'
      : 'Find each measurement indicated. Round your answers to the nearest tenth.',
  multipleChoice: true,
  defaultCount: 8,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Find',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed (by difficulty)' },
        { value: 'side', label: 'A missing side (AAS / ASA)' },
        { value: 'angle', label: 'A missing angle (SSA, one triangle)' },
        { value: 'ambiguous', label: 'Ambiguous case: 0, 1 or 2 triangles' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const t = strOpt(ctx, 'task');
    const task =
      t === 'side' || t === 'angle' || t === 'ambiguous'
        ? t
        : difficulty === 'easy'
          ? 'side'
          : difficulty === 'medium'
            ? rng.pick(['side', 'angle'] as const)
            : rng.pick(['side', 'angle', 'ambiguous'] as const);

    if (task === 'ambiguous') {
      const { g, sols } = ambiguous(rng);
      const parts: Part[] = ['B', 'C', 'c'];
      const answer = ambiguousAnswer(sols, parts);
      const sinB = (g.b! * Math.sin(rad(g.A!))) / g.a!;
      const steps = [m(`\\sin B = \\frac{${g.b}\\sin ${g.A}^\\circ}{${g.a}} \\approx ${decimal(sinB, 4)}`)];
      if (sinB > 1) steps.push(`Since ${m('\\sin B > 1')}, no triangle exists.`);
      else if (sols.length === 0) steps.push(`${m('\\angle A')} is obtuse and ${m(`a \\le b`)}, so no triangle exists.`);
      else {
        const B1 = deg(Math.asin(sinB));
        steps.push(m(`m\\angle B \\approx ${decimal(B1)}^\\circ \\text{ or } m\\angle B \\approx ${decimal(180 - B1)}^\\circ`));
        steps.push(sols.length === 2 ? 'Both angles fit with the given angle, so there are two triangles.' : `Only ${m(`${decimal(sols[0]!.B)}^\\circ`)} leaves room for the third angle, so there is one triangle.`);
        sols.forEach((s, i) => steps.push(m(`m\\angle C${sols.length === 2 ? `_{${i + 1}}` : ''} \\approx ${decimal(s.C)}^\\circ, \\; c${sols.length === 2 ? `_{${i + 1}}` : ''} = \\frac{${g.a}\\sin C}{\\sin ${g.A}^\\circ} \\approx ${decimal(s.c)}`)));
      }
      const fake = (h: Givens) => ambiguousAnswer(solveTriangle(h), parts);
      return {
        question: `${givensTex(g)}`,
        answer,
        steps,
        distractors: distinctDistractors(
          answer,
          [fake({ A: g.A, a: g.b, b: g.a }), fake({ A: g.A, a: roundTo(g.a! * 1.3, 0), b: g.b }), fake({ A: g.A, a: Math.max(2, roundTo(g.a! * 0.8, 0)), b: g.b }), fake({ A: g.A, a: roundTo(g.a! * 1.6, 0), b: g.b })],
          // step in units of b so that a "no triangle" problem eventually yields triangles to show as wrong choices
          (k) => fake({ A: g.A, a: roundTo(g.a! + (k * g.b!) / 10, 1), b: g.b }),
        ),
        check: { kind: 'trigonometry.triangle', ambiguous: true },
      };
    }

    const { g, tri } = randomTriangle(rng, difficulty, task === 'side' ? rng.pick(['AAS', 'ASA'] as const) : 'SSA');
    const unknown = unknownsOf(g);
    let target: Part;
    let steps: string[];
    let wrong: number[];
    if (task === 'side') {
      target = rng.pick(unknown.filter((p) => !isAngle(p)));
      const known = SIDES.find((s) => g[s] !== undefined)!;
      const K = OPP[known];
      const T = OPP[target];
      const third = ANGLES.find((a) => g[a] === undefined)!;
      steps = [];
      if (g[K] === undefined || g[T] === undefined) steps.push(m(`m\\angle ${third} = 180^\\circ - ${ANGLES.filter((a) => g[a] !== undefined).map((a) => `${g[a]}^\\circ`).join(' - ')} = ${decimal(tri[third])}^\\circ`));
      steps.push(m(`\\frac{${target}}{\\sin ${decimal(tri[T])}^\\circ} = \\frac{${g[known]}}{\\sin ${decimal(tri[K])}^\\circ}`), m(`${target} = \\frac{${g[known]}\\sin ${decimal(tri[T])}^\\circ}{\\sin ${decimal(tri[K])}^\\circ} \\approx ${decimal(tri[target])}`));
      const k = tri[known];
      const sT = Math.sin(rad(tri[T]));
      const sK = Math.sin(rad(tri[K]));
      const other = ANGLES.find((a) => a !== T && a !== K)!;
      wrong = [(k * sK) / sT, (k * Math.sin(rad(tri[other]))) / sK, k * sT, (k * sT) / Math.sin(rad(tri[other]))];
    } else {
      // SSA: the angle opposite the shorter given side
      const sides = SIDES.filter((s) => g[s] !== undefined);
      const A0 = ANGLES.find((a) => g[a] !== undefined)!;
      const s1 = OPP[A0];
      const s2 = sides.find((s) => s !== s1)!;
      target = OPP[s2];
      const v = tri[target];
      steps = [
        m(`\\frac{\\sin ${target}}{${g[s2]}} = \\frac{\\sin ${g[A0]}^\\circ}{${g[s1]}}`),
        m(`m\\angle ${target} = \\sin^{-1}\\left(\\frac{${g[s2]}\\sin ${g[A0]}^\\circ}{${g[s1]}}\\right) \\approx ${decimal(v)}^\\circ`),
      ];
      const ratio = g[s1]! / g[s2]!;
      wrong = [180 - v, 180 - v - g[A0]!, 90 - v, ratio * Math.sin(rad(g[A0]!)) <= 1 ? deg(Math.asin(ratio * Math.sin(rad(g[A0]!)))) : v + 7];
    }
    const answer = ansOne(target, tri[target]);
    return {
      question: `${givensTex(g)}. Find ${m(partTex(target))}.`,
      answer,
      steps,
      distractors: distinctDistractors(answer, wrong.filter((w) => w > 0).map((w) => ansOne(target, w)), (k) => ansOne(target, tri[target] * (1 + 0.09 * k))),
      diagram: figureFor(rng, tri, g, [target]),
      check: { kind: 'trigonometry.triangle' },
    };
  },
});

// ---------------------------------------------------------------- law of cosines

export const lawOfCosines = defineTopic({
  id: 'trig.laws.cosines',
  subject: 'trigonometry',
  title: 'The Law of Cosines',
  description: 'Find a side from two sides and the included angle (SAS) or an angle from three sides (SSS).',
  category: CATEGORY,
  instruction: (o) => (o.task === 'solve' ? 'Solve each triangle. Round your answers to the nearest tenth.' : 'Find each measurement indicated. Round your answers to the nearest tenth.'),
  multipleChoice: true,
  defaultCount: 8,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Find',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed (by difficulty)' },
        { value: 'side', label: 'A missing side (SAS)' },
        { value: 'angle', label: 'A missing angle (SSS)' },
        { value: 'solve', label: 'Solve the whole triangle' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const t = strOpt(ctx, 'task');
    const task = t === 'side' || t === 'angle' || t === 'solve' ? t : difficulty === 'hard' ? rng.pick(['side', 'angle', 'solve'] as const) : rng.pick(['side', 'angle'] as const);
    const config: Config = task === 'side' ? 'SAS' : task === 'angle' ? 'SSS' : rng.pick(['SAS', 'SSS'] as const);
    const { g, tri } = randomTriangle(rng, difficulty, config);
    const unknown = unknownsOf(g);

    if (task === 'solve') {
      const answer = listAll(tri, unknown);
      const steps: string[] = [];
      if (config === 'SAS') {
        const s = unknown.find((p) => !isAngle(p))!;
        const [p, q] = SIDES.filter((x) => x !== s);
        steps.push(m(`${s} = \\sqrt{${g[p!]}^{2} + ${g[q!]}^{2} - 2(${g[p!]})(${g[q!]})\\cos ${g[OPP[s]]}^\\circ} \\approx ${decimal(tri[s])}`));
      }
      const [first, second] = unknown.filter(isAngle);
      const [x, y, z] = [OPP[first!], ...SIDES.filter((s) => s !== OPP[first!])];
      steps.push(m(`\\cos ${first} = \\frac{${decimal(tri[y!])}^{2} + ${decimal(tri[z!])}^{2} - ${decimal(tri[x!])}^{2}}{2(${decimal(tri[y!])})(${decimal(tri[z!])})} \\Rightarrow m\\angle ${first} \\approx ${decimal(tri[first!])}^\\circ`));
      if (second) steps.push(m(`m\\angle ${second} = 180^\\circ - ${ANGLES.filter((a) => a !== second).map((a) => `${decimal(tri[a])}^\\circ`).join(' - ')} \\approx ${decimal(tri[second])}^\\circ`));
      return {
        question: givensTex(g),
        answer,
        steps,
        distractors: distinctDistractors(answer, wrongSolutions(tri, unknown), (k) => perturb(tri, unknown, k)),
        diagram: figureFor(rng, tri, g, unknown.filter((p) => !isAngle(p))),
        check: { kind: 'trigonometry.triangle' },
      };
    }

    if (task === 'side') {
      const target = unknown.find((p) => !isAngle(p))!;
      const [p, q] = SIDES.filter((x) => x !== target);
      const A0 = g[OPP[target]]!;
      const P = g[p!]!;
      const Q = g[q!]!;
      const answer = ansOne(target, tri[target]);
      const c2 = P * P + Q * Q - 2 * P * Q * Math.cos(rad(A0));
      return {
        question: `${givensTex(g)}. Find ${m(target)}.`,
        answer,
        steps: [m(`${target}^{2} = ${P}^{2} + ${Q}^{2} - 2(${P})(${Q})\\cos ${A0}^\\circ \\approx ${decimal(c2, 2)}`), m(`${target} \\approx ${decimal(tri[target])}`)],
        distractors: distinctDistractors(
          answer,
          [Math.sqrt(P * P + Q * Q), Math.sqrt(P * P + Q * Q + 2 * P * Q * Math.cos(rad(A0))), c2, Math.sqrt(Math.abs(P * P + Q * Q - P * Q * Math.cos(rad(A0))))].map((v) => ansOne(target, v)),
          (k) => ansOne(target, tri[target] * (1 + 0.08 * k)),
        ),
        diagram: figureFor(rng, tri, g, [target]),
        check: { kind: 'trigonometry.triangle' },
      };
    }

    // SSS: find an angle (hard: often the largest)
    const target = difficulty === 'hard' ? ANGLES.reduce((x, y) => (tri[x] >= tri[y] ? x : y)) : rng.pick(ANGLES);
    const x = OPP[target];
    const [y, z] = SIDES.filter((s) => s !== x);
    const X = g[x]!;
    const Y = g[y!]!;
    const Z = g[z!]!;
    const cosv = (Y * Y + Z * Z - X * X) / (2 * Y * Z);
    const answer = ansOne(target, tri[target]);
    const others = ANGLES.filter((a) => a !== target);
    return {
      question: `${givensTex(g)}. Find ${m(partTex(target))}.`,
      answer,
      steps: [m(`\\cos ${target} = \\frac{${Y}^{2} + ${Z}^{2} - ${X}^{2}}{2(${Y})(${Z})} \\approx ${decimal(cosv, 4)}`), m(`m\\angle ${target} = \\cos^{-1}(${decimal(cosv, 4)}) \\approx ${decimal(tri[target])}^\\circ`)],
      distractors: distinctDistractors(answer, [180 - tri[target], tri[others[0]!], tri[others[1]!], deg(Math.acos(Math.max(-1, Math.min(1, (X * X + Y * Y - Z * Z) / (2 * X * Y)))))].map((v) => ansOne(target, v)), (k) => ansOne(target, tri[target] + 3 * k)),
      diagram: figureFor(rng, tri, g, []),
      check: { kind: 'trigonometry.triangle' },
    };
  },
});

// ---------------------------------------------------------------- area and mixed solving

export const triangleArea = defineTopic({
  id: 'trig.laws.area',
  subject: 'trigonometry',
  title: 'Area and Laws of Sines and Cosines',
  description: 'Find triangle areas with ½ab sin C and Heron’s formula, and solve triangles with either law.',
  category: CATEGORY,
  instruction: (o) => (o.task === 'solve' ? 'Solve each triangle. Round your answers to the nearest tenth.' : o.task === 'any' ? 'Find each indicated measure. Round your answers to the nearest tenth.' : 'Find the area of each triangle. Round your answers to the nearest tenth.'),
  multipleChoice: true,
  defaultCount: 8,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Find',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'sas', label: 'Area from two sides and the included angle' },
        { value: 'heron', label: "Area from three sides (Heron's formula)" },
        { value: 'asa', label: 'Area from two angles and a side' },
        { value: 'solve', label: 'Solve the triangle (either law)' },
      ],
    },
    opt.units(true),
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const unit = boolOpt(ctx, 'units') ? rng.pick(UNITS) : undefined;
    const t = strOpt(ctx, 'task');
    const task =
      t === 'sas' || t === 'heron' || t === 'asa' || t === 'solve'
        ? t
        : difficulty === 'easy'
          ? rng.pick(['sas', 'heron'] as const)
          : rng.pick(['sas', 'heron', 'asa', 'solve'] as const);

    if (task === 'solve') {
      const config = rng.pick<Config>(difficulty === 'easy' ? ['AAS', 'ASA', 'SAS'] : ['AAS', 'ASA', 'SAS', 'SSS', 'SSA']);
      const { g, tri } = randomTriangle(rng, difficulty, config);
      const unknown = unknownsOf(g);
      const answer = listAll(tri, unknown);
      const law = config === 'SAS' || config === 'SSS' ? 'the Law of Cosines' : 'the Law of Sines';
      return {
        question: givensTex(g),
        answer,
        steps: [`${config}: start with ${law}.`, ...unknown.map((p) => m(measureTex(p, tri[p])))],
        distractors: distinctDistractors(answer, wrongSolutions(tri, unknown), (k) => perturb(tri, unknown, k)),
        diagram: figureFor(rng, tri, g, unknown.filter((p) => !isAngle(p))),
        check: { kind: 'trigonometry.triangle' },
      };
    }

    const config: Config = task === 'sas' ? 'SAS' : task === 'heron' ? 'SSS' : rng.pick(['AAS', 'ASA'] as const);
    const { g, tri } = randomTriangle(rng, difficulty, config);
    const area = 0.5 * tri.a * tri.b * Math.sin(rad(tri.C));
    const areaTex = (v: number) => {
      const r = roundTo(v, 1);
      return m(`\\text{Area} ${Math.abs(r - v) > 1e-9 ? '\\approx' : '='} ${withUnit(decimal(v), unit, 2)}`);
    };
    const answer = areaTex(area);
    let steps: string[];
    let wrong: number[];
    if (config === 'SAS') {
      const C0 = ANGLES.find((a) => g[a] !== undefined)!;
      const [p, q] = SIDES.filter((s) => g[s] !== undefined);
      const P = g[p!]!;
      const Q = g[q!]!;
      steps = [m(`\\text{Area} = \\frac{1}{2}(${P})(${Q})\\sin ${g[C0]}^\\circ \\approx ${decimal(area)}`)];
      wrong = [P * Q * Math.sin(rad(g[C0]!)), 0.5 * P * Q, 0.5 * P * Q * Math.abs(Math.cos(rad(g[C0]!)))];
    } else if (config === 'SSS') {
      const s = (tri.a + tri.b + tri.c) / 2;
      const prod = s * (s - tri.a) * (s - tri.b) * (s - tri.c);
      const [a, b, c] = [g.a!, g.b!, g.c!];
      steps = [m(`s = \\frac{${a} + ${b} + ${c}}{2} = ${decimal(s, 2)}`), m(`\\text{Area} = \\sqrt{${decimal(s, 2)}(${decimal(s - a, 2)})(${decimal(s - b, 2)})(${decimal(s - c, 2)})} \\approx ${decimal(area)}`)];
      const P = 2 * s;
      wrong = [prod, Math.sqrt(Math.abs(P * (P - a) * (P - b) * (P - c))), 0.5 * a * b, area * 2];
    } else {
      const known = SIDES.find((x) => g[x] !== undefined)!;
      const third = ANGLES.find((a) => g[a] === undefined)!;
      const [o1, o2] = SIDES.filter((x) => x !== known);
      steps = [
        m(`m\\angle ${third} = ${decimal(tri[third])}^\\circ`),
        m(`${o1} = \\frac{${g[known]}\\sin ${decimal(tri[OPP[o1!]])}^\\circ}{\\sin ${decimal(tri[OPP[known]])}^\\circ} \\approx ${decimal(tri[o1!])}`),
        m(`\\text{Area} = \\frac{1}{2}(${g[known]})(${decimal(tri[o1!])})\\sin ${decimal(tri[OPP[o2!]])}^\\circ \\approx ${decimal(area)}`),
      ];
      wrong = [area * 2, 0.5 * tri[known] * tri[o1!], 0.5 * tri[known] ** 2 * Math.sin(rad(tri[OPP[o2!]]))];
    }
    return {
      question: `${givensTex(g, unit)}. Find the area.`,
      answer,
      steps,
      distractors: distinctDistractors(answer, wrong.map(areaTex), (k) => areaTex(area * (1 + 0.1 * k))),
      diagram: figureFor(rng, tri, g, [], unit),
      check: { kind: 'trigonometry.triangle' },
    };
  },
});
