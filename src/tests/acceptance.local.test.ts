import { readFileSync } from 'node:fs';
import { Decoder, Stream } from '@garmin/fitsdk';
import { describe, expect, it } from 'vitest';
import { encodeRepairedFit } from '../fit/encoder/fitEncoder';
import { parseFitBuffer } from '../fit/parser/fitDecoder';
import {
  analyzeGpsEvidence,
  buildHeadingGuide,
  createGpsMatchProposal,
  hasUsableGpsShape,
} from '../fit/gps/traceAnalysis';
import { estimateDistanceConsensus } from '../fit/repair/distanceConsensus';
import { applyRepairPatch } from '../fit/repair/applyRepairPatch';
import { applyGpsRepair } from '../fit/repair/applyGpsRepair';
import { createRepairCandidates } from '../fit/repair/createRepairCandidates';

const fixturePath = process.env.FIT_FIXTURE;

describe.runIf(Boolean(fixturePath))('provided damaged FIT fixture', () => {
  it('matches the known decoded profile and three repair distances', () => {
    const bytes = readFileSync(fixturePath!);
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const parsed = parseFitBuffer(buffer, {
      name: 'fixture.fit',
      size: bytes.byteLength,
      lastModified: 0,
    });
    const candidates = createRepairCandidates(parsed.normalized);
    const evidence = analyzeGpsEvidence(parsed.normalized);
    const consensus = estimateDistanceConsensus(parsed.normalized);
    const headings = parsed.normalized.records.filter(
      (record) => record.headingDeg != null || record.trackDeg != null,
    );
    const guide = consensus
      ? buildHeadingGuide(
          parsed.normalized,
          { latitude: 50.45, longitude: 30.52 },
          consensus.distanceM,
        )
      : [];
    expect(consensus?.distanceM).toBeCloseTo(12_669, 0);
    expect(evidence.sourcePoints).toHaveLength(317);
    expect(evidence.cleanedPoints).toHaveLength(7);
    expect(hasUsableGpsShape(evidence)).toBe(false);
    expect(headings).toHaveLength(0);
    expect(guide).toHaveLength(0);
    expect(parsed.normalized.records).toHaveLength(4_372);
    expect(
      parsed.normalized.records.filter((record) => record.position?.latitude != null),
    ).toHaveLength(317);
    expect(parsed.normalized.session?.totalDistanceM).toBeCloseTo(35_100.96, 2);
    const distances = candidates.map((candidate) => candidate.distanceM / 1000);
    expect(distances[0]).toBeCloseTo(12.734, 3);
    expect(distances[1]).toBeCloseTo(12.669, 3);
    expect(distances[2]).toBeCloseTo(12.542, 3);
    expect(candidates[2].calculation.replacedSamples).toBe(127);
    const { patch } = applyRepairPatch(
      'fixture.fit',
      parsed.normalized,
      candidates[0],
      '2024-01-01T00:00:00.000Z',
    );
    const exported = encodeRepairedFit(buffer, patch);
    const exportedBuffer = exported.bytes.buffer.slice(
      exported.bytes.byteOffset,
      exported.bytes.byteOffset + exported.bytes.byteLength,
    );
    const exportedDecoder = new Decoder(Stream.fromArrayBuffer(exportedBuffer));
    expect(exportedDecoder.checkIntegrity()).toBe(true);
    const exportedMessages = exportedDecoder.read().messages;
    expect(exportedMessages.recordMesgs).toHaveLength(4_372);
    expect(exportedMessages.sessionMesgs?.[0]?.totalDistance).toBeCloseTo(12_733.56, 1);
    expect(exported.report.messageCount).toBe(9_387);

    const start = { latitude: 50.45, longitude: 30.52 };
    const proposal = createGpsMatchProposal(
      parsed.normalized,
      { ...evidence, cleanedPoints: [] },
      [{ ...start, recordIndex: 0 }],
      [start, { latitude: 50.56, longitude: 30.52 }],
      [],
      {
        distanceM: consensus!.distanceM,
        source: 'repair_consensus',
        recordProgresses: consensus!.recordProgresses,
        recordPatches: consensus!.recordPatches,
      },
      'generated_loop',
    );
    const gpsRepair = applyGpsRepair('fixture.fit', parsed.normalized, proposal);
    expect(gpsRepair.repairedActivity.session?.totalDistanceM).toBeCloseTo(12_669, 0);
    expect(gpsRepair.patch.recordPatches).toHaveLength(4_372);
    expect(gpsRepair.patch.positionPatches).toHaveLength(4_372);
    const gpsExport = encodeRepairedFit(buffer, gpsRepair.patch);
    const gpsExportBuffer = gpsExport.bytes.buffer.slice(
      gpsExport.bytes.byteOffset,
      gpsExport.bytes.byteOffset + gpsExport.bytes.byteLength,
    );
    const gpsDecoder = new Decoder(Stream.fromArrayBuffer(gpsExportBuffer));
    expect(gpsDecoder.checkIntegrity()).toBe(true);
    expect(gpsDecoder.read().messages.sessionMesgs?.[0]?.totalDistance).toBeCloseTo(12_669, 0);
  });
});
