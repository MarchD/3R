import type { NormalizedActivity } from './fit';

export type DistanceRepairAlgorithm =
  | 'steps_median_step_length'
  | 'steps_weighted_mean_step_length'
  | 'cleaned_speed_integration';

export type RepairAlgorithm = DistanceRepairAlgorithm | 'timestamp_shift';

export interface ActivitySummary {
  totalDistanceM?: number;
  elapsedTimeS?: number;
  averagePaceSPerKm?: number;
  totalSteps?: number;
}

export interface RecordPatch {
  recordIndex: number;
  distanceM: number;
  derivedSpeedMps?: number;
}

export interface RepairCalculation {
  totalSteps?: number;
  stepLengthM?: number;
  acceptedSamples: number;
  rejectedSamples: number;
  replacedSamples?: number;
  unresolvedSamples?: number;
  weights?: { recordIndex: number; weight: number }[];
}

export interface RepairCandidate {
  id: string;
  algorithm: DistanceRepairAlgorithm;
  name: string;
  description: string;
  distanceM: number;
  averagePaceSPerKm?: number;
  confidence: 'low' | 'medium' | 'high';
  assumptions: string[];
  warnings: string[];
  calculation: RepairCalculation;
  recordPatches: RecordPatch[];
}

export interface RepairPatch {
  sourceFileName: string;
  createdAt: string;
  algorithm: RepairAlgorithm;
  originalSummary: ActivitySummary;
  repairedSummary: ActivitySummary;
  recordPatches: RecordPatch[];
  timestampOffsetMs?: number;
  originalStartTime?: string;
  correctedStartTime?: string;
  assumptions: string[];
  warnings: string[];
}

export interface RepairedActivity extends NormalizedActivity {
  repair: {
    algorithm: RepairAlgorithm;
    createdAt: string;
    originalDistanceM?: number;
    timestampOffsetMs?: number;
    originalStartTime?: string;
    correctedStartTime?: string;
  };
}

export type RepairState =
  | { status: 'not-requested' }
  | { status: 'confirming' }
  | { status: 'calculating' }
  | { status: 'ready'; candidates: RepairCandidate[]; selectedCandidateId?: string }
  | { status: 'previewing'; candidates: RepairCandidate[]; selectedCandidateId: string }
  | {
      status: 'applied';
      patch: RepairPatch;
      repairedActivity: RepairedActivity;
      candidates: RepairCandidate[];
    };
