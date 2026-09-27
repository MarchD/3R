import type { NormalizedActivity, NormalizedRecord } from '../../models/fit';
import type { RebuiltLap } from '../../models/repair';

interface TimedDistanceRecord {
  distanceM: number;
  timeMs: number;
  position?: NormalizedRecord['position'];
  speedMps?: number;
}

interface Boundary {
  distanceM: number;
  timeMs: number;
  position?: { latitude: number; longitude: number };
}

function originalAutoLapLength(activity: NormalizedActivity): number | undefined {
  const { laps } = activity;
  if (laps.length < 2 || laps.length > 10_000) return undefined;
  if (laps.slice(0, -1).some((lap) => lap.lapTrigger !== 'distance')) return undefined;
  if (!['distance', 'sessionEnd'].includes(laps.at(-1)?.lapTrigger ?? '')) return undefined;

  const fullDistances = laps.slice(0, -1).map((lap) => lap.totalDistanceM);
  if (fullDistances.some((distance) => distance == null || !Number.isFinite(distance)))
    return undefined;
  const sorted = [...(fullDistances as number[])].sort((first, second) => first - second);
  const lapLengthM = sorted[Math.floor(sorted.length / 2)];
  if (lapLengthM < 100 || lapLengthM > 10_000) return undefined;
  if (sorted.some((distance) => Math.abs(distance - lapLengthM) > lapLengthM * 0.05))
    return undefined;

  const finalDistanceM = laps.at(-1)?.totalDistanceM;
  if (finalDistanceM == null || finalDistanceM <= 0 || finalDistanceM > lapLengthM * 1.05)
    return undefined;
  return lapLengthM;
}

function timedDistanceRecords(records: NormalizedRecord[]): TimedDistanceRecord[] | undefined {
  const timed = records.map((record) => ({
    distanceM: record.distanceM,
    timeMs: record.timestamp ? Date.parse(record.timestamp) : Number.NaN,
    position: record.position,
    speedMps: record.enhancedSpeedMps ?? record.speedMps,
  }));
  if (
    timed.length < 2 ||
    timed.some(
      (record, index) =>
        record.distanceM == null ||
        !Number.isFinite(record.distanceM) ||
        !Number.isFinite(record.timeMs) ||
        (index > 0 &&
          (record.distanceM < timed[index - 1].distanceM! ||
            record.timeMs < timed[index - 1].timeMs)),
    )
  )
    return undefined;
  return timed as TimedDistanceRecord[];
}

function boundaryAt(records: TimedDistanceRecord[], distanceM: number): Boundary {
  let low = 0;
  let high = records.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (records[middle].distanceM < distanceM) low = middle + 1;
    else high = middle;
  }
  const next = records[low];
  const previous = records[Math.max(0, low - 1)];
  const span = next.distanceM - previous.distanceM;
  const fraction = span > 0 ? (distanceM - previous.distanceM) / span : 0;
  const firstPosition = previous.position;
  const lastPosition = next.position;
  const position =
    firstPosition?.latitude != null &&
    firstPosition.longitude != null &&
    lastPosition?.latitude != null &&
    lastPosition.longitude != null
      ? {
          latitude:
            firstPosition.latitude + (lastPosition.latitude - firstPosition.latitude) * fraction,
          longitude:
            firstPosition.longitude + (lastPosition.longitude - firstPosition.longitude) * fraction,
        }
      : undefined;
  return {
    distanceM,
    timeMs: previous.timeMs + (next.timeMs - previous.timeMs) * fraction,
    position,
  };
}

export function rebuildDistanceLaps(
  original: NormalizedActivity,
  repairedRecords: NormalizedRecord[],
  repairedDistanceM: number,
): RebuiltLap[] | undefined {
  const lapLengthM = originalAutoLapLength(original);
  const records = timedDistanceRecords(repairedRecords);
  if (!lapLengthM || !records || !Number.isFinite(repairedDistanceM)) return undefined;
  if (Math.abs(records[0].distanceM) > 1) return undefined;
  if (Math.abs(records.at(-1)!.distanceM - repairedDistanceM) > 1) return undefined;

  const firstTimeMs = records[0].timeMs;
  const lastTimeMs = records.at(-1)!.timeMs;
  const sessionElapsedS = original.session?.totalElapsedTimeS;
  const sessionTimerS = original.session?.totalTimerTimeS;
  const expectedEndMs =
    sessionElapsedS != null && sessionElapsedS > 0
      ? firstTimeMs + sessionElapsedS * 1000
      : lastTimeMs;
  if (Math.abs(expectedEndMs - lastTimeMs) > 2000) return undefined;
  const endTimeMs = expectedEndMs;
  if (endTimeMs <= firstTimeMs) return undefined;
  const timerRatio =
    sessionTimerS != null && sessionTimerS > 0 && sessionElapsedS != null && sessionElapsedS > 0
      ? Math.min(1, sessionTimerS / sessionElapsedS)
      : 1;

  const boundaries = [boundaryAt(records, 0)];
  for (let distanceM = lapLengthM; distanceM < repairedDistanceM - 0.5; distanceM += lapLengthM) {
    if (boundaries.length >= 10_000) return undefined;
    boundaries.push(boundaryAt(records, distanceM));
  }
  const finalRecordPosition = records.at(-1)!.position;
  const finalPosition =
    finalRecordPosition?.latitude != null && finalRecordPosition.longitude != null
      ? { latitude: finalRecordPosition.latitude, longitude: finalRecordPosition.longitude }
      : undefined;
  boundaries.push({
    ...boundaryAt(records, repairedDistanceM),
    timeMs: endTimeMs,
    position: finalPosition,
  });
  if (
    boundaries.some(
      (boundary, index) => index > 0 && boundary.timeMs <= boundaries[index - 1].timeMs,
    )
  )
    return undefined;

  return boundaries.slice(1).map((end, index) => {
    const start = boundaries[index];
    const totalElapsedTimeS = (end.timeMs - start.timeMs) / 1000;
    const totalTimerTimeS = totalElapsedTimeS * timerRatio;
    const totalDistanceM = end.distanceM - start.distanceM;
    const maxSpeedMps = records.reduce(
      (maximum, record) =>
        record.timeMs > start.timeMs && record.timeMs <= end.timeMs
          ? Math.max(maximum, record.speedMps ?? 0)
          : maximum,
      0,
    );
    return {
      index,
      startTime: new Date(start.timeMs).toISOString(),
      endTime: new Date(end.timeMs).toISOString(),
      totalElapsedTimeS,
      totalTimerTimeS,
      totalDistanceM,
      avgSpeedMps: totalTimerTimeS > 0 ? totalDistanceM / totalTimerTimeS : 0,
      maxSpeedMps,
      lapTrigger: index === boundaries.length - 2 ? 'sessionEnd' : 'distance',
      startPosition: start.position,
      endPosition: end.position,
    };
  });
}
