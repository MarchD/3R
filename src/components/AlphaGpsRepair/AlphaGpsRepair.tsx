import { AlertTriangle, FlaskConical, LoaderCircle, MapPinned, Send } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  analyzeGpsEvidence,
  hasUsableGpsShape,
  hasUsableHeading,
} from '../../fit/gps/traceAnalysis';
import type { GeoPoint, GpsMatchProposal } from '../../fit/gps/types';
import { requestGpsMatch, requestLoopCandidates } from '../../fit/gps/valhallaMapMatcher';
import { estimateDistanceConsensus } from '../../fit/repair/distanceConsensus';
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
  | { status: 'ready'; proposal: GpsMatchProposal; alternatives: GpsMatchProposal[] }
  | { status: 'error'; message: string };

export function AlphaGpsRepair({ result, onApply }: Props) {
  const { t } = useLanguage();
  const evidence = useMemo(() => analyzeGpsEvidence(result.normalized), [result.normalized]);
  const needsGeneratedLoops = !hasUsableGpsShape(evidence) && !hasUsableHeading(result.normalized);
  const recordedStart = evidence.sourcePoints[0];
  const [selectedStart, setSelectedStart] = useState<GeoPoint | undefined>(recordedStart);
  const [state, setState] = useState<MatchState>({ status: 'idle' });
  const request = useRef<AbortController>();
  const resultPanel = useRef<HTMLDivElement>(null);
  const traceWasScaled =
    state.status === 'ready' && Math.abs(state.proposal.traceScaleFactor - 1) > 0.01;
  const usedHeadingGuide =
    state.status === 'ready' && state.proposal.reconstructionMethod === 'heading_dead_reckoning';
  const usedGeneratedLoop =
    state.status === 'ready' && state.proposal.reconstructionMethod === 'generated_loop';
  let reviewBody = '';
  let traceLabel = t('alphaGps.shiftedTrace');
  if (state.status === 'ready') {
    const location = {
      latitude: state.proposal.correctedStart.latitude.toFixed(6),
      longitude: state.proposal.correctedStart.longitude.toFixed(6),
    };
    reviewBody = t('alphaGps.reviewBody', location);
    if (traceWasScaled && state.proposal.distanceReference) {
      reviewBody = t('alphaGps.reviewBodyScaled', {
        ...location,
        scale: state.proposal.traceScaleFactor.toFixed(2),
        distance: (state.proposal.distanceReference.distanceM / 1000).toFixed(2),
      });
      traceLabel = t('alphaGps.distanceAdjustedTrace');
    }
    if (usedHeadingGuide && state.proposal.distanceReference) {
      reviewBody = t('alphaGps.reviewBodyHeading', {
        ...location,
        distance: (state.proposal.distanceReference.distanceM / 1000).toFixed(2),
      });
      traceLabel = t('alphaGps.headingGuide');
    }
    if (usedGeneratedLoop && state.proposal.distanceReference) {
      reviewBody = t('alphaGps.reviewBodyLoop', {
        ...location,
        distance: (state.proposal.distanceReference.distanceM / 1000).toFixed(2),
      });
      traceLabel = t('alphaGps.noTrace');
    }
  }

  useEffect(() => {
    request.current?.abort();
    setState({ status: 'idle' });
    setSelectedStart(recordedStart);
    return () => request.current?.abort();
  }, [recordedStart, result.file.name]);

  useEffect(() => {
    if (state.status !== 'ready') return undefined;
    const animationFrame = window.requestAnimationFrame(() => {
      resultPanel.current?.focus({ preventScroll: true });
      const reducedMotion =
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      resultPanel.current?.scrollIntoView?.({
        behavior: reducedMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [state.status]);

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
      const distanceConsensus = estimateDistanceConsensus(result.normalized);
      const distanceReference = distanceConsensus
        ? {
            distanceM: distanceConsensus.distanceM,
            source: 'repair_consensus' as const,
            estimateCount: distanceConsensus.estimateCount,
            recordProgresses: distanceConsensus.recordProgresses,
            recordPatches: distanceConsensus.recordPatches,
          }
        : undefined;
      if (needsGeneratedLoops) {
        if (!selectedStart || !distanceReference) {
          throw new Error(t('alphaGps.needsDistance'));
        }
        const alternatives = await requestLoopCandidates(
          result.normalized,
          evidence,
          selectedStart,
          distanceReference,
          fetch,
          request.current.signal,
        );
        setState({ status: 'ready', proposal: alternatives[0], alternatives });
      } else {
        const proposal = await requestGpsMatch(
          result.normalized,
          evidence,
          fetch,
          request.current.signal,
          selectedStart,
          distanceReference,
        );
        setState({ status: 'ready', proposal, alternatives: [] });
      }
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      setState({
        status: 'error',
        message: cause instanceof Error ? cause.message : t('alphaGps.error'),
      });
    }
  };

  const canMatch = selectedStart != null && evidence.sourcePoints.length >= 1;
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
      {state.status !== 'ready' && recordedStart && selectedStart && (
        <StartLocationEditor
          recordedStart={recordedStart}
          selectedStart={selectedStart}
          onChange={changeStart}
        />
      )}
      {state.status === 'ready' ? (
        <div ref={resultPanel} className="alphaGpsResult" tabIndex={-1}>
          <div className="routeReviewHeading">
            <div>
              <h3>{t('alphaGps.reviewTitle')}</h3>
              <p>{reviewBody}</p>
            </div>
            <button
              type="button"
              className="textButton"
              onClick={() => setState({ status: 'idle' })}
            >
              {t('alphaGps.changeStart')}
            </button>
          </div>
          <RouteComparisonMap
            shiftedTrace={state.proposal.originalTrace}
            matchedRoute={state.proposal.matchedRoute}
            shiftedLabel={traceLabel}
            matchedLabel={t('alphaGps.matchedRoute')}
            startLabel={t('alphaGps.reconstructedStart')}
            endLabel={t('alphaGps.reconstructedEnd')}
          />
          {usedGeneratedLoop && state.alternatives.length > 1 && (
            <div className="routeAlternatives" aria-label={t('alphaGps.alternatives')}>
              <strong>{t('alphaGps.alternatives')}</strong>
              <div>
                {state.alternatives.map((alternative, index) => (
                  <button
                    key={alternative.candidateId}
                    type="button"
                    className={alternative === state.proposal ? 'selected' : ''}
                    onClick={() =>
                      setState({
                        status: 'ready',
                        proposal: alternative,
                        alternatives: state.alternatives,
                      })
                    }
                  >
                    {t('alphaGps.loopOption', {
                      number: index + 1,
                      distance: (alternative.routeDistanceM / 1000).toFixed(2),
                    })}
                  </button>
                ))}
              </div>
            </div>
          )}
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
              <span>
                {state.proposal.distanceReference?.source === 'repair_consensus'
                  ? t('alphaGps.distanceDifferenceEstimate', {
                      distance: (state.proposal.distanceReference.distanceM / 1000).toFixed(2),
                    })
                  : t('alphaGps.distanceDifference')}
              </span>
              <strong>
                {state.proposal.distanceDeltaPercent == null
                  ? '—'
                  : `${state.proposal.distanceDeltaPercent.toFixed(1)}%`}
              </strong>
            </div>
          </div>
          {state.proposal.distanceConflict && state.proposal.distanceReference && (
            <div className="alphaGpsConflict" role="alert">
              <AlertTriangle size={17} aria-hidden="true" />
              <span>
                {t('alphaGps.distanceConflict', {
                  route: (state.proposal.routeDistanceM / 1000).toFixed(2),
                  reference: (state.proposal.distanceReference.distanceM / 1000).toFixed(2),
                  difference: state.proposal.distanceDeltaPercent?.toFixed(1) ?? '—',
                })}
              </span>
            </div>
          )}
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
              disabled={state.proposal.distanceConflict}
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
            <p>{t(needsGeneratedLoops ? 'alphaGps.externalBodyLoop' : 'alphaGps.externalBody')}</p>
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
            {state.status === 'loading'
              ? t('alphaGps.matching')
              : t(needsGeneratedLoops ? 'alphaGps.findLoops' : 'alphaGps.find')}
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
