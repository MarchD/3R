import type { GeoPoint, GpsEvidence, GpsMatchProposal } from './types';
import { createGpsMatchProposal, relocateGpsEvidence, sampleTrace } from './traceAnalysis';
import type { NormalizedActivity } from '../../models/fit';

const ENDPOINT = 'https://valhalla1.openstreetmap.de/trace_route';
const ELEVATION_ENDPOINT = 'https://valhalla1.openstreetmap.de/height';

interface ValhallaResponse {
  error?: string;
  trip?: { legs?: { shape?: string }[] };
}

interface ElevationResponse {
  height?: (number | null)[];
  range_height?: [number, number | null][];
}

export function decodePolyline(encoded: string, precision = 6): GeoPoint[] {
  const points: GeoPoint[] = [];
  const factor = 10 ** precision;
  let index = 0;
  let latitude = 0;
  let longitude = 0;
  const decodeValue = (): number => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index) - 63;
      index += 1;
      result += (byte % 32) * 2 ** shift;
      shift += 5;
    } while (byte >= 0x20 && index <= encoded.length);
    return result % 2 ? -(Math.floor(result / 2) + 1) : Math.floor(result / 2);
  };
  while (index < encoded.length) {
    latitude += decodeValue();
    longitude += decodeValue();
    points.push({ latitude: latitude / factor, longitude: longitude / factor });
  }
  return points;
}

function joinedRoute(response: ValhallaResponse): GeoPoint[] {
  return (response.trip?.legs ?? []).flatMap((leg, index) => {
    if (!leg.shape) return [];
    const points = decodePolyline(leg.shape);
    return index ? points.slice(1) : points;
  });
}

function median(values: number[]): number | undefined {
  if (!values.length) return undefined;
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function pointTimes(points: GpsEvidence['cleanedPoints']): (number | undefined)[] {
  const milliseconds = points.map((point) =>
    point.timestamp ? Date.parse(point.timestamp) : Number.NaN,
  );
  const first = milliseconds[0];
  const usable =
    Number.isFinite(first) &&
    milliseconds.every(
      (value, index) => Number.isFinite(value) && (index === 0 || value > milliseconds[index - 1]),
    );
  return usable ? milliseconds.map((value) => Math.round((value - first) / 1000)) : [];
}

async function requestElevations(
  route: GeoPoint[],
  fetcher: typeof fetch,
  signal?: AbortSignal,
): Promise<number[]> {
  const maximumPoints = 180;
  const sampledRoute =
    route.length <= maximumPoints
      ? route
      : Array.from(
          { length: maximumPoints },
          (_, index) => route[Math.round((index * (route.length - 1)) / (maximumPoints - 1))],
        );
  try {
    const response = await fetcher(ELEVATION_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Id': '3r-fit-repair-alpha',
      },
      body: JSON.stringify({
        shape: sampledRoute.map((point) => ({ lat: point.latitude, lon: point.longitude })),
        range: true,
        resample_distance: 30,
        height_precision: 1,
      }),
      signal,
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as ElevationResponse;
    return (payload.range_height?.map((entry) => entry[1]) ?? payload.height ?? []).flatMap(
      (height) => (height == null || !Number.isFinite(height) ? [] : [height]),
    );
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    return [];
  }
}

export async function requestGpsMatch(
  activity: NormalizedActivity,
  evidence: GpsEvidence,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
  correctedStart?: GeoPoint,
): Promise<GpsMatchProposal> {
  const matchingEvidence = correctedStart
    ? relocateGpsEvidence(evidence, correctedStart)
    : evidence;
  const submittedPoints = sampleTrace(matchingEvidence.cleanedPoints);
  if (submittedPoints.length < 2) {
    throw new Error('At least two valid GPS positions are required for map matching.');
  }
  const times = pointTimes(submittedPoints);
  const gpsAccuracy = median(
    submittedPoints.flatMap((point) =>
      point.gpsAccuracy == null || point.gpsAccuracy <= 0 ? [] : [point.gpsAccuracy],
    ),
  );
  const response = await fetcher(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Id': '3r-fit-repair-alpha',
    },
    body: JSON.stringify({
      shape: submittedPoints.map((point, index) => ({
        lat: point.latitude,
        lon: point.longitude,
        type: index === 0 || index === submittedPoints.length - 1 ? 'break' : 'via',
        ...(times[index] == null ? {} : { time: times[index] }),
      })),
      costing: activity.sport === 'cycling' ? 'bicycle' : 'pedestrian',
      shape_match: 'map_snap',
      directions_type: 'none',
      shape_format: 'polyline6',
      use_timestamps: times.length === submittedPoints.length,
      trace_options: {
        gps_accuracy: gpsAccuracy ?? 10,
        search_radius: Math.min(100, Math.max(30, (gpsAccuracy ?? 10) * 3)),
        interpolation_distance: 5,
        turn_penalty_factor: 200,
      },
    }),
    signal,
  });
  const payload = (await response.json()) as ValhallaResponse;
  if (!response.ok) throw new Error(payload.error ?? `Map matching failed (${response.status}).`);
  const matchedRoute = joinedRoute(payload);
  const routeElevations =
    evidence.altitudeRecords > 1 ? await requestElevations(matchedRoute, fetcher, signal) : [];
  const proposal = createGpsMatchProposal(
    activity,
    matchingEvidence,
    submittedPoints,
    matchedRoute,
    routeElevations,
  );
  return {
    ...proposal,
    recordedStart: evidence.sourcePoints[0],
    correctedStart: submittedPoints[0],
  };
}
