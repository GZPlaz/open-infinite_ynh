/** Algebra 2: three-variable systems, matrices, complex numbers. */
import type { TopicGenerator } from '../../types';
import { cramersRule } from '../algebra2/matrix/cramer';
import { determinants } from '../algebra2/matrix/determinants';
import { matrixEquations } from '../algebra2/matrix/equations';
import { inverseMatrices } from '../algebra2/matrix/inverses';
import { matrixArithmetic } from '../algebra2/matrix/operations';
import { matrixTransformations } from '../algebra2/matrix/transformations';
import { matrixOperations } from '../algebra2/matrices';

const topics: TopicGenerator[] = [
  // Matrices
  matrixArithmetic,
  determinants,
  inverseMatrices,
  cramersRule,
  matrixEquations,
  matrixTransformations,
  matrixOperations,
];

export default topics;
