/** Circles: central angles and arcs, arc length, sector area, inscribed angles, tangents. */
import { DiagramBuilder, type Pt } from '../../diagram';
import { Frac } from '../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, offset, opt, strOpt } from '../../generator';
import { linear, m, withUnit } from '../../tex';
import type { ProblemContent } from '../../types';
import { formatMeasure, pickUnit, PiExpr, triples } from './common';
import { add, angleLabel, dirDeg, linDeg, linFor, linSubTex, linTex, linVal, mul, numChoices, onCircle, posToward, randomLetters, sideText, sub, unit } from './kit';

// ---------------------------------------------------------------- shared figure helpers

export const O: Pt = [0, 0];

/** Circle of radius 1 at the origin, with a builder scaled to `px` pixels per unit. */
export function circleBuilder(px = 70): DiagramBuilder {
  const b = new DiagramBuilder(px);
  b.circle(O, 1, { weight: 1.4 });
  return b;
}

/** Label outside the unit circle at angle `deg`. */
export function arcLabel(b: DiagramBuilder, deg: number, tex: string, r = 1): void {
  const d = dirDeg(deg);
  b.label(add(mul(d, r), mul(d, b.px(7))), tex, posToward(d));
}

/** Name of a point on the circle, placed just outside it. */
export function pointName(b: DiagramBuilder, p: Pt, name: string, center: Pt = O): void {
  const d = unit(sub(p, center));
  b.label(add(p, mul(d, b.px(9))), name, 'c');
}

export const deg = (t: string): string => (/^\d+$|^[a-z]$/.test(t) ? `${t}^\\circ` : `(${t})^\\circ`);


// ---------------------------------------------------------------- arcs and central angles

