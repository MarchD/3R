import type { NormalizedActivity } from '../../models/fit';
import type { RepairCandidate, RepairedActivity, RepairPatch } from '../../models/repair';
import { activitySummary } from '../analysis/activitySummary';

function shiftTimestamp(value: string | undefined, offsetMs: number): string | undefined {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp + offsetMs).toISOString() : value;
}

export function applyRepairPatch(
  sourceFileName: string,
  original: NormalizedActivity,
  candidate: RepairCandidate,
  createdAt = new Date().toISOString(),
  correctedStartTime?: string,
): { patch: RepairPatch; repairedActivity: RepairedActivity } {
  const originalSummary = activitySummary(original);
  const originalStartTime = original.session?.startTime;
  const originalStartMs = originalStartTime ? Date.parse(originalStartTime) : NaN;
  const correctedStartMs = correctedStartTime ? Date.parse(correctedStartTime) : NaN;
  const timestampOffsetMs = correctedStartTime
    ? Math.round((correctedStartMs - originalStartMs) / 1000) * 1000
    : 0;

  if (correctedStartTime && !Number.isFinite(originalStartMs)) {
    throw new Error('The activity does not contain a valid original start time.');
  }
  if (correctedStartTime && !Number.isFinite(correctedStartMs)) {
    throw new Error('The corrected start time is invalid.');
  }

  const correctedStartIso = timestampOffsetMs
    ? new Date(originalStartMs + timestampOffsetMs).toISOString()
    : undefined;
  const patch: RepairPatch = {
    sourceFileName,
    createdAt,
    algorithm: candidate.algorithm,
    originalSummary,
    repairedSummary: {
      ...originalSummary,
      totalDistanceM: candidate.distanceM,
      averagePaceSPerKm: candidate.averagePaceSPerKm,
      totalSteps: candidate.calculation.totalSteps,
    },
    recordPatches: candidate.recordPatches.map((record) => ({ ...record })),
    timestampOffsetMs: timestampOffsetMs || undefined,
    originalStartTime: correctedStartIso ? originalStartTime : undefined,
    correctedStartTime: correctedStartIso,
    assumptions: [
      ...candidate.assumptions,
      ...(correctedStartIso ? ['Every absolute FIT timestamp is shifted by the same offset.'] : []),
    ],
    warnings: [...candidate.warnings],
  };
  const patchByIndex = new Map(
    candidate.recordPatches.map((record) => [record.recordIndex, record]),
  );
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
          totalDistanceM: candidate.distanceM,
          avgSpeedMps: original.session.totalElapsedTimeS
            ? candidate.distanceM / original.session.totalElapsedTimeS
            : undefined,
        }
      : undefined,
    laps: original.laps.map((lap) => ({
      ...lap,
      startTime: shiftTimestamp(lap.startTime, timestampOffsetMs),
    })),
    records: original.records.map((record) => {
      const change = patchByIndex.get(record.index);
      return change
        ? {
            ...record,
            timestamp: shiftTimestamp(record.timestamp, timestampOffsetMs),
            distanceM: change.distanceM,
            speedMps: change.derivedSpeedMps,
            enhancedSpeedMps: change.derivedSpeedMps,
          }
        : { ...record, timestamp: shiftTimestamp(record.timestamp, timestampOffsetMs) };
    }),
    developerFields: {
      definitions: original.developerFields.definitions.map((definition) => ({ ...definition })),
      valuesByRecord: original.developerFields.valuesByRecord.map((value) => ({ ...value })),
    },
    repair: {
      algorithm: candidate.algorithm,
      createdAt,
      originalDistanceM: original.session?.totalDistanceM,
      timestampOffsetMs: timestampOffsetMs || undefined,
      originalStartTime: correctedStartIso ? originalStartTime : undefined,
      correctedStartTime: correctedStartIso,
    },
  };
  return { patch, repairedActivity };
}
