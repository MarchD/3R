import { z } from 'zod';

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface FitWarning {
  code: string;
  message: string;
}

export interface FitParseError {
  code: string;
  message: string;
  recoverable?: boolean;
}

export interface RawFitMessage {
  index: number;
  messageNumber: number;
  messageType: string;
  data: Record<string, unknown>;
}

export interface DeveloperFieldDefinition {
  key: number;
  name?: string;
  units?: string;
  developerDataIndex?: number;
  fieldDefinitionNumber?: number;
  [key: string]: unknown;
}

export const normalizedRecordSchema = z.object({
  index: z.number().int().nonnegative(),
  timestamp: z.string().optional(),
  position: z.object({ latitude: z.number().optional(), longitude: z.number().optional() }).optional(),
  distanceM: z.number().optional(),
  speedMps: z.number().optional(),
  enhancedSpeedMps: z.number().optional(),
  altitudeM: z.number().optional(),
  enhancedAltitudeM: z.number().optional(),
  heartRate: z.number().optional(),
  cadenceRaw: z.number().optional(),
  runningCadenceSpm: z.number().optional(),
  powerW: z.number().optional(),
  headingDeg: z.number().optional(),
  trackDeg: z.number().optional(),
  gpsAccuracy: z.number().optional(),
  nativeStepLengthM: z.number().optional(),
  developerFields: z.record(z.unknown()),
});

export type NormalizedRecord = z.infer<typeof normalizedRecordSchema>;

export interface NormalizedLap {
  index: number;
  startTime?: string;
  totalElapsedTimeS?: number;
  totalTimerTimeS?: number;
  totalDistanceM?: number;
  [key: string]: unknown;
}

export interface NormalizedActivity {
  metadata: {
    manufacturer?: string;
    product?: string;
    serialNumber?: string;
    createdAt?: string;
  };
  sport?: string;
  subSport?: string;
  session?: {
    startTime?: string;
    totalElapsedTimeS?: number;
    totalTimerTimeS?: number;
    totalDistanceM?: number;
    avgSpeedMps?: number;
    maxSpeedMps?: number;
    avgHeartRate?: number;
    maxHeartRate?: number;
    totalAscentM?: number;
    totalDescentM?: number;
    totalStrides?: number;
  };
  laps: NormalizedLap[];
  records: NormalizedRecord[];
  developerFields: {
    definitions: DeveloperFieldDefinition[];
    valuesByRecord: Record<string, unknown>[];
  };
}

export interface ActivityAnomaly {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  recordIndexes: number[];
  message: string;
  evidence: Record<string, unknown>;
}

export interface ParsedFitFile {
  file: { name: string; size: number; lastModified: number };
  integrity: {
    crcValid: boolean | null;
    complete: boolean;
    warnings: FitWarning[];
    errors: FitParseError[];
  };
  raw: {
    messages: RawFitMessage[];
    developerFields: DeveloperFieldDefinition[];
  };
  normalized: NormalizedActivity;
  anomalies: ActivityAnomaly[];
}

export type AttachmentState =
  | { status: 'idle' }
  | { status: 'parsing'; progress?: number }
  | { status: 'parsed'; result: ParsedFitFile }
  | { status: 'error'; error: FitParseError };

export interface Attachment {
  id: string;
  file: File;
  state: AttachmentState;
}
