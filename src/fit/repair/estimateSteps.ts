import type { NormalizedActivity, NormalizedRecord } from '../../models/fit';

export interface CadenceInterpretation {
  multiplier: 1 | 2;
  reason: string;
}

export function interpretCadence(
  sport: string | undefined,
  rawCadences: number[],
): CadenceInterpretation {
  const valid = rawCadences.filter((value) => value > 0 && value < 260).sort((a, b) => a - b);
  const median = valid.length ? valid[Math.floor(valid.length / 2)] : 0;
  if ((sport === 'running' || sport === 'walking') && median > 45 && median < 120) {
    return { multiplier: 2, reason: 'Running cadence is stored as cycles per minute for one leg.' };
  }
  return { multiplier: 1, reason: 'Cadence already appears to represent full steps per minute.' };
}

export function recordCadenceSpm(record: NormalizedRecord, multiplier: 1 | 2): number | undefined {
  if (record.cadenceRaw == null || record.cadenceRaw <= 0) return undefined;
  return record.cadenceRaw * multiplier;
}

export function secondsBetween(current?: string, previous?: string): number | undefined {
  if (!current || !previous) return undefined;
  const seconds = (Date.parse(current) - Date.parse(previous)) / 1000;
  return Number.isFinite(seconds) ? seconds : undefined;
}

export function estimateSteps(activity: NormalizedActivity): {
  totalSteps: number;
  integratedSteps: number;
  multiplier: 1 | 2;
  reason: string;
} {
  const interpretation = interpretCadence(
    activity.sport,
    activity.records.flatMap((record) => (record.cadenceRaw == null ? [] : [record.cadenceRaw])),
  );
  let integratedSteps = 0;
  for (let index = 1; index < activity.records.length; index += 1) {
    const record = activity.records[index];
    const dt = secondsBetween(record.timestamp, activity.records[index - 1].timestamp);
    const cadence = recordCadenceSpm(record, interpretation.multiplier);
    if (dt != null && dt > 0 && dt <= 3 && cadence != null) {
      integratedSteps += (cadence * dt) / 60;
    }
  }
  const sessionSteps =
    activity.session?.totalStrides && interpretation.multiplier === 2
      ? activity.session.totalStrides * 2
      : undefined;
  const totalSteps =
    sessionSteps && Math.abs(sessionSteps - integratedSteps) / sessionSteps < 0.1
      ? sessionSteps
      : integratedSteps;
  return {
    totalSteps,
    integratedSteps,
    multiplier: interpretation.multiplier,
    reason: interpretation.reason,
  };
}
