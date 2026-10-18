/** Algebra 1 topics, in curriculum order. */
import type { TopicGenerator } from '../../types';
import { orderOfOperationsAlg1, simplifyingExpressions } from '../algebra1/beginning';
import { absoluteValueInequalities, compoundInequalities } from '../algebra1/compound';
import { absoluteValueEquations, oneStepEquations } from '../algebra1/equations';
import { exponentProperties } from '../algebra1/exponents';
import { factoringTrinomials } from '../algebra1/factoring';
import { inequalities } from '../algebra1/inequalities';
import { linearMultiStep } from '../algebra1/linear-multistep';
import { polynomialOperations } from '../algebra1/polynomial-ops';
import { simplifyingRadicals } from '../algebra1/radicals';
import { systemsOfEquations } from '../algebra1/systems';

const topics: TopicGenerator[] = [
  // Beginning Algebra
  orderOfOperationsAlg1,
  simplifyingExpressions,
  // Equations and Inequalities
  oneStepEquations,
  linearMultiStep,
  absoluteValueEquations,
  inequalities,
  compoundInequalities,
  absoluteValueInequalities,
  // Systems of Equations and Inequalities
  systemsOfEquations,
  // Polynomials, Factoring, Exponents, Radical Expressions
  polynomialOperations,
  factoringTrinomials,
  exponentProperties,
  simplifyingRadicals,
];

export default topics;
