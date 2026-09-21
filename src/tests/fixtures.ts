import type { NormalizedActivity, ParsedFitFile } from '../models/fit';

export function activityFixture(): NormalizedActivity {
  return {
    metadata: { manufacturer: 'garmin', createdAt: '2024-01-01T00:00:00.000Z' },
    sport: 'running',
    session: {
      startTime: '2024-01-01T00:00:00.000Z',
      totalElapsedTimeS: 4,
      totalTimerTimeS: 4,
      totalDistanceM: 500,
      totalStrides: 6,
    },
    laps: [],
    records: [0, 1, 2, 3, 4].map((second, index) => ({
      index,
      timestamp: `2024-01-01T00:00:0${second}.000Z`,
      distanceM: index * 3,
      enhancedSpeedMps: index === 2 ? 12 : 3,
      cadenceRaw: 90,
      runningCadenceSpm: 180,
      nativeStepLengthM: 1,
      position: { latitude: 50 + index * 0.00001, longitude: 30 },
      developerFields: {},
    })),
    developerFields: { definitions: [], valuesByRecord: [{}, {}, {}, {}, {}] },
  };
}

export function parsedFixture(): ParsedFitFile {
  const normalized = activityFixture();
  return {
    file: { name: 'test.fit', size: 10, lastModified: 1 },
    integrity: { crcValid: true, complete: true, warnings: [], errors: [] },
    raw: { messages: [{ index: 0, messageNumber: 20, messageType: 'record', data: { timestamp: normalized.records[0].timestamp } }], developerFields: [] },
    normalized,
    anomalies: [],
  };
}
