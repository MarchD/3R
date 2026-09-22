import type { NormalizedActivity, NormalizedRecord } from '../../models/fit';
import type {
  GeoPoint,
  GpsEvidence,
  MatchEvidenceMetric,
  MatchEvidenceScores,
  PositionLike,
} from './types';

const EARTH_RADIUS_M = 6_371_000;

function distanceBetween(first: GeoPoint, second: GeoPoint): number {
  const latitudeDelta = ((second.latitude - first.latitude) * Math.PI) / 180;
  const longitudeDelta = ((second.longitude - first.longitude) * Math.PI) / 180;
  const firstLatitude = (first.latitude * Math.PI) / 180;
  const secondLatitude = (second.latitude * Math.PI) / 180;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

function clampScore(score: number): number {
  return Math.round(Math.max(0, Math.min(100, score)));
}

function bearing(first: GeoPoint, second: GeoPoint): number {
  const latitude1 = (first.latitude * Math.PI) / 180;
  const latitude2 = (second.latitude * Math.PI) / 180;
  const longitudeDelta = ((second.longitude - first.longitude) * Math.PI) / 180;
  const y = Math.sin(longitudeDelta) * Math.cos(latitude2);
  const x =
    Math.cos(latitude1) * Math.sin(latitude2) -
    Math.sin(latitude1) * Math.cos(latitude2) * Math.cos(longitudeDelta);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function angleDifference(first: number, second: number): number {
  const difference = Math.abs(first - second) % 360;
  return Math.min(difference, 360 - difference);
}

function headingMetric(
  records: NormalizedRecord[],
  positions: PositionLike[],
): MatchEvidenceMetric | undefined {
  const differences = records.flatMap((record, index) => {
    const recordedHeading = record.trackDeg ?? record.headingDeg;
    if (recordedHeading == null || !Number.isFinite(recordedHeading)) return [];
    const nextPosition = positions[index + 1];
    const previousPosition = positions[index - 1];
    let routeHeading: number | undefined;
    if (nextPosition) routeHeading = bearing(positions[index], nextPosition);
    else if (previousPosition) routeHeading = bearing(previousPosition, positions[index]);
    return routeHeading == null ? [] : [angleDifference(recordedHeading, routeHeading)];
  });
  if (!differences.length) return undefined;
  const meanDifference = differences.reduce((sum, value) => sum + value, 0) / differences.length;
  return {
    score: clampScore(100 - meanDifference * 1.1),
    value: meanDifference,
    samples: differences.length,
  };
}

function localCoordinates(point: GeoPoint, origin: GeoPoint): { x: number; y: number } {
  const latitudeScale = 111_320;
  const longitudeScale = latitudeScale * Math.cos((origin.latitude * Math.PI) / 180);
  return {
    x: (point.longitude - origin.longitude) * longitudeScale,
    y: (point.latitude - origin.latitude) * latitudeScale,
  };
}

function distanceToSegment(point: GeoPoint, start: GeoPoint, end: GeoPoint): number {
  const projectedPoint = localCoordinates(point, start);
  const projectedEnd = localCoordinates(end, start);
  const segmentLengthSquared = projectedEnd.x ** 2 + projectedEnd.y ** 2;
  if (!segmentLengthSquared) return distanceBetween(point, start);
  const progress = Math.max(
    0,
    Math.min(
      1,
      (projectedPoint.x * projectedEnd.x + projectedPoint.y * projectedEnd.y) /
        segmentLengthSquared,
    ),
  );
  return Math.hypot(
    projectedPoint.x - projectedEnd.x * progress,
    projectedPoint.y - projectedEnd.y * progress,
  );
}

function proximityMetric(
  evidence: GpsEvidence,
  route: GeoPoint[],
): MatchEvidenceMetric | undefined {
  if (route.length < 2 || !evidence.cleanedPoints.length) return undefined;
  const deviations = evidence.cleanedPoints.map((point) =>
    route
      .slice(1)
      .reduce(
        (closest, end, index) => Math.min(closest, distanceToSegment(point, route[index], end)),
        Number.POSITIVE_INFINITY,
      ),
  );
  const meanDeviation = deviations.reduce((sum, value) => sum + value, 0) / deviations.length;
  return {
    score: clampScore(100 - meanDeviation * 2),
    value: meanDeviation,
    samples: deviations.length,
  };
}

function elevationMovement(values: number[]): number {
  return values.slice(1).reduce((movement, value, index) => {
    const change = Math.abs(value - values[index]);
    return movement + (change >= 0.5 ? change : 0);
  }, 0);
}

function altitudeMetric(
  activity: NormalizedActivity,
  routeElevations: number[],
): MatchEvidenceMetric | undefined {
  const recordedElevations = activity.records.flatMap((record) => {
    const elevation = record.enhancedAltitudeM ?? record.altitudeM;
    return elevation == null || !Number.isFinite(elevation) ? [] : [elevation];
  });
  if (recordedElevations.length < 2 || routeElevations.length < 2) return undefined;
  const recordedMovement =
    activity.session?.totalAscentM != null && activity.session?.totalDescentM != null
      ? activity.session.totalAscentM + activity.session.totalDescentM
      : elevationMovement(recordedElevations);
  const routeMovement = elevationMovement(routeElevations);
  const differencePercent =
    recordedMovement > 5
      ? (Math.abs(routeMovement - recordedMovement) / recordedMovement) * 100
      : Math.abs(routeMovement - recordedMovement) * 10;
  return {
    score: clampScore(100 - differencePercent * 1.5),
    value: differencePercent,
    samples: Math.min(recordedElevations.length, routeElevations.length),
  };
}

export function scoreGpsMatch(
  activity: NormalizedActivity,
  evidence: GpsEvidence,
  matchedRoute: GeoPoint[],
  positions: PositionLike[],
  distanceDeltaPercent?: number,
  routeElevations: number[] = [],
): MatchEvidenceScores {
  const distance =
    distanceDeltaPercent == null
      ? undefined
      : { score: clampScore(100 - distanceDeltaPercent * 2), value: distanceDeltaPercent };
  const metrics = {
    distance,
    heading: headingMetric(activity.records, positions),
    proximity: proximityMetric(evidence, matchedRoute),
    altitude: altitudeMetric(activity, routeElevations),
  };
  const weightedMetrics = [
    [metrics.distance, 0.3],
    [metrics.heading, 0.25],
    [metrics.proximity, 0.3],
    [metrics.altitude, 0.15],
  ] as const;
  const availableWeight = weightedMetrics.reduce(
    (sum, [metric, weight]) => sum + (metric ? weight : 0),
    0,
  );
  const overall = availableWeight
    ? Math.round(
        weightedMetrics.reduce((sum, [metric, weight]) => sum + (metric?.score ?? 0) * weight, 0) /
          availableWeight,
      )
    : 0;
  return { overall, ...metrics };
}
