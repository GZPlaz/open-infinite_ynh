/** Calculus topics, in curriculum order. */
import type { TopicGenerator } from '../../types';
import { derivatives } from '../calculus/derivatives';
import { integrals } from '../calculus/integrals';
import { limits } from '../calculus/limits';
import { expLogDerivatives, higherOrderDerivatives, implicitDifferentiation, inverseTrigDerivatives, trigDerivatives } from '../calculus/diff-more';
import { concavity, extrema, lhopital, meanValueTheorem, motion, optimization, relatedRates, tangentLines } from '../calculus/applications';
import { averageValue, definiteIntegrals, ftc, integrationByParts, riemannSums, trigExpIntegrals, uSubstitution } from '../calculus/integration';
import { areaBetweenCurves, crossSections, shellMethod, volumesOfRevolution } from '../calculus/integration-apps';
import { improperIntegrals, partialFractions, trigIntegrals, trigSubstitution } from '../calculus/techniques';
import { eulersMethod, exponentialModels, logisticGrowth, separableEquations, slopeFields } from '../calculus/diffeq';
import { arcLength, parametricDerivatives, polarArea, polarDerivatives, vectorFunctions } from '../calculus/parametric';
import { alternatingSeries, comparisonTests, geometricSeries, lagrangeError, maclaurinSeries, powerSeriesInterval, pSeries, ratioRootTests, sequenceConvergence, taylorPolynomials } from '../calculus/series';
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
  // Techniques of Integration
  partialFractions,
  trigIntegrals,
  trigSubstitution,
  improperIntegrals,
  // Applications of Integration
  areaBetweenCurves,
  volumesOfRevolution,
  crossSections,
  shellMethod,
  // Differential Equations
  slopeFields,
  eulersMethod,
  separableEquations,
  exponentialModels,
  logisticGrowth,
  // Parametric, Polar and Vector-Valued Functions
  parametricDerivatives,
  arcLength,
  polarDerivatives,
  polarArea,
  vectorFunctions,
  // Infinite Sequences and Series
  sequenceConvergence,
  geometricSeries,
  pSeries,
  comparisonTests,
  ratioRootTests,
  alternatingSeries,
  powerSeriesInterval,
  taylorPolynomials,
  maclaurinSeries,
  lagrangeError,
];

export default topics;
