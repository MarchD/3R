import type { NormalizedActivity } from '../../models/fit';
import type { RepairCandidate } from '../../models/repair';
import { paceFor } from '../analysis/activitySummary';
import { estimateSteps, recordCadenceSpm, secondsBetween } from './estimateSteps';
import { buildStepDistancePatches, isPlausibleStepLength } from './medianStepLength';

export function weightedMean(samples: { value: number; weight: number }[]): number | undefined {
  const denominator = samples.reduce((sum, sample) => sum + sample.weight, 0);
  if (!samples.length || denominator <= 0) return undefined;
  return samples.reduce((sum, sample) => sum + sample.value * sample.weight, 0) / denominator;
}

export function weightedStepLengthCandidate(activity: NormalizedActivity): RepairCandidate {
  const stepEstimate = estimateSteps(activity);
  const samples: { value: number; weight: number; index: number }[] = [];
  let rejected = 0;
  for (let index = 1; index < activity.records.length; index += 1) {
    const current = activity.records[index];
    const previous = activity.records[index - 1];
    const dt = secondsBetween(current.timestamp, previous.timestamp);
    const cadence = recordCadenceSpm(current, stepEstimate.multiplier);
    const speed = current.enhancedSpeedMps ?? current.speedMps;
    const distanceDelta = current.distanceM != null && previous.distanceM != null
      ? current.distanceM - previous.distanceM
      : undefined;
    const stepLength = current.nativeStepLengthM;
    if (
      dt == null || dt <= 0 || dt > 3 || cadence == null || speed == null || speed < 0 || speed > 6 ||
      distanceDelta == null || distanceDelta < 0 || distanceDelta >= 20 ||
      stepLength == null || !isPlausibleStepLength(stepLength)
    ) {
      rejected += 1;
      continue;
    }
    const steps = cadence * dt / 60;
    const weight = Math.min(6, steps) * (distanceDelta < 10 ? 1 : 0.5);
    samples.push({ value: stepLength, weight, index });
  }
  const stepLengthM = weightedMean(samples);
  if (stepLengthM == null || stepEstimate.totalSteps <= 0) throw new Error('Not enough high-quality samples for weighted step-length repair.');
  const distanceM = stepEstimate.totalSteps * stepLengthM;
  return {
    id: 'steps-weighted',
    algorithm: 'steps_weighted_mean_step_length',
    name: 'Steps × weighted mean step length',
    description: 'Weights plausible step lengths by segment steps and quality, with a cap to limit damaged segments.',
    distanceM,
    averagePaceSPerKm: paceFor(distanceM, activity.session?.totalElapsedTimeS),
    confidence: samples.length >= 100 ? 'high' : samples.length >= 20 ? 'medium' : 'low',
    assumptions: [stepEstimate.reason, 'Samples require valid time, cadence, speed and distance deltas.'],
    warnings: [],
    calculation: {
      totalSteps: stepEstimate.totalSteps,
      stepLengthM,
      acceptedSamples: samples.length,
      rejectedSamples: rejected,
      weights: samples.map(({ index, weight }) => ({ recordIndex: index, weight })),
    },
    recordPatches: buildStepDistancePatches(activity, stepEstimate.multiplier, distanceM),
  };
}
