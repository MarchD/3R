import type { ActivityAnomaly, NormalizedActivity } from '../../models/fit';
import { secondsBetween } from '../repair/estimateSteps';

const EARTH_RADIUS_M = 6_371_000;

function haversineMeters(
  a: { latitude?: number; longitude?: number },
  b: { latitude?: number; longitude?: number },
): number | undefined {
  if (a.latitude == null || a.longitude == null || b.latitude == null || b.longitude == null)
    return undefined;
  const toRadians = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * toRadians;
  const dLon = (b.longitude - a.longitude) * toRadians;
  const lat1 = a.latitude * toRadians;
  const lat2 = b.latitude * toRadians;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

function anomaly(
  id: string,
  type: string,
  severity: ActivityAnomaly['severity'],
  recordIndexes: number[],
  message: string,
  evidence: Record<string, unknown>,
): ActivityAnomaly {
  return { id, type, severity, recordIndexes, message, evidence };
}

export function detectAnomalies(
  activity: NormalizedActivity,
  crcValid: boolean | null,
): ActivityAnomaly[] {
  const issues: ActivityAnomaly[] = [];
  if (crcValid === false) {
    issues.push(
      anomaly(
        'crc-invalid',
        'invalid_crc',
        'critical',
        [],
        'The FIT container CRC does not match.',
        { crcValid },
      ),
    );
  }
  const missingTimestamps: number[] = [];
  const missingCoordinates: number[] = [];
  const invalidDeltas: number[] = [];
  const timestampJumps: number[] = [];
  const gpsJumps: number[] = [];
  const coordinateSpeed: number[] = [];
  const distanceDecreases: number[] = [];
  const distanceJumps: number[] = [];
  const invalidSpeeds: number[] = [];
  const abnormalSteps: number[] = [];
  const suspiciousDeveloperTypes: number[] = [];

  activity.records.forEach((record, index) => {
    if (!record.timestamp) missingTimestamps.push(index);
    if (record.position?.latitude == null || record.position?.longitude == null)
      missingCoordinates.push(index);
    const speed = record.enhancedSpeedMps ?? record.speedMps;
    if (speed != null && (speed < 0 || speed > 6)) invalidSpeeds.push(index);
    if (
      record.nativeStepLengthM != null &&
      (record.nativeStepLengthM < 0.6 || record.nativeStepLengthM > 1.6)
    )
      abnormalSteps.push(index);
    if (
      Object.values(record.developerFields).some(
        (value) => typeof value === 'function' || typeof value === 'symbol',
      )
    ) {
      suspiciousDeveloperTypes.push(index);
    }
    if (index === 0) return;
    const previous = activity.records[index - 1];
    const dt = secondsBetween(record.timestamp, previous.timestamp);
    if (dt != null && dt <= 0) invalidDeltas.push(index);
    if (dt != null && dt > 10) timestampJumps.push(index);
    if (record.distanceM != null && previous.distanceM != null) {
      const delta = record.distanceM - previous.distanceM;
      if (delta < 0) distanceDecreases.push(index);
      if (delta > 25 && (dt == null || delta / Math.max(dt, 0.001) > 8)) distanceJumps.push(index);
    }
    const gpsDistance =
      record.position && previous.position
        ? haversineMeters(previous.position, record.position)
        : undefined;
    if (gpsDistance != null && gpsDistance > 100) gpsJumps.push(index);
    if (gpsDistance != null && dt != null && dt > 0 && gpsDistance / dt > 15)
      coordinateSpeed.push(index);
  });

  const addGrouped = (
    indexes: number[],
    type: string,
    severity: ActivityAnomaly['severity'],
    message: string,
    evidence: Record<string, unknown> = {},
  ) => {
    if (indexes.length)
      issues.push(
        anomaly(type, type, severity, indexes, message, { count: indexes.length, ...evidence }),
      );
  };
  addGrouped(missingTimestamps, 'missing_timestamps', 'warning', 'Some records have no timestamp.');
  addGrouped(
    invalidDeltas,
    'invalid_time_deltas',
    'warning',
    'Some record timestamps do not move forward.',
  );
  addGrouped(
    timestampJumps,
    'timestamp_jumps',
    'warning',
    'Some gaps between records are unusually long.',
    { thresholdSeconds: 10 },
  );
  addGrouped(
    missingCoordinates,
    'missing_coordinates',
    'info',
    'Some records contain no GPS coordinates. This can be normal indoors or during signal loss.',
  );
  addGrouped(
    gpsJumps,
    'gps_jumps',
    'critical',
    'Coordinate pairs contain large point-to-point jumps.',
    { thresholdMeters: 100 },
  );
  addGrouped(
    coordinateSpeed,
    'coordinate_speed',
    'critical',
    'Coordinate-derived speed exceeds a plausible running threshold.',
    { thresholdMps: 15 },
  );
  addGrouped(
    distanceDecreases,
    'distance_decreases',
    'warning',
    'The cumulative distance decreases in some records.',
  );
  addGrouped(
    distanceJumps,
    'distance_jumps',
    'critical',
    'The distance timeline contains implausible jumps.',
  );
  addGrouped(
    invalidSpeeds,
    'invalid_speed',
    'warning',
    'Recorded speed exceeds the 6 m/s repair cap.',
    { capMps: 6 },
  );
  addGrouped(
    abnormalSteps,
    'abnormal_step_length',
    'warning',
    'Native step length falls outside the plausible 0.6–1.6 m range.',
  );
  addGrouped(
    suspiciousDeveloperTypes,
    'developer_field_types',
    'warning',
    'Some developer fields have values that cannot be represented safely.',
  );

  const start = activity.session?.startTime ? Date.parse(activity.session.startTime) : NaN;
  if (Number.isFinite(start) && (start > Date.now() + 86_400_000 || start < Date.UTC(1990, 0, 1))) {
    issues.push(
      anomaly(
        'suspicious-date',
        'suspicious_activity_date',
        'warning',
        [],
        'The activity date is outside the expected range.',
        { startTime: activity.session?.startTime },
      ),
    );
  }
  const lastDistance = [...activity.records]
    .reverse()
    .find((record) => record.distanceM != null)?.distanceM;
  const sessionDistance = activity.session?.totalDistanceM;
  const elapsedTime = activity.session?.totalElapsedTimeS;
  if (
    sessionDistance != null &&
    elapsedTime != null &&
    elapsedTime > 0 &&
    sessionDistance / elapsedTime > 6
  ) {
    issues.push(
      anomaly(
        'implausible-session-distance',
        'implausible_session_distance',
        'critical',
        [],
        'The session distance implies an implausibly high average running speed.',
        {
          sessionDistanceM: sessionDistance,
          elapsedTimeS: elapsedTime,
          impliedAverageSpeedMps: sessionDistance / elapsedTime,
          thresholdMps: 6,
        },
      ),
    );
  }
  if (
    lastDistance != null &&
    sessionDistance != null &&
    Math.abs(lastDistance - sessionDistance) / Math.max(sessionDistance, 1) > 0.05
  ) {
    issues.push(
      anomaly(
        'session-distance',
        'session_distance_disagreement',
        'warning',
        [],
        'Session distance disagrees with the record timeline.',
        { sessionDistanceM: sessionDistance, lastRecordDistanceM: lastDistance },
      ),
    );
  }
  return issues;
}
