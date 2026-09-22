import type { NormalizedActivity, NormalizedRecord } from '../../models/fit';
import { scoreGpsMatch } from './matchScoring';
import type { GeoPoint, GpsEvidence, GpsMatchProposal, GpsTracePoint } from './types';

const EARTH_RADIUS_M = 6_371_000;
const MAX_MATCH_POINTS = 180;

function radians(value: number): number {
  return (value * Math.PI) / 180;
}

export function distanceBetween(first: GeoPoint, second: GeoPoint): number {
  const latitudeDelta = radians(second.latitude - first.latitude);
  const longitudeDelta = radians(second.longitude - first.longitude);
  const firstLatitude = radians(first.latitude);
  const secondLatitude = radians(second.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

function validPosition(record: NormalizedRecord): GpsTracePoint | undefined {
  const latitude = record.position?.latitude;
  const longitude = record.position?.longitude;
  if (
    latitude == null ||
    longitude == null ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return undefined;
  }
  return {
    recordIndex: record.index,
    latitude,
    longitude,
    timestamp: record.timestamp,
    distanceM: record.distanceM,
    gpsAccuracy: record.gpsAccuracy,
  };
}

function timestampMs(point: GpsTracePoint): number | undefined {
  if (!point.timestamp) return undefined;
  const value = Date.parse(point.timestamp);
  return Number.isFinite(value) ? value : undefined;
}

function speedBetween(first: GpsTracePoint, second: GpsTracePoint): number | undefined {
  const firstTime = timestampMs(first);
  const secondTime = timestampMs(second);
  if (firstTime == null || secondTime == null || secondTime <= firstTime) return undefined;
  return distanceBetween(first, second) / ((secondTime - firstTime) / 1000);
}

function runningSpeedLimit(activity: NormalizedActivity): number {
  if (activity.sport === 'running' || activity.sport === 'walking') return 15;
  if (activity.sport === 'cycling') return 40;
  return 60;
}

export function analyzeGpsEvidence(activity: NormalizedActivity): GpsEvidence {
  const sourcePoints = activity.records.flatMap((record) => {
    const point = validPosition(record);
    return point ? [point] : [];
  });
  if (sourcePoints.length <= 2) {
    return {
      sourcePoints,
      cleanedPoints: sourcePoints,
      rejectedPoints: 0,
      headingRecords: activity.records.filter(
        (record) => record.headingDeg != null || record.trackDeg != null,
      ).length,
      altitudeRecords: activity.records.filter(
        (record) => record.enhancedAltitudeM != null || record.altitudeM != null,
      ).length,
      accuracyRecords: activity.records.filter((record) => record.gpsAccuracy != null).length,
    };
  }

  const speedLimit = runningSpeedLimit(activity);
  const cleanedPoints = [sourcePoints[0]];
  sourcePoints.slice(1, -1).forEach((point) => {
    const speed = speedBetween(cleanedPoints.at(-1)!, point);
    if (speed == null || speed <= speedLimit) cleanedPoints.push(point);
  });
  const finalPoint = sourcePoints.at(-1)!;
  if (finalPoint.recordIndex !== cleanedPoints.at(-1)?.recordIndex) cleanedPoints.push(finalPoint);

  return {
    sourcePoints,
    cleanedPoints,
    rejectedPoints: sourcePoints.length - cleanedPoints.length,
    headingRecords: activity.records.filter(
      (record) => record.headingDeg != null || record.trackDeg != null,
    ).length,
    altitudeRecords: activity.records.filter(
      (record) => record.enhancedAltitudeM != null || record.altitudeM != null,
    ).length,
    accuracyRecords: activity.records.filter((record) => record.gpsAccuracy != null).length,
  };
}

export function sampleTrace(points: GpsTracePoint[]): GpsTracePoint[] {
  if (points.length <= MAX_MATCH_POINTS) return points;
  return Array.from({ length: MAX_MATCH_POINTS }, (_, index) => {
    const sourceIndex = Math.round((index * (points.length - 1)) / (MAX_MATCH_POINTS - 1));
    return points[sourceIndex];
  });
}

function wrappedLongitude(longitude: number): number {
  return ((((longitude + 180) % 360) + 360) % 360) - 180;
}

export function relocateGpsEvidence(evidence: GpsEvidence, start: GeoPoint): GpsEvidence {
  const recordedStart = evidence.sourcePoints[0];
  if (!recordedStart) return evidence;
  const latitudeDelta = start.latitude - recordedStart.latitude;
  const sourceLongitudeScale = Math.cos(radians(recordedStart.latitude));
  const targetLongitudeScale = Math.cos(radians(start.latitude));
  const longitudeScale =
    Math.abs(targetLongitudeScale) > 0.001 ? sourceLongitudeScale / targetLongitudeScale : 1;
  const translate = (point: GpsTracePoint): GpsTracePoint =>
    point.recordIndex === recordedStart.recordIndex
      ? { ...point, ...start }
      : {
          ...point,
          latitude: Math.max(-90, Math.min(90, point.latitude + latitudeDelta)),
          longitude: wrappedLongitude(
            start.longitude + (point.longitude - recordedStart.longitude) * longitudeScale,
          ),
        };
  return {
    ...evidence,
    sourcePoints: evidence.sourcePoints.map(translate),
    cleanedPoints: evidence.cleanedPoints.map(translate),
  };
}

function cumulativeDistances(route: GeoPoint[]): number[] {
  return route.reduce<number[]>((distances, point, index) => {
    distances.push(
      index === 0 ? 0 : distances[index - 1] + distanceBetween(route[index - 1], point),
    );
    return distances;
  }, []);
}

function pointAlongRoute(route: GeoPoint[], distances: number[], progress: number): GeoPoint {
  const target = distances.at(-1)! * Math.min(1, Math.max(0, progress));
  const endIndex = distances.findIndex((distance) => distance >= target);
  if (endIndex <= 0) return route[0];
  const startIndex = endIndex - 1;
  const segmentLength = distances[endIndex] - distances[startIndex];
  const segmentProgress = segmentLength ? (target - distances[startIndex]) / segmentLength : 0;
  return {
    latitude:
      route[startIndex].latitude +
      (route[endIndex].latitude - route[startIndex].latitude) * segmentProgress,
    longitude:
      route[startIndex].longitude +
      (route[endIndex].longitude - route[startIndex].longitude) * segmentProgress,
  };
}

function recordProgresses(records: NormalizedRecord[]): number[] {
  const distances = records.map((record) => record.distanceM);
  const distancesAreUsable = distances.every(
    (distance, index) =>
      distance != null && (index === 0 || distance >= (distances[index - 1] ?? distance)),
  );
  const firstDistance = distances[0];
  const finalDistance = distances.at(-1);
  if (
    distancesAreUsable &&
    firstDistance != null &&
    finalDistance != null &&
    finalDistance > firstDistance
  ) {
    return distances.map(
      (distance) => ((distance ?? firstDistance) - firstDistance) / (finalDistance - firstDistance),
    );
  }

  const timestamps = records.map((record) =>
    record.timestamp ? Date.parse(record.timestamp) : NaN,
  );
  const firstTime = timestamps[0];
  const finalTime = timestamps.at(-1);
  if (
    timestamps.every(Number.isFinite) &&
    firstTime != null &&
    finalTime != null &&
    finalTime > firstTime
  ) {
    return timestamps.map((timestamp) => (timestamp - firstTime) / (finalTime - firstTime));
  }
  return records.map((_, index) => (records.length > 1 ? index / (records.length - 1) : 0));
}

export function createGpsMatchProposal(
  activity: NormalizedActivity,
  evidence: GpsEvidence,
  submittedPoints: GpsTracePoint[],
  matchedRoute: GeoPoint[],
  routeElevations: number[] = [],
): GpsMatchProposal {
  if (matchedRoute.length < 2) throw new Error('The map matcher did not return a usable route.');
  const distances = cumulativeDistances(matchedRoute);
  const routeDistanceM = distances.at(-1)!;
  const recordedDistanceM = activity.session?.totalDistanceM;
  const distanceDeltaPercent =
    recordedDistanceM && recordedDistanceM > 0
      ? (Math.abs(routeDistanceM - recordedDistanceM) / recordedDistanceM) * 100
      : undefined;
  const progresses = recordProgresses(activity.records);
  const positionPatches = activity.records.map((record, index) => ({
    recordIndex: record.index,
    ...pointAlongRoute(matchedRoute, distances, progresses[index]),
  }));
  const evidenceScores = scoreGpsMatch(
    activity,
    evidence,
    matchedRoute,
    positionPatches,
    distanceDeltaPercent,
    routeElevations,
  );
  let confidence: GpsMatchProposal['confidence'] = 'low';
  if (evidenceScores.overall >= 75) confidence = 'high';
  else if (evidenceScores.overall >= 50) confidence = 'medium';
  return {
    provider: 'Valhalla / OpenStreetMap',
    originalTrace: evidence.sourcePoints,
    recordedStart: evidence.sourcePoints[0],
    correctedStart: submittedPoints[0],
    matchedRoute,
    positionPatches,
    sourcePointCount: evidence.sourcePoints.length,
    submittedPointCount: submittedPoints.length,
    rejectedPointCount: evidence.rejectedPoints,
    routeDistanceM,
    recordedDistanceM,
    distanceDeltaPercent,
    evidenceScores,
    confidence,
  };
}
