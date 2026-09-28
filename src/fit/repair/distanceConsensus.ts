import type { NormalizedActivity } from '../../models/fit';
import type { RecordPatch } from '../../models/repair';
import { cleanedSpeedIntegrationCandidate } from './cleanedSpeedIntegration';
import { median, medianStepLengthCandidate } from './medianStepLength';
import { validateRepairEligibility } from './validateRepairEligibility';
import { weightedStepLengthCandidate } from './weightedStepLength';

export interface DistanceConsensus {
  distanceM: number;
  estimateCount: number;
  spreadPercent: number;
  recordProgresses: number[];
  recordPatches: RecordPatch[];
}

const estimators = [
  medianStepLengthCandidate,
  weightedStepLengthCandidate,
  cleanedSpeedIntegrationCandidate,
];

export function estimateDistanceConsensus(
  activity: NormalizedActivity,
): DistanceConsensus | undefined {
  if (!validateRepairEligibility(activity).eligible) return undefined;
  const estimates = estimators.flatMap((estimate) => {
    try {
      const candidate = estimate(activity);
      return Number.isFinite(candidate.distanceM) && candidate.distanceM > 0 ? [candidate] : [];
    } catch {
      return [];
    }
  });
  const center = median(estimates.map((estimate) => estimate.distanceM));
  if (center == null || estimates.length < 2) return undefined;
  const agreeingEstimates = estimates.filter(
    (estimate) => Math.abs(estimate.distanceM - center) / center <= 0.25,
  );
  const distanceM = median(agreeingEstimates.map((estimate) => estimate.distanceM));
  if (distanceM == null || agreeingEstimates.length < 2) return undefined;
  const representative = agreeingEstimates.reduce((closest, candidate) =>
    Math.abs(candidate.distanceM - distanceM) < Math.abs(closest.distanceM - distanceM)
      ? candidate
      : closest,
  );
  const spreadPercent =
    ((Math.max(...agreeingEstimates.map((estimate) => estimate.distanceM)) -
      Math.min(...agreeingEstimates.map((estimate) => estimate.distanceM))) /
      distanceM) *
    100;
  const scale = distanceM / representative.distanceM;
  const recordPatches = representative.recordPatches.map((patch) => ({
    ...patch,
    distanceM: patch.distanceM * scale,
    derivedSpeedMps: patch.derivedSpeedMps == null ? undefined : patch.derivedSpeedMps * scale,
  }));
  return {
    distanceM,
    estimateCount: agreeingEstimates.length,
    spreadPercent,
    recordProgresses: recordPatches.map((patch) =>
      Math.max(0, Math.min(1, patch.distanceM / distanceM)),
    ),
    recordPatches,
  };
}
