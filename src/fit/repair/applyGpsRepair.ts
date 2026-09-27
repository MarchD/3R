import type { NormalizedActivity } from '../../models/fit';
import type { GpsMatchProposal } from '../gps/types';
import type { RepairedActivity, RepairPatch } from '../../models/repair';
import { activitySummary } from '../analysis/activitySummary';
import { calibrateLaps } from './calibrateLaps';
import { rebuildDistanceLaps } from './rebuildDistanceLaps';
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
    !proposal.preserveDistance &&
    (distanceReference?.source === 'repair_consensus' ||
      distanceReference?.source === 'sensor_candidate' ||
      distanceReference?.source === 'gps_trace') &&
    distanceReference.recordPatches?.length === original.records.length
      ? distanceReference.recordPatches
      : [];
  const repairedDistanceM = recordPatches.length ? distanceReference?.distanceM : undefined;
  const manuallyDrawn = proposal.reconstructionMethod === 'manual_route';
  const gpsTraceDistance = proposal.reconstructionMethod === 'gps_trace_distance';
  let algorithm: RepairPatch['algorithm'] = 'gps_map_match';
  if (manuallyDrawn) algorithm = 'gps_manual_draw';
  if (gpsTraceDistance) algorithm = 'gps_trace_distance';
  let routeAssumption =
    'The selected OpenStreetMap route is a plausible reconstruction, not the original GPS trace.';
  if (manuallyDrawn)
    routeAssumption =
      'The manually drawn path is a plausible reconstruction, not the original GPS trace or a road-snapped route.';
  if (gpsTraceDistance)
    routeAssumption =
      'The recorded GPS positions are assumed to be the correct route; GPS noise may affect calculated distance.';
  const distanceAssumption = {
    gps_trace: 'Distance and lap summaries were derived from the recorded GPS track.',
    sensor_candidate: 'Distance was derived from the selected sensor estimate.',
    repair_consensus: 'Distance was derived from the independent sensor consensus.',
    recorded_session: '',
  }[distanceReference?.source ?? 'recorded_session'];
  const positions = new Map(
    proposal.positionPatches.map((position) => [position.recordIndex, position]),
  );
  const distances = new Map(recordPatches.map((record) => [record.recordIndex, record]));
  const repairedRecords = original.records.map((record) => {
    const position = positions.get(record.index);
    const distance = distances.get(record.index);
    return {
      ...record,
      distanceM: distance?.distanceM ?? record.distanceM,
      speedMps: distance?.derivedSpeedMps ?? record.speedMps,
      enhancedSpeedMps: distance?.derivedSpeedMps ?? record.enhancedSpeedMps,
      position: position
        ? { latitude: position.latitude, longitude: position.longitude }
        : record.position,
      developerFields: { ...record.developerFields },
    };
  });
  const replacementLaps =
    gpsTraceDistance && repairedDistanceM != null
      ? rebuildDistanceLaps(original, repairedRecords, repairedDistanceM)
      : undefined;
  const lapPatches =
    !replacementLaps && (manuallyDrawn || gpsTraceDistance || proposal.preserveDistance)
      ? calibrateLaps(original, repairedRecords, recordPatches.length > 0)
      : [];
  const laps = new Map(lapPatches.map((lap) => [lap.lapIndex, lap]));
  const patch: RepairPatch = {
    sourceFileName,
    createdAt,
    algorithm,
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
    lapPatches,
    replacementLaps,
    timestampOffsetMs: correction.timestampOffsetMs || undefined,
    originalStartTime: correction.originalStartTime,
    correctedStartTime: correction.correctedStartTime,
    assumptions: [
      routeAssumption,
      ...(proposal.preserveDistance
        ? ['Original record, lap, and session distances and speeds were preserved.']
        : []),
      ...(repairedDistanceM && distanceAssumption ? [distanceAssumption] : []),
      ...(replacementLaps
        ? [`Automatic distance laps were rebuilt as ${replacementLaps.length} splits.`]
        : []),
      ...(correction.correctedStartTime
        ? ['Every absolute FIT timestamp is shifted by the same offset.']
        : []),
    ],
    warnings: [
      ...(gpsTraceDistance
        ? [
            'GPS distance is calculated from straight segments between recorded positions; it may underestimate turns between sparse samples or overestimate GPS jitter.',
          ]
        : [
            `Coordinates for ${proposal.positionPatches.length} records were synthesized from a ${manuallyDrawn ? 'manually drawn path' : 'map-matched route'}.`,
          ]),
      ...(replacementLaps
        ? [
            'Rebuilt automatic laps do not retain original lap-only metrics such as per-lap calories or advanced sensor summaries; record data and session totals are preserved.',
          ]
        : []),
    ],
  };
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
    laps: replacementLaps
      ? replacementLaps.map((lap) => ({
          ...lap,
          startTime: shiftTimestamp(lap.startTime, correction.timestampOffsetMs),
          endTime: shiftTimestamp(lap.endTime, correction.timestampOffsetMs),
        }))
      : original.laps.map((lap) => {
          const calibrated = laps.get(lap.index);
          const totalDistanceM = calibrated?.totalDistanceM ?? lap.totalDistanceM;
          return {
            ...lap,
            startTime: shiftTimestamp(lap.startTime, correction.timestampOffsetMs),
            endTime: shiftTimestamp(lap.endTime, correction.timestampOffsetMs),
            totalDistanceM,
            avgSpeedMps:
              calibrated?.totalDistanceM != null && lap.totalTimerTimeS
                ? calibrated.totalDistanceM / lap.totalTimerTimeS
                : lap.avgSpeedMps,
            startPosition: calibrated?.startPosition ?? lap.startPosition,
            endPosition: calibrated?.endPosition ?? lap.endPosition,
          };
        }),
    records: repairedRecords.map((record) => ({
      ...record,
      timestamp: shiftTimestamp(record.timestamp, correction.timestampOffsetMs),
    })),
    developerFields: {
      definitions: original.developerFields.definitions.map((definition) => ({ ...definition })),
      valuesByRecord: original.developerFields.valuesByRecord.map((value) => ({ ...value })),
    },
    repair: {
      algorithm,
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
