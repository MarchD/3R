import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseFitBuffer } from '../fit/parser/fitDecoder';
import { createRepairCandidates } from '../fit/repair/createRepairCandidates';
import { applyRepairPatch } from '../fit/repair/applyRepairPatch';
import { encodeRepairedFit } from '../fit/encoder/fitEncoder';
import { Decoder, Stream } from '@garmin/fitsdk';

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
    const { patch } = applyRepairPatch('fixture.fit', parsed.normalized, candidates[0], '2024-01-01T00:00:00.000Z');
    const exported = encodeRepairedFit(buffer, patch);
    const exportedBuffer = exported.bytes.buffer.slice(exported.bytes.byteOffset, exported.bytes.byteOffset + exported.bytes.byteLength);
    const exportedDecoder = new Decoder(Stream.fromArrayBuffer(exportedBuffer));
    expect(exportedDecoder.checkIntegrity()).toBe(true);
    const exportedMessages = exportedDecoder.read().messages;
    expect(exportedMessages.recordMesgs).toHaveLength(4_372);
    expect(exportedMessages.sessionMesgs?.[0]?.totalDistance).toBeCloseTo(12_733.56, 1);
    expect(exported.report.messageCount).toBe(9_387);
  });
});