export const arcsCentralAngles = defineTopic({
  id: 'geo.arcs',
  subject: 'geometry',
  category: 'Circles',
  title: 'Central Angles and Arc Measures',
  description: 'Measures of minor arcs, major arcs and semicircles from central angles.',
  instruction: 'Find the measure of each arc or the value of x. Segments through the center are diameters.',
  multipleChoice: true,
  defaultCount: 9,
  options: [],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const [nO, nA, nB, nC] = randomLetters(rng, 4) as [string, string, string, string];
    // diameter A–C, radius to B; ∠AOB = p, ∠BOC = 180 − p
    const p = rng.int(25, 155);
    const start = rng.int(0, 359);
    const s = rng.sign();
    const at = (d: number) => start + s * d;
    const A = onCircle(O, 1, at(0));
    const B = onCircle(O, 1, at(p));
    const C = onCircle(O, 1, at(180));
    const b = circleBuilder(75);
    b.segment(A, C, { weight: 1.3 });
    b.segment(O, B, { weight: 1.3 });
    b.dot(O);
    b.label(add(O, mul(dirDeg(at(p) + 180 + s * 0), b.px(11))), nO, 'c');
    for (const [P, n] of [[A, nA], [B, nB], [C, nC]] as Array<[Pt, string]>) {
      b.dot(P);
      pointName(b, P, n);
    }
    const arc = (u: string, v: string) => `m\\overset{\\frown}{${u}${v}}`;
    const arc3 = (u: string, w: string, v: string) => `m\\overset{\\frown}{${u}${w}${v}}`;
    // arcs counterclockwise from one point to another (for the figure check)
    const ccw = (P: Pt, Q: Pt): [Pt, Pt] => (s > 0 ? [P, Q] : [Q, P]);
    if (difficulty === 'easy' || difficulty === 'medium') {
      const showBOC = rng.bool();
      const known = showBOC ? 180 - p : p;
      angleLabel(b, O, showBOC ? B : A, showBOC ? C : B, deg(String(known)), { radiusPx: 14, maxPx: 40 });
      const targets: Array<[string, number, [Pt, Pt]]> = [
        [arc(nA, nB), p, ccw(A, B)],
        [arc(nB, nC), 180 - p, ccw(B, C)],
        [arc3(nA, nC, nB), 360 - p, s > 0 ? [B, A] : [A, B]],
        [arc3(nB, nA, nC), 180 + p, s > 0 ? [C, B] : [B, C]],
      ];
      const pool = difficulty === 'easy' ? targets.slice(0, 2) : targets;
      const [name, val, pair] = rng.pick(pool.filter((t) => difficulty === 'easy' || t[1] !== known));
      const fmt = (v: number) => m(`${name} = ${v}^\\circ`);
      return {
        question: `Find $${name}$.`,
        answer: fmt(val),
        steps: [val === known ? 'A minor arc has the same measure as its central angle.' : val > 180 ? `A major arc measures $360^\\circ$ minus its minor arc.` : `$\\overline{${nA}${nC}}$ is a diameter, so the two arcs add up to $180^\\circ$.`, fmt(val)],
        distractors: numChoices(fmt, val, [180 - val, 360 - val, known, 360 - known, val / 2]),
        diagram: b.build(`Circle ${nO} with diameter ${nA}${nC} and radius ${nO}${nB}`),
        check: {
          kind: 'geometry.solve',
          names: { [name]: 'L' },
          eqs: [`L = ${val === p ? (showBOC ? `180 - ${known}` : String(known)) : val === 180 - p ? (showBOC ? String(known) : `180 - ${known}`) : val === 360 - p ? (showBOC ? `180 + ${known}` : `360 - ${known}`) : showBOC ? `360 - ${known}` : `180 + ${known}`}`],
          arcs: [[O, pair[0], pair[1], 'L']],
          given: [deg(String(known))],
        },
      };
    }
    // hard: both angles as expressions, solve and find an arc
    const built = attempt('arc-expr', () => {
      const x = rng.int(3, 20);
      const e1 = linFor(rng, p, x, { aMin: 1, aMax: 6, bMax: 60 });
      const e2 = linFor(rng, 180 - p, x, { aMin: 1, aMax: 6, bMax: 60 });
      return e1 && e2 ? { x, e1, e2 } : null;
    });
    const { x, e1, e2 } = built;
    angleLabel(b, O, A, B, linDeg(e1), { radiusPx: 14, maxPx: 70 });
    angleLabel(b, O, B, C, linDeg(e2), { radiusPx: 18, maxPx: 70 });
    const target = rng.pick([
      [arc(nA, nB), (w: number) => linVal(e1, w), ccw(A, B), `L = ${linTex(e1)}`],
      [arc(nB, nC), (w: number) => linVal(e2, w), ccw(B, C), `L = ${linTex(e2)}`],
      [arc3(nA, nC, nB), (w: number) => 360 - linVal(e1, w), s > 0 ? [B, A] : [A, B], `L = 360 - (${linTex(e1)})`],
    ] as Array<[string, (w: number) => number, [Pt, Pt], string]>);
    const [name, f, pair, eqL] = target;
    const fmt = (w: number) => `${m(`x = ${w}`)}, ${m(`${name} = ${f(w)}^\\circ`)}`;
    const A2 = e1.a + e2.a;
    const B2 = 180 - e1.b - e2.b;
    return {
      question: `Find $x$ and $${name}$.`,
      answer: fmt(x),
      steps: [`$\\overline{${nA}${nC}}$ is a diameter:`, m(`(${linTex(e1)}) + (${linTex(e2)}) = 180`), m(`${linear(A2, 0)} = ${B2}`), m(`x = ${x}`), m(`${name} = ${f(x)}^\\circ`)],
      distractors: numChoices(fmt, x, [(360 - e1.b - e2.b) / A2, (90 - e1.b - e2.b) / A2, (e2.b - e1.b) / (e1.a - e2.a || 1)].filter((w) => linVal(e1, w) > 0 && linVal(e2, w) > 0 && f(w) > 0)),
      diagram: b.build(`Circle ${nO} with diameter ${nA}${nC} and radius ${nO}${nB}`),
      check: {
        kind: 'geometry.solve',
        names: { [name]: 'L' },
        eqs: [`(${linTex(e1)}) + (${linTex(e2)}) = 180`, eqL],
        arcs: [[O, ...(s > 0 ? [A, B] : [B, A]), linTex(e1)], [O, ...(s > 0 ? [B, C] : [C, B]), linTex(e2)], [O, pair[0], pair[1], 'L']],
        given: [linDeg(e1), linDeg(e2)],
      },
    };
  },
});

// ---------------------------------------------------------------- arc length and sector area

