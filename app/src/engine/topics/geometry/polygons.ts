/** Polygons and quadrilaterals: interior/exterior angle sums, properties of parallelograms. */
import { DiagramBuilder, type Pt } from '../../diagram';
import { attempt, defineTopic, distinctDistractors, offset, strOpt } from '../../generator';
import type { Rng } from '../../rng';
import { linear, m } from '../../tex';
import type { ProblemContent } from '../../types';
import { add, angleLabel, centroid, dirDeg, linDeg, linFor, linSubTex, linTex, linVal, mid, mul, nameVertices, numChoices, randomLetters, rotate, sideText, ticks, type Lin } from './kit';

const POLY_NAMES: Record<number, string> = { 3: 'triangle', 4: 'quadrilateral', 5: 'pentagon', 6: 'hexagon', 7: 'heptagon', 8: 'octagon', 9: 'nonagon', 10: 'decagon', 11: 'hendecagon', 12: 'dodecagon' };
const polyName = (n: number) => POLY_NAMES[n] ?? `${n}-gon`;
const article = (w: string) => (/^[aeiou]/.test(w) || /^(8|11|18)/.test(w) ? 'an' : 'a');

/** n for which a regular n-gon has whole-degree angles. */
const REGULAR = [3, 4, 5, 6, 8, 9, 10, 12, 15, 18, 20, 24, 30, 36, 40, 45, 60, 72, 90];

/** Convex polygon with the given interior angles (degrees, summing to (n − 2)·180), random side lengths. */
function polygonWithAngles(rng: Rng, angles: number[]): Pt[] | null {
  const n = angles.length;
  // heading of side i (from vertex i to i+1)
  const heads: number[] = [0];
  for (let i = 1; i < n; i++) heads.push(heads[i - 1]! + (180 - angles[i]!));
  const lens: number[] = [];
  for (let i = 0; i < n - 2; i++) lens.push(rng.int(6, 12) / 10);
  // solve the last two lengths so that the polygon closes
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n - 2; i++) {
    const d = dirDeg(heads[i]!);
    sx += lens[i]! * d[0];
    sy += lens[i]! * d[1];
  }
  const d1 = dirDeg(heads[n - 2]!);
  const d2 = dirDeg(heads[n - 1]!);
  const det = d1[0] * d2[1] - d1[1] * d2[0];
  if (Math.abs(det) < 1e-6) return null;
  const a = (-sx * d2[1] + sy * d2[0]) / det;
  const b = (-sy * d1[0] + sx * d1[1]) / det;
  if (a < 0.45 || b < 0.45 || a > 1.6 || b > 1.6) return null;
  lens.push(a, b);
  const pts: Pt[] = [[0, 0]];
  for (let i = 0; i < n - 1; i++) pts.push(add(pts[i]!, mul(dirDeg(heads[i]!), lens[i]!)));
  return pts;
}

