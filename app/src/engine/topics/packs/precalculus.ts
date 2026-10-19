/** Precalculus topics, in curriculum order. */
import type { TopicGenerator } from '../../types';
import { composition } from '../precalculus/composition';
import { dotProduct } from '../precalculus/dot-product';
import { domainRange } from '../precalculus/domain-range';
import { evenOdd } from '../precalculus/even-odd';
import { piecewiseEvaluate, piecewiseGraph } from '../precalculus/piecewise';
import { partialFractions } from '../precalculus/partial-fractions';
import { polarEquations } from '../precalculus/polar-equations';
import { polarPoints } from '../precalculus/polar-points';
import { rationalGraphs } from '../precalculus/rational-graphs';
import { rationalInequalities } from '../precalculus/rational-inequalities';
import { sequencesSeries } from '../precalculus/sequences';
import { transformations } from '../precalculus/transformations';
import { vectors } from '../precalculus/vectors';

const topics: TopicGenerator[] = [domainRange, evenOdd, transformations, piecewiseEvaluate, piecewiseGraph, composition, rationalGraphs, partialFractions, rationalInequalities, vectors, dotProduct, polarPoints, polarEquations, sequencesSeries];

export default topics;
