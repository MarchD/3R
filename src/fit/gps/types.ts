import type { PositionPatch } from '../../models/repair';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface GpsTracePoint extends GeoPoint {
  recordIndex: number;
  timestamp?: string;
  distanceM?: number;
  gpsAccuracy?: number;
}

export interface GpsEvidence {
  sourcePoints: GpsTracePoint[];
  cleanedPoints: GpsTracePoint[];
  rejectedPoints: number;
  headingRecords: number;
  altitudeRecords: number;
  accuracyRecords: number;
}

export interface PositionLike extends GeoPoint {
  recordIndex: number;
}

export interface MatchEvidenceMetric {
  score: number;
  value: number;
  samples?: number;
}

export interface MatchEvidenceScores {
  overall: number;
  distance?: MatchEvidenceMetric;
  heading?: MatchEvidenceMetric;
  proximity?: MatchEvidenceMetric;
  altitude?: MatchEvidenceMetric;
}

export interface GpsMatchProposal {
  provider: 'Valhalla / OpenStreetMap';
  originalTrace: GeoPoint[];
  recordedStart: GeoPoint;
  correctedStart: GeoPoint;
  matchedRoute: GeoPoint[];
  positionPatches: PositionPatch[];
  sourcePointCount: number;
  submittedPointCount: number;
  rejectedPointCount: number;
  routeDistanceM: number;
  recordedDistanceM?: number;
  distanceDeltaPercent?: number;
  evidenceScores: MatchEvidenceScores;
  confidence: 'low' | 'medium' | 'high';
}
