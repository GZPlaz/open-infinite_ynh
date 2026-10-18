/** Algebra 2: sequences and series, probability and statistics. */
import type { TopicGenerator } from '../../types';
import { arithmeticSequences, geometricSequences } from '../algebra2/sequences/arith-geom';
import { generalSequences } from '../algebra2/sequences/general';
import { means } from '../algebra2/sequences/means';
import { arithmeticSeries, generalSeries, geometricSeries } from '../algebra2/sequences/series';

const topics: TopicGenerator[] = [
  generalSequences,
  arithmeticSequences,
  geometricSequences,
  means,
  generalSeries,
  arithmeticSeries,
  geometricSeries,
];

export default topics;
