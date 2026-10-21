/** Graphing polar equations: circles, roses, cardioids, limaçons and lemniscates. */
import { plotParam } from '../../diagram';
import { defineTopic, distinctDistractors } from '../../generator';
import type { Rng } from '../../rng';
import { term } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { polarPlane } from './common';

interface Curve {
  tex: string;
  r: (t: number) => number;
  squared: boolean;
  name: string;
  wrong: string[];
  max: number;
  steps: string[];
}

type Kind = 'circle0' | 'circleTrig' | 'rose' | 'cardioid' | 'limacon' | 'lemniscate';
const KINDS: Record<Difficulty, Kind[]> = {
  easy: ['circle0', 'circleTrig', 'rose', 'cardioid'],
  medium: ['circleTrig', 'rose', 'cardioid', 'limacon'],
  hard: ['rose', 'limacon', 'lemniscate', 'cardioid'],
};

const NAMES = ['Circle', 'Cardioid', 'Limaçon with an inner loop', 'Dimpled limaçon', 'Convex limaçon', 'Lemniscate'];
const petals = (n: number) => `Rose curve with ${n} petals`;

function build(rng: Rng, kind: Kind, d: Difficulty): Curve {
  const useSin = rng.bool();
  const fn = useSin ? '\\sin' : '\\cos';
  const trig = (t: number) => (useSin ? Math.sin(t) : Math.cos(t));
  switch (kind) {
    case 'circle0': {
      const a = rng.int(2, 6);
      return { tex: `r = ${a}`, r: () => a, squared: false, name: 'Circle', wrong: [petals(a), 'Cardioid', 'Convex limaçon'], max: a, steps: [`Every point is ${a} units from the pole: a circle of radius ${a}.`] };
    }
    case 'circleTrig': {
      const k = rng.signedInt(2, 6, true);
      return {
        tex: `r = ${term(k, `${fn}\\theta`)}`,
        r: (t) => k * trig(t),
        squared: false,
        name: 'Circle',
        wrong: [petals(2), 'Cardioid', 'Lemniscate'],
        max: Math.abs(k),
        steps: [`${'$'}r = ${term(k, `${fn}\\theta`)}${'$'} is a circle of diameter ${Math.abs(k)} through the pole, centered on the ${useSin ? 'vertical' : 'horizontal'} axis.`],
      };
    }
    case 'rose': {
      const n = rng.int(2, d === 'hard' ? 5 : 3);
      const a = rng.int(3, 6) * (d === 'hard' && rng.bool(0.3) ? -1 : 1);
      const count = n % 2 ? n : 2 * n;
      return {
        tex: `r = ${term(a, `${fn} ${n}\\theta`)}`,
        r: (t) => a * trig(n * t),
        squared: false,
        name: petals(count),
        wrong: [petals(n % 2 ? 2 * n : n), petals(count + 1 === n ? count + 2 : count + 1), 'Circle', 'Limaçon with an inner loop', petals(2 * count)],
        max: Math.abs(a),
        steps: [`${'$'}n = ${n}${'$'} is ${n % 2 ? 'odd' : 'even'}, so the rose has ${count} petals of length ${Math.abs(a)}.`],
      };
    }
    case 'cardioid': {
      const a = rng.int(1, 3);
      const s = rng.pick([1, -1]);
      return {
        tex: `r = ${a} ${s > 0 ? '+' : '-'} ${term(a, `${fn}\\theta`)}`,
        r: (t) => a + s * a * trig(t),
        squared: false,
        name: 'Cardioid',
        wrong: ['Limaçon with an inner loop', 'Circle', 'Dimpled limaçon'],
        max: 2 * a,
        steps: [`${'$'}r = a \\pm a${fn}\\theta${'$'} with ${'$'}a = ${a}${'$'}: a cardioid.`],
      };
    }
    case 'limacon': {
      const type = rng.pick(['loop', 'dimple', 'convex']);
      let a: number;
      let b: number;
      if (type === 'loop') {
        a = rng.int(1, 3);
        b = rng.int(a + 1, 6 - a + 1);
      } else if (type === 'dimple') {
        b = rng.int(2, 3);
        a = rng.int(b + 1, 2 * b - 1);
      } else {
        b = rng.int(1, 2);
        a = rng.int(2 * b, 6 - b);
      }
      const s = rng.pick([1, -1]);
      const name = type === 'loop' ? 'Limaçon with an inner loop' : type === 'dimple' ? 'Dimpled limaçon' : 'Convex limaçon';
      return {
        tex: `r = ${a} ${s > 0 ? '+' : '-'} ${term(b, `${fn}\\theta`)}`,
        r: (t) => a + s * b * trig(t),
        squared: false,
        name,
        wrong: [...NAMES.filter((x) => x !== name && x.includes('imaçon')), 'Cardioid', 'Circle'],
        max: a + b,
        steps: [`${'$'}a = ${a}${'$'}, ${'$'}b = ${b}${'$'}: ${type === 'loop' ? '$a < b$, so there is an inner loop' : type === 'dimple' ? '$b < a < 2b$, so the limaçon is dimpled' : '$a \\ge 2b$, so the limaçon is convex'}.`],
      };
    }
    case 'lemniscate':
    default: {
      const a = rng.int(2, 5);
      return {
        tex: `r^{2} = ${a * a}${fn} 2\\theta`,
        r: (t) => Math.sqrt(a * a * trig(2 * t)),
        squared: true,
        name: 'Lemniscate',
        wrong: [petals(4), petals(2), 'Circle'],
        max: a,
        steps: [`${'$'}r^{2} = a^{2}${fn} 2\\theta${'$'} is a lemniscate with loops of length ${a}.`],
      };
    }
  }
}

export const polarGraphs = defineTopic({
  id: 'precalc.polar.graph',
  subject: 'precalculus',
  category: 'Polar Coordinates and Complex Numbers',
  title: 'Graphing Polar Equations',
  description: 'Identify and graph circles, rose curves, cardioids, limaçons and lemniscates.',
  instruction: 'Identify the type of each polar graph, then sketch it.',
  multipleChoice: true,
  defaultCount: 6,
  options: [],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const c = build(rng, rng.pick(KINDS[difficulty]), difficulty);
    const R = Math.max(2, Math.ceil(c.max));
    const blank = polarPlane(R);
    const b = polarPlane(R);
    const w = { x0: -R - 0.5, x1: R + 0.5, y0: -R - 0.5, y1: R + 0.5 };
    plotParam(b, (t) => c.r(t) * Math.cos(t), (t) => c.r(t) * Math.sin(t), 0, 2 * Math.PI, w, {}, 360);
    const answer = c.name;
    return {
      question: `Graph ${'$'}${c.tex}${'$'}`,
      answer,
      steps: c.steps,
      distractors: distinctDistractors(answer, c.wrong, (k) => petals(k + 6)),
      diagram: blank.build('Blank polar grid'),
      answerDiagram: b.build(`Polar graph of ${c.tex}`),
      check: { kind: 'precalculus.polarCurve' },
    };
  },
});
