import type { NormalizedActivity } from '../../models/fit';
import type { GpsMatchProposal } from '../gps/types';
import type { RepairedActivity, RepairPatch } from '../../models/repair';
import { activitySummary } from '../analysis/activitySummary';
import { resolveTimestampCorrection, shiftTimestamp } from './timestampCorrection';

export function applyGpsRepair(
  sourceFileName: string,
  original: NormalizedActivity,
  proposal: GpsMatchProposal,
  correctedStartTime?: string,
  createdAt = new Date().toISOString(),
): { patch: RepairPatch; repairedActivity: RepairedActivity } {
  const correction = resolveTimestampCorrection(original.session?.startTime, correctedStartTime);
  const summary = activitySummary(original);
  const { distanceReference } = proposal;
  const recordPatches =
    distanceReference?.source === 'repair_consensus' &&
    distanceReference.recordPatches?.length === original.records.length
      ? distanceReference.recordPatches
      : [];
  const repairedDistanceM = recordPatches.length ? distanceReference?.distanceM : undefined;
  const patch: RepairPatch = {
    sourceFileName,
    createdAt,
    algorithm: 'gps_map_match',
    originalSummary: summary,
    repairedSummary: {
      ...summary,
      totalDistanceM: repairedDistanceM ?? summary.totalDistanceM,
      averagePaceSPerKm:
        repairedDistanceM && original.session?.totalElapsedTimeS
          ? (original.session.totalElapsedTimeS * 1000) / repairedDistanceM
          : summary.averagePaceSPerKm,
    },
    recordPatches: recordPatches.map((record) => ({ ...record })),
    positionPatches: proposal.positionPatches.map((position) => ({ ...position })),
    timestampOffsetMs: correction.timestampOffsetMs || undefined,
    originalStartTime: correction.originalStartTime,
    correctedStartTime: correction.correctedStartTime,
    assumptions: [
      'The selected OpenStreetMap route is a plausible reconstruction, not the original GPS trace.',
      ...(repairedDistanceM ? ['Distance was derived from the independent sensor consensus.'] : []),
      ...(correction.correctedStartTime
        ? ['Every absolute FIT timestamp is shifted by the same offset.']
        : []),
    ],
    warnings: [
      `Coordinates for ${proposal.positionPatches.length} records were synthesized from a map-matched route.`,
    ],
  };
  const positions = new Map(
    proposal.positionPatches.map((position) => [position.recordIndex, position]),
  );
  const distances = new Map(recordPatches.map((record) => [record.recordIndex, record]));
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
          totalDistanceM: repairedDistanceM ?? original.session.totalDistanceM,
          avgSpeedMps:
            repairedDistanceM && original.session.totalTimerTimeS
              ? repairedDistanceM / original.session.totalTimerTimeS
              : original.session.avgSpeedMps,
        }
      : undefined,
    laps: original.laps.map((lap) => ({
      ...lap,
      startTime: shiftTimestamp(lap.startTime, correction.timestampOffsetMs),
    })),
    records: original.records.map((record) => {
      const position = positions.get(record.index);
      const distance = distances.get(record.index);
      return {
        ...record,
        timestamp: shiftTimestamp(record.timestamp, correction.timestampOffsetMs),
        distanceM: distance?.distanceM ?? record.distanceM,
        speedMps: distance?.derivedSpeedMps ?? record.speedMps,
        enhancedSpeedMps: distance?.derivedSpeedMps ?? record.enhancedSpeedMps,
        position: position
          ? { latitude: position.latitude, longitude: position.longitude }
          : record.position,
        developerFields: { ...record.developerFields },
      };
    }),
    developerFields: {
      definitions: original.developerFields.definitions.map((definition) => ({ ...definition })),
      valuesByRecord: original.developerFields.valuesByRecord.map((value) => ({ ...value })),
    },
    repair: {
      algorithm: 'gps_map_match',
      createdAt,
      originalDistanceM: original.session?.totalDistanceM,
      timestampOffsetMs: correction.timestampOffsetMs || undefined,
      originalStartTime: correction.originalStartTime,
      correctedStartTime: correction.correctedStartTime,
      positionPatchedRecords: proposal.positionPatches.length,
    },
  };
  return { patch, repairedActivity };
}
