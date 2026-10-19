/** Precalculus topics, in curriculum order. */
import type { TopicGenerator } from '../../types';
import { composition } from '../precalculus/composition';
import { domainRange } from '../precalculus/domain-range';
import { evenOdd } from '../precalculus/even-odd';
import { piecewiseEvaluate, piecewiseGraph } from '../precalculus/piecewise';
import { sequencesSeries } from '../precalculus/sequences';
import { transformations } from '../precalculus/transformations';
import { vectors } from '../precalculus/vectors';

const topics: TopicGenerator[] = [domainRange, evenOdd, transformations, piecewiseEvaluate, piecewiseGraph, composition, sequencesSeries, vectors];

export default topics;
