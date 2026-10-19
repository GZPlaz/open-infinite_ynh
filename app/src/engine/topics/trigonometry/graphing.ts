/** Graphing y = a·sin(b(x − c)) + d (and cosine / tangent): amplitude, period, phase shift, vertical shift. */
import { plot } from '../../diagram';
import { Frac } from '../../fraction';
import { attempt, defineTopic, distinctDistractors, strOpt } from '../../generator';
import { m } from '../../tex';
import type { ProblemContent } from '../../types';
import { piTex } from './exact';
import { radianPlane } from './figures';

type G = 'sin' | 'cos' | 'tan';

interface Props {
  amp: string | null;
  period: Frac; // multiple of π
  phase: Frac; // multiple of π; positive = right
  vshift: number;
}

function propsText(p: Props): string {
  const amp = p.amp === null ? 'none' : m(p.amp);
  const phase = p.phase.isZero() ? 'none' : `${m(piTex(p.phase.abs()))} ${p.phase.sign > 0 ? 'right' : 'left'}`;
  const vs = p.vshift === 0 ? 'none' : `${m(String(Math.abs(p.vshift)))} ${p.vshift > 0 ? 'up' : 'down'}`;
  return `Amplitude: ${amp}; Period: ${m(piTex(p.period))}; Phase shift: ${phase}; Vertical shift: ${vs}`;
}

export const graphingTrig = defineTopic({
  id: 'trig.functions.graphing',
  subject: 'trigonometry',
  title: 'Graphing Trig Functions',
  description: 'Find the amplitude, period, phase shift and vertical shift of sine, cosine and tangent functions and graph them.',
  category: 'Trigonometric Functions',
  instruction: (o) =>
    o.task === 'properties'
      ? 'Find the amplitude, the period in radians, the phase shift in radians and the vertical shift.'
      : 'Find the amplitude, the period in radians, the phase shift in radians and the vertical shift. Then graph one full period or more, using radians.',
  multipleChoice: true,
  defaultCount: 6,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Task',
      default: 'graph',
      choices: [
        { value: 'graph', label: 'Properties and graph' },
        { value: 'properties', label: 'Properties only' },
      ],
    },
    {
      type: 'select',
      id: 'fns',
      label: 'Functions',
      default: 'sincos',
      choices: [
        { value: 'sincos', label: 'Sine and cosine' },
        { value: 'all', label: 'Sine, cosine and tangent' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const graph = strOpt(ctx, 'task') !== 'properties';
    const fns: G[] = strOpt(ctx, 'fns') === 'all' && difficulty !== 'easy' ? ['sin', 'cos', 'tan'] : ['sin', 'cos'];
    const g = rng.pick(fns);
    const spec = attempt('graph', () => {
      const a = rng.signedInt(1, g === 'tan' ? 2 : difficulty === 'easy' ? 4 : 3, difficulty !== 'easy');
      const b = rng.pick(difficulty === 'easy' ? [new Frac(1), new Frac(2), new Frac(1, 2)] : difficulty === 'medium' ? [new Frac(1), new Frac(2)] : [new Frac(2), new Frac(3), new Frac(1, 2), new Frac(1)]);
      let phi = new Frac(0); // argument is b·x − φ·π
      let d = 0;
      if (difficulty === 'medium') {
        const which = rng.int(0, 2);
        if (which !== 1) phi = rng.pick([new Frac(1, 4), new Frac(1, 2), new Frac(1, 3), new Frac(1, 6)]).mul(rng.sign());
        if (which !== 0) d = rng.signedInt(1, 3, true);
        if (!b.eq(1) && !phi.isZero()) return null;
      } else if (difficulty === 'hard') {
        phi = rng.pick([new Frac(1, 4), new Frac(1, 2), new Frac(1, 3), new Frac(1, 6), new Frac(2, 3)]).mul(rng.sign());
        d = rng.bool(0.7) ? rng.signedInt(1, 3, true) : 0;
      }
      return { a, b, phi, d };
    });
    const { a, b, phi, d } = spec;
    const c = phi.div(b); // phase shift (multiples of π)
    const bx = b.eq(1) ? 'x' : b.d === 1 ? `${b.n}x` : `\\frac{x}{${b.d}}`;
    const arg = phi.isZero() ? (b.eq(1) ? ' x' : ` ${bx}`) : `\\left(${bx} ${phi.sign > 0 ? '-' : '+'} ${piTex(phi.abs())}\\right)`;
    const aTex = a === 1 ? '' : a === -1 ? '-' : String(a);
    const rhs = `${aTex}\\${g}${arg}${d > 0 ? ` + ${d}` : d < 0 ? ` - ${-d}` : ''}`;
    const eq = `y = ${rhs}`;
    const period = (g === 'tan' ? new Frac(1) : new Frac(2)).div(b);
    const props: Props = { amp: g === 'tan' ? null : String(Math.abs(a)), period, phase: c, vshift: d };
    const answer = propsText(props);
    const wrongs: Props[] = [
      { ...props, period: period.mul(b).mul(b) },
      { ...props, phase: b.eq(1) ? c.neg() : phi },
      { ...props, vshift: -d, phase: c.neg() },
      { ...props, amp: g === 'tan' ? String(Math.abs(a)) : a < 0 ? String(a) : String(2 * a) },
      { ...props, period: period.div(2) },
    ];
    const steps = [
      g === 'tan' ? `Tangent has no amplitude; the vertical stretch is ${m(String(Math.abs(a)))}.` : m(`\\text{Amplitude} = |${a}| = ${Math.abs(a)}`),
      m(`\\text{Period} = \\frac{${g === 'tan' ? '\\pi' : '2\\pi'}}{${b.toTex()}} = ${piTex(period)}`),
      phi.isZero() ? 'No phase shift.' : m(`\\text{Phase shift: } ${bx} ${phi.sign > 0 ? '-' : '+'} ${piTex(phi.abs())} = 0 \\Rightarrow x = ${piTex(c)}`),
      d === 0 ? 'No vertical shift.' : m(`\\text{Vertical shift} = ${d}`),
    ];
    const out: ProblemContent = {
      question: m(eq),
      answer,
      steps,
      distractors: distinctDistractors(answer, wrongs.map(propsText), (k) => propsText({ ...props, period: period.mul(k + 2) })),
      check: { kind: 'trigonometry.graph', fn: g },
    };
    if (graph) {
      const yr = g === 'tan' ? Math.max(4, Math.abs(d) + 4) : Math.max(3, Math.abs(a) + Math.abs(d) + 1);
      const make = () => radianPlane([-4, 4], yr);
      out.diagram = make().b.build('Blank graph with x from -2π to 2π');
      const { b: B, w } = make();
      const bv = b.value;
      const cv = c.value * Math.PI;
      const base = g === 'sin' ? Math.sin : g === 'cos' ? Math.cos : Math.tan;
      if (g === 'tan') {
        const P = period.value * Math.PI;
        for (let k = -12; k <= 12; k++) {
          const x = cv + P / 2 + k * P;
          if (x > w.x0 && x < w.x1) B.segment([x, w.y0], [x, w.y1], { dash: true, ink: 'muted', weight: 0.8 });
        }
      }
      plot(B, (x) => a * base(bv * (x - cv)) + d, w, {}, 600);
      out.answerDiagram = B.build(`Graph of ${eq}`);
    }
    return out;
  },
});
