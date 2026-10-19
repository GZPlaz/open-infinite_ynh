/** Algebra 2: conic sections. */
import type { TopicGenerator } from '../../types';
import { circleGraph, circleWrite } from '../algebra2/conics/circles';
import { classifyConics } from '../algebra2/conics/classify';
import { ellipseGraph, ellipseWrite } from '../algebra2/conics/ellipses';
import { hyperbolaGraph, hyperbolaWrite } from '../algebra2/conics/hyperbolas';
import { parabolaGraph, parabolaWrite } from '../algebra2/conics/parabolas';
import { quadraticSystems } from '../algebra2/conics/systems';

const topics: TopicGenerator[] = [
  parabolaGraph,
  parabolaWrite,
  circleGraph,
  circleWrite,
  ellipseGraph,
  ellipseWrite,
  hyperbolaGraph,
  hyperbolaWrite,
  classifyConics,
  quadraticSystems,
];

export default topics;
