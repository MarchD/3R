import type { NormalizedActivity } from '../../models/fit';
import type { RepairCandidate } from '../../models/repair';
import { cleanedSpeedIntegrationCandidate } from './cleanedSpeedIntegration';
import { medianStepLengthCandidate } from './medianStepLength';
import { weightedStepLengthCandidate } from './weightedStepLength';
import { validateRepairEligibility } from './validateRepairEligibility';

export function createRepairCandidates(activity: NormalizedActivity): RepairCandidate[] {
  const eligibility = validateRepairEligibility(activity);
  if (!eligibility.eligible) throw new Error(eligibility.reason);
  return [
    medianStepLengthCandidate(activity),
    weightedStepLengthCandidate(activity),
    cleanedSpeedIntegrationCandidate(activity),
  ];
}
