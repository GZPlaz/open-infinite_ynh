/** Precalculus topics, in curriculum order. */
import type { TopicGenerator } from '../../types';
import { domainRange } from '../precalculus/domain-range';
import { sequencesSeries } from '../precalculus/sequences';
import { vectors } from '../precalculus/vectors';

const topics: TopicGenerator[] = [domainRange, sequencesSeries, vectors];

export default topics;
