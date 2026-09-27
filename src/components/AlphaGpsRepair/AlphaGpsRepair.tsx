import {
  AlertTriangle,
  FlaskConical,
  LoaderCircle,
  MapPinned,
  PencilRuler,
  Send,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  analyzeGpsEvidence,
  distanceBetween,
  hasUsableGpsShape,
  hasUsableHeading,
} from '../../fit/gps/traceAnalysis';
import type { DistanceReference, GeoPoint, GpsMatchProposal } from '../../fit/gps/types';
import { requestGpsMatch, requestLoopCandidates } from '../../fit/gps/valhallaMapMatcher';
import { createManualRouteProposal } from '../../fit/gps/manualRoute';
import { createGpsTraceDistanceProposal } from '../../fit/gps/gpsTraceDistance';
import { estimateDistanceConsensus } from '../../fit/repair/distanceConsensus';
import { useLanguage } from '../../i18n/LanguageContext';
import type { ParsedFitFile } from '../../models/fit';
import type { RepairCandidate } from '../../models/repair';
import { MatchEvidencePanel } from './MatchEvidencePanel';
import { ManualRouteEditor } from './ManualRouteEditor';
import { RouteComparisonMap } from './RouteComparisonMap';
import { StartLocationEditor } from './StartLocationEditor';

interface Props {
  result: ParsedFitFile;
  onApply: (proposal: GpsMatchProposal) => void;
  active?: boolean;
  allowSuggestions?: boolean;
  preserveDistance: boolean;
  selectedDistanceCandidate?: RepairCandidate;
  onClose?: () => void;
}

type MatchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; proposal: GpsMatchProposal; alternatives: GpsMatchProposal[] }
  | { status: 'error'; message: string };

type RouteMode = 'automatic' | 'manual' | 'gps';
const EMPTY_ROUTE: GeoPoint[] = [];

function distanceReferenceFor(result: ParsedFitFile): DistanceReference | undefined {
  const consensus = estimateDistanceConsensus(result.normalized);
  return consensus
    ? {
        distanceM: consensus.distanceM,
        source: 'repair_consensus',
        estimateCount: consensus.estimateCount,
        recordProgresses: consensus.recordProgresses,
        recordPatches: consensus.recordPatches,
      }
    : undefined;
}

function referenceForCandidate(candidate?: RepairCandidate): DistanceReference | undefined {
  if (!candidate || !Number.isFinite(candidate.distanceM) || candidate.distanceM <= 0)
    return undefined;
  return {
    distanceM: candidate.distanceM,
    source: 'sensor_candidate',
    recordPatches: candidate.recordPatches,
    recordProgresses: candidate.recordPatches.map((patch) =>
      Math.max(0, Math.min(1, patch.distanceM / candidate.distanceM)),
    ),
  };
}

