import type { NormalizedActivity } from '../../models/fit';
import type { RepairCandidate } from '../../models/repair';
import { paceFor } from '../analysis/activitySummary';
import { estimateSteps, recordCadenceSpm, secondsBetween } from './estimateSteps';

export function median(values: number[]): number | undefined {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function isPlausibleStepLength(value: number): boolean {
  return Number.isFinite(value) && value >= 0.6 && value <= 1.6;
}

export function stepLengthSamples(activity: NormalizedActivity, multiplier: 1 | 2): { value: number; index: number }[] {
  const samples: { value: number; index: number }[] = [];
  for (let index = 1; index < activity.records.length; index += 1) {
    const record = activity.records[index];
    const previous = activity.records[index - 1];
    const dt = secondsBetween(record.timestamp, previous.timestamp);
    const cadence = recordCadenceSpm(record, multiplier);
    if (dt == null || dt <= 0 || dt > 3 || cadence == null) continue;
    const steps = cadence * dt / 60;
    const distanceDelta = record.distanceM != null && previous.distanceM != null
      ? record.distanceM - previous.distanceM
      : undefined;
    const speed = record.enhancedSpeedMps ?? record.speedMps;
    const value = record.nativeStepLengthM
      ?? (distanceDelta != null && distanceDelta > 0 ? distanceDelta / steps : undefined)
      ?? (speed != null && speed >= 0 ? speed * dt / steps : undefined);
    if (value != null && isPlausibleStepLength(value)) samples.push({ value, index });
  }
  return samples;
}

export function buildStepDistancePatches(
  activity: NormalizedActivity,
  multiplier: 1 | 2,
  totalDistanceM: number,
) {
  const cumulative: number[] = [0];
  let totalIntegratedSteps = 0;
  for (let index = 1; index < activity.records.length; index += 1) {
    const dt = secondsBetween(activity.records[index].timestamp, activity.records[index - 1].timestamp);
    const cadence = recordCadenceSpm(activity.records[index], multiplier);
    if (dt != null && dt > 0 && dt <= 3 && cadence != null) totalIntegratedSteps += cadence * dt / 60;
    cumulative.push(totalIntegratedSteps);
  }
  const scale = totalIntegratedSteps > 0 ? totalDistanceM / totalIntegratedSteps : 0;
  return activity.records.map((record, index) => {
    const distanceM = cumulative[index] * scale;
    const dt = index ? secondsBetween(record.timestamp, activity.records[index - 1].timestamp) : undefined;
    const previousDistance = index ? cumulative[index - 1] * scale : 0;
    return {
      recordIndex: index,
      distanceM,
      derivedSpeedMps: dt && dt > 0 ? (distanceM - previousDistance) / dt : undefined,
    };
  });
}

export function medianStepLengthCandidate(activity: NormalizedActivity): RepairCandidate {
  const stepEstimate = estimateSteps(activity);
  const samples = stepLengthSamples(activity, stepEstimate.multiplier);
  const stepLengthM = median(samples.map((sample) => sample.value));
  if (stepLengthM == null || stepEstimate.totalSteps <= 0) throw new Error('Not enough valid cadence and step-length data for median repair.');
  const distanceM = stepEstimate.totalSteps * stepLengthM;
  return {
    id: 'steps-median',
    algorithm: 'steps_median_step_length',
    name: 'Steps × median step length',
    description: 'Uses the robust median of plausible native or observed step-length samples.',
    distanceM,
    averagePaceSPerKm: paceFor(distanceM, activity.session?.totalElapsedTimeS),
    confidence: samples.length >= 100 ? 'high' : samples.length >= 20 ? 'medium' : 'low',
    assumptions: [stepEstimate.reason, 'Plausible step length is between 0.6 and 1.6 metres.'],
    warnings: [],
    calculation: {
      totalSteps: stepEstimate.totalSteps,
      stepLengthM,
      acceptedSamples: samples.length,
      rejectedSamples: Math.max(0, activity.records.length - 1 - samples.length),
    },
    recordPatches: buildStepDistancePatches(activity, stepEstimate.multiplier, distanceM),
  };
}