export const polygonAngles = defineTopic({
  id: 'geo.polygon-angles',
  subject: 'geometry',
  category: 'Polygons and Quadrilaterals',
  title: 'Interior and Exterior Angles of Polygons',
  description: 'Angle sums of polygons, angles of regular polygons, number of sides, and solving for x in a polygon.',
  instruction: 'Find the indicated value.',
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Problems',
      default: 'any',
      choices: [
        { value: 'any', label: 'By difficulty' },
        { value: 'sum', label: 'Interior angle sum' },
        { value: 'each', label: 'One angle of a regular polygon' },
        { value: 'sides', label: 'Number of sides from an angle' },
        { value: 'solve', label: 'Solve for x in a polygon' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const chosen = strOpt(ctx, 'task');
    const task =
      chosen !== 'any'
        ? chosen
        : difficulty === 'easy'
          ? rng.pick(['sum', 'each'])
          : difficulty === 'medium'
            ? rng.pick(['sum', 'each', 'sides', 'solve'])
            : rng.pick(['sides', 'solve', 'each']);
    if (task === 'sum') {
      const n = difficulty === 'easy' ? rng.int(3, 30) : rng.int(5, 60);
      const S = (n - 2) * 180;
      const fmt = (v: number) => m(`${v}^\\circ`);
      const nm = polyName(n);
      return {
        question: `Find the sum of the interior angles of ${article(nm)} ${n > 12 ? `$${n}$-gon` : nm}.`,
        answer: fmt(S),
        steps: [m(`(n - 2) \\cdot 180^\\circ = (${n} - 2) \\cdot 180^\\circ = ${S}^\\circ`)],
        distractors: numChoices(fmt, S, [n * 180, (n - 1) * 180, 360, (n - 3) * 180], { step: 180 }),
        check: { kind: 'geometry.polygon', task, n },
      };
    }
    if (task === 'each') {
      const n = rng.pick(difficulty === 'easy' ? REGULAR.slice(0, 14) : REGULAR.slice(2));
      const ext = rng.bool(difficulty === 'easy' ? 0.3 : 0.5);
      const v = ext ? 360 / n : 180 - 360 / n;
      const fmt = (x: number) => m(`${x}^\\circ`);
      const nm = polyName(n);
      return {
        question: `Find the measure of one ${ext ? 'exterior' : 'interior'} angle of a regular ${n > 12 ? `$${n}$-gon` : nm}.`,
        answer: fmt(v),
        steps: ext ? [m(`\\frac{360^\\circ}{${n}} = ${v}^\\circ`)] : [m(`\\frac{(${n} - 2) \\cdot 180^\\circ}{${n}} = ${v}^\\circ`)],
        distractors: numChoices(fmt, v, [180 - v, ((n - 2) * 180) / n === v ? 360 / n : ((n - 2) * 180) / n, (n - 2) * 180, 360 / (n - 1), 180 / n], { integer: false }),
        check: { kind: 'geometry.polygon', task, n, ext },
      };
    }
    if (task === 'sides') {
      const n = rng.pick(REGULAR.slice(2));
      const ext = rng.bool();
      const v = ext ? 360 / n : 180 - 360 / n;
      const fmt = (x: number) => m(`n = ${x}`);
      return {
        question: `Each ${ext ? 'exterior' : 'interior'} angle of a regular polygon measures $${v}^\\circ$. How many sides does it have?`,
        answer: fmt(n),
        steps: ext ? [m(`n = \\frac{360^\\circ}{${v}^\\circ} = ${n}`)] : [`Each exterior angle is $180^\\circ - ${v}^\\circ = ${180 - v}^\\circ$.`, m(`n = \\frac{360^\\circ}{${180 - v}^\\circ} = ${n}`)],
        distractors: numChoices(fmt, n, [ext ? 360 / (180 - v) : 360 / v, n + 2, n - 2, Math.round(180 / (180 - v))]),
        check: { kind: 'geometry.polygon', task, ext },
      };
    }
    // solve for x in a drawn polygon
    const built = attempt('poly-solve', () => {
      const n = difficulty === 'hard' ? rng.int(5, 7) : rng.int(4, 6);
      const S = (n - 2) * 180;
      const angles: number[] = [];
      for (let i = 0; i < n - 1; i++) angles.push(rng.int(Math.max(60, Math.round(S / n) - 40), Math.min(170, Math.round(S / n) + 35)));
      const last = S - angles.reduce((s, v) => s + v, 0);
      if (last < 60 || last > 170) return null;
      angles.push(last);
      const pts = polygonWithAngles(rng, angles);
      if (!pts) return null;
      const x = rng.int(3, 25);
      // 1 (medium) or 2–3 (hard) angles become expressions in x
      const k = difficulty === 'hard' ? rng.int(2, 3) : 1;
      const idx = rng.sample([...angles.keys()], k);
      const exprs: Array<Lin | null> = angles.map((v, i) => (idx.includes(i) ? linFor(rng, v, x, { aMin: 1, aMax: 5, bMax: 70 }) : null));
      if (idx.some((i) => !exprs[i])) return null;
      return { n, angles, pts, x, exprs, S };
    });
    const { n, angles, x, exprs, S } = built;
    const turn = rng.int(0, 359);
    const pts = built.pts.map((p) => rotate(p, turn));
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const b = new DiagramBuilder((n >= 5 ? 280 : 220) / Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)));
    b.polygon(pts, { weight: 1.4 });
    const labels = angles.map((v, i) => (exprs[i] ? linDeg(exprs[i]!) : `${v}^\\circ`));
    const texs = angles.map((v, i) => (exprs[i] ? linTex(exprs[i]!) : String(v)));
    const angleItems: Array<[Pt, Pt, Pt, string]> = [];
    pts.forEach((v, i) => {
      const pr = pts[(i + n - 1) % n]!;
      const nx = pts[(i + 1) % n]!;
      angleLabel(b, v, pr, nx, labels[i]!, { radiusPx: 12, maxPx: 60 });
      angleItems.push([pr, v, nx, texs[i]!]);
    });
    const A = exprs.reduce((s, e) => s + (e ? e.a : 0), 0);
    const B = exprs.reduce((s, e, i) => s + (e ? e.b : angles[i]!), 0);
    const eq = `${texs.map((t, i) => (exprs[i] ? `(${t})` : t)).join(' + ')} = ${S}`;
    const fmt = (w: number) => m(`x = ${w}`);
    const wrong = [((n - 1) * 180 - B) / A, ((n - 3) * 180 - B) / A, (360 - B) / A, (n * 180 - B) / A];
    return {
      question: `Find $x$. (The figure is a ${polyName(n)}.)`,
      answer: fmt(x),
      steps: [`The interior angles of ${article(polyName(n))} ${polyName(n)} add up to $(${n} - 2) \\cdot 180^\\circ = ${S}^\\circ$.`, m(eq), m(`${linear(A, B)} = ${S}`), m(`x = ${x}`)],
      distractors: numChoices(fmt, x, wrong.filter((w) => w > 0 && exprs.every((e) => !e || linVal(e, w) > 0))),
      diagram: b.build(`A ${polyName(n)} with its interior angles labelled`),
      check: { kind: 'geometry.solve', eqs: [eq], angles: angleItems, given: labels },
    };
  },
});

