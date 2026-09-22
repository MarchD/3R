import type { RepairCandidate } from '../../models/repair';

export function confidenceFromSampleCount(sampleCount: number): RepairCandidate['confidence'] {
  if (sampleCount >= 100) return 'high';
  if (sampleCount >= 20) return 'medium';
  return 'low';
}

export function speedIntegrationConfidence(
  acceptedSamples: number,
  unresolvedSamples: number,
): RepairCandidate['confidence'] {
  if (unresolvedSamples === 0 && acceptedSamples >= 100) return 'high';
  if (unresolvedSamples < 10) return 'medium';
  return 'low';
}
