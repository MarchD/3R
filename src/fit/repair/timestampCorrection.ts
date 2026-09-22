export interface TimestampCorrection {
  timestampOffsetMs: number;
  originalStartTime?: string;
  correctedStartTime?: string;
}

export function resolveTimestampCorrection(
  originalStartTime: string | undefined,
  correctedStartTime: string | undefined,
): TimestampCorrection {
  if (!correctedStartTime) return { timestampOffsetMs: 0 };
  const originalStartMs = originalStartTime ? Date.parse(originalStartTime) : NaN;
  const correctedStartMs = Date.parse(correctedStartTime);
  if (!Number.isFinite(originalStartMs)) {
    throw new Error('The activity does not contain a valid original start time.');
  }
  if (!Number.isFinite(correctedStartMs)) throw new Error('The corrected start time is invalid.');
  const timestampOffsetMs = Math.round((correctedStartMs - originalStartMs) / 1000) * 1000;
  return {
    timestampOffsetMs,
    originalStartTime: timestampOffsetMs ? originalStartTime : undefined,
    correctedStartTime: timestampOffsetMs
      ? new Date(originalStartMs + timestampOffsetMs).toISOString()
      : undefined,
  };
}

export function shiftTimestamp(value: string | undefined, offsetMs: number): string | undefined {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp + offsetMs).toISOString() : value;
}
