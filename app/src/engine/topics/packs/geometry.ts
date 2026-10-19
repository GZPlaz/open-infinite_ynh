/** Geometry topics, in curriculum order (grouped by category in the topic picker). */
import type { TopicGenerator } from '../../types';
import { angleRelationships } from '../geometry/angles';
import { areaPerimeter } from '../geometry/area-perimeter';
import { angleAddition, classifyAngles, midpointEndpoint, segmentAddition } from '../geometry/basics';
import { triangleCongruence } from '../geometry/congruence';
import { coordinateGeometry } from '../geometry/coordinate';
import { parallelPerpendicular, parallelTransversal } from '../geometry/parallel';
import { pythagoreanTheorem } from '../geometry/pythagorean';
import { elevationDepression, pythagoreanConverse, specialRightTriangles } from '../geometry/right-triangles';
import { transformations } from '../geometry/transformations';
import { trigRatios } from '../geometry/trig-ratios';
import { centroids, classifyTriangles, isoscelesEquilateral, midsegments, triangleAngleSum, triangleInequality } from '../geometry/triangles';
import { volumeSurfaceArea } from '../geometry/volume';

const topics: TopicGenerator[] = [
  // Basics of Geometry
  segmentAddition,
  coordinateGeometry,
  midpointEndpoint,
  angleAddition,
  classifyAngles,
  angleRelationships,
  // Parallel and Perpendicular Lines
  parallelTransversal,
  parallelPerpendicular,
  // Triangles
  classifyTriangles,
  triangleAngleSum,
  isoscelesEquilateral,
  triangleCongruence,
  triangleInequality,
  midsegments,
  centroids,
  // Right Triangles and Trigonometry
  pythagoreanTheorem,
  pythagoreanConverse,
  specialRightTriangles,
  trigRatios,
  elevationDepression,
  // Polygons and Quadrilaterals
  areaPerimeter,
  // Transformations
  transformations,
  // Solids
  volumeSurfaceArea,
];

export default topics;
