import L from 'leaflet';
import { useEffect, useRef } from 'react';
import type { GeoPoint } from '../../fit/gps/types';

interface Props {
  shiftedTrace: GeoPoint[];
  matchedRoute: GeoPoint[];
  shiftedLabel: string;
  matchedLabel: string;
  startLabel: string;
  endLabel: string;
}

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

function coordinates(points: GeoPoint[]): L.LatLngExpression[] {
  return points.map((point) => [point.latitude, point.longitude]);
}

export function RouteComparisonMap({
  shiftedTrace,
  matchedRoute,
  shiftedLabel,
  matchedLabel,
  startLabel,
  endLabel,
}: Props) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current || matchedRoute.length < 2) return undefined;
    const instance = L.map(container.current, { zoomControl: true });
    L.tileLayer(TILE_URL, {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(instance);

    const matchedCoordinates = coordinates(matchedRoute);
    L.polyline(matchedCoordinates, {
      color: '#fff',
      weight: 8,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(instance);
    L.polyline(matchedCoordinates, {
      color: '#2457d6',
      weight: 5,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
    })
      .addTo(instance)
      .bindTooltip(matchedLabel);
    if (shiftedTrace.length > 1) {
      L.polyline(coordinates(shiftedTrace), {
        color: '#a86108',
        weight: 3,
        opacity: 0.85,
        dashArray: '5 7',
        lineCap: 'round',
      })
        .addTo(instance)
        .bindTooltip(shiftedLabel);
    }

    const start = matchedRoute[0];
    const end = matchedRoute.at(-1)!;
    L.circleMarker([start.latitude, start.longitude], {
      radius: 7,
      color: '#fff',
      weight: 3,
      fillColor: '#18815f',
      fillOpacity: 1,
    })
      .addTo(instance)
      .bindTooltip(startLabel);
    L.circleMarker([end.latitude, end.longitude], {
      radius: 7,
      color: '#fff',
      weight: 3,
      fillColor: '#c23b3b',
      fillOpacity: 1,
    })
      .addTo(instance)
      .bindTooltip(endLabel);

    const bounds = L.latLngBounds([...coordinates(shiftedTrace), ...matchedCoordinates]);
    instance.fitBounds(bounds, { padding: [28, 28], maxZoom: 16 });
    return () => {
      instance.remove();
    };
  }, [endLabel, matchedLabel, matchedRoute, shiftedLabel, shiftedTrace, startLabel]);

  return (
    <figure className="routeComparisonMap">
      <figcaption>
        <strong>{matchedLabel}</strong>
        <span className="shifted">{shiftedLabel}</span>
        <span className="matched">{matchedLabel}</span>
        <span className="start">{startLabel}</span>
        <span className="end">{endLabel}</span>
      </figcaption>
      <div ref={container} className="routeComparisonCanvas" role="img" aria-label={matchedLabel} />
    </figure>
  );
}
