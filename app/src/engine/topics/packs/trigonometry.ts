/** Trigonometry topics, in curriculum order. */
import type { TopicGenerator } from '../../types';
import { anglesStandardPosition, coterminalAngles, degreesMinutesSeconds, radiansDegrees } from '../trigonometry/angles';
import { arcSector } from '../trigonometry/arc-sector';
import { trigEquations } from '../trigonometry/equations';
import { trigFunctionsAnyAngle } from '../trigonometry/functions';
import { graphingTrig } from '../trigonometry/graphing';
import { graphingReciprocal, sinusoidalModels, sinusoidEquations } from '../trigonometry/graphs2';
import { doubleHalfIdentities, sumDifferenceIdentities } from '../trigonometry/identities';
import { fundamentalIdentities, productSumIdentities, verifyingIdentities } from '../trigonometry/identities2';
import { inverseCompositions, inverseEvaluate } from '../trigonometry/inverse';
import { lawOfCosines, lawOfSines, triangleArea } from '../trigonometry/laws';
import { lawsApplications } from '../trigonometry/laws-apps';
import { multipleAngleEquations } from '../trigonometry/multiple-angle';
import { trigComplexForm, trigDotProduct, trigPolarEquations, trigPolarGraphs, trigPolarPoints, vectorMagnitudeDirection } from '../trigonometry/polar-vectors';
import { linearAngularSpeed, referenceAngles } from '../trigonometry/reference-speed';
import { rightTrigAngles, rightTrigRatios, solveRightTriangles } from '../trigonometry/right-triangles';
import { unitCircle } from '../trigonometry/unit-circle';

const topics: TopicGenerator[] = [
  // Angles and Angle Measure
  anglesStandardPosition,
  referenceAngles,
  radiansDegrees,
  degreesMinutesSeconds,
  coterminalAngles,
  arcSector,
  linearAngularSpeed,
  // Right Triangle Trigonometry
  rightTrigRatios,
  rightTrigAngles,
  solveRightTriangles,
  // Trigonometric Functions
  unitCircle,
  trigFunctionsAnyAngle,
  graphingTrig,
  graphingReciprocal,
  sinusoidEquations,
  sinusoidalModels,
  // Inverse Trigonometric Functions
  inverseEvaluate,
  inverseCompositions,
  // Laws of Sines and Cosines
  lawOfSines,
  lawOfCosines,
  triangleArea,
  lawsApplications,
  // Trigonometric Identities and Equations
  fundamentalIdentities,
  verifyingIdentities,
  sumDifferenceIdentities,
  doubleHalfIdentities,
  productSumIdentities,
  trigEquations,
  multipleAngleEquations,
  // Polar Coordinates, Complex Numbers and Vectors
  trigPolarPoints,
  trigPolarEquations,
  trigPolarGraphs,
  trigComplexForm,
  vectorMagnitudeDirection,
  trigDotProduct,
];

export default topics;
