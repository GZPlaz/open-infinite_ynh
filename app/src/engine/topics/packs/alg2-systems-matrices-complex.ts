/** Algebra 2: three-variable systems, matrices, complex numbers. */
import type { TopicGenerator } from '../../types';
import { complexAbsoluteValue } from '../algebra2/complex/absolute';
import { complexGraphing } from '../algebra2/complex/graphing';
import { complexOperations } from '../algebra2/complex/operations';
import { rationalizingDenominators } from '../algebra2/complex/rationalizing';
import { cramersRule } from '../algebra2/matrix/cramer';
import { determinants } from '../algebra2/matrix/determinants';
import { matrixEquations } from '../algebra2/matrix/equations';
import { inverseMatrices } from '../algebra2/matrix/inverses';
import { matrixArithmetic } from '../algebra2/matrix/operations';
import { matrixTransformations } from '../algebra2/matrix/transformations';
import { matrixOperations } from '../algebra2/matrices';
import { planes } from '../algebra2/sys3/planes';
import { pointsInSpace } from '../algebra2/sys3/space';
import { threeVariableSystems } from '../algebra2/sys3/three-variables';

const topics: TopicGenerator[] = [
  // Systems of Equations and Inequalities
  pointsInSpace,
  planes,
  threeVariableSystems,
  // Matrices
  matrixArithmetic,
  determinants,
  inverseMatrices,
  cramersRule,
  matrixEquations,
  matrixTransformations,
  matrixOperations,
  // Complex Numbers
  complexOperations,
  complexGraphing,
  complexAbsoluteValue,
  rationalizingDenominators,
];

export default topics;
