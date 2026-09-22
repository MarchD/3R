import { AlertTriangle, FlaskConical, LoaderCircle, MapPinned, Send } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { analyzeGpsEvidence } from '../../fit/gps/traceAnalysis';
import type { GeoPoint, GpsMatchProposal } from '../../fit/gps/types';
import { requestGpsMatch } from '../../fit/gps/valhallaMapMatcher';
import { useLanguage } from '../../i18n/LanguageContext';
import type { ParsedFitFile } from '../../models/fit';
import { MatchEvidencePanel } from './MatchEvidencePanel';
import { RouteComparisonMap } from './RouteComparisonMap';
import { StartLocationEditor } from './StartLocationEditor';

interface Props {
  result: ParsedFitFile;
  onApply: (proposal: GpsMatchProposal) => void;
}

type MatchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; proposal: GpsMatchProposal }
  | { status: 'error'; message: string };

export function AlphaGpsRepair({ result, onApply }: Props) {
  const { t } = useLanguage();
  const evidence = useMemo(() => analyzeGpsEvidence(result.normalized), [result.normalized]);
  const recordedStart = evidence.sourcePoints[0];
  const [selectedStart, setSelectedStart] = useState<GeoPoint | undefined>(recordedStart);
  const [state, setState] = useState<MatchState>({ status: 'idle' });
  const request = useRef<AbortController>();

  useEffect(() => {
    request.current?.abort();
    setState({ status: 'idle' });
    setSelectedStart(recordedStart);
    return () => request.current?.abort();
  }, [recordedStart, result.file.name]);

  const changeStart = (point: GeoPoint) => {
    request.current?.abort();
    setSelectedStart(point);
    setState({ status: 'idle' });
  };

  const findRoute = async () => {
    request.current?.abort();
    request.current = new AbortController();
    setState({ status: 'loading' });
    try {
      const proposal = await requestGpsMatch(
        result.normalized,
        evidence,
        fetch,
        request.current.signal,
        selectedStart,
      );
      setState({ status: 'ready', proposal });
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      setState({
        status: 'error',
        message: cause instanceof Error ? cause.message : t('alphaGps.error'),
      });
    }
  };

  const canMatch = evidence.cleanedPoints.length >= 2;
  return (
    <section className="alphaGps" aria-labelledby="alpha-gps-title">
      <header className="alphaGpsHeading">
        <div className="alphaGpsIcon">
          <FlaskConical size={18} aria-hidden="true" />
        </div>
        <div>
          <span className="alphaBadge">{t('alphaGps.badge')}</span>
          <h2 id="alpha-gps-title">{t('alphaGps.title')}</h2>
          <p>{t('alphaGps.body')}</p>
        </div>
      </header>
      <div className="alphaEvidence" aria-label={t('alphaGps.evidence')}>
        <div>
          <strong>{evidence.sourcePoints.length.toLocaleString()}</strong>
          <span>{t('alphaGps.positions')}</span>
        </div>
        <div>
          <strong>{evidence.headingRecords.toLocaleString()}</strong>
          <span>{t('alphaGps.heading')}</span>
        </div>
        <div>
          <strong>{evidence.altitudeRecords.toLocaleString()}</strong>
          <span>{t('alphaGps.altitude')}</span>
        </div>
        <div>
          <strong>{evidence.rejectedPoints.toLocaleString()}</strong>
          <span>{t('alphaGps.outliers')}</span>
        </div>
      </div>
      {recordedStart && selectedStart && (
        <StartLocationEditor
          recordedStart={recordedStart}
          selectedStart={selectedStart}
          onChange={changeStart}
        />
      )}
      {state.status === 'ready' ? (
        <div className="alphaGpsResult">
          <RouteComparisonMap
            shiftedTrace={state.proposal.originalTrace}
            matchedRoute={state.proposal.matchedRoute}
            shiftedLabel={t('alphaGps.shiftedTrace')}
            matchedLabel={t('alphaGps.matchedRoute')}
            startLabel={t('alphaGps.reconstructedStart')}
            endLabel={t('alphaGps.reconstructedEnd')}
          />
          <div className="alphaGpsVerdict">
            <div>
              <span>{t('alphaGps.confidence')}</span>
              <strong className={`confidence ${state.proposal.confidence}`}>
                {t(`confidence.${state.proposal.confidence}`)} ·{' '}
                {state.proposal.evidenceScores.overall}/100
              </strong>
            </div>
            <div>
              <span>{t('alphaGps.routeDistance')}</span>
              <strong>{(state.proposal.routeDistanceM / 1000).toFixed(2)} km</strong>
            </div>
            <div>
              <span>{t('alphaGps.distanceDifference')}</span>
              <strong>
                {state.proposal.distanceDeltaPercent == null
                  ? '—'
                  : `${state.proposal.distanceDeltaPercent.toFixed(1)}%`}
              </strong>
            </div>
          </div>
          <MatchEvidencePanel scores={state.proposal.evidenceScores} />
          <div className="alphaGpsWarning">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>{t('alphaGps.notOriginal')}</span>
          </div>
          <div className="alphaGpsActions">
            <button
              type="button"
              className="button secondary"
              onClick={() => setState({ status: 'idle' })}
            >
              {t('alphaGps.discard')}
            </button>
            <button
              type="button"
              className="button primary"
              onClick={() => onApply(state.proposal)}
            >
              <MapPinned size={16} /> {t('alphaGps.apply')}
            </button>
          </div>
        </div>
      ) : (
        <div className="alphaGpsRequest">
          <div>
            <strong>{t('alphaGps.externalTitle')}</strong>
            <p>{t('alphaGps.externalBody')}</p>
          </div>
          <button
            type="button"
            className="button alphaButton"
            disabled={!canMatch || state.status === 'loading'}
            onClick={findRoute}
          >
            {state.status === 'loading' ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <Send size={16} />
            )}
            {state.status === 'loading' ? t('alphaGps.matching') : t('alphaGps.find')}
          </button>
        </div>
      )}
      {!canMatch && (
        <p className="alphaGpsError" role="alert">
          {t('alphaGps.needsPositions')}
        </p>
      )}
      {state.status === 'error' && (
        <p className="alphaGpsError" role="alert">
          {state.message}
        </p>
      )}
      <footer>
        {t('alphaGps.attribution')}{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          OpenStreetMap
        </a>
        {' · '}
        <a href="https://valhalla.github.io/valhalla/" target="_blank" rel="noreferrer">
          Valhalla
        </a>
      </footer>
    </section>
  );
}
