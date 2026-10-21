/** Complex numbers in trigonometric form: converting, products and quotients, De Moivre's theorem, nth roots. */
import { Frac } from '../../fraction';
import { attempt, defineTopic, distinctDistractors, strOpt } from '../../generator';
import type { Rng } from '../../rng';
import { m, num } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { Surd, angleTex, cisTex, complexTex, reduceTurn, trigExact } from './common';
import { nicePolar } from './polar-points';

type Task = 'toTrig' | 'toRect' | 'multiply' | 'divide' | 'power' | 'roots';
const TASKS: Record<Difficulty, Task[]> = {
  easy: ['toTrig', 'toRect', 'multiply'],
  medium: ['toTrig', 'multiply', 'divide', 'power'],
  hard: ['power', 'roots', 'divide', 'toTrig'],
};
const ROOT_WORD: Record<number, string> = { 2: 'square', 3: 'cube', 4: 'fourth', 6: 'sixth' };

const SPECIAL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((k) => new Frac(k, 6)).concat([1, 3, 5, 7].map((k) => new Frac(k, 4)));
const rect = (r: Surd, t: Frac) => {
  const { cos, sin } = trigExact(t);
  return complexTex(r.mul(cos), r.mul(sin));
};

function pickAngle(rng: Rng): Frac {
  return rng.pick(SPECIAL.filter((t) => !t.isZero()));
}

