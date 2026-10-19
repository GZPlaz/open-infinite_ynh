/** Algebra 2: quadratic functions and inequalities, general functions. */
import type { TopicGenerator } from '../../types';
import { evaluatingFunctions } from '../algebra2/general-functions/evaluate';
import { inverseFunctions } from '../algebra2/general-functions/inverse';
import { functionOperations } from '../algebra2/general-functions/operations';
import { quadraticFormula } from '../algebra2/quadratic-formula';
import { completingTheSquare, solveByCompletingSquare } from '../algebra2/quadratics/completing-square';
import { discriminant } from '../algebra2/quadratics/discriminant';
import { factoringQuadratics, factoringSpecialCases } from '../algebra2/quadratics/factoring';
import { graphingQuadraticInequalities, graphingQuadratics } from '../algebra2/quadratics/graphing';
import { solveByFactoring } from '../algebra2/quadratics/solve-factoring';
import { squareRootSolving } from '../algebra2/quadratics/square-roots';

const topics: TopicGenerator[] = [
  // Quadratic Functions and Inequalities
  graphingQuadratics,
  graphingQuadraticInequalities,
  factoringQuadratics,
  factoringSpecialCases,
  squareRootSolving,
  solveByFactoring,
  completingTheSquare,
  solveByCompletingSquare,
  quadraticFormula,
  discriminant,
  // General Functions
  evaluatingFunctions,
  functionOperations,
  inverseFunctions,
];

export default topics;
