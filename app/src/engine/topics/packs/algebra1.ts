/** Algebra 1 topics, in curriculum order. */
import type { TopicGenerator } from '../../types';
import { orderOfOperationsAlg1, simplifyingExpressions } from '../algebra1/beginning';
import { absoluteValueInequalities, compoundInequalities } from '../algebra1/compound';
import { absoluteValueEquations, oneStepEquations } from '../algebra1/equations';
import { continuousRelations, discreteRelations, evaluatingFunctions } from '../algebra1/relations';
import { graphingAbsoluteValue, graphingLinearInequalities, graphingLines, slopeFromPoints, variation, writingLines } from '../algebra1/linear';
import { graphingSystemsOfInequalities, solvingSystemsByGraphing, systemsByElimination, systemsBySubstitution } from '../algebra1/systems-graphing';
import { distanceWordProblems, mixtureWordProblems, systemsWordProblems, workWordProblems } from '../algebra1/words';
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
  workWordProblems,
  distanceWordProblems,
  mixtureWordProblems,
  absoluteValueEquations,
  inequalities,
  compoundInequalities,
  absoluteValueInequalities,
  // Relations and Introduction to Functions
  discreteRelations,
  continuousRelations,
  evaluatingFunctions,
  // Linear Relations and Functions
  slopeFromPoints,
  graphingLines,
  writingLines,
  graphingAbsoluteValue,
  graphingLinearInequalities,
  variation,
  // Systems of Equations and Inequalities
  graphingSystemsOfInequalities,
  solvingSystemsByGraphing,
  systemsByElimination,
  systemsBySubstitution,
  systemsWordProblems,
  systemsOfEquations,
  // Polynomials, Factoring, Exponents, Radical Expressions
  polynomialOperations,
  factoringTrinomials,
  exponentProperties,
  simplifyingRadicals,
];

export default topics;
