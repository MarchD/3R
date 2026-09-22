import type { GeoPoint } from './types';

const ENDPOINT = 'https://nominatim.openstreetmap.org/search';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export interface PlaceSearchResult extends GeoPoint {
  id: number;
  label: string;
}

export async function searchPlaces(
  query: string,
  language: string,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<PlaceSearchResult[]> {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 2) return [];

  const parameters = new URLSearchParams({
    q: trimmedQuery,
    format: 'jsonv2',
    limit: '5',
    addressdetails: '0',
    'accept-language': language,
  });
  const response = await fetcher(`${ENDPOINT}?${parameters}`, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) throw new Error(`Place search failed (${response.status}).`);

  const results = (await response.json()) as NominatimResult[];
  return results.flatMap((result) => {
    const latitude = Number(result.lat);
    const longitude = Number(result.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
    return [{ id: result.place_id, label: result.display_name, latitude, longitude }];
  });
}
