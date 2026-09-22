import { LocateFixed, MapPin, Search } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { searchPlaces, type PlaceSearchResult } from '../../fit/gps/nominatimGeocoder';
import type { GeoPoint } from '../../fit/gps/types';
import { useLanguage } from '../../i18n/LanguageContext';
import { StartLocationMap } from './StartLocationMap';

interface Props {
  recordedStart: GeoPoint;
  selectedStart: GeoPoint;
  onChange: (point: GeoPoint) => void;
}

function coordinate(value: number): string {
  return value.toFixed(6);
}

function validPoint(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  );
}

export function StartLocationEditor({ recordedStart, selectedStart, onChange }: Props) {
  const { language, t } = useLanguage();
  const [query, setQuery] = useState('');
  const [latitude, setLatitude] = useState(coordinate(selectedStart.latitude));
  const [longitude, setLongitude] = useState(coordinate(selectedStart.longitude));
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [searchState, setSearchState] = useState<'idle' | 'loading' | 'error'>('idle');
  const searchRequest = useRef<AbortController>();

  useEffect(() => {
    setLatitude(coordinate(selectedStart.latitude));
    setLongitude(coordinate(selectedStart.longitude));
  }, [selectedStart.latitude, selectedStart.longitude]);

  useEffect(() => () => searchRequest.current?.abort(), []);

  const submitSearch = async (event: FormEvent) => {
    event.preventDefault();
    if (query.trim().length < 2) return;
    searchRequest.current?.abort();
    searchRequest.current = new AbortController();
    setSearchState('loading');
    try {
      const matches = await searchPlaces(query, language, searchRequest.current.signal);
      setResults(matches);
      setSearchState('idle');
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      setResults([]);
      setSearchState('error');
    }
  };

  const applyCoordinates = () => {
    const nextLatitude = Number(latitude);
    const nextLongitude = Number(longitude);
    if (validPoint(nextLatitude, nextLongitude)) {
      onChange({ latitude: nextLatitude, longitude: nextLongitude });
    }
  };

  const chooseResult = (result: PlaceSearchResult) => {
    onChange(result);
    setQuery(result.label);
    setResults([]);
  };

  return (
    <section className="startLocationEditor" aria-labelledby="start-location-title">
      <div className="startLocationHeading">
        <div>
          <span className="sectionEyebrow">{t('alphaGps.startStep')}</span>
          <h3 id="start-location-title">{t('alphaGps.startTitle')}</h3>
          <p>{t('alphaGps.startBody')}</p>
        </div>
        <button type="button" className="textButton" onClick={() => onChange(recordedStart)}>
          <LocateFixed size={14} /> {t('alphaGps.useRecorded')}
        </button>
      </div>

      <form className="startSearch" onSubmit={submitSearch}>
        <label htmlFor="start-place">{t('alphaGps.searchLabel')}</label>
        <div className="startSearchControl">
          <Search size={16} aria-hidden="true" />
          <input
            id="start-place"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('alphaGps.searchPlaceholder')}
          />
          <button type="submit" disabled={searchState === 'loading' || query.trim().length < 2}>
            {searchState === 'loading' ? t('alphaGps.searching') : t('alphaGps.search')}
          </button>
        </div>
        {searchState === 'error' && <p className="fieldError">{t('alphaGps.searchError')}</p>}
        {results.length > 0 && (
          <ul className="placeResults">
            {results.map((result) => (
              <li key={result.id}>
                <button type="button" onClick={() => chooseResult(result)}>
                  <MapPin size={15} aria-hidden="true" />
                  <span>{result.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>

      <div className="coordinateEditor">
        <label htmlFor="start-latitude">
          <span>{t('records.latitude')}</span>
          <input
            id="start-latitude"
            value={latitude}
            inputMode="decimal"
            onChange={(event) => setLatitude(event.target.value)}
          />
        </label>
        <label htmlFor="start-longitude">
          <span>{t('records.longitude')}</span>
          <input
            id="start-longitude"
            value={longitude}
            inputMode="decimal"
            onChange={(event) => setLongitude(event.target.value)}
          />
        </label>
        <button type="button" className="button secondary" onClick={applyCoordinates}>
          {t('alphaGps.setCoordinates')}
        </button>
      </div>

      <StartLocationMap
        recordedStart={recordedStart}
        selectedStart={selectedStart}
        recordedLabel={t('alphaGps.recordedStart')}
        selectedLabel={t('alphaGps.correctedStart')}
        onChange={onChange}
      />
      <div className="startMapLegend">
        <span className="recorded">{t('alphaGps.recordedStart')}</span>
        <span className="selected">{t('alphaGps.correctedStart')}</span>
        <em>{t('alphaGps.mapHint')}</em>
      </div>
    </section>
  );
}
