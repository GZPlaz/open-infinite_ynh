/** Multivariable Calculus (Calculus 3) topics, in curriculum order. */
import type { TopicGenerator } from '../../types';
import { doubleGeneral, doubleRect, polarDouble, reverseOrder } from '../multivariable/integrals';
import { applicationsMultiple, cylSphIntegrals, tripleIntegrals } from '../multivariable/triple';
import { conservativeFields, divCurl, ftli, lineIntegrals, vectorFields } from '../multivariable/vfields';
import { divergenceTheorem, greensTheorem, stokesTheorem, surfaceIntegrals } from '../multivariable/vtheorems';
import { gradient, lagrange, localExtrema, tangentPlanes } from '../multivariable/optimization';
import { chainRule, multiLimits, partialDerivatives, severalVariables } from '../multivariable/partials';
import { cylSph, linesPlanes, quadricSurfaces } from '../multivariable/space';
import { dotCross, vectors3d } from '../multivariable/vectors';
import { arcCurvature, motionSpace, spaceCurves } from '../multivariable/vvf';

const topics: TopicGenerator[] = [vectors3d, dotCross, linesPlanes, quadricSurfaces, cylSph, spaceCurves, arcCurvature, motionSpace, severalVariables, multiLimits, partialDerivatives, chainRule, gradient, tangentPlanes, localExtrema, lagrange, doubleRect, doubleGeneral, reverseOrder, polarDouble, tripleIntegrals, cylSphIntegrals, applicationsMultiple, vectorFields, divCurl, conservativeFields, lineIntegrals, ftli, greensTheorem, surfaceIntegrals, stokesTheorem, divergenceTheorem];

export default topics;
