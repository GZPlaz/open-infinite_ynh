/**
 * The registry must expose every topic generator exported from src/engine/topics,
 * whether or not a pack lists it — so a new topic is available as soon as it exists.
 */
import { describe, expect, it } from 'vitest';
import { getTopic, TOPICS } from '../src/engine/topics';
import { SUBJECTS, type TopicGenerator } from '../src/engine/types';

const modules = import.meta.glob<Record<string, unknown>>(['../src/engine/topics/**/*.ts', '!../src/engine/topics/packs/**', '!../src/engine/topics/index.ts'], { eager: true });
const exported = new Set<TopicGenerator>();
for (const m of Object.values(modules)) {
  for (const v of Object.values(m)) {
    const t = v as Partial<TopicGenerator> | null;
    if (t && typeof t === 'object' && typeof t.id === 'string' && typeof t.subject === 'string' && typeof t.generate === 'function') exported.add(t as TopicGenerator);
  }
}

describe('topic registry', () => {
  it('contains every exported topic generator', () => {
    const missing = [...exported].filter((t) => !TOPICS.includes(t)).map((t) => t.id);
    expect(missing).toEqual([]);
    // (packs may also define a few topics inline, e.g. variants, so TOPICS can be larger)
    expect(TOPICS.length).toBeGreaterThanOrEqual(exported.size);
  });

  it('has unique ids that resolve through getTopic', () => {
    for (const t of TOPICS) expect(getTopic(t.id)).toBe(t);
    expect(new Set(TOPICS.map((t) => t.id)).size).toBe(TOPICS.length);
  });

  it('keeps subjects in curriculum order', () => {
    const rank = (s: string) => SUBJECTS.findIndex((x) => x.id === s);
    const ranks = TOPICS.map((t) => rank(t.subject));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it('lists the writing-expressions topic under Pre-Algebra', () => {
    expect(getTopic('prealg.verbal-expressions')?.subject).toBe('prealgebra');
  });
});
