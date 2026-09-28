import { ArrowDown, ArrowUp, MapPinPlus, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { traceDistance } from '../../fit/gps/traceAnalysis';
import type { GeoPoint } from '../../fit/gps/types';
import { useLanguage } from '../../i18n/LanguageContext';
import { EditableRouteMap } from './EditableRouteMap';
import { StartLocationEditor } from './StartLocationEditor';

interface Props {
  start: GeoPoint;
  recordedStart?: GeoPoint;
  finish?: GeoPoint;
  waypoints: GeoPoint[];
  drawnRoute: GeoPoint[];
  targetDistanceM?: number;
  allowWithoutDistance?: boolean;
  missingDistanceLabel?: string;
  onAdd: (point: GeoPoint) => void;
  onMove: (index: number, point: GeoPoint) => void;
  onRemove: (index: number) => void;
  onReorder: (index: number, direction: -1 | 1) => void;
  onClear: () => void;
  onStartChange: (point: GeoPoint) => void;
  onFinishChange: (point?: GeoPoint) => void;
  onBuild: () => void;
}

function isValidPoint(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  );
}

export function ManualRouteEditor({
  start,
  recordedStart,
  finish,
  waypoints,
  drawnRoute,
  targetDistanceM,
  allowWithoutDistance = false,
  missingDistanceLabel,
  onAdd,
  onMove,
  onRemove,
  onReorder,
  onClear,
  onStartChange,
  onFinishChange,
  onBuild,
}: Props) {
  const { t } = useLanguage();
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [invalidCoordinates, setInvalidCoordinates] = useState(false);
  const [placement, setPlacement] = useState<'waypoint' | 'finish'>('waypoint');
  const drawnDistanceM = drawnRoute.length > 1 ? traceDistance(drawnRoute) : undefined;
  let coordinateActionLabel = t('alphaGps.manual.addCoordinates');
  if (placement === 'finish') coordinateActionLabel = t('alphaGps.manual.setFinishMode');
  if (editingIndex != null) coordinateActionLabel = t('alphaGps.manual.saveCoordinates');

  const placePoint = (point: GeoPoint) => {
    if (placement === 'finish') {
      onFinishChange(point);
      setPlacement('waypoint');
    } else {
      onAdd(point);
    }
  };

  const submitCoordinates = (event: FormEvent) => {
    event.preventDefault();
    const point = { latitude: Number(latitude), longitude: Number(longitude) };
    if (!latitude.trim() || !longitude.trim() || !isValidPoint(point.latitude, point.longitude)) {
      setInvalidCoordinates(true);
      return;
    }
    if (editingIndex == null) placePoint(point);
    else onMove(editingIndex, point);
    setLatitude('');
    setLongitude('');
    setEditingIndex(null);
    setInvalidCoordinates(false);
  };

  const editPoint = (index: number) => {
    setEditingIndex(index);
    setLatitude(waypoints[index].latitude.toFixed(6));
    setLongitude(waypoints[index].longitude.toFixed(6));
    setInvalidCoordinates(false);
  };

  const cancelEditing = () => {
    setEditingIndex(null);
    setLatitude('');
    setLongitude('');
    setInvalidCoordinates(false);
  };

  const removePoint = (index: number) => {
    onRemove(index);
    if (editingIndex === index) cancelEditing();
    else if (editingIndex != null && editingIndex > index) setEditingIndex(editingIndex - 1);
  };

  return (
    <section className="manualRouteEditor" aria-labelledby="manual-route-title">
      <div className="manualRouteHeading">
        <div>
          <h3 id="manual-route-title">{t('alphaGps.manual.title')}</h3>
          <p>{t('alphaGps.manual.body')}</p>
        </div>
      </div>
      {recordedStart && (
        <StartLocationEditor
          recordedStart={recordedStart}
          selectedStart={start}
          onChange={onStartChange}
          compact
        />
      )}
      <div
        className="manualRouteToolbar"
        role="group"
        aria-label={t('alphaGps.manual.placementMode')}
      >
        <button
          type="button"
          className={placement === 'waypoint' ? 'selected' : ''}
          onClick={() => {
            cancelEditing();
            setPlacement('waypoint');
          }}
        >
          {t('alphaGps.manual.addPointMode')}
        </button>
        <button
          type="button"
          className={placement === 'finish' ? 'selected' : ''}
          onClick={() => {
            cancelEditing();
            setPlacement('finish');
          }}
        >
          {t('alphaGps.manual.setFinishMode')}
        </button>
        <button type="button" disabled={!waypoints.length} onClick={() => onFinishChange(start)}>
          {t('alphaGps.manual.finishAtStart')}
        </button>
        {finish && (
          <button type="button" onClick={() => onFinishChange(undefined)}>
            {t('alphaGps.manual.leaveOpen')}
          </button>
        )}
      </div>
      <EditableRouteMap
        start={start}
        finish={finish}
        waypoints={waypoints}
        drawnRoute={drawnRoute}
        mapLabel={t('alphaGps.manual.mapLabel')}
        startLabel={t('alphaGps.correctedStart')}
        finishLabel={t('alphaGps.manual.finish')}
        pointLabel={(number) => t('alphaGps.manual.point', { number })}
        removeLabel={(number) => t('alphaGps.manual.removePoint', { number })}
        onAdd={placePoint}
        onMove={onMove}
        onRemove={removePoint}
        onStartChange={onStartChange}
        onFinishChange={onFinishChange}
      />
      <div className="manualRouteControls">
        <p className="manualRouteHint">{t('alphaGps.manual.mapHint')}</p>
        <div className="manualRouteDistance" aria-live="polite">
          <span>
            {t('alphaGps.manual.target')}:{' '}
            <strong>
              {targetDistanceM == null ? '—' : `${(targetDistanceM / 1000).toFixed(2)} km`}
            </strong>
          </span>
          <span>
            {t('alphaGps.manual.drawnDistance')}:{' '}
            <strong>
              {drawnDistanceM == null ? '—' : `${(drawnDistanceM / 1000).toFixed(2)} km`}
            </strong>
          </span>
        </div>
        {waypoints.length > 0 && (
          <ol className="manualRoutePoints">
            {waypoints.map((point, index) => (
              // Rows have no local state; their displayed number follows route order.
              // eslint-disable-next-line react/no-array-index-key
              <li key={`${index}-${point.latitude}-${point.longitude}`}>
                <span className="manualRoutePointNumber">{index + 1}</span>
                <span className="manualRouteCoordinates">
                  {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}
                </span>
                <button
                  type="button"
                  onClick={() => editPoint(index)}
                  aria-label={t('alphaGps.manual.editPoint', { number: index + 1 })}
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => {
                    cancelEditing();
                    onReorder(index, -1);
                  }}
                  aria-label={t('alphaGps.manual.moveUp', { number: index + 1 })}
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  type="button"
                  disabled={index === waypoints.length - 1}
                  onClick={() => {
                    cancelEditing();
                    onReorder(index, 1);
                  }}
                  aria-label={t('alphaGps.manual.moveDown', { number: index + 1 })}
                >
                  <ArrowDown size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => removePoint(index)}
                  aria-label={t('alphaGps.manual.removePoint', { number: index + 1 })}
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ol>
        )}
        <form className="manualRouteCoordinatesForm" onSubmit={submitCoordinates}>
          <label htmlFor="manual-route-latitude">
            {t('records.latitude')}
            <input
              id="manual-route-latitude"
              value={latitude}
              onChange={(event) => setLatitude(event.target.value)}
              inputMode="decimal"
              placeholder="50.450000"
            />
          </label>
          <label htmlFor="manual-route-longitude">
            {t('records.longitude')}
            <input
              id="manual-route-longitude"
              value={longitude}
              onChange={(event) => setLongitude(event.target.value)}
              inputMode="decimal"
              placeholder="30.520000"
            />
          </label>
          <button type="submit" className="button secondary">
            <MapPinPlus size={16} /> {coordinateActionLabel}
          </button>
          {editingIndex != null && (
            <button type="button" className="textButton" onClick={cancelEditing}>
              {t('alphaGps.manual.cancelEdit')}
            </button>
          )}
        </form>
        {invalidCoordinates && (
          <p className="fieldError" role="alert">
            {t('alphaGps.manual.invalidCoordinates')}
          </p>
        )}
        <div className="manualRouteActions">
          <button
            type="button"
            className="textButton"
            onClick={() => {
              cancelEditing();
              onClear();
            }}
            disabled={!waypoints.length}
          >
            <RotateCcw size={15} /> {t('alphaGps.manual.clear')}
          </button>
          <span>{t('alphaGps.manual.pointCount', { count: waypoints.length })}</span>
          <button
            type="button"
            className="button primary"
            disabled={
              (!waypoints.length && !finish) || (targetDistanceM == null && !allowWithoutDistance)
            }
            onClick={onBuild}
          >
            {t('alphaGps.manual.build')}
          </button>
        </div>
        {targetDistanceM == null && !allowWithoutDistance && (
          <p className="fieldError">{missingDistanceLabel ?? t('alphaGps.manual.needsDistance')}</p>
        )}
        <p className="manualRoutePrivacy">{t('alphaGps.manual.externalBody')}</p>
      </div>
    </section>
  );
}