export const complexTrigForm = defineTopic({
  id: 'precalc.complex.trig-form',
  subject: 'precalculus',
  category: 'Polar Coordinates and Complex Numbers',
  title: "Trigonometric Form and De Moivre's Theorem",
  description: "Write complex numbers in trigonometric form, multiply and divide them, and use De Moivre's theorem for powers and roots.",
  instruction: (o) => `Answer as indicated. Use ${o.angles === 'degrees' ? 'degrees, $0^\\circ \\le \\theta < 360^\\circ$' : 'radians, $0 \\le \\theta < 2\\pi$'}.`,
  multipleChoice: true,
  defaultCount: 8,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Task',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed (by difficulty)' },
        { value: 'toTrig', label: 'Write in trigonometric form' },
        { value: 'toRect', label: 'Write in rectangular form' },
        { value: 'multiply', label: 'Multiply' },
        { value: 'divide', label: 'Divide' },
        { value: 'power', label: "Powers (De Moivre's theorem)" },
        { value: 'roots', label: 'nth roots' },
      ],
    },
    {
      type: 'select',
      id: 'angles',
      label: 'Angles',
      default: 'radians',
      choices: [
        { value: 'radians', label: 'Radians' },
        { value: 'degrees', label: 'Degrees' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const deg = strOpt(ctx, 'angles') === 'degrees';
    const tOpt = strOpt(ctx, 'task');
    const task: Task = tOpt === 'any' ? rng.pick(TASKS[difficulty]) : (tOpt as Task);
    const cis = (r: Surd, t: Frac) => cisTex(r, t, deg);
    const A = (t: Frac) => angleTex(t, deg);
    const steps: string[] = [];
    let question: string;
    let answer: string;
    let wrongs: string[];
    let fallback: (k: number) => string;

    switch (task) {
      case 'toTrig': {
        const { r, t } = nicePolar(rng, difficulty);
        const z = rect(r, t);
        question = `Write ${m(`z = ${z}`)} in trigonometric form.`;
        steps.push(m(`r = |z| = ${r.toTex()}`));
        steps.push(`${m(`\\theta = ${A(t)}`)} (the angle of the point in its quadrant)`);
        answer = m(cis(r, t));
        wrongs = [m(cis(r, reduceTurn(t.add(1)))), m(cis(r, reduceTurn(new Frac(1).sub(t)))), m(cis(r.mul(r), t)), m(cis(r, reduceTurn(t.neg())))];
        fallback = (k) => m(cis(r, reduceTurn(t.add(new Frac(k, 6)))));
        break;
      }
      case 'toRect': {
        const r = Surd.of(rng.int(2, 8));
        const t = pickAngle(rng);
        question = `Write ${m(`z = ${cis(r, t)}`)} in rectangular form.`;
        const { cos, sin } = trigExact(t);
        steps.push(m(`z = ${r.toTex()}\\left(${complexTex(cos, sin)}\\right)`));
        answer = m(rect(r, t));
        wrongs = [m(complexTex(r.mul(sin), r.mul(cos))), m(complexTex(r.mul(cos).neg(), r.mul(sin))), m(complexTex(r.mul(cos), r.mul(sin).neg())), m(complexTex(r.mul(cos).neg(), r.mul(sin).neg()))];
        fallback = (k) => m(rect(r.mul(k + 2), t));
        break;
      }
      case 'multiply':
      case 'divide': {
        const mult = task === 'multiply';
        const { r1, r2, t1, t2 } = attempt('cis-op', () => {
          const r2 = rng.int(1, 4);
          const r1 = mult ? rng.int(1, 5) : r2 * rng.int(1, 4);
          const t1 = pickAngle(rng);
          const t2 = pickAngle(rng);
          return r1 * r2 === 1 || t1.eq(t2) ? null : { r1, r2, t1, t2 };
        });
        const R = mult ? Surd.of(r1 * r2) : Surd.of(new Frac(r1, r2));
        const T = reduceTurn(mult ? t1.add(t2) : t1.sub(t2));
        question = `Find ${m(mult ? 'z_1 z_2' : '\\frac{z_1}{z_2}')} in trigonometric form for ${m(`z_1 = ${cis(Surd.of(r1), t1)}`)} and ${m(`z_2 = ${cis(Surd.of(r2), t2)}`)}.`;
        steps.push(mult ? `Multiply the moduli and add the angles: ${m(`r = ${r1 * r2},\\ \\theta = ${A(t1)} + ${A(t2)}`)}` : `Divide the moduli and subtract the angles: ${m(`r = ${num(new Frac(r1, r2))},\\ \\theta = ${A(t1)} - ${A(t2)}`)}`);
        answer = m(cis(R, T));
        steps.push(answer);
        const wrongT = reduceTurn(mult ? t1.sub(t2) : t1.add(t2));
        const wrongR = mult ? Surd.of(r1 + r2) : Surd.of(new Frac(r2, r1));
        wrongs = [m(cis(R, wrongT)), m(cis(wrongR, T)), m(cis(R, reduceTurn(mult ? t1.mul(t2) : t2.sub(t1)))), m(cis(wrongR, wrongT))];
        fallback = (k) => m(cis(R, reduceTurn(T.add(new Frac(k, 4)))));
        break;
      }
      case 'power': {
        const { r, t, n, fromRect } = attempt('cis-power', () => {
          const fromRect = difficulty === 'hard' && rng.bool(0.5);
          const r = fromRect ? rng.pick([Surd.of(1, 2), Surd.of(2)]) : rng.pick([Surd.of(1), Surd.of(2), Surd.of(3), Surd.of(1, 2)]);
          const t = fromRect ? rng.pick([1, 3, 5, 7].map((k) => new Frac(k, 4)).concat([1, 2, 4, 5, 7, 8, 10, 11].map((k) => new Frac(k, 6)))) : pickAngle(rng);
          if (fromRect && r.value === 2 && t.d === 4) return null;
          if (fromRect && Math.abs(r.value - Math.SQRT2) < 1e-9 && t.d === 6) return null;
          const n = rng.int(3, difficulty === 'medium' ? 4 : 6);
          return r.value ** n > 800 ? null : { r, t, n, fromRect };
        });
        const zTex = fromRect ? rect(r, t) : cis(r, t);
        let R = Surd.of(1);
        for (let i = 0; i < n; i++) R = R.mul(r);
        const T = reduceTurn(t.mul(n));
        question = `Find ${m(`z^{${n}}`)} for ${m(`z = ${zTex}`)}. Write the answer in rectangular form.`;
        if (!zTex.includes('\\cos')) steps.push(m(`z = ${cis(r, t)}`));
        steps.push(`De Moivre: ${m(`z^{${n}} = ${R.s === 1 && R.q.eq(1) ? '' : R.toTex()}\\left(\\cos ${A(t.mul(n))} + i\\sin ${A(t.mul(n))}\\right)`)}`);
        answer = m(rect(R, T));
        steps.push(answer);
        wrongs = [m(rect(r.mul(n), T)), m(rect(R, reduceTurn(t.add(n)))), m(rect(R, reduceTurn(T.add(1)))), m(rect(R, reduceTurn(new Frac(1, 2).sub(T))))];
        fallback = (k) => m(rect(R.mul(k + 1), T));
        break;
      }
      case 'roots':
      default: {
        const { n, R, alpha } = attempt('cis-roots', () => {
          const n = rng.pick([2, 3, 3, 4]);
          const R = rng.int(1, n === 2 ? 4 : 2);
          const alpha = rng.pick([new Frac(0), ...SPECIAL.filter((x) => x.d !== 4 || n !== 3)]);
          if (deg && !alpha.mul(180).div(n).isInt()) return null;
          return { n, R, alpha };
        });
        const W = Surd.of(R ** n);
        const wTex = rect(W, alpha);
        const roots = Array.from({ length: n }, (_, k) => alpha.add(2 * k).div(n));
        question = `Find the ${ROOT_WORD[n]} roots of ${m(`w = ${wTex}`)}. Write them in trigonometric form.`;
        steps.push(m(`w = ${cis(W, alpha)}`));
        steps.push(m(`z_k = \\sqrt[${n}]{${R ** n}}\\left(\\cos\\frac{${A(alpha)} + ${deg ? '360^\\circ' : '2\\pi'} k}{${n}} + i\\sin\\frac{${A(alpha)} + ${deg ? '360^\\circ' : '2\\pi'} k}{${n}}\\right)`));
        const list = (rs: Surd, ts: Frac[]) => ts.map((t, k) => m(`z_${k} = ${cis(rs, t)}`)).join(', ');
        answer = list(Surd.of(R), roots);
        wrongs = [
          list(Surd.of(R ** n), roots),
          list(Surd.of(R), roots.map((_, k) => alpha.div(n).add(new Frac(k, n)))),
          list(Surd.of(R), roots.map((_, k) => alpha.add(2 * k))),
          list(Surd.of(R).mul(n), roots),
        ];
        fallback = (k) => list(Surd.of(R + k), roots);
        break;
      }
    }
    return {
      question,
      answer,
      steps,
      distractors: distinctDistractors(answer, wrongs, fallback),
      check: { kind: 'precalculus.complex', task },
    };
  },
});