function sectorTopic(kind: 'length' | 'sector') {
  const isLen = kind === 'length';
  return defineTopic({
    id: isLen ? 'geo.arc-length' : 'geo.sector-area',
    subject: 'geometry',
    category: 'Circles',
    title: isLen ? 'Arc Length' : 'Area of Sectors',
    description: isLen ? 'Length of an arc from its central angle and the radius.' : 'Area of a sector from its central angle and the radius.',
    instruction: (o) => `Find the ${isLen ? 'length of each arc' : 'area of each shaded sector'}. ${o.answerForm === 'exact' ? 'Leave your answers in terms of π.' : 'Round to the nearest tenth.'}`,
    multipleChoice: true,
    defaultCount: 8,
    options: [opt.rounding('exact'), opt.units(true)],
    generate(ctx): ProblemContent {
      const { rng, difficulty } = ctx;
      const form = strOpt(ctx, 'answerForm');
      const unitName = pickUnit(rng, boolOpt(ctx, 'units'));
      const theta = difficulty === 'easy' ? rng.pick([30, 45, 60, 90, 120, 135, 150, 180, 210, 240, 270, 300]) : difficulty === 'medium' ? rng.int(4, 34) * 10 : rng.int(15, 345);
      const r = rng.int(2, difficulty === 'easy' ? 12 : 20);
      const useDiameter = difficulty === 'hard' && rng.bool(0.5);
      const start = rng.int(0, 359);
      const A = onCircle(O, 1, start);
      const B = onCircle(O, 1, start + theta);
      const b = new DiagramBuilder(70);
      if (!isLen) {
        const pts: Pt[] = [O];
        for (let k = 0; k <= 48; k++) pts.push(onCircle(O, 1, start + (theta * k) / 48));
        b.polygon(pts, { fill: 'accent', noStroke: true });
      }
      b.circle(O, 1, { weight: 1.4 });
      if (isLen) b.arc(O, 1, start, start + theta, 'accent', 2.6);
      b.segment(O, A, { weight: 1.3 });
      b.segment(O, B, { weight: 1.3 });
      b.dot(O);
      angleLabel(b, O, A, B, deg(String(theta)), { radiusPx: 14, maxPx: 34 });
      if (theta > 180) {
        // the label sits in the reflex angle: angleLabel marks the smaller angle, so redraw for the reflex one
        b.items.splice(b.items.length - 2, 2);
        b.arc(O, b.px(14), start, start + theta);
        const mid = dirDeg(start + theta / 2);
        b.label(mul(mid, b.px(30)), deg(String(theta)), 'c');
      }
      const rLabel = withUnit(String(useDiameter ? 2 * r : r), unitName);
      if (useDiameter) {
        const D1 = onCircle(O, 1, start - 90 + (theta > 180 ? 0 : -60));
        const D2 = sub(O, D1);
        b.segment(D1, D2, { weight: 1, dash: true });
        sideText(b, D1, D2, rLabel, onCircle(O, 1, start + theta / 2), 3);
      } else sideText(b, O, A, rLabel, B, 3);
      const coef = isLen ? new Frac(theta * r, 180) : new Frac(theta * r * r, 360);
      const exact = PiExpr.of(0, coef);
      const sym = isLen ? 'L' : 'A';
      const power = isLen ? 1 : 2;
      const fmt = (v: PiExpr) => {
        const f = formatMeasure(v.value, form, unitName, power, v.toTex());
        return m(`${sym} ${f.approx ? '\\approx' : '='} ${f.tex}`);
      };
      const answer = fmt(exact);
      const wrongs = isLen
        ? [PiExpr.of(0, new Frac(theta * r, 360)), PiExpr.of(0, new Frac(2 * r)), PiExpr.of(0, new Frac(theta * r * r, 360)), PiExpr.of(0, new Frac((360 - theta) * r, 180))]
        : [PiExpr.of(0, new Frac(theta * r, 180)), PiExpr.of(0, new Frac(r * r)), PiExpr.of(0, new Frac(theta * r * r, 180)), PiExpr.of(0, new Frac((360 - theta) * r * r, 360))];
      const rTex = useDiameter ? `\\frac{${2 * r}}{2}` : String(r);
      const eq = isLen ? `${sym} = 2\\pi \\cdot ${rTex} \\cdot \\frac{${theta}}{360}` : `${sym} = \\pi \\cdot \\left(${rTex}\\right)^{2} \\cdot \\frac{${theta}}{360}`;
      return {
        question: isLen ? `Find the length of the ${theta > 180 ? 'major' : theta === 180 ? '' : 'minor'} arc shown in red.`.replace('the  arc', 'the arc') : 'Find the area of the shaded sector.',
        answer,
        steps: [
          ...(useDiameter ? [`The radius is half the diameter: $r = ${r}$.`] : []),
          isLen ? m(`L = 2\\pi r \\cdot \\frac{\\theta}{360^\\circ} = 2\\pi \\cdot ${r} \\cdot \\frac{${theta}}{360}`) : m(`A = \\pi r^{2} \\cdot \\frac{\\theta}{360^\\circ} = \\pi \\cdot ${r}^{2} \\cdot \\frac{${theta}}{360}`),
          answer,
        ],
        distractors: distinctDistractors(answer, wrongs.map(fmt), (k) => fmt(PiExpr.of(0, coef.add(offset(k))))),
        diagram: b.build(isLen ? `Circle with a ${theta} degree central angle; the intercepted arc is highlighted` : `Circle with a shaded ${theta} degree sector`),
        check: { kind: 'geometry.solve', eqs: [eq], given: [rLabel, deg(String(theta))], arcs: [[O, A, B, String(theta)]] },
      };
    },
  });
}

