import type { NormalizedActivity } from '../../models/fit';
import type { RepairCandidate } from '../../models/repair';
import { cleanedSpeedIntegrationCandidate } from './cleanedSpeedIntegration';
import { medianStepLengthCandidate } from './medianStepLength';
import { weightedStepLengthCandidate } from './weightedStepLength';

export function createRepairCandidates(activity: NormalizedActivity): RepairCandidate[] {
  return [
    medianStepLengthCandidate(activity),
    weightedStepLengthCandidate(activity),
    cleanedSpeedIntegrationCandidate(activity),
  ];
}
