import type { NormalizedActivity, NormalizedRecord } from '../../models/fit';
import type { LapPatch } from '../../models/repair';

function timestampMs(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

type TimedRecord = { record: NormalizedRecord; time: number };

function recordAtTime(timed: TimedRecord[], time: number) {
  if (!timed.length) return undefined;
  let low = 0;
  let high = timed.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (timed[middle].time < time) low = middle + 1;
    else high = middle;
  }
  const nextIndex = low === timed.length ? -1 : low;
  if (nextIndex <= 0) return timed[nextIndex < 0 ? timed.length - 1 : 0].record;
  const previous = timed[nextIndex - 1];
  const next = timed[nextIndex];
  const fraction = Math.min(1, Math.max(0, (time - previous.time) / (next.time - previous.time)));
  const previousPosition = previous.record.position;
  const nextPosition = next.record.position;
  return {
    distanceM:
      previous.record.distanceM != null && next.record.distanceM != null
        ? previous.record.distanceM + (next.record.distanceM - previous.record.distanceM) * fraction
        : undefined,
    position:
      previousPosition?.latitude != null &&
      previousPosition.longitude != null &&
      nextPosition?.latitude != null &&
      nextPosition.longitude != null
        ? {
            latitude:
              previousPosition.latitude +
              (nextPosition.latitude - previousPosition.latitude) * fraction,
            longitude:
              previousPosition.longitude +
              (nextPosition.longitude - previousPosition.longitude) * fraction,
          }
        : undefined,
  };
}

export function calibrateLaps(
  activity: NormalizedActivity,
  repairedRecords: NormalizedRecord[],
  hasDistanceRepair: boolean,
): LapPatch[] {
  const timed = repairedRecords
    .map((record) => ({ record, time: timestampMs(record.timestamp) }))
    .filter((item): item is TimedRecord => item.time != null)
    .sort((first, second) => first.time - second.time);
  return activity.laps.flatMap((lap) => {
    const start = timestampMs(lap.startTime);
    let end = timestampMs(lap.endTime);
    if (start != null && (end == null || end <= start) && lap.totalElapsedTimeS != null) {
      end = start + lap.totalElapsedTimeS * 1000;
    }
    if (start == null || end == null || end <= start) return [];
    const first = recordAtTime(timed, start);
    const last = recordAtTime(timed, end);
    const startPosition = first?.position;
    const endPosition = last?.position;
    const totalDistanceM =
      hasDistanceRepair && first?.distanceM != null && last?.distanceM != null
        ? Math.max(0, last.distanceM - first.distanceM)
        : undefined;
    const hasPositions =
      startPosition?.latitude != null &&
      startPosition.longitude != null &&
      endPosition?.latitude != null &&
      endPosition.longitude != null;
    if (totalDistanceM == null && !hasPositions) return [];
    return [
      {
        lapIndex: lap.index,
        startPosition: hasPositions
          ? { latitude: startPosition!.latitude!, longitude: startPosition!.longitude! }
          : undefined,
        endPosition: hasPositions
          ? { latitude: endPosition!.latitude!, longitude: endPosition!.longitude! }
          : undefined,
        totalDistanceM,
      },
    ];
  });
}