// ---------------------------------------------------------------- parallelograms

type Part = 'sides' | 'angles' | 'consecutive' | 'diagonals';

export const parallelograms = defineTopic({
  id: 'geo.parallelograms',
  subject: 'geometry',
  category: 'Polygons and Quadrilaterals',
  title: 'Properties of Parallelograms',
  description: 'Opposite sides and angles are congruent, consecutive angles are supplementary, and diagonals bisect each other.',
  instruction: 'Each quadrilateral is a parallelogram. Find the indicated values.',
  multipleChoice: true,
  defaultCount: 8,
  options: [],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const built = attempt('para', () => {
      const a = rng.int(6, 30);
      const c = rng.int(6, 30);
      const ang = rng.int(50, 80);
      if (a / c > 2.2 || c / a > 2.2) return null;
      return { a, c, ang };
    });
    const { a, c, ang } = built;
    // P0P1 = a along the base, P0P3 = c at angle `ang`
    const raw: Pt[] = [[0, 0], [a, 0], add([a, 0], mul(dirDeg(ang), c)), mul(dirDeg(ang), c)];
    const flip = rng.bool();
    const tilt = rng.int(-12, 12);
    const P = raw.map((p) => rotate(flip ? ([a - p[0], p[1]] as Pt) : p, tilt));
    const E = mid(P[0]!, P[2]!);
    const names = randomLetters(rng, 5);
    const nm = names.slice(0, 4);
    const nE = names[4]!;
    const xs = P.map((p) => p[0]);
    const ys = P.map((p) => p[1]);
    const b = new DiagramBuilder(220 / Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)));
    b.polygon(P, { weight: 1.4 });
    nameVertices(b, P, nm);
    const cen = centroid(P);
    const parts: Part[] = difficulty === 'hard' ? rng.sample(['sides', 'angles', 'consecutive', 'diagonals'] as Part[], 2) : [rng.pick(['sides', 'angles', 'consecutive', 'diagonals'] as Part[])];
    if (parts.length === 2 && (parts.includes('diagonals') || (parts.includes('angles') && parts.includes('consecutive')))) {
      parts[0] = parts.includes('diagonals') ? 'diagonals' : parts[0]!;
      parts[1] = 'sides';
    }
    const vars = ['x', 'y'];
    const eqs: string[] = [];
    const lengths: Array<[Pt, Pt, string]> = [];
    const diagLens: Array<[Pt, Pt, string]> = [];
    const angles: Array<[Pt, Pt, Pt, string]> = [];
    const given: string[] = [];
    const steps: string[] = [];
    const answers: Array<{ v: string; val: number; e: Lin | null; quantity: string; qVal: number }> = [];
    const angleAtV = (i: number): [Pt, Pt, Pt] => [P[(i + 3) % 4]!, P[i]!, P[(i + 1) % 4]!];
    const angVal = (i: number) => (i % 2 === 0 ? ang : 180 - ang);
    const easy = difficulty === 'easy';
    const diagDone = { v: false };
    parts.forEach((part, k) => {
      const v = vars[k]!;
      const xv = rng.int(2, 15);
      const make = (value: number) => (easy ? null : linFor(rng, value, xv, { aMin: 1, aMax: 5, bMax: 160 }));
      const tex = (e: Lin | null, value: number) => (e ? linTex(e, v) : String(value));
      if (part === 'sides') {
        const i = rng.int(0, 1); // side P0P1 (and opposite P2P3) or P1P2 (and P3P0)
        const value = i === 0 ? a : c;
        const e1 = make(value);
        const e2 = easy ? null : linFor(rng, value, xv, { aMin: 1, aMax: 7, bMax: 60, avoidA: e1 ? [e1.a] : [] });
        if (!easy && (!e1 || !e2)) throw new Error('retry');
        const t1 = easy ? String(value) : tex(e1, value);
        const t2 = easy ? v : tex(e2, value);
        const [s1, s2] = i === 0 ? [[0, 1], [2, 3]] : [[1, 2], [3, 0]];
        sideText(b, P[s1![0]!]!, P[s1![1]!]!, t1, cen, 4);
        sideText(b, P[s2![0]!]!, P[s2![1]!]!, t2, cen, 4);
        lengths.push([P[s1![0]!]!, P[s1![1]!]!, t1], [P[s2![0]!]!, P[s2![1]!]!, t2]);
        eqs.push(`${t1} = ${t2}`);
        given.push(t1, t2);
        steps.push(`Opposite sides are congruent: $${t1} = ${t2}$`);
        answers.push({ v, val: easy ? value : xv, e: easy ? null : e2, quantity: `${nm[s2![0]!]}${nm[s2![1]!]}`, qVal: value });
      } else if (part === 'angles' || part === 'consecutive') {
        const i = rng.int(0, 3);
        const j = part === 'angles' ? (i + 2) % 4 : (i + 1) % 4;
        const e1 = make(angVal(i));
        const e2 = easy ? null : linFor(rng, angVal(j), xv, { aMin: 1, aMax: 7, bMax: 160, avoidA: part === 'angles' && e1 ? [e1.a] : [] });
        if (!easy && (!e1 || !e2)) throw new Error('retry');
        const t1 = easy ? String(angVal(i)) : tex(e1, angVal(i));
        const t2 = easy ? v : tex(e2, angVal(j));
        const deg = (t: string) => (/^[\d]+$|^[a-z]$/.test(t) ? `${t}^\\circ` : `(${t})^\\circ`);
        angleLabel(b, P[i]!, P[(i + 3) % 4]!, P[(i + 1) % 4]!, deg(t1), { radiusPx: 12, maxPx: 70 });
        angleLabel(b, P[j]!, P[(j + 3) % 4]!, P[(j + 1) % 4]!, deg(t2), { radiusPx: 12, maxPx: 70 });
        angles.push([...angleAtV(i), t1], [...angleAtV(j), t2]);
        eqs.push(part === 'angles' ? `${t1} = ${t2}` : `(${t1}) + (${t2}) = 180`);
        given.push(deg(t1), deg(t2));
        steps.push(part === 'angles' ? `Opposite angles are congruent: $${t1} = ${t2}$` : `Consecutive angles are supplementary: $(${t1}) + (${t2}) = 180$`);
        answers.push({ v, val: easy ? angVal(j) : xv, e: easy ? null : e2, quantity: `m\\angle ${nm[j]}`, qVal: angVal(j) });
      } else {
        if (!diagDone.v) {
          b.segment(P[0]!, P[2]!, { weight: 1 });
          b.segment(P[1]!, P[3]!, { weight: 1 });
          diagDone.v = true;
        }
        const i = rng.int(0, 1); // diagonal P0P2 or P1P3
        // the two halves of one diagonal get equal labels (drawn equal); the scale is free
        const value = rng.int(4, 25);
        const e1 = make(value);
        const e2 = easy ? null : linFor(rng, value, xv, { aMin: 1, aMax: 7, bMax: 60, avoidA: e1 ? [e1.a] : [] });
        if (!easy && (!e1 || !e2)) throw new Error('retry');
        const t1 = easy ? String(value) : tex(e1, value);
        const t2 = easy ? v : tex(e2, value);
        const [u, w] = i === 0 ? [P[0]!, P[2]!] : [P[1]!, P[3]!];
        const other = i === 0 ? P[1]! : P[0]!;
        sideText(b, u, E, t1, other, 3);
        sideText(b, E, w, t2, other, 3);
        diagLens.push([u, E, t1], [E, w, t2]);
        eqs.push(`${t1} = ${t2}`);
        given.push(t1, t2);
        steps.push(`The diagonals bisect each other: $${t1} = ${t2}$`);
        answers.push({ v, val: easy ? value : xv, e: easy ? null : e2, quantity: `${nE}${nm[i === 0 ? 2 : 3]}`, qVal: value });
      }
    });
    if (parts.includes('diagonals')) {
      b.dot(E);
      b.label(add(E, mul([0, -1], b.px(10))), nE, 'c');
    }
    // marks for opposite sides
    ticks(b, P[0]!, P[1]!, 1);
    ticks(b, P[2]!, P[3]!, 1);
    ticks(b, P[1]!, P[2]!, 2);
    ticks(b, P[3]!, P[0]!, 2);
    const withQuantity = !easy;
    const fmt = (vals: number[]) =>
      answers
        .map((ans, k) => {
          const val = vals[k]!;
          if (!ans.e) return m(`${ans.v} = ${val}`);
          const q = linVal(ans.e, val);
          return withQuantity && difficulty === 'medium' ? `${m(`${ans.v} = ${val}`)}, ${m(`${ans.quantity} = ${q}${ans.quantity.startsWith('m') ? '^\\circ' : ''}`)}` : m(`${ans.v} = ${val}`);
        })
        .join(', ');
    const correct = answers.map((a2) => a2.val);
    const names2: Record<string, string> = {};
    if (difficulty === 'medium' && answers[0]!.e) {
      names2[answers[0]!.quantity] = 'L';
      eqs.push(`L = ${linTex(answers[0]!.e, answers[0]!.v)}`);
      steps.push(m(`${answers[0]!.quantity} = ${linSubTex(answers[0]!.e, correct[0]!)} = ${answers[0]!.qVal}${answers[0]!.quantity.startsWith('m') ? '^\\circ' : ''}`));
    }
    steps.push(answers.map((a2) => m(`${a2.v} = ${a2.val}`)).join(', '));
    const answer = fmt(correct);
    const ok = (vals: number[]) => vals.every((w, k) => w > 0 && (!answers[k]!.e || linVal(answers[k]!.e!, w) > 0));
    const wrongs: number[][] = [];
    if (easy) {
      const q0 = answers[0]!;
      wrongs.push([180 - q0.val], [q0.val / 2], [q0.val * 2], [90 - q0.val]);
    } else {
      for (const d of [1, -1, 2, -2, 3]) wrongs.push(correct.map((w, k) => (k === 0 ? w + d : w)));
      if (correct.length === 2) wrongs.unshift([correct[1]!, correct[0]!]);
    }
    return {
      question: `Find ${answers.map((a2) => `$${a2.v}$`).join(' and ')}${difficulty === 'medium' && answers[0]!.e ? ` and $${answers[0]!.quantity}$` : ''}.`,
      answer,
      steps,
      distractors: distinctDistractors(answer, wrongs.filter((w) => w.every(Number.isFinite) && w.every((u) => u > 0) && ok(w)).map(fmt), (k) => fmt(correct.map((w, i) => (i === 0 ? w + offset(k) + 3 : w)))),
      diagram: b.build(`Parallelogram ${nm.join('')}`),
      check: { kind: 'geometry.solve', eqs, names: names2, lengths, ratios: diagLens, angles, given },
    };
  },
});
