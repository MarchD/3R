import type { DeveloperFieldDefinition } from '../../models/fit';

const KNOWN_RECORD_FIELDS = new Set([
  'timestamp', 'positionLat', 'positionLong', 'distance', 'speed', 'enhancedSpeed',
  'altitude', 'enhancedAltitude', 'heartRate', 'cadence', 'fractionalCadence',
  'power', 'heading', 'track', 'gpsAccuracy', 'stepLength', 'activityType',
  'accumulatedPower', 'verticalOscillation', 'stanceTime', 'verticalRatio',
  'cycleLength16',
]);

export function normalizeDeveloperFields(
  record: Record<string, unknown>,
  definitions: DeveloperFieldDefinition[],
): Record<string, unknown> {
  const named = new Set(definitions.map((definition) => definition.name).filter(Boolean));
  return Object.fromEntries(
    Object.entries(record).filter(([key]) =>
      named.has(key) || !KNOWN_RECORD_FIELDS.has(key),
    ),
  );
}
