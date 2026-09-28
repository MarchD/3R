import type { NormalizedActivity } from '../../models/fit';
import { createGpsMatchProposal, traceDistance } from './traceAnalysis';
import type { DistanceReference, GeoPoint, GpsEvidence, GpsMatchProposal } from './types';

function validPoint(point: GeoPoint): boolean {
  return (
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    Math.abs(point.latitude) <= 90 &&
    Math.abs(point.longitude) <= 180
  );
}

export function createManualRouteProposal(
  activity: NormalizedActivity,
  evidence: GpsEvidence,
  start: GeoPoint,
  waypoints: GeoPoint[],
  distanceReference?: DistanceReference,
  finish?: GeoPoint,
): GpsMatchProposal {
  const route = finish ? [start, ...waypoints, finish] : [start, ...waypoints];
  if (route.length < 2 || route.some((point) => !validPoint(point)) || traceDistance(route) < 1) {
    throw new Error('Draw at least one valid route segment before reviewing.');
  }

  const artificialEvidence = { ...evidence, cleanedPoints: [], scaleFactor: 1 };
  const submittedPoints = route.map((point, index) => ({ ...point, recordIndex: index }));
  const proposal = createGpsMatchProposal(
    activity,
    artificialEvidence,
    submittedPoints,
    route,
    [],
    distanceReference,
    'manual_route',
  );
  return {
    ...proposal,
    candidateId: 'manual-route',
    provider: 'Manual drawing',
    routeAnchors: route,
  };
}
