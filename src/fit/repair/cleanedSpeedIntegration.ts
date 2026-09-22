import type { NormalizedActivity } from '../../models/fit';
import type { RepairCandidate, RecordPatch } from '../../models/repair';
import { paceFor } from '../analysis/activitySummary';
import { speedIntegrationConfidence } from './confidence';
import { secondsBetween } from './estimateSteps';
import { median } from './medianStepLength';

export const SPEED_CAP_MPS = 6;
export const MIN_LOCAL_SPEED_MPS = 0.5;
export const LOCAL_WINDOW_RECORDS = 60;

export const clampDt = (seconds: number): number => Math.max(0, Math.min(3, seconds));

export function localMedianReplacement(
  speeds: (number | undefined)[],
  index: number,
): number | undefined {
  const candidates: number[] = [];
  const start = Math.max(0, index - LOCAL_WINDOW_RECORDS);
  const end = Math.min(speeds.length - 1, index + LOCAL_WINDOW_RECORDS);
  for (let cursor = start; cursor <= end; cursor += 1) {
    const speed = speeds[cursor];
    if (speed != null && speed >= MIN_LOCAL_SPEED_MPS && speed <= SPEED_CAP_MPS)
      candidates.push(speed);
  }
  return median(candidates);
}

export function cleanedSpeedIntegrationCandidate(activity: NormalizedActivity): RepairCandidate {
  const speeds = activity.records.map((record) => record.enhancedSpeedMps ?? record.speedMps);
  const patches: RecordPatch[] = [{ recordIndex: 0, distanceM: 0, derivedSpeedMps: speeds[0] }];
  let distanceM = 0;
  let replaced = 0;
  let unresolved = 0;
  let accepted = 0;
  for (let index = 1; index < activity.records.length; index += 1) {
    let speed = speeds[index];
    if (speed == null || speed < 0 || speed > SPEED_CAP_MPS) {
      speed = localMedianReplacement(speeds, index);
      if (speed == null) unresolved += 1;
      else replaced += 1;
    } else {
      accepted += 1;
    }
    const rawDt = secondsBetween(
      activity.records[index].timestamp,
      activity.records[index - 1].timestamp,
    );
    const dt = rawDt == null ? 0 : clampDt(rawDt);
    if (speed != null) distanceM += speed * dt;
    patches.push({ recordIndex: index, distanceM, derivedSpeedMps: speed });
  }
  return {
    id: 'speed-integration',
    algorithm: 'cleaned_speed_integration',
    name: 'Cleaned speed integration',
    description: 'Replaces invalid speeds with a local median and integrates the cleaned timeline.',
    distanceM,
    averagePaceSPerKm: paceFor(distanceM, activity.session?.totalElapsedTimeS),
    confidence: speedIntegrationConfidence(accepted, unresolved),
    assumptions: ['Speed is plausible from 0 to 6 m/s.', 'Time deltas are clamped to 0–3 seconds.'],
    warnings: unresolved ? [`${unresolved} segments could not be resolved.`] : [],
    calculation: {
      acceptedSamples: accepted,
      rejectedSamples: replaced + unresolved,
      replacedSamples: replaced,
      unresolvedSamples: unresolved,
    },
    recordPatches: patches,
  };
}
