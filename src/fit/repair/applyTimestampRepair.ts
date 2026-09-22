import type { NormalizedActivity } from '../../models/fit';
import type { RepairedActivity, RepairPatch } from '../../models/repair';
import { activitySummary } from '../analysis/activitySummary';

function shiftTimestamp(value: string | undefined, offsetMs: number): string | undefined {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp + offsetMs).toISOString() : value;
}

export function applyTimestampRepair(
  sourceFileName: string,
  original: NormalizedActivity,
  correctedStartTime: string,
  createdAt = new Date().toISOString(),
): { patch: RepairPatch; repairedActivity: RepairedActivity } {
  const originalStartTime = original.session?.startTime;
  const originalStartMs = originalStartTime ? Date.parse(originalStartTime) : NaN;
  const correctedStartMs = Date.parse(correctedStartTime);

  if (!Number.isFinite(originalStartMs)) {
    throw new Error('The activity does not contain a valid original start time.');
  }
  if (!Number.isFinite(correctedStartMs)) {
    throw new Error('The corrected start time is invalid.');
  }

  const timestampOffsetMs = Math.round((correctedStartMs - originalStartMs) / 1000) * 1000;
  if (timestampOffsetMs === 0) {
    throw new Error('The corrected start time must be different from the original start time.');
  }

  const originalSummary = activitySummary(original);
  const correctedStartIso = new Date(originalStartMs + timestampOffsetMs).toISOString();
  const patch: RepairPatch = {
    sourceFileName,
    createdAt,
    algorithm: 'timestamp_shift',
    originalSummary,
    repairedSummary: { ...originalSummary },
    recordPatches: [],
    timestampOffsetMs,
    originalStartTime,
    correctedStartTime: correctedStartIso,
    assumptions: ['Every absolute FIT timestamp is shifted by the same offset.'],
    warnings: [],
  };

  const repairedActivity: RepairedActivity = {
    ...original,
    metadata: {
      ...original.metadata,
      createdAt: shiftTimestamp(original.metadata.createdAt, timestampOffsetMs),
    },
    session: original.session
      ? {
          ...original.session,
          startTime: shiftTimestamp(original.session.startTime, timestampOffsetMs),
        }
      : undefined,
    laps: original.laps.map((lap) => ({
      ...lap,
      startTime: shiftTimestamp(lap.startTime, timestampOffsetMs),
    })),
    records: original.records.map((record) => ({
      ...record,
      timestamp: shiftTimestamp(record.timestamp, timestampOffsetMs),
      developerFields: { ...record.developerFields },
    })),
    developerFields: {
      definitions: original.developerFields.definitions.map((definition) => ({ ...definition })),
      valuesByRecord: original.developerFields.valuesByRecord.map((value) => ({ ...value })),
    },
    repair: {
      algorithm: 'timestamp_shift',
      createdAt,
      originalDistanceM: original.session?.totalDistanceM,
      timestampOffsetMs,
      originalStartTime,
      correctedStartTime: correctedStartIso,
    },
  };

  return { patch, repairedActivity };
}
