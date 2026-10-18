/** Algebra 2: radical functions, rational exponents and rational expressions. */
import type { TopicGenerator } from '../../types';
import { convertRationalExponents, evaluateRationalExponents, rationalExponentProperties } from '../algebra2/radicals/exponents';
import { divideRadicals, multiplyRadicals } from '../algebra2/radicals/operations';
import { addRadicals, simplifyRadicals } from '../algebra2/radicals/simplify';

const topics: TopicGenerator[] = [
  simplifyRadicals,
  addRadicals,
  multiplyRadicals,
  divideRadicals,
  convertRationalExponents,
  evaluateRationalExponents,
  rationalExponentProperties,
];

export default topics;