export const arcLength = sectorTopic('length');
export const sectorArea = sectorTopic('sector');

// ---------------------------------------------------------------- inscribed angles

export const inscribedAngles = defineTopic({
  id: 'geo.inscribed-angles',
  subject: 'geometry',
  category: 'Circles',
  title: 'Inscribed Angles',
  description: 'An inscribed angle is half its intercepted arc; angles in a semicircle are right; inscribed quadrilaterals have supplementary opposite angles.',
  instruction: 'Find the indicated value.',
  multipleChoice: true,
  defaultCount: 9,
  options: [],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const [nA, nB, nC, nD] = randomLetters(rng, 4) as [string, string, string, string];
    const variant = difficulty === 'hard' ? rng.pick(['quad', 'same', 'semi']) : 'basic';
    const b = circleBuilder(variant === 'quad' ? 105 : 78);
    const start = rng.int(0, 359);
    const ptAt = (d: number) => onCircle(O, 1, start + d);
    const draw = (P: Pt, n: string) => {
      b.dot(P);
      pointName(b, P, n);
    };
    if (variant === 'quad') {
      // ABCD inscribed in order; ∠A + ∠C = 180
      const built = attempt('quad', () => {
        const arcs = [rng.int(50, 120), rng.int(50, 120), rng.int(50, 120)];
        const last = 360 - arcs[0]! - arcs[1]! - arcs[2]!;
        if (last < 50 || last > 130) return null;
        const all = [...arcs, last];
        // angle at A intercepts arc BCD = arcs[1] + arcs[2]
        const angA = (all[1]! + all[2]!) / 2;
        const angC = (all[3]! + all[0]!) / 2;
        if (!Number.isInteger(angA)) return null;
        const x = rng.int(3, 18);
        const e1 = linFor(rng, angA, x, { aMin: 1, aMax: 6, bMax: 80 });
        const e2 = linFor(rng, angC, x, { aMin: 1, aMax: 6, bMax: 80 });
        if (!e1 || !e2 || e1.a + e2.a === 0) return null;
        return { all, x, e1, e2 };
      });
      const { all, x, e1, e2 } = built;
      const d = [0, all[0]!, all[0]! + all[1]!, all[0]! + all[1]! + all[2]!];
      const P = d.map(ptAt);
      b.polygon(P, { weight: 1.3 });
      P.forEach((p, i) => draw(p, [nA, nB, nC, nD][i]!));
      angleLabel(b, P[0]!, P[3]!, P[1]!, linDeg(e1), { radiusPx: 13, maxPx: 62 });
      angleLabel(b, P[2]!, P[1]!, P[3]!, linDeg(e2), { radiusPx: 13, maxPx: 62 });
      const tName = rng.bool() ? `m\\angle ${nA}` : `m\\angle ${nC}`;
      const tE = tName.endsWith(nA) ? e1 : e2;
      const fmt = (w: number) => `${m(`x = ${w}`)}, ${m(`${tName} = ${linVal(tE, w)}^\\circ`)}`;
      return {
        question: `Find $x$ and $${tName}$.`,
        answer: fmt(x),
        steps: ['Opposite angles of an inscribed quadrilateral are supplementary:', m(`(${linTex(e1)}) + (${linTex(e2)}) = 180`), m(`x = ${x}`), m(`${tName} = ${linSubTex(tE, x)} = ${linVal(tE, x)}^\\circ`)],
        distractors: numChoices(fmt, x, [(360 - e1.b - e2.b) / (e1.a + e2.a), (90 - e1.b - e2.b) / (e1.a + e2.a), (e2.b - e1.b) / (e1.a - e2.a || 1)].filter((w) => linVal(e1, w) > 0 && linVal(e2, w) > 0)),
        diagram: b.build(`Quadrilateral ${nA}${nB}${nC}${nD} inscribed in a circle`),
        check: {
          kind: 'geometry.solve',
          names: { [tName]: 'L' },
          eqs: [`(${linTex(e1)}) + (${linTex(e2)}) = 180`, `L = ${linTex(tE)}`],
          angles: [[P[3]!, P[0]!, P[1]!, linTex(e1)], [P[1]!, P[2]!, P[3]!, linTex(e2)]],
          given: [linDeg(e1), linDeg(e2)],
        },
      };
    }
    // arc A→C (ccw) of measure `arc`, inscribed vertex B on the other arc
    const arcVal = variant === 'semi' ? 180 : 2 * rng.int(difficulty === 'easy' ? 15 : 12, 80);
    const A = ptAt(0);
    const C = ptAt(arcVal);
    const gap = Math.min(45, (360 - arcVal) / 2 - 5);
    const bPos = arcVal + rng.int(Math.round(gap), Math.round(360 - arcVal - gap));
    const B = ptAt(bPos);
    b.segment(B, A, { weight: 1.3 });
    b.segment(B, C, { weight: 1.3 });
    [A, B, C].forEach((p, i) => draw(p, [nA, nB, nC][i]!));
    if (variant === 'semi') {
      b.segment(A, C, { weight: 1, dash: true });
      b.dot(O);
      const x = rng.int(3, 20);
      const e = linFor(rng, 90, x, { aMin: 2, aMax: 8, bMax: 80 })!;
      angleLabel(b, B, A, C, linDeg(e), { radiusPx: 13, maxPx: 70 });
      const fmt = (w: number) => m(`x = ${w}`);
      return {
        question: `$\\overline{${nA}${nC}}$ is a diameter. Find $x$.`,
        answer: fmt(x),
        steps: ['An angle inscribed in a semicircle is a right angle:', m(`${linTex(e)} = 90`), m(`x = ${x}`)],
        distractors: numChoices(fmt, x, [(180 - e.b) / e.a, (45 - e.b) / e.a, (360 - e.b) / e.a]),
        diagram: b.build(`Angle ${nA}${nB}${nC} inscribed in a semicircle`),
        check: { kind: 'geometry.solve', eqs: [`${linTex(e)} = 90`], angles: [[A, B, C, linTex(e)]], arcs: [[O, A, C, '180']], given: [linDeg(e)] },
      };
    }
    if (variant === 'same') {
      // second inscribed angle at D intercepting the same arc
      const dPos = arcVal + rng.int(Math.round(gap), Math.round(360 - arcVal - gap));
      if (Math.abs(dPos - bPos) < 30) {
        // fall back to the basic layout below when the two vertices would crowd
      } else {
        const D = ptAt(dPos);
        b.segment(D, A, { weight: 1.3 });
        b.segment(D, C, { weight: 1.3 });
        draw(D, nD);
        const ang = arcVal / 2;
        const built = attempt('same', () => {
          const x = rng.int(3, 18);
          const e1 = linFor(rng, ang, x, { aMin: 1, aMax: 6, bMax: 60 });
          const e2 = linFor(rng, ang, x, { aMin: 1, aMax: 8, bMax: 60, avoidA: e1 ? [e1.a] : [] });
          return e1 && e2 ? { x, e1, e2 } : null;
        });
        const { x, e1, e2 } = built;
        angleLabel(b, B, A, C, linDeg(e1), { radiusPx: 13, maxPx: 70 });
        angleLabel(b, D, A, C, linDeg(e2), { radiusPx: 13, maxPx: 70 });
        const tName = `m\\overset{\\frown}{${nA}${nC}}`;
        const fmt = (w: number) => `${m(`x = ${w}`)}, ${m(`${tName} = ${2 * linVal(e1, w)}^\\circ`)}`;
        return {
          question: `Find $x$ and $${tName}$.`,
          answer: fmt(x),
          steps: ['Inscribed angles that intercept the same arc are congruent:', m(`${linTex(e1)} = ${linTex(e2)}`), m(`x = ${x}`), m(`${tName} = 2 \\cdot ${ang}^\\circ = ${arcVal}^\\circ`)],
          distractors: numChoices(fmt, x, [(e2.b + e1.b) / (e1.a - e2.a), (180 - e1.b - e2.b) / (e1.a + e2.a), (e2.b - e1.b) / (e1.a + e2.a)].filter((w) => linVal(e1, w) > 0 && linVal(e2, w) > 0)),
          diagram: b.build(`Inscribed angles at ${nB} and ${nD} intercepting arc ${nA}${nC}`),
          check: {
            kind: 'geometry.solve',
            names: { [tName]: 'L' },
            eqs: [`${linTex(e1)} = ${linTex(e2)}`, `L = 2(${linTex(e1)})`],
            angles: [[A, B, C, linTex(e1)], [A, D, C, linTex(e2)]],
            arcs: [[O, A, C, 'L']],
            given: [linDeg(e1), linDeg(e2)],
          },
        };
      }
    }
    // basic: angle ↔ arc
    const ang = arcVal / 2;
    const findAngle = rng.bool();
    const arcName = `m\\overset{\\frown}{${nA}${nC}}`;
    const angName = `m\\angle ${nA}${nB}${nC}`;
    if (difficulty === 'easy' || variant !== 'basic') {
      const known = findAngle ? arcVal : ang;
      const val = findAngle ? ang : arcVal;
      arcLabel(b, start + arcVal / 2, findAngle ? deg(String(arcVal)) : deg('x'));
      angleLabel(b, B, A, C, findAngle ? deg('x') : deg(String(ang)), { radiusPx: 13, maxPx: 60 });
      const fmt = (v: number) => m(`x = ${v}`);
      return {
        question: 'Find $x$.',
        answer: fmt(val),
        steps: [findAngle ? 'An inscribed angle is half its intercepted arc:' : 'An intercepted arc is twice the inscribed angle:', m(findAngle ? `x = \\frac{1}{2} \\cdot ${known} = ${val}` : `x = 2 \\cdot ${known} = ${val}`)],
        distractors: numChoices(fmt, val, [known, findAngle ? 2 * known : known / 2, 180 - val, 360 - known]),
        diagram: b.build(`Inscribed angle ${nA}${nB}${nC} and its intercepted arc`),
        check: { kind: 'geometry.solve', eqs: [findAngle ? `2x = ${known}` : `x = 2 \\cdot ${known}`], angles: [[A, B, C, findAngle ? 'x' : String(known)]], arcs: [[O, A, C, findAngle ? String(known) : 'x']], given: [deg(String(known))] },
      };
    }
    // medium: expressions for the angle and the arc
    const built = attempt('insc', () => {
      const x = rng.int(3, 18);
      const ea = linFor(rng, ang, x, { aMin: 1, aMax: 5, bMax: 50 });
      const er = linFor(rng, arcVal, x, { aMin: 1, aMax: 9, bMax: 80, avoidA: ea ? [2 * ea.a] : [] });
      return ea && er ? { x, ea, er } : null;
    });
    const { x, ea, er } = built;
    arcLabel(b, start + arcVal / 2, linDeg(er));
    angleLabel(b, B, A, C, linDeg(ea), { radiusPx: 13, maxPx: 70 });
    const tName = findAngle ? angName : arcName;
    const tVal = (w: number) => (findAngle ? linVal(ea, w) : linVal(er, w));
    const fmt = (w: number) => m(`${tName} = ${tVal(w)}^\\circ`);
    const A2 = 2 * ea.a - er.a;
    return {
      question: `Find $${tName}$.`,
      answer: fmt(x),
      steps: ['The intercepted arc is twice the inscribed angle:', m(`2(${linTex(ea)}) = ${linTex(er)}`), m(`${linear(A2, 0)} = ${er.b - 2 * ea.b}`), m(`x = ${x}`), fmt(x)],
      distractors: distinctDistractors(
        fmt(x),
        [(er.b - ea.b) / (ea.a - er.a), (2 * er.b - ea.b) / (ea.a - 2 * er.a), (180 - ea.b - er.b) / (ea.a + er.a)].filter((w) => Number.isInteger(w) && w > 0 && w !== x && tVal(w) > 0 && tVal(w) < 360).map(fmt),
        (k) => (x + offset(k) > 0 && tVal(x + offset(k)) > 0 ? fmt(x + offset(k)) : null),
      ),
      diagram: b.build(`Inscribed angle ${nA}${nB}${nC} and its intercepted arc`),
      check: { kind: 'geometry.solve', names: { [tName]: 'L' }, eqs: [`2(${linTex(ea)}) = ${linTex(er)}`, `L = ${findAngle ? linTex(ea) : linTex(er)}`], angles: [[A, B, C, linTex(ea)]], arcs: [[O, A, C, linTex(er)]], given: [linDeg(ea), linDeg(er)] },
    };
  },
});

