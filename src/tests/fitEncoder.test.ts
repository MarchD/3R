import { Decoder, Encoder, Profile, Stream } from '@garmin/fitsdk';
import { describe, expect, it } from 'vitest';
import { encodeRepairedFit } from '../fit/encoder/fitEncoder';
import type { RepairPatch } from '../models/repair';

function sourceFit(): Uint8Array {
  const encoder = new Encoder();
  const start = new Date('2024-01-01T00:00:00.000Z');
  const end = new Date('2024-01-01T00:00:02.000Z');
  encoder.onMesg(Profile.MesgNum.FILE_ID, {
    type: 'activity',
    manufacturer: 'development',
    product: 1,
    timeCreated: start,
  });
  [0, 1, 2].forEach((second) =>
    encoder.onMesg(Profile.MesgNum.RECORD, {
      timestamp: new Date(start.getTime() + second * 1000),
      distance: second * 3,
      enhancedSpeed: 3,
      heartRate: 140 + second,
    }),
  );
  encoder.onMesg(Profile.MesgNum.LAP, {
    messageIndex: 0,
    timestamp: end,
    startTime: start,
    totalElapsedTime: 2,
    totalTimerTime: 2,
    totalDistance: 6,
  });
  encoder.onMesg(Profile.MesgNum.SESSION, {
    messageIndex: 0,
    timestamp: end,
    startTime: start,
    totalElapsedTime: 2,
    totalTimerTime: 2,
    totalDistance: 100,
    sport: 'running',
    firstLapIndex: 0,
    numLaps: 1,
  });
  encoder.onMesg(Profile.MesgNum.ACTIVITY, {
    timestamp: end,
    totalTimerTime: 2,
    numSessions: 1,
    type: 'manual',
  });
  return encoder.close();
}

describe('FIT export', () => {
  it('encodes, CRC-validates, and decodes a repaired FIT derivative', () => {
    const source = sourceFit();
    const patch: RepairPatch = {
      sourceFileName: 'source.fit',
      createdAt: '2024-01-01T00:00:00.000Z',
      algorithm: 'cleaned_speed_integration',
      originalSummary: { totalDistanceM: 100, elapsedTimeS: 2 },
      repairedSummary: { totalDistanceM: 8, elapsedTimeS: 2, averagePaceSPerKm: 250 },
      recordPatches: [
        { recordIndex: 0, distanceM: 0, derivedSpeedMps: 4 },
        { recordIndex: 1, distanceM: 4, derivedSpeedMps: 4 },
        { recordIndex: 2, distanceM: 8, derivedSpeedMps: 4 },
      ],
      assumptions: [],
      warnings: [],
    };
    const buffer = source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
    const exported = encodeRepairedFit(buffer, patch);
    const decoder = new Decoder(
      Stream.fromArrayBuffer(
        exported.bytes.buffer.slice(
          exported.bytes.byteOffset,
          exported.bytes.byteOffset + exported.bytes.byteLength,
        ),
      ),
    );
    expect(decoder.checkIntegrity()).toBe(true);
    const decoded = decoder.read();
    expect(decoded.errors).toEqual([]);
    expect(decoded.messages.recordMesgs).toHaveLength(3);
    expect(decoded.messages.recordMesgs?.at(-1)?.distance).toBeCloseTo(8, 2);
    expect(decoded.messages.recordMesgs?.at(-1)?.enhancedSpeed).toBeCloseTo(4, 2);
    expect(decoded.messages.sessionMesgs?.[0]?.totalDistance).toBeCloseTo(8, 2);
    expect(exported.report.recordCount).toBe(3);
  });
});
