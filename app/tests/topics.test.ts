/**
 * PACK=<name> [TOPIC=<id prefix>] fuzzes one pack (tests/fuzz.ts). Without
 * PACK it fuzzes the topics no pack lists — the packs themselves run from
 * tests/fuzz/<pack>.test.ts, one file each so they run in parallel — and
 * checks that every pack has such a file.
 */
import { describe, expect, it } from 'vitest';
import { TOPICS } from '../src/engine/topics';
import { fuzzTopics, loadPack, PACKS } from './fuzz';

const PACK = process.env.PACK;
const ONLY = process.env.TOPIC;
const names = Object.keys(PACKS).map((p) => p.replace(/^.*\/|\.ts$/g, ''));

if (PACK) {
  const topics = await loadPack(PACK);
  fuzzTopics(ONLY ? topics.filter((t) => t.id.startsWith(ONLY)) : topics);
} else {
  const packed = new Set((await Promise.all(names.map(loadPack))).flat());
  const unpacked = TOPICS.filter((t) => !packed.has(t) && (!ONLY || t.id.startsWith(ONLY)));
  if (unpacked.length) fuzzTopics(unpacked);

  const files = import.meta.glob('./fuzz/*.test.ts');
  describe('fuzz files', () => {
    it('exist for every pack', () => {
      const missing = names.filter((n) => !(`./fuzz/${n}.test.ts` in files));
      expect(missing, 'add tests/fuzz/<pack>.test.ts calling fuzzPack(<pack>)').toEqual([]);
    });
  });
}