// ---------------------------------------------------------------- tangents

export const tangents = defineTopic({
  id: 'geo.tangents',
  subject: 'geometry',
  category: 'Circles',
  title: 'Tangents to Circles',
  description: 'A tangent is perpendicular to the radius at the point of tangency; two tangents from a point are congruent.',
  instruction: 'Find $x$. Assume that segments that appear to be tangent are tangent.',
  multipleChoice: true,
  defaultCount: 8,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Problems',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'right', label: 'Tangent ⊥ radius (Pythagorean)' },
        { value: 'two', label: 'Two tangents from a point' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const chosen = strOpt(ctx, 'task');
    const task = chosen === 'any' ? rng.pick(['right', 'two']) : chosen;
    const [nO, nP, nT, nU] = randomLetters(rng, 4) as [string, string, string, string];
    const dir = rng.int(0, 359);
    if (task === 'right') {
      const [p, q, h] = rng.pick(triples(difficulty === 'easy' ? 30 : 65));
      const [r, t] = rng.bool() ? [p, q] : [q, p];
      const d = h;
      // unit-circle figure scaled: radius 1
      const k = 1 / r;
      const Pp = mul(dirDeg(dir), d * k);
      const phi = (Math.acos(r / d) * 180) / Math.PI;
      const T = onCircle(O, 1, dir + rng.sign() * phi);
      const b = new DiagramBuilder(160 / Math.max(2, d * k + 1));
      b.circle(O, 1, { weight: 1.4 });
      b.dot(O);
      b.segment(O, T, { weight: 1.3 });
      b.segment(T, Pp, { weight: 1.3 });
      b.rightAngle(T, O, Pp, 9);
      const Q = onCircle(O, 1, dir);
      const hardPart = difficulty === 'hard';
      b.segment(O, Pp, { weight: 1.3 });
      b.label(add(O, mul(dirDeg(dir + 180), b.px(10))), nO, 'c');
      pointName(b, T, nT);
      b.label(add(Pp, mul(dirDeg(dir), b.px(10))), nP, 'c');
      const inside = mul(add(add(O, T), Pp), 1 / 3);
      const lengths: Array<[Pt, Pt, string]> = [];
      const lab = (u: Pt, v: Pt, tex: string) => {
        sideText(b, u, v, tex, inside, 3);
        lengths.push([u, v, tex]);
      };
      if (hardPart) {
        // radius unknown: PT and the outside part PQ of OP are given
        b.dot(Q);
        const outside = d - r;
        lab(O, T, 'x');
        lab(T, Pp, String(t));
        lab(Q, Pp, String(outside));
        const fmt = (v: number) => m(`x = ${v}`);
        return {
          question: `$\\overline{${nP}${nT}}$ is tangent to circle $${nO}$. Find the radius $x$.`,
          answer: fmt(r),
          steps: ['The radius is perpendicular to the tangent, so', m(`x^{2} + ${t}^{2} = (x + ${outside})^{2}`), m(`${t * t} = ${2 * outside}x + ${outside * outside}`), m(`x = ${r}`)],
          distractors: numChoices(fmt, r, [t - outside, Math.sqrt(t * t + outside * outside), (t * t) / (2 * outside), d]),
          diagram: b.build(`Circle ${nO} with tangent segment ${nP}${nT}`),
          check: { kind: 'geometry.solve', eqs: [`x^{2} + ${t}^{2} = (x + ${outside})^{2}`], lengths, angles: [[O, T, Pp, '90']], given: [String(t), String(outside)] },
        };
      }
      const unknown = rng.pick(['r', 't', 'd'] as const);
      const tex = (w: 'r' | 't' | 'd') => (w === unknown ? 'x' : String(w === 'r' ? r : w === 't' ? t : d));
      lab(O, T, tex('r'));
      lab(T, Pp, tex('t'));
      lab(O, Pp, tex('d'));
      const val = unknown === 'r' ? r : unknown === 't' ? t : d;
      const fmt = (v: number) => m(`x = ${v}`);
      const eq = `(${tex('r')})^{2} + (${tex('t')})^{2} = (${tex('d')})^{2}`;
      return {
        question: `$\\overline{${nP}${nT}}$ is tangent to circle $${nO}$ at $${nT}$. Find $x$.`,
        answer: fmt(val),
        steps: ['A tangent is perpendicular to the radius at the point of tangency:', m(eq.replace(/\(x\)/g, 'x').replace(/\((\d+)\)/g, '$1')), fmt(val)],
        distractors: numChoices(fmt, val, unknown === 'd' ? [r + t, Math.abs(t - r), Math.sqrt(Math.abs(t * t - r * r))] : [Math.sqrt(d * d + (unknown === 'r' ? t * t : r * r)), d - (unknown === 'r' ? t : r), d + (unknown === 'r' ? t : r)]),
        diagram: b.build(`Circle ${nO} with tangent segment ${nP}${nT}`),
        check: { kind: 'geometry.solve', eqs: [eq], lengths, angles: [[O, T, Pp, '90']], given: [tex('r'), tex('t'), tex('d')].filter((s) => s !== 'x') },
      };
    }
    // two tangents from P
    const built = attempt('two-tan', () => {
      const x = rng.int(2, difficulty === 'hard' ? 16 : 10);
      const L = rng.int(5, difficulty === 'easy' ? 25 : 45);
      const e1 = difficulty === 'easy' ? null : linFor(rng, L, x, { aMin: 1, aMax: 5, bMax: 30 });
      const e2 = linFor(rng, L, x, { aMin: 1, aMax: 8, bMax: 30, avoidA: e1 ? [e1.a] : [] });
      if (!e2 || (difficulty !== 'easy' && !e1)) return null;
      return { x, L, e1, e2 };
    });
    const { x, L, e1, e2 } = built;
    const dRatio = rng.int(18, 30) / 10;
    const Pp = mul(dirDeg(dir), dRatio);
    const phi = (Math.acos(1 / dRatio) * 180) / Math.PI;
    const T1 = onCircle(O, 1, dir + phi);
    const T2 = onCircle(O, 1, dir - phi);
    const b = new DiagramBuilder(150 / (dRatio + 1));
    b.circle(O, 1, { weight: 1.4 });
    b.dot(O);
    b.segment(Pp, T1, { weight: 1.3 });
    b.segment(Pp, T2, { weight: 1.3 });
    b.label(add(Pp, mul(dirDeg(dir), b.px(10))), nP, 'c');
    pointName(b, T1, nT);
    pointName(b, T2, nU);
    b.label(add(O, mul(dirDeg(dir + 180), b.px(10))), nO, 'c');
    const t1 = e1 ? linTex(e1) : String(L);
    const t2 = linTex(e2);
    sideText(b, T1, Pp, t1, T2, 3);
    sideText(b, T2, Pp, t2, T1, 3);
    const hardAsk = difficulty === 'hard';
    const fmt = (w: number) => (hardAsk ? `${m(`x = ${w}`)}, ${m(`${nP}${nT} = ${e1 ? linVal(e1, w) : L}`)}` : m(`x = ${w}`));
    const A2 = (e1?.a ?? 0) - e2.a;
    const B2 = e2.b - (e1?.b ?? L);
    return {
      question: `$\\overline{${nP}${nT}}$ and $\\overline{${nP}${nU}}$ are tangent to circle $${nO}$. Find ${hardAsk ? `$x$ and $${nP}${nT}$` : '$x$'}.`,
      answer: fmt(x),
      steps: ['Two tangent segments from the same point are congruent:', m(`${t1} = ${t2}`), m(`${linear(A2, 0)} = ${B2}`), m(`x = ${x}`)],
      distractors: numChoices(fmt, x, [(-e2.b - (e1?.b ?? L)) / (A2 || 1), ((e1?.b ?? L) - e2.b) / ((e1?.a ?? 0) + e2.a), (2 * (e1?.b ?? L) - e2.b) / e2.a].filter((w) => linVal(e2, w) > 0 && (!e1 || linVal(e1, w) > 0))),
      diagram: b.build(`Two tangent segments from ${nP} to circle ${nO}`),
      check: {
        kind: 'geometry.solve',
        eqs: [`${t1} = ${t2}`, ...(hardAsk ? [`M = ${t1}`] : [])],
        names: hardAsk ? { [`${nP}${nT}`]: 'M' } : {},
        lengths: [[Pp, T1, t1], [Pp, T2, t2]],
        given: [t1, t2],
      },
    };
  },
});

