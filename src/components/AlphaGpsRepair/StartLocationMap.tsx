import L from 'leaflet';
import { useEffect, useRef } from 'react';
import type { GeoPoint } from '../../fit/gps/types';

interface Props {
  recordedStart: GeoPoint;
  selectedStart: GeoPoint;
  recordedLabel: string;
  selectedLabel: string;
  onChange: (point: GeoPoint) => void;
}

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

function markerIcon(className: string): L.DivIcon {
  return L.divIcon({
    className: 'startMapMarkerShell',
    html: `<span class="${className}" aria-hidden="true"></span>`,
    iconAnchor: [11, 11],
    iconSize: [22, 22],
  });
}

export function StartLocationMap({
  recordedStart,
  selectedStart,
  recordedLabel,
  selectedLabel,
  onChange,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map>();
  const recordedMarker = useRef<L.Marker>();
  const selectedMarker = useRef<L.Marker>();
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!container.current) return undefined;
    const instance = L.map(container.current, { zoomControl: true }).setView(
      [recordedStart.latitude, recordedStart.longitude],
      13,
    );
    L.tileLayer(TILE_URL, {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(instance);

    instance.on('click', ({ latlng }: L.LeafletMouseEvent) => {
      onChangeRef.current({ latitude: latlng.lat, longitude: latlng.lng });
    });
    map.current = instance;
    return () => {
      instance.remove();
      map.current = undefined;
      recordedMarker.current = undefined;
      selectedMarker.current = undefined;
    };
  }, [recordedStart.latitude, recordedStart.longitude]);

  useEffect(() => {
    if (!map.current) return;
    recordedMarker.current?.remove();
    recordedMarker.current = L.marker([recordedStart.latitude, recordedStart.longitude], {
      icon: markerIcon('startMapMarker recorded'),
      title: recordedLabel,
      alt: recordedLabel,
      interactive: false,
    })
      .addTo(map.current)
      .bindTooltip(recordedLabel);
  }, [recordedLabel, recordedStart.latitude, recordedStart.longitude]);

  useEffect(() => {
    if (!map.current) return;
    if (!selectedMarker.current) {
      selectedMarker.current = L.marker([selectedStart.latitude, selectedStart.longitude], {
        icon: markerIcon('startMapMarker selected'),
        title: selectedLabel,
        alt: selectedLabel,
        draggable: true,
        autoPan: true,
      })
        .addTo(map.current)
        .bindTooltip(selectedLabel);
      selectedMarker.current.on('dragend', ({ target }: L.DragEndEvent) => {
        const position = (target as L.Marker).getLatLng();
        onChangeRef.current({ latitude: position.lat, longitude: position.lng });
      });
    } else {
      selectedMarker.current.setLatLng([selectedStart.latitude, selectedStart.longitude]);
      selectedMarker.current.setTooltipContent(selectedLabel);
    }
    map.current.flyTo([selectedStart.latitude, selectedStart.longitude], 13, { duration: 0.7 });
  }, [selectedLabel, selectedStart.latitude, selectedStart.longitude]);

  return <div ref={container} className="startLocationMap" aria-label={selectedLabel} />;
}