export function AlphaGpsRepair({
  result,
  onApply,
  active = true,
  allowSuggestions = false,
  preserveDistance,
  selectedDistanceCandidate,
  onClose,
}: Props) {
  const { t } = useLanguage();
  const evidence = useMemo(() => analyzeGpsEvidence(result.normalized), [result.normalized]);
  const needsGeneratedLoops = !hasUsableGpsShape(evidence) && !hasUsableHeading(result.normalized);
  const recordedStart = evidence.sourcePoints[0];
  const [selectedStart, setSelectedStart] = useState<GeoPoint | undefined>(recordedStart);
  const [routeMode, setRouteMode] = useState<RouteMode>('manual');
  const [manualWaypoints, setManualWaypoints] = useState<GeoPoint[]>([]);
  const [manualFinish, setManualFinish] = useState<GeoPoint>();
  const manualDistance = useMemo(
    () =>
      preserveDistance
        ? distanceReferenceFor(result)
        : referenceForCandidate(selectedDistanceCandidate),
    [preserveDistance, result, selectedDistanceCandidate],
  );
  const keepDistance = routeMode !== 'gps' && preserveDistance;
  const [state, setState] = useState<MatchState>({ status: 'idle' });
  const manualPath = useMemo(
    () =>
      selectedStart
        ? [selectedStart, ...manualWaypoints, ...(manualFinish ? [manualFinish] : [])]
        : EMPTY_ROUTE,
    [manualFinish, manualWaypoints, selectedStart],
  );
  const request = useRef<AbortController>();
  const resultPanel = useRef<HTMLDivElement>(null);
  const traceWasScaled =
    state.status === 'ready' && Math.abs(state.proposal.traceScaleFactor - 1) > 0.01;
  const usedHeadingGuide =
    state.status === 'ready' && state.proposal.reconstructionMethod === 'heading_dead_reckoning';
  const usedGeneratedLoop =
    state.status === 'ready' && state.proposal.reconstructionMethod === 'generated_loop';
  const usedManualRoute =
    state.status === 'ready' && state.proposal.reconstructionMethod === 'manual_route';
  const usedGpsDistance =
    state.status === 'ready' && state.proposal.reconstructionMethod === 'gps_trace_distance';
  const reviewKeys = {
    automatic: {
      title: 'alphaGps.reviewTitle',
      distance: 'alphaGps.routeDistance',
      warning: 'alphaGps.notOriginal',
      discard: 'alphaGps.discard',
      apply: 'alphaGps.apply',
    },
    manual: {
      title: 'alphaGps.manual.reviewTitle',
      distance: 'alphaGps.manual.routeDistance',
      warning: 'alphaGps.manual.notOriginal',
      discard: 'alphaGps.manual.discard',
      apply: 'alphaGps.manual.apply',
    },
    gps: {
      title: 'alphaGps.gps.reviewTitle',
      distance: 'alphaGps.gps.distance',
      warning: 'alphaGps.gps.warning',
      discard: 'alphaGps.gps.discard',
      apply: 'alphaGps.gps.apply',
    },
  }[routeMode];
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
    if (usedManualRoute) {
      reviewBody = t('alphaGps.manual.reviewBody');
      traceLabel = t('alphaGps.noTrace');
    }
    if (usedGpsDistance) reviewBody = t('alphaGps.gps.reviewBody');
  }

  useEffect(() => {
    request.current?.abort();
    setState({ status: 'idle' });
    setSelectedStart(recordedStart);
    setRouteMode('manual');
    setManualWaypoints([]);
    setManualFinish(undefined);
    return () => request.current?.abort();
  }, [recordedStart, result]);

  useEffect(() => {
    if (!active || state.status !== 'ready') return undefined;
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
  }, [active, state.status]);

  const changeStart = (point: GeoPoint) => {
    request.current?.abort();
    if (selectedStart && manualFinish && distanceBetween(selectedStart, manualFinish) < 10) {
      setManualFinish(point);
    }
    setSelectedStart(point);
    setState({ status: 'idle' });
  };

  const changeWaypoints = (next: GeoPoint[]) => {
    request.current?.abort();
    setManualWaypoints(next);
    setState({ status: 'idle' });
  };

  const changeFinish = (point?: GeoPoint) => {
    request.current?.abort();
    setManualFinish(point);
    setState({ status: 'idle' });
  };

  const openManualEditor = () => {
    if (routeMode === 'manual') return;
    request.current?.abort();
    if (state.status === 'ready' && state.proposal.routeAnchors) {
      const anchors = state.proposal.routeAnchors;
      setManualWaypoints(anchors.slice(1, -1));
      setManualFinish(anchors.at(-1));
    }
    setRouteMode('manual');
    setState({ status: 'idle' });
  };

  const openAutomaticMode = () => {
    if (routeMode === 'automatic') return;
    request.current?.abort();
    setRouteMode('automatic');
    setState({ status: 'idle' });
  };

  const openGpsDistance = () => {
    request.current?.abort();
    setRouteMode('gps');
    try {
      const proposal = createGpsTraceDistanceProposal(result.normalized, evidence);
      setState({ status: 'ready', proposal, alternatives: [] });
    } catch (cause) {
      setState({
        status: 'error',
        message: cause instanceof Error ? cause.message : t('alphaGps.error'),
      });
    }
  };

  const findRoute = async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setState({ status: 'loading' });
    try {
      const distanceReference = manualDistance;
      if (!preserveDistance && !distanceReference) {
        throw new Error(t('alphaGps.selectDistanceEstimate'));
      }
      if (needsGeneratedLoops) {
        if (!selectedStart || !distanceReference) {
          throw new Error(
            preserveDistance ? t('alphaGps.needsDistance') : t('alphaGps.selectDistanceEstimate'),
          );
        }
        const alternatives = await requestLoopCandidates(
          result.normalized,
          evidence,
          selectedStart,
          distanceReference,
          fetch,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setState({ status: 'ready', proposal: alternatives[0], alternatives });
      } else {
        const proposal = await requestGpsMatch(
          result.normalized,
          evidence,
          fetch,
          controller.signal,
          selectedStart,
          distanceReference,
        );
        if (controller.signal.aborted) return;
        setState({ status: 'ready', proposal, alternatives: [] });
      }
    } catch (cause) {
      if (controller.signal.aborted) return;
      setState({
        status: 'error',
        message: cause instanceof Error ? cause.message : t('alphaGps.error'),
      });
    }
  };

  const buildManualRoute = () => {
    if (
      !selectedStart ||
      (!manualDistance && !keepDistance) ||
      (!manualWaypoints.length && !manualFinish)
    )
      return;
    try {
      const proposal = createManualRouteProposal(
        result.normalized,
        evidence,
        selectedStart,
        manualWaypoints,
        manualDistance,
        manualFinish,
      );
      setState({ status: 'ready', proposal, alternatives: [] });
    } catch (cause) {
      setState({
        status: 'error',
        message: cause instanceof Error ? cause.message : t('alphaGps.error'),
      });
    }
  };

  const canMatch = selectedStart != null && evidence.sourcePoints.length >= 1;
  let requestPanel = null;
  if (routeMode === 'automatic' && state.status !== 'ready') {
    requestPanel = (
      <div className="alphaGpsRequest">
        <div>
          <strong>{t('alphaGps.externalTitle')}</strong>
          <p>{t(needsGeneratedLoops ? 'alphaGps.externalBodyLoop' : 'alphaGps.externalBody')}</p>
        </div>
        <button
          type="button"
          className="button alphaButton"
          disabled={
            !canMatch || (!preserveDistance && !manualDistance) || state.status === 'loading'
          }
          title={
            !preserveDistance && !manualDistance ? t('alphaGps.selectDistanceEstimate') : undefined
          }
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
    );
  }
  return (
    <section className="alphaGps standardMap" aria-labelledby="alpha-gps-title">
      <header className="alphaGpsHeading">
        <div className="alphaGpsIcon">
          <MapPinned size={18} aria-hidden="true" />
        </div>
        <div>
          <h2 id="alpha-gps-title">{t('alphaGps.mapTitle')}</h2>
          <p>{t('alphaGps.mapBody')}</p>
        </div>
        {onClose && (
          <button type="button" className="textButton mapCloseButton" onClick={onClose}>
            <X size={15} aria-hidden="true" /> {t('alphaGps.closeMap')}
          </button>
        )}
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
      <div className="routeModeSwitch" role="group" aria-label={t('alphaGps.modeLabel')}>
        {allowSuggestions && (
          <button
            type="button"
            className={routeMode === 'automatic' ? 'selected' : ''}
            onClick={openAutomaticMode}
          >
            <FlaskConical size={15} aria-hidden="true" /> {t('alphaGps.modeAutomatic')}
            <span className="alphaBadge" aria-hidden="true">
              {t('alphaGps.badge')}
            </span>
          </button>
        )}
        <button
          type="button"
          className={routeMode === 'manual' ? 'selected' : ''}
          onClick={openManualEditor}
        >
          <PencilRuler size={15} /> {t('alphaGps.modeManual')}
        </button>
        <button
          type="button"
          className={routeMode === 'gps' ? 'selected' : ''}
          onClick={openGpsDistance}
        >
          <MapPinned size={15} /> {t('alphaGps.gps.mode')}
        </button>
      </div>
      {!preserveDistance && !manualDistance && routeMode === 'automatic' && (
        <p className="mapDistanceNote" role="status">
          {t('alphaGps.selectDistanceEstimate')}
        </p>
      )}
      {routeMode === 'automatic' && state.status !== 'ready' && recordedStart && selectedStart && (
        <StartLocationEditor
          recordedStart={recordedStart}
          selectedStart={selectedStart}
          onChange={changeStart}
        />
      )}
      {routeMode === 'manual' && selectedStart && (
        <ManualRouteEditor
          start={selectedStart}
          recordedStart={recordedStart}
          finish={manualFinish}
          waypoints={manualWaypoints}
          drawnRoute={manualPath}
          targetDistanceM={manualDistance?.distanceM}
          allowWithoutDistance={keepDistance}
          missingDistanceLabel={t('alphaGps.selectDistanceEstimate')}
          onAdd={(point) => changeWaypoints([...manualWaypoints, point])}
          onMove={(index, point) =>
            changeWaypoints(
              manualWaypoints.map((current, position) => (position === index ? point : current)),
            )
          }
          onRemove={(index) =>
            changeWaypoints(manualWaypoints.filter((_, position) => position !== index))
          }
          onReorder={(index, direction) => {
            if (index + direction < 0 || index + direction >= manualWaypoints.length) return;
            const next = [...manualWaypoints];
            [next[index], next[index + direction]] = [next[index + direction], next[index]];
            changeWaypoints(next);
          }}
          onClear={() => changeWaypoints([])}
          onStartChange={changeStart}
          onFinishChange={changeFinish}
          onBuild={buildManualRoute}
        />
      )}
      {state.status === 'ready' ? (
        <div ref={resultPanel} className="alphaGpsResult" tabIndex={-1}>
          <div className="routeReviewHeading">
            <div>
              <h3>{t(reviewKeys.title)}</h3>
              <p>{reviewBody}</p>
            </div>
            {routeMode === 'automatic' && (
              <button
                type="button"
                className="textButton"
                onClick={() => setState({ status: 'idle' })}
              >
                {t('alphaGps.changeStart')}
              </button>
            )}
          </div>
          {routeMode !== 'manual' && (
            <RouteComparisonMap
              shiftedTrace={usedGpsDistance ? EMPTY_ROUTE : state.proposal.originalTrace}
              matchedRoute={state.proposal.matchedRoute}
              shiftedLabel={usedGpsDistance ? '' : traceLabel}
              matchedLabel={t(usedGpsDistance ? 'alphaGps.gps.track' : 'alphaGps.matchedRoute')}
              startLabel={t(usedGpsDistance ? 'alphaGps.gps.start' : 'alphaGps.reconstructedStart')}
              endLabel={t(usedGpsDistance ? 'alphaGps.gps.end' : 'alphaGps.reconstructedEnd')}
            />
          )}
          {routeMode === 'automatic' && (
            <button type="button" className="textButton" onClick={openManualEditor}>
              <PencilRuler size={15} /> {t('alphaGps.manual.editRoute')}
            </button>
          )}
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
            {!usedGpsDistance && (
              <div>
                <span>{t('alphaGps.confidence')}</span>
                <strong className={`confidence ${state.proposal.confidence}`}>
                  {t(`confidence.${state.proposal.confidence}`)} ·{' '}
                  {state.proposal.evidenceScores.overall}/100
                </strong>
              </div>
            )}
            <div>
              <span>{t(reviewKeys.distance)}</span>
              <strong>{(state.proposal.routeDistanceM / 1000).toFixed(2)} km</strong>
            </div>
            <div>
              <span>
                {state.proposal.distanceReference?.source === 'repair_consensus' ||
                state.proposal.distanceReference?.source === 'sensor_candidate'
                  ? t('alphaGps.distanceDifferenceEstimate', {
                      distance: (state.proposal.distanceReference.distanceM / 1000).toFixed(2),
                    })
                  : t(usedGpsDistance ? 'alphaGps.gps.difference' : 'alphaGps.distanceDifference')}
              </span>
              <strong>
                {state.proposal.distanceDeltaPercent == null
                  ? '—'
                  : `${state.proposal.distanceDeltaPercent.toFixed(1)}%`}
              </strong>
            </div>
          </div>
          {state.proposal.distanceConflict && state.proposal.distanceReference && !keepDistance && (
            <div className="alphaGpsConflict" role="alert">
              <AlertTriangle size={17} aria-hidden="true" />
              <span>
                {t(
                  usedManualRoute
                    ? 'alphaGps.manual.distanceConflict'
                    : 'alphaGps.distanceConflict',
                  {
                    route: (state.proposal.routeDistanceM / 1000).toFixed(2),
                    reference: (state.proposal.distanceReference.distanceM / 1000).toFixed(2),
                    difference: state.proposal.distanceDeltaPercent?.toFixed(1) ?? '—',
                  },
                )}
              </span>
            </div>
          )}
          {keepDistance && (
            <p className="mapDistanceNote">{t('alphaGps.preserveDistanceReview')}</p>
          )}
          {!usedGpsDistance && (
            <MatchEvidencePanel scores={state.proposal.evidenceScores} manual={usedManualRoute} />
          )}
          <div className="alphaGpsWarning">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>{t(reviewKeys.warning)}</span>
          </div>
          <div className="alphaGpsActions">
            <button
              type="button"
              className="button secondary"
              onClick={() => setState({ status: 'idle' })}
            >
              {t(reviewKeys.discard)}
            </button>
            <button
              type="button"
              className="button primary"
              disabled={state.proposal.distanceConflict && !keepDistance}
              onClick={() => onApply({ ...state.proposal, preserveDistance: keepDistance })}
            >
              <MapPinned size={16} /> {t(reviewKeys.apply)}
            </button>
          </div>
        </div>
      ) : (
        requestPanel
      )}
      {routeMode === 'automatic' && !canMatch && (
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
        {routeMode === 'automatic' && <>{t('alphaGps.attribution')} </>}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          OpenStreetMap
        </a>
        {routeMode === 'automatic' && (
          <>
            {' · '}
            <a href="https://valhalla.github.io/valhalla/" target="_blank" rel="noreferrer">
              Valhalla
            </a>
          </>
        )}
      </footer>
    </section>
  );
}
