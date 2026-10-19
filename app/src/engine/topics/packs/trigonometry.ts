/** Trigonometry topics, in curriculum order. */
import type { TopicGenerator } from '../../types';
import { anglesStandardPosition, coterminalAngles, degreesMinutesSeconds, radiansDegrees } from '../trigonometry/angles';
import { arcSector } from '../trigonometry/arc-sector';
import { trigEquations } from '../trigonometry/equations';
import { trigFunctionsAnyAngle } from '../trigonometry/functions';
import { graphingTrig } from '../trigonometry/graphing';
import { doubleHalfIdentities, sumDifferenceIdentities } from '../trigonometry/identities';
import { lawOfCosines, lawOfSines, triangleArea } from '../trigonometry/laws';
import { rightTrigAngles, rightTrigRatios, solveRightTriangles } from '../trigonometry/right-triangles';

const topics: TopicGenerator[] = [
  // Angles and Angle Measure
  anglesStandardPosition,
  radiansDegrees,
  degreesMinutesSeconds,
  coterminalAngles,
  arcSector,
  // Right Triangle Trigonometry
  rightTrigRatios,
  rightTrigAngles,
  solveRightTriangles,
  // Trigonometric Functions
  trigFunctionsAnyAngle,
  graphingTrig,
  // Laws of Sines and Cosines
  lawOfSines,
  lawOfCosines,
  triangleArea,
  // Trigonometric Identities and Equations
  sumDifferenceIdentities,
  doubleHalfIdentities,
  trigEquations,
];

export default topics;
