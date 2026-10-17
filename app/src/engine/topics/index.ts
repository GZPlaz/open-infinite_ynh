/** Registry of every topic generator, in curriculum order. */
import type { SubjectId, TopicGenerator } from '../types';
import { exponentProperties } from './algebra1/exponents';
import { factoringTrinomials } from './algebra1/factoring';
import { inequalities } from './algebra1/inequalities';
import { linearMultiStep } from './algebra1/linear-multistep';
import { polynomialOperations } from './algebra1/polynomial-ops';
import { simplifyingRadicals } from './algebra1/radicals';
import { systemsOfEquations } from './algebra1/systems';
import { matrixOperations } from './algebra2/matrices';
import { derivatives } from './calculus/derivatives';
import { integrals } from './calculus/integrals';
import { limits } from './calculus/limits';
import { quadraticFormula } from './algebra2/quadratic-formula';
import { angleRelationships } from './geometry/angles';
import { areaPerimeter } from './geometry/area-perimeter';
import { coordinateGeometry } from './geometry/coordinate';
import { pythagoreanTheorem } from './geometry/pythagorean';
import { transformations } from './geometry/transformations';
import { trigRatios } from './geometry/trig-ratios';
import { volumeSurfaceArea } from './geometry/volume';
import { fractionOperations } from './prealgebra/fractions';
import { orderOfOperations } from './prealgebra/order-of-operations';
import { twoStepEquations } from './prealgebra/two-step';
import { sequencesSeries } from './precalculus/sequences';
import { vectors } from './precalculus/vectors';

export const TOPICS: readonly TopicGenerator[] = [
  orderOfOperations,
  fractionOperations,
  twoStepEquations,
  linearMultiStep,
  inequalities,
  systemsOfEquations,
  polynomialOperations,
  factoringTrinomials,
  exponentProperties,
  simplifyingRadicals,
  quadraticFormula,
  matrixOperations,
  pythagoreanTheorem,
  trigRatios,
  areaPerimeter,
  volumeSurfaceArea,
  angleRelationships,
  coordinateGeometry,
  transformations,
  sequencesSeries,
  vectors,
  limits,
  derivatives,
  integrals,
];

const BY_ID = new Map(TOPICS.map((t) => [t.id, t]));
if (BY_ID.size !== TOPICS.length) throw new Error('duplicate topic id');

export function getTopic(id: string): TopicGenerator | undefined {
  return BY_ID.get(id);
}

export function topicsFor(subject: SubjectId): TopicGenerator[] {
  return TOPICS.filter((t) => t.subject === subject);
}
