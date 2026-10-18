/** Pre-Algebra topics, in curriculum order (grouped by category in the picker). */
import type { TopicGenerator } from '../../types';
import { evaluatingExpressions } from '../prealgebra/evaluating';
import { convertingFdp, decimalOperations, simplifyingFractions } from '../prealgebra/fdp';
import { fractionOperations } from '../prealgebra/fractions';
import { absoluteValue, addSubIntegers, mulDivIntegers } from '../prealgebra/integers';
import { gcfLcm, primeFactorization } from '../prealgebra/number-theory';
import { orderOfOperations } from '../prealgebra/order-of-operations';
import { proportions, ratiosRates } from '../prealgebra/ratios';
import { twoStepEquations } from '../prealgebra/two-step';

const topics: TopicGenerator[] = [
  // Integers and Order of Operations
  addSubIntegers,
  mulDivIntegers,
  absoluteValue,
  orderOfOperations,
  evaluatingExpressions,
  // Number Theory
  primeFactorization,
  gcfLcm,
  // Fractions, Decimals and Percents
  simplifyingFractions,
  fractionOperations,
  decimalOperations,
  convertingFdp,
  // Ratios, Rates and Percents
  ratiosRates,
  proportions,
  // Equations and Inequalities
  twoStepEquations,
];

export default topics;
