import type { NormalizedActivity } from '../../models/fit';
import type { RecordPatch } from '../../models/repair';
import { distanceBetween } from './traceAnalysis';
import type { GpsEvidence, GpsMatchProposal, GpsTracePoint } from './types';

function interpolateDistance(
  first: GpsTracePoint,
  last: GpsTracePoint,
  firstDistance: number,
  lastDistance: number,
  recordIndex: number,
  activity: NormalizedActivity,
): number {
  const firstTime = first.timestamp ? Date.parse(first.timestamp) : NaN;
  const lastTime = last.timestamp ? Date.parse(last.timestamp) : NaN;
  const recordTime = activity.records[recordIndex].timestamp
    ? Date.parse(activity.records[recordIndex].timestamp)
    : NaN;
  const fraction =
    Number.isFinite(firstTime) &&
    Number.isFinite(lastTime) &&
    Number.isFinite(recordTime) &&
    lastTime > firstTime
      ? (recordTime - firstTime) / (lastTime - firstTime)
      : (recordIndex - first.recordIndex) / (last.recordIndex - first.recordIndex);
  return firstDistance + (lastDistance - firstDistance) * Math.max(0, Math.min(1, fraction));
}

export function createGpsTraceDistanceProposal(
  activity: NormalizedActivity,
  evidence: GpsEvidence,
): GpsMatchProposal {
  const points = evidence.cleanedPoints;
  const coverage = evidence.sourcePoints.length / activity.records.length;
  const retained = points.length / evidence.sourcePoints.length;
  if (points.length < 2 || coverage < 0.8 || retained < 0.95) {
    throw new Error('The GPS track is too sparse or noisy to calculate a reliable distance.');
  }
  let speedLimit = 60;
  if (activity.sport === 'cycling') speedLimit = 40;
  if (activity.sport === 'running' || activity.sport === 'walking') speedLimit = 15;
  const cumulative = [0];
  for (let index = 1; index < points.length; index += 1) {
    const firstTimestamp = points[index - 1].timestamp;
    const lastTimestamp = points[index].timestamp;
    const firstTime = firstTimestamp ? Date.parse(firstTimestamp) : NaN;
    const lastTime = lastTimestamp ? Date.parse(lastTimestamp) : NaN;
    const seconds = (lastTime - firstTime) / 1000;
    const segmentDistance = distanceBetween(points[index - 1], points[index]);
    if (!Number.isFinite(seconds) || seconds <= 0 || segmentDistance / seconds > speedLimit) {
      throw new Error('The GPS track contains a gap or jump too large for distance calibration.');
    }
    cumulative.push(cumulative[index - 1] + segmentDistance);
  }
  const distanceM = cumulative.at(-1)!;
  if (distanceM < 10) throw new Error('The GPS track is too short for distance calibration.');
  const distances = Array<number>(activity.records.length).fill(0);
  for (let index = 0; index < points.length - 1; index += 1) {
    const first = points.at(index)!;
    const last = points.at(index + 1)!;
    const { recordIndex: firstIndex } = first;
    for (let recordIndex = firstIndex; recordIndex <= last.recordIndex; recordIndex += 1) {
      distances[recordIndex] = interpolateDistance(
        first,
        last,
        cumulative[index],
        cumulative[index + 1],
        recordIndex,
        activity,
      );
    }
  }
  distances.fill(distanceM, points.at(-1)!.recordIndex);
  const recordPatches: RecordPatch[] = activity.records.map((record, index) => {
    const previous = activity.records[index - 1];
    const elapsedS =
      record.timestamp && previous?.timestamp
        ? (Date.parse(record.timestamp) - Date.parse(previous.timestamp)) / 1000
        : 0;
    return {
      recordIndex: record.index,
      distanceM: distances[index],
      derivedSpeedMps:
        index > 0 && elapsedS > 0
          ? Math.max(0, distances[index] - distances[index - 1]) / elapsedS
          : undefined,
    };
  });
  const recordedDistanceM = activity.session?.totalDistanceM;
  return {
    candidateId: 'gps-trace-distance',
    provider: 'Recorded GPS',
    originalTrace: points,
    recordedStart: points[0],
    correctedStart: points[0],
    matchedRoute: points,
    positionPatches: [],
    sourcePointCount: evidence.sourcePoints.length,
    submittedPointCount: 0,
    rejectedPointCount: evidence.rejectedPoints,
    routeDistanceM: distanceM,
    recordedDistanceM,
    distanceReference: { source: 'gps_trace', distanceM, recordPatches },
    distanceDeltaPercent:
      recordedDistanceM && recordedDistanceM > 0
        ? (Math.abs(distanceM - recordedDistanceM) / recordedDistanceM) * 100
        : undefined,
    distanceConflict: false,
    traceScaleFactor: 1,
    reconstructionMethod: 'gps_trace_distance',
    evidenceScores: { overall: 0 },
    confidence: 'low',
  };
}
