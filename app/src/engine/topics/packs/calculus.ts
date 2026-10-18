/** Calculus topics, in curriculum order. */
import type { TopicGenerator } from '../../types';
import { derivatives } from '../calculus/derivatives';
import { integrals } from '../calculus/integrals';
import { limits } from '../calculus/limits';
import { continuity, limitsAtInfinity, oneSidedLimits, trigLimits } from '../calculus/limits-more';

const topics: TopicGenerator[] = [
  // Limits and Continuity
  limits,
  limitsAtInfinity,
  oneSidedLimits,
  trigLimits,
  continuity,
  // Differentiation
  derivatives,
  // Integration
  integrals,
];

export default topics;
