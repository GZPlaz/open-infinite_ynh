/** Algebra 2: radical functions, rational exponents and rational expressions. */
import type { TopicGenerator } from '../../types';
import { radicalEquations, rationalExponentEquations } from '../algebra2/radicals/equations';
import { convertRationalExponents, evaluateRationalExponents, rationalExponentProperties } from '../algebra2/radicals/exponents';
import { graphRadicals, radicalDomainRange } from '../algebra2/radicals/graphs';
import { divideRadicals, multiplyRadicals } from '../algebra2/radicals/operations';
import { addRadicals, simplifyRadicals } from '../algebra2/radicals/simplify';
import { rationalEquations } from '../algebra2/rational/equations';
import { addSubtractRational, complexFractions, multiplyDivideRational, simplifyRational } from '../algebra2/rational/expressions';
import { graphRational } from '../algebra2/rational/graph';

const topics: TopicGenerator[] = [
  // Radical Functions and Rational Exponents
  simplifyRadicals,
  addRadicals,
  multiplyRadicals,
  divideRadicals,
  convertRationalExponents,
  evaluateRationalExponents,
  rationalExponentProperties,
  radicalEquations,
  rationalExponentEquations,
  graphRadicals,
  radicalDomainRange,
  // Rational Expressions
  graphRational,
  simplifyRational,
  multiplyDivideRational,
  addSubtractRational,
  complexFractions,
  rationalEquations,
];

export default topics;
