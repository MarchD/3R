import L from 'leaflet';
import { useEffect, useRef } from 'react';
import { distanceBetween } from '../../fit/gps/traceAnalysis';
import type { GeoPoint } from '../../fit/gps/types';

interface Props {
  start: GeoPoint;
  finish?: GeoPoint;
  waypoints: GeoPoint[];
  drawnRoute: GeoPoint[];
  mapLabel: string;
  startLabel: string;
  finishLabel: string;
  pointLabel: (number: number) => string;
  removeLabel: (number: number) => string;
  onAdd: (point: GeoPoint) => void;
  onMove: (index: number, point: GeoPoint) => void;
  onRemove: (index: number) => void;
  onStartChange: (point: GeoPoint) => void;
  onFinishChange: (point: GeoPoint) => void;
}

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

function coordinates(points: GeoPoint[]): L.LatLngExpression[] {
  return points.map((point) => [point.latitude, point.longitude]);
}

function markerIcon(label: string, kind: 'start' | 'waypoint' | 'finish'): L.DivIcon {
  return L.divIcon({
    className: 'routeEditMarkerShell',
    html: `<span class="routeEditMarker ${kind}" aria-hidden="true">${label}</span>`,
    iconAnchor: [14, 14],
    iconSize: [28, 28],
  });
}

export function EditableRouteMap({
  start,
  finish,
  waypoints,
  drawnRoute,
  mapLabel,
  startLabel,
  finishLabel,
  pointLabel,
  removeLabel,
  onAdd,
  onMove,
  onRemove,
  onStartChange,
  onFinishChange,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const initialStart = useRef(start);
  const previousStart = useRef(start);
  const map = useRef<L.Map>();
  const routeLayers = useRef<L.LayerGroup>();
  const handlers = useRef({ onAdd, onMove, onRemove, onStartChange, onFinishChange });

  useEffect(() => {
    handlers.current = { onAdd, onMove, onRemove, onStartChange, onFinishChange };
  }, [onAdd, onMove, onRemove, onStartChange, onFinishChange]);

  useEffect(() => {
    if (!container.current) return undefined;
    const firstStart = initialStart.current;
    const instance = L.map(container.current, { zoomControl: true }).setView(
      [firstStart.latitude, firstStart.longitude],
      13,
    );
    L.tileLayer(TILE_URL, {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(instance);
    const layers = L.layerGroup().addTo(instance);
    instance.on('click', ({ latlng }: L.LeafletMouseEvent) => {
      handlers.current.onAdd({ latitude: latlng.lat, longitude: latlng.lng });
    });
    map.current = instance;
    routeLayers.current = layers;
    return () => {
      instance.remove();
      map.current = undefined;
      routeLayers.current = undefined;
    };
  }, []);

  useEffect(() => {
    const previous = previousStart.current;
    if (previous.latitude !== start.latitude || previous.longitude !== start.longitude) {
      map.current?.panTo([start.latitude, start.longitude]);
      previousStart.current = start;
    }
  }, [start]);

  useEffect(() => {
    const instance = map.current;
    const layers = routeLayers.current;
    if (!instance || !layers) return;
    layers.clearLayers();

    if (drawnRoute.length > 1) {
      L.polyline(coordinates(drawnRoute), {
        color: '#fff',
        weight: 8,
        opacity: 0.9,
        interactive: false,
      }).addTo(layers);
      L.polyline(coordinates(drawnRoute), {
        color: '#2457d6',
        weight: 5,
        opacity: 0.95,
        interactive: false,
      }).addTo(layers);
    }

    L.marker([start.latitude, start.longitude], {
      icon: markerIcon('S', 'start'),
      title: startLabel,
      alt: startLabel,
      draggable: true,
      autoPan: true,
    })
      .on('dragend', ({ target }: L.DragEndEvent) => {
        const point = (target as L.Marker).getLatLng();
        handlers.current.onStartChange({ latitude: point.lat, longitude: point.lng });
      })
      .addTo(layers)
      .bindTooltip(startLabel);

    waypoints.forEach((point, index) => {
      const label = pointLabel(index + 1);
      const marker = L.marker([point.latitude, point.longitude], {
        icon: markerIcon(String(index + 1), 'waypoint'),
        title: label,
        alt: label,
        draggable: true,
        autoPan: true,
      })
        .on('dragend', ({ target }: L.DragEndEvent) => {
          const moved = (target as L.Marker).getLatLng();
          handlers.current.onMove(index, { latitude: moved.lat, longitude: moved.lng });
        })
        .addTo(layers)
        .bindTooltip(label);
      marker.on('contextmenu', () => handlers.current.onRemove(index));
      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'routeEditRemove';
      removeButton.textContent = removeLabel(index + 1);
      removeButton.addEventListener('click', () => handlers.current.onRemove(index));
      marker.bindPopup(removeButton);
    });
    if (finish && distanceBetween(start, finish) > 10) {
      L.marker([finish.latitude, finish.longitude], {
        icon: markerIcon('F', 'finish'),
        title: finishLabel,
        alt: finishLabel,
        draggable: true,
        autoPan: true,
      })
        .on('dragend', ({ target }: L.DragEndEvent) => {
          const point = (target as L.Marker).getLatLng();
          handlers.current.onFinishChange({ latitude: point.lat, longitude: point.lng });
        })
        .addTo(layers)
        .bindTooltip(finishLabel);
    }
  }, [drawnRoute, finish, finishLabel, pointLabel, removeLabel, start, startLabel, waypoints]);

  return <div ref={container} className="editableRouteMap" role="group" aria-label={mapLabel} />;
}
