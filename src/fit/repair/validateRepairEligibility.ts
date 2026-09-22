import type { NormalizedActivity } from '../../models/fit';

export type RepairEligibility =
  | { eligible: true; detectedSport: string }
  | { eligible: false; detectedSport: string; reason: string };

export function validateRepairEligibility(activity: NormalizedActivity): RepairEligibility {
  const detectedSport = activity.sport?.trim().toLocaleLowerCase() || 'unknown';
  if (detectedSport !== 'running') {
    return {
      eligible: false,
      detectedSport,
      reason: `Distance repair currently supports running activities only. This file is marked as ${detectedSport}.`,
    };
  }
  if (!activity.session) {
    return {
      eligible: false,
      detectedSport,
      reason: 'Distance repair needs a decoded running session.',
    };
  }
  if (activity.records.length < 2) {
    return {
      eligible: false,
      detectedSport,
      reason: 'Distance repair needs at least two running records.',
    };
  }
  return { eligible: true, detectedSport };
}
