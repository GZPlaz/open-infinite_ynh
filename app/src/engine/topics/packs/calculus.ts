/** Calculus topics, in curriculum order. */
import type { TopicGenerator } from '../../types';
import { derivatives } from '../calculus/derivatives';
import { integrals } from '../calculus/integrals';
import { limits } from '../calculus/limits';
import { expLogDerivatives, higherOrderDerivatives, implicitDifferentiation, inverseTrigDerivatives, trigDerivatives } from '../calculus/diff-more';
import { concavity, extrema, lhopital, meanValueTheorem, motion, optimization, relatedRates, tangentLines } from '../calculus/applications';
import { averageValue, definiteIntegrals, ftc, integrationByParts, riemannSums, trigExpIntegrals, uSubstitution } from '../calculus/integration';
import { chainRule, derivativeDefinition, productRule, quotientRule } from '../calculus/diff-rules';
import { continuity, limitsAtInfinity, oneSidedLimits, trigLimits } from '../calculus/limits-more';

const topics: TopicGenerator[] = [
  // Limits and Continuity
  limits,
  limitsAtInfinity,
  oneSidedLimits,
  trigLimits,
  continuity,
  // Differentiation
  derivativeDefinition,
  derivatives,
  productRule,
  quotientRule,
  chainRule,
  trigDerivatives,
  expLogDerivatives,
  inverseTrigDerivatives,
  implicitDifferentiation,
  higherOrderDerivatives,
  // Applications of Differentiation
  tangentLines,
  relatedRates,
  extrema,
  concavity,
  meanValueTheorem,
  motion,
  lhopital,
  optimization,
  // Integration
  riemannSums,
  integrals,
  definiteIntegrals,
  uSubstitution,
  integrationByParts,
  trigExpIntegrals,
  ftc,
  averageValue,
];

export default topics;
