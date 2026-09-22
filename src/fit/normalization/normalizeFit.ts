import type {
  DeveloperFieldDefinition,
  NormalizedActivity,
  NormalizedLap,
  NormalizedRecord,
} from '../../models/fit';
import { interpretCadence } from '../repair/estimateSteps';
import { normalizeDeveloperFields } from './normalizeDeveloperFields';

export const semicirclesToDegrees = (semicircles: number): number => (semicircles * 180) / 2 ** 31;

function number(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function text(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  return undefined;
}

function first(messages: Record<string, unknown[]>, key: string): Record<string, unknown> {
  return (messages[key]?.[0] ?? {}) as Record<string, unknown>;
}

export function normalizeFit(
  messages: Record<string, unknown[]>,
  definitions: DeveloperFieldDefinition[],
): NormalizedActivity {
  const fileId = first(messages, 'fileIdMesgs');
  const session = first(messages, 'sessionMesgs');
  const rawRecords = (messages.recordMesgs ?? []) as Record<string, unknown>[];
  const cadence = interpretCadence(
    text(session.sport),
    rawRecords.flatMap((record) =>
      number(record.cadence) == null ? [] : [number(record.cadence)!],
    ),
  );
  const records: NormalizedRecord[] = rawRecords.map((record, index) => {
    const latitude = number(record.positionLat);
    const longitude = number(record.positionLong);
    const cadenceRaw = number(record.cadence);
    const fractional = number(record.fractionalCadence) ?? 0;
    const developerFields = normalizeDeveloperFields(record, definitions);
    return {
      index,
      timestamp: text(record.timestamp),
      position:
        latitude != null || longitude != null
          ? {
              latitude: latitude == null ? undefined : semicirclesToDegrees(latitude),
              longitude: longitude == null ? undefined : semicirclesToDegrees(longitude),
            }
          : undefined,
      distanceM: number(record.distance),
      speedMps: number(record.speed),
      enhancedSpeedMps: number(record.enhancedSpeed),
      altitudeM: number(record.altitude),
      enhancedAltitudeM: number(record.enhancedAltitude),
      heartRate: number(record.heartRate),
      cadenceRaw,
      runningCadenceSpm:
        cadenceRaw == null
          ? undefined
          : cadenceRaw * cadence.multiplier + fractional * cadence.multiplier,
      powerW: number(record.power),
      headingDeg: number(record.heading),
      trackDeg: number(record.track),
      gpsAccuracy: number(record.gpsAccuracy),
      nativeStepLengthM:
        number(record.stepLength) == null ? undefined : number(record.stepLength)! / 1000,
      developerFields,
    };
  });
  const laps: NormalizedLap[] = ((messages.lapMesgs ?? []) as Record<string, unknown>[]).map(
    (lap, index) => ({
      index,
      startTime: text(lap.startTime),
      totalElapsedTimeS: number(lap.totalElapsedTime),
      totalTimerTimeS: number(lap.totalTimerTime),
      totalDistanceM: number(lap.totalDistance),
    }),
  );
  return {
    metadata: {
      manufacturer: text(fileId.manufacturer),
      product: text(fileId.productName ?? fileId.garminProduct ?? fileId.product),
      serialNumber: text(fileId.serialNumber),
      createdAt: text(fileId.timeCreated),
    },
    sport: text(session.sport),
    subSport: text(session.subSport),
    session: Object.keys(session).length
      ? {
          startTime: text(session.startTime),
          totalElapsedTimeS: number(session.totalElapsedTime),
          totalTimerTimeS: number(session.totalTimerTime),
          totalDistanceM: number(session.totalDistance),
          avgSpeedMps: number(session.enhancedAvgSpeed ?? session.avgSpeed),
          maxSpeedMps: number(session.enhancedMaxSpeed ?? session.maxSpeed),
          avgHeartRate: number(session.avgHeartRate),
          maxHeartRate: number(session.maxHeartRate),
          totalAscentM: number(session.totalAscent),
          totalDescentM: number(session.totalDescent),
          totalStrides: number(session.totalStrides ?? session.totalCycles),
        }
      : undefined,
    laps,
    records,
    developerFields: {
      definitions,
      valuesByRecord: records.map((record) => record.developerFields),
    },
  };
}
