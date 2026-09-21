import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseFitBuffer } from '../fit/parser/fitDecoder';
import { createRepairCandidates } from '../fit/repair/createRepairCandidates';

const fixturePath = process.env.FIT_FIXTURE;

describe.runIf(Boolean(fixturePath))('provided damaged FIT fixture', () => {
  it('matches the known decoded profile and three repair distances', () => {
    const bytes = readFileSync(fixturePath!);
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const parsed = parseFitBuffer(buffer, { name: 'fixture.fit', size: bytes.byteLength, lastModified: 0 });
    const candidates = createRepairCandidates(parsed.normalized);
    expect(parsed.normalized.records).toHaveLength(4_372);
    expect(parsed.normalized.records.filter((record) => record.position?.latitude != null)).toHaveLength(317);
    expect(parsed.normalized.session?.totalDistanceM).toBeCloseTo(35_100.96, 2);
    const distances = candidates.map((candidate) => candidate.distanceM / 1000);
    expect(distances[0]).toBeCloseTo(12.734, 3);
    expect(distances[1]).toBeCloseTo(12.669, 3);
    expect(distances[2]).toBeCloseTo(12.542, 3);
    expect(candidates[2].calculation.replacedSamples).toBe(127);
  });
});
