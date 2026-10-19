/**
 * Registry of every topic generator, in curriculum order. Topics live in
 * packs (one per subject or unit, see ./packs); within a subject the topic
 * picker groups them by `category` in order of first appearance.
 */
import type { SubjectId, TopicGenerator } from '../types';
import algebra1 from './packs/algebra1';
import alg2Conics from './packs/alg2-conics';
import alg2ExpLog from './packs/alg2-explog';
import alg2Polynomials from './packs/alg2-polynomials';
import alg2Quadratics from './packs/alg2-quadratics-functions';
import alg2Radicals from './packs/alg2-radicals-rational';
import alg2Sequences from './packs/alg2-sequences-probability';
import alg2Systems from './packs/alg2-systems-matrices-complex';
import calculus from './packs/calculus';
import geometry from './packs/geometry';
import prealgebra from './packs/prealgebra';
import precalculus from './packs/precalculus';
import trigonometry from './packs/trigonometry';

export const TOPICS: readonly TopicGenerator[] = [
  ...prealgebra,
  ...algebra1,
  ...alg2Systems,
  ...alg2Quadratics,
  ...alg2Polynomials,
  ...alg2Radicals,
  ...alg2Conics,
  ...alg2ExpLog,
  ...alg2Sequences,
  ...geometry,
  ...trigonometry,
  ...precalculus,
  ...calculus,
];

const BY_ID = new Map(TOPICS.map((t) => [t.id, t]));
if (BY_ID.size !== TOPICS.length) {
  const seen = new Set<string>();
  const dup = TOPICS.find((t) => seen.size === seen.add(t.id).size);
  throw new Error(`duplicate topic id ${dup?.id}`);
}

export function getTopic(id: string): TopicGenerator | undefined {
  return BY_ID.get(id);
}

export function topicsFor(subject: SubjectId): TopicGenerator[] {
  return TOPICS.filter((t) => t.subject === subject);
}

/** A subject's topics grouped by category (uncategorised topics under ''). */
export function categoriesFor(subject: SubjectId): Array<{ category: string; topics: TopicGenerator[] }> {
  const out: Array<{ category: string; topics: TopicGenerator[] }> = [];
  for (const t of topicsFor(subject)) {
    const name = t.category ?? '';
    let g = out.find((x) => x.category === name);
    if (!g) out.push((g = { category: name, topics: [] }));
    g.topics.push(t);
  }
  return out;
}
