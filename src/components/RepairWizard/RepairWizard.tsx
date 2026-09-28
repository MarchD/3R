import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileDown,
  LoaderCircle,
  MapPinned,
} from 'lucide-react';
import type { ParsedFitFile } from '../../models/fit';
import type { RepairCandidate, RepairState } from '../../models/repair';
import { downloadJson } from '../../utils/download';
import { pace } from '../ActivitySummary/ActivitySummary';
import { RepairCandidateCard } from '../RepairCandidateCard/RepairCandidateCard';
import type { FitExportReport } from '../../fit/encoder/fitEncoder';
import { useLanguage } from '../../i18n/LanguageContext';

export type FitExportUiState =
  | { status: 'idle' }
  | { status: 'exporting' }
  | { status: 'success'; report: FitExportReport }
  | { status: 'error'; message: string };

interface Props {
  result: ParsedFitFile;
  state: RepairState;
  onState: (state: RepairState) => void;
  onApply: (candidate: RepairCandidate) => void;
  correctedStartTime?: string;
  fitExportState: FitExportUiState;
  onExportFit: () => void;
  onCopied: () => void;
  onBack: () => void;
  onKeepDistance: () => void;
}

export function RepairWizard({
  result,
  state,
  onState,
  onApply,
  correctedStartTime,
  fitExportState,
  onExportFit,
  onCopied,
  onBack,
  onKeepDistance,
}: Props) {
  const { language, t } = useLanguage();
  if (state.status === 'not-requested') return null;
  if (state.status === 'calculating') {
    return (
      <div className="repairWorking" aria-live="polite">
        <span className="spinner" /> {t('repair.calculating')}
      </div>
    );
  }
  if (state.status === 'applied') {
    return (
      <section className="appliedPanel">
        <button
          type="button"
          className="textButton"
          disabled={fitExportState.status === 'exporting'}
          onClick={onBack}
        >
          <ArrowLeft size={15} /> {t('repair.backToPrevious')}
        </button>
        <div className="appliedHeading">
          <CheckCircle2 aria-hidden="true" />
          <div>
            <strong>{t('repair.ready')}</strong>
            <p>{t('repair.unchanged')}</p>
          </div>
        </div>
        {state.patch.originalStartTime && state.patch.correctedStartTime && (
          <div className="timeRepairSummary">
            <strong>{t('repair.timeChanged')}</strong>
            <span>
              {t('repair.timeChange', {
                before: new Date(state.patch.originalStartTime).toLocaleString(
                  language === 'uk' ? 'uk-UA' : 'en-US',
                ),
                after: new Date(state.patch.correctedStartTime).toLocaleString(
                  language === 'uk' ? 'uk-UA' : 'en-US',
                ),
              })}
            </span>
          </div>
        )}
        {state.patch.positionPatches?.length ? (
          <div className="gpsRepairSummary">
            <MapPinned size={17} aria-hidden="true" />
            <span>
              {t(
                state.patch.algorithm === 'gps_manual_draw'
                  ? 'alphaGps.manual.applied'
                  : 'alphaGps.applied',
                {
                  records: state.patch.positionPatches.length.toLocaleString(),
                },
              )}
            </span>
          </div>
        ) : null}
        {state.patch.algorithm === 'gps_trace_distance' && (
          <div className="gpsRepairSummary">
            <MapPinned size={17} aria-hidden="true" />
            <span>{t('alphaGps.gps.applied')}</span>
          </div>
        )}
        <div className="derivedOutputGroup">
          <span>{t('repair.jsonEvidence')}</span>
          <div className="downloadGrid">
            <button
              type="button"
              className="button secondary"
              onClick={() => downloadJson('activity.original.json', result.normalized)}
            >
              <Download size={15} /> {t('repair.originalJson')}
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => downloadJson('activity.repaired.json', state.repairedActivity)}
            >
              <Download size={15} /> {t('repair.repairedJson')}
            </button>
          </div>
        </div>
        <div className="fitExport">
          <div>
            <span>{t('repair.device')}</span>
            <strong>{t('repair.fit')}</strong>
            <p>{t('repair.fitBody')}</p>
          </div>
          <button
            type="button"
            className="button primary"
            disabled={fitExportState.status === 'exporting'}
            onClick={onExportFit}
          >
            {fitExportState.status === 'exporting' ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <FileDown size={16} />
            )}{' '}
            {fitExportState.status === 'exporting' ? t('repair.validating') : t('repair.createFit')}
          </button>
        </div>
        {fitExportState.status === 'success' && (
          <div className="fitExportStatus success" role="status">
            <CheckCircle2 size={16} />
            <span>
              {t('repair.validated', {
                records: fitExportState.report.recordCount.toLocaleString(),
                messages: fitExportState.report.messageCount.toLocaleString(),
                size: (fitExportState.report.outputBytes / 1024).toFixed(1),
              })}
            </span>
          </div>
        )}
        {fitExportState.status === 'error' && (
          <div className="fitExportStatus error" role="alert">
            <AlertTriangle size={16} />
            <span>{fitExportState.message}</span>
          </div>
        )}
        <div className="compatibilityNote">
          <AlertTriangle size={15} />
          <span>{t('repair.compatibility')}</span>
        </div>
      </section>
    );
  }
  const selected = state.candidates.find((candidate) => candidate.id === state.selectedCandidateId);
  if (state.status === 'previewing' && selected) {
    const before = result.normalized.session?.totalDistanceM;
    const paceUnit = language === 'uk' ? '/км' : '/km';
    return (
      <section className="diffPanel">
        <button
          type="button"
          className="textButton"
          onClick={() =>
            onState({
              status: 'ready',
              candidates: state.candidates,
              selectedCandidateId: state.selectedCandidateId,
            })
          }
        >
          <ArrowLeft size={15} /> {t('repair.back')}
        </button>
        <h2>{t('repair.review')}</h2>
        <p>{t('repair.reviewBody')}</p>
        <div className="diffGrid">
          <div>
            <span>{t('repair.totalDistance')}</span>
            <del>{before == null ? '—' : `${before.toFixed(2)} m`}</del>
            <ins>{selected.distanceM.toFixed(2)} m</ins>
          </div>
          <div>
            <span>{t('repair.averagePace')}</span>
            <del>
              {pace(
                before && result.normalized.session?.totalElapsedTimeS
                  ? result.normalized.session.totalElapsedTimeS / (before / 1000)
                  : undefined,
                paceUnit,
              )}
            </del>
            <ins>{pace(selected.averagePaceSPerKm, paceUnit)}</ins>
          </div>
          <div>
            <span>{t('repair.changedRecords')}</span>
            <del>0</del>
            <ins>{selected.recordPatches.length.toLocaleString()}</ins>
          </div>
          {correctedStartTime && result.normalized.session?.startTime && (
            <div>
              <span>{t('repair.timeChanged')}</span>
              <del>
                {new Date(result.normalized.session.startTime).toLocaleString(
                  language === 'uk' ? 'uk-UA' : 'en-US',
                )}
              </del>
              <ins>
                {new Date(correctedStartTime).toLocaleString(language === 'uk' ? 'uk-UA' : 'en-US')}
              </ins>
            </div>
          )}
        </div>
        <button type="button" className="button primary" onClick={() => onApply(selected)}>
          {t('repair.apply')}
        </button>
      </section>
    );
  }
  const { candidates } = state;
  return (
    <section className="repairCandidates">
      <div className="repairHeading">
        <div>
          <h2>{t('repair.compare')}</h2>
          <p>{t('repair.compareBody')}</p>
        </div>
        <div className="originalValue">
          <span>{t('repair.originalValue')}</span>
          <strong>
            {result.normalized.session?.totalDistanceM == null
              ? '—'
              : `${(result.normalized.session.totalDistanceM / 1000).toFixed(3)} km`}
          </strong>
          <small>{t('repair.notCandidate')}</small>
        </div>
      </div>
      <div className="candidateGrid">
        {candidates.map((candidate) => (
          <RepairCandidateCard
            key={candidate.id}
            candidate={candidate}
            originalDistanceM={result.normalized.session?.totalDistanceM}
            selected={state.selectedCandidateId === candidate.id}
            onSelect={() =>
              onState({ status: 'ready', candidates, selectedCandidateId: candidate.id })
            }
            onCopied={onCopied}
          />
        ))}
      </div>
      <div className="repairFooter">
        <button type="button" className="button secondary" onClick={onKeepDistance}>
          {t('repair.cancelRepair')}
        </button>
        <button
          type="button"
          className="button primary"
          disabled={!selected}
          onClick={() =>
            selected &&
            onState({ status: 'previewing', candidates, selectedCandidateId: selected.id })
          }
        >
          {t('repair.preview')}
        </button>
      </div>
    </section>
  );
}
