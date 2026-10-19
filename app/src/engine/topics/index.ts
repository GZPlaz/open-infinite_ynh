/**
 * Registry of every topic generator, in curriculum order. Topics live in
 * packs (one per subject or unit, see ./packs), which fix their order; any
 * topic exported from a file here but not listed in a pack is discovered and
 * added automatically. Within a subject the topic picker groups them by
 * `category` in order of first appearance.
 */
import { SUBJECTS, type SubjectId, type TopicGenerator } from '../types';
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

/** Topics the packs list explicitly, in curriculum order. */
const PACKED: readonly TopicGenerator[] = [
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

const isTopic = (v: unknown): v is TopicGenerator =>
  typeof v === 'object' && v !== null && typeof (v as TopicGenerator).id === 'string' && typeof (v as TopicGenerator).subject === 'string' && typeof (v as TopicGenerator).generate === 'function';

/**
 * Every topic generator exported anywhere under ./ (packs excluded), found at
 * build time. Dropping a new `export const x = defineTopic({...})` into any
 * topic file is enough for it to show up in the app — packs only decide the
 * order. Sorted by path so the result is deterministic.
 */
function discover(): TopicGenerator[] {
  const modules = import.meta.glob<Record<string, unknown>>(['./**/*.ts', '!./packs/**', '!./index.ts'], { eager: true });
  const found = new Set<TopicGenerator>();
  for (const path of Object.keys(modules).sort()) {
    for (const value of Object.values(modules[path]!)) if (isTopic(value)) found.add(value);
  }
  return [...found];
}

/**
 * Packed topics first (curriculum order), then any discovered topic no pack
 * lists, placed after the last topic of its own subject (and its category
 * when that category already exists in the subject).
 */
function assemble(): TopicGenerator[] {
  const all = [...PACKED];
  const listed = new Set(all);
  for (const t of discover()) {
    if (listed.has(t)) continue;
    let at = -1;
    for (let i = all.length - 1; i >= 0 && at < 0; i--) if (all[i]!.subject === t.subject && all[i]!.category === t.category) at = i;
    for (let i = all.length - 1; i >= 0 && at < 0; i--) if (all[i]!.subject === t.subject) at = i;
    if (at < 0) {
      // subject with no packed topics yet: keep the SUBJECTS order
      const rank = (s: string) => SUBJECTS.findIndex((x) => x.id === s);
      at = all.reduce((last, x, i) => (rank(x.subject) < rank(t.subject) ? i : last), -1);
    }
    all.splice(at + 1, 0, t);
    listed.add(t);
  }
  return all;
}

export const TOPICS: readonly TopicGenerator[] = assemble();

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
