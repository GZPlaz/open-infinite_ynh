/** Algebra 2: sequences and series, probability and statistics. */
import type { TopicGenerator } from '../../types';
import { combinations, countingPrinciple, permutations, permVsComb } from '../algebra2/probability/counting';
import { indepDep2, indepDepWord, mutex, mutexWord, permCombProbability } from '../algebra2/probability/events';
import { arithmeticSequences, geometricSequences } from '../algebra2/sequences/arith-geom';
import { generalSequences } from '../algebra2/sequences/general';
import { means } from '../algebra2/sequences/means';
import { arithmeticSeries, generalSeries, geometricSeries } from '../algebra2/sequences/series';

const topics: TopicGenerator[] = [
  // Sequences and Series
  generalSequences,
  arithmeticSequences,
  geometricSequences,
  means,
  generalSeries,
  arithmeticSeries,
  geometricSeries,
  // Probability and Statistics
  countingPrinciple,
  indepDepWord,
  indepDep2,
  mutexWord,
  mutex,
  permutations,
  combinations,
  permVsComb,
  permCombProbability,
];

export default topics;
