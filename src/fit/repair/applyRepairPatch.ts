import type { NormalizedActivity } from '../../models/fit';
import type { RepairCandidate, RepairedActivity, RepairPatch } from '../../models/repair';
import { activitySummary } from '../analysis/activitySummary';
import { resolveTimestampCorrection, shiftTimestamp } from './timestampCorrection';

export function applyRepairPatch(
  sourceFileName: string,
  original: NormalizedActivity,
  candidate: RepairCandidate,
  createdAt = new Date().toISOString(),
  correctedStartTime?: string,
): { patch: RepairPatch; repairedActivity: RepairedActivity } {
  const originalSummary = activitySummary(original);
  const correction = resolveTimestampCorrection(original.session?.startTime, correctedStartTime);
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
    timestampOffsetMs: correction.timestampOffsetMs || undefined,
    originalStartTime: correction.originalStartTime,
    correctedStartTime: correction.correctedStartTime,
    assumptions: [
      ...candidate.assumptions,
      ...(correction.correctedStartTime
        ? ['Every absolute FIT timestamp is shifted by the same offset.']
        : []),
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
      createdAt: shiftTimestamp(original.metadata.createdAt, correction.timestampOffsetMs),
    },
    session: original.session
      ? {
          ...original.session,
          startTime: shiftTimestamp(original.session.startTime, correction.timestampOffsetMs),
          totalDistanceM: candidate.distanceM,
          avgSpeedMps: original.session.totalElapsedTimeS
            ? candidate.distanceM / original.session.totalElapsedTimeS
            : undefined,
        }
      : undefined,
    laps: original.laps.map((lap) => ({
      ...lap,
      startTime: shiftTimestamp(lap.startTime, correction.timestampOffsetMs),
    })),
    records: original.records.map((record) => {
      const change = patchByIndex.get(record.index);
      return change
        ? {
            ...record,
            timestamp: shiftTimestamp(record.timestamp, correction.timestampOffsetMs),
            distanceM: change.distanceM,
            speedMps: change.derivedSpeedMps,
            enhancedSpeedMps: change.derivedSpeedMps,
          }
        : {
            ...record,
            timestamp: shiftTimestamp(record.timestamp, correction.timestampOffsetMs),
          };
    }),
    developerFields: {
      definitions: original.developerFields.definitions.map((definition) => ({ ...definition })),
      valuesByRecord: original.developerFields.valuesByRecord.map((value) => ({ ...value })),
    },
    repair: {
      algorithm: candidate.algorithm,
      createdAt,
      originalDistanceM: original.session?.totalDistanceM,
      timestampOffsetMs: correction.timestampOffsetMs || undefined,
      originalStartTime: correction.originalStartTime,
      correctedStartTime: correction.correctedStartTime,
    },
  };
  return { patch, repairedActivity };
}
