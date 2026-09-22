import type { NormalizedActivity } from '../../models/fit';
import type { RepairCandidate, RepairedActivity, RepairPatch } from '../../models/repair';
import { activitySummary } from '../analysis/activitySummary';

export function applyRepairPatch(
  sourceFileName: string,
  original: NormalizedActivity,
  candidate: RepairCandidate,
  createdAt = new Date().toISOString(),
): { patch: RepairPatch; repairedActivity: RepairedActivity } {
  const originalSummary = activitySummary(original);
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
    assumptions: [...candidate.assumptions],
    warnings: [...candidate.warnings],
  };
  const patchByIndex = new Map(
    candidate.recordPatches.map((record) => [record.recordIndex, record]),
  );
  const repairedActivity: RepairedActivity = {
    ...original,
    metadata: { ...original.metadata },
    session: original.session
      ? {
          ...original.session,
          totalDistanceM: candidate.distanceM,
          avgSpeedMps: original.session.totalElapsedTimeS
            ? candidate.distanceM / original.session.totalElapsedTimeS
            : undefined,
        }
      : undefined,
    laps: original.laps.map((lap) => ({ ...lap })),
    records: original.records.map((record) => {
      const change = patchByIndex.get(record.index);
      return change
        ? {
            ...record,
            distanceM: change.distanceM,
            speedMps: change.derivedSpeedMps,
            enhancedSpeedMps: change.derivedSpeedMps,
          }
        : { ...record };
    }),
    developerFields: {
      definitions: original.developerFields.definitions.map((definition) => ({ ...definition })),
      valuesByRecord: original.developerFields.valuesByRecord.map((value) => ({ ...value })),
    },
    repair: {
      algorithm: candidate.algorithm,
      createdAt,
      originalDistanceM: original.session?.totalDistanceM,
    },
  };
  return { patch, repairedActivity };
}
