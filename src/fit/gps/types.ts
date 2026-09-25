import type { PositionPatch, RecordPatch } from '../../models/repair';

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
  traceDistanceM: number;
  scaleFactor: number;
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

export interface DistanceReference {
  distanceM: number;
  source: 'repair_consensus' | 'recorded_session';
  estimateCount?: number;
  recordProgresses?: number[];
  recordPatches?: RecordPatch[];
}

export interface GpsMatchProposal {
  candidateId: string;
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
  distanceReference?: DistanceReference;
  distanceDeltaPercent?: number;
  distanceConflict: boolean;
  traceScaleFactor: number;
  reconstructionMethod: 'trace_match' | 'heading_dead_reckoning' | 'generated_loop';
  evidenceScores: MatchEvidenceScores;
  confidence: 'low' | 'medium' | 'high';
}
