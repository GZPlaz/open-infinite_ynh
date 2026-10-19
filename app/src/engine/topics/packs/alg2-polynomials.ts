/** Algebra 2: polynomial functions. */
import { variant } from '../../generator';
import type { TopicGenerator } from '../../types';
import { polynomialOperations } from '../algebra1/polynomial-ops';
import { CATEGORY } from '../algebra2/polynomials/common';
import { dividingPolynomials, remainderTheorem } from '../algebra2/polynomials/division';
import { factoringAll, factoringByGrouping, factoringCubes, factoringQuadraticForm } from '../algebra2/polynomials/factoring';
import { endBehavior, graphingPolynomials } from '../algebra2/polynomials/graphs';
import { namingPolynomials } from '../algebra2/polynomials/naming';
import { binomialTheorem, specialProducts } from '../algebra2/polynomials/products';
import { solvingPolynomialEquations } from '../algebra2/polynomials/solving';
import { descartesRule, fundamentalTheorem, rationalZeroTheorem } from '../algebra2/polynomials/theorems';
import { conjugateFactoring, conjugateWriting, writingFromZeros } from '../algebra2/polynomials/zeros';

const addSubtract = variant(polynomialOperations, {
  id: 'alg2.poly.add-subtract',
  title: 'Adding and Subtracting Polynomials',
  subject: 'algebra2',
  category: CATEGORY,
  description: 'Add and subtract polynomials by combining like terms.',
  fixed: { operation: 'addsub' },
});

const multiply = variant(polynomialOperations, {
  id: 'alg2.poly.multiply',
  title: 'Multiplying Polynomials',
  subject: 'algebra2',
  category: CATEGORY,
  description: 'Multiply monomials, binomials and trinomials by distributing.',
  fixed: { operation: 'multiply' },
});

const topics: TopicGenerator[] = [
  namingPolynomials,
  addSubtract,
  multiply,
  specialProducts,
  binomialTheorem,
  dividingPolynomials,
  factoringByGrouping,
  factoringCubes,
  factoringQuadraticForm,
  factoringAll,
  remainderTheorem,
  writingFromZeros,
  conjugateFactoring,
  conjugateWriting,
  descartesRule,
  rationalZeroTheorem,
  fundamentalTheorem,
  solvingPolynomialEquations,
  endBehavior,
  graphingPolynomials,
];

export default topics;
