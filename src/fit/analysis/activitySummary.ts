import type { NormalizedActivity } from '../../models/fit';
import type { ActivitySummary } from '../../models/repair';

export function paceFor(distanceM?: number, elapsedTimeS?: number): number | undefined {
  if (!distanceM || !elapsedTimeS || distanceM <= 0 || elapsedTimeS <= 0) return undefined;
  return elapsedTimeS / (distanceM / 1000);
}

export function activitySummary(activity: NormalizedActivity): ActivitySummary {
  const distance = activity.session?.totalDistanceM;
  const elapsed = activity.session?.totalElapsedTimeS;
  return {
    totalDistanceM: distance,
    elapsedTimeS: elapsed,
    averagePaceSPerKm: paceFor(distance, elapsed),
  };
}
