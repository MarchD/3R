import { AlertTriangle, ArrowLeft, CheckCircle2, Download, FileDown, LoaderCircle, ShieldAlert, Wrench } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { ParsedFitFile } from '../../models/fit';
import type { RepairCandidate, RepairState } from '../../models/repair';
import { downloadJson } from '../../utils/download';
import { pace } from '../ActivitySummary/ActivitySummary';
import { RepairCandidateCard } from '../RepairCandidateCard/RepairCandidateCard';
import type { FitExportReport } from '../../fit/encoder/fitEncoder';
import { validateRepairEligibility } from '../../fit/repair/validateRepairEligibility';
import { sportLabel, useLanguage } from '../../i18n/LanguageContext';

export type FitExportUiState =
  | { status: 'idle' }
  | { status: 'exporting' }
  | { status: 'success'; report: FitExportReport }
  | { status: 'error'; message: string };

interface Props {
  result: ParsedFitFile;
  state: RepairState;
  onState: (state: RepairState) => void;
  onCalculate: () => void;
  onApply: (candidate: RepairCandidate) => void;
  fitExportState: FitExportUiState;
  onExportFit: () => void;
  onCopied: () => void;
}

export function RepairWizard({ result, state, onState, onCalculate, onApply, fitExportState, onExportFit, onCopied }: Props) {
  const { language, t } = useLanguage();
  const dialog = useRef<HTMLDivElement>(null);
  const eligibility = validateRepairEligibility(result.normalized);
  const detectedSport = sportLabel(eligibility.detectedSport, language);
  const ineligibilityReason = eligibility.detectedSport !== 'running'
    ? t('repair.runningOnly', { sport: detectedSport })
    : !result.normalized.session ? t('repair.needsSession') : t('repair.needsRecords');
  useEffect(() => { if (state.status === 'confirming') dialog.current?.focus(); }, [state.status]);
  if (state.status === 'not-requested') {
    if (!eligibility.eligible) return <div className="repairEntry repairBlocked"><AlertTriangle aria-hidden="true" /><div><strong>{t('repair.unavailable')}</strong><span>{ineligibilityReason}</span></div><span className="eligibilityBadge">{t('repair.detected', { sport: detectedSport })}</span></div>;
    return <div className="repairEntry"><CheckCircle2 className="eligibilityIcon" aria-hidden="true" /><div><strong>{t('repair.runningValidated')}</strong><span>{t('repair.available')}</span></div><button className="button primary" onClick={() => onState({ status: 'confirming' })}><Wrench size={16} /> {t('repair.activity')}</button></div>;
  }
  if (state.status === 'confirming') {
    return <div className="dialogBackdrop"><div className="dialog" role="dialog" aria-modal="true" aria-labelledby="repair-title" tabIndex={-1} ref={dialog}><ShieldAlert size={28} /><h2 id="repair-title">{t('repair.dialogTitle')}</h2><p>{t('repair.dialogBody')}</p><div className="dialogActions"><button className="button secondary" onClick={() => onState({ status: 'not-requested' })}>{t('repair.cancel')}</button><button className="button primary" onClick={onCalculate}>{t('repair.continue')}</button></div></div></div>;
  }
  if (state.status === 'calculating') {
    return <div className="repairWorking" aria-live="polite"><span className="spinner" /> {t('repair.calculating')}</div>;
  }
  if (state.status === 'applied') {
    return <section className="appliedPanel"><div className="appliedHeading"><CheckCircle2 aria-hidden="true" /><div><strong>{t('repair.ready')}</strong><p>{t('repair.unchanged')}</p></div></div><div className="derivedOutputGroup"><span>{t('repair.jsonEvidence')}</span><div className="downloadGrid"><button className="button secondary" onClick={() => downloadJson('activity.original.json', result.normalized)}><Download size={15} /> {t('repair.originalJson')}</button><button className="button secondary" onClick={() => downloadJson('activity.repaired.json', state.repairedActivity)}><Download size={15} /> {t('repair.repairedJson')}</button></div></div><div className="fitExport"><div><span>{t('repair.device')}</span><strong>{t('repair.fit')}</strong><p>{t('repair.fitBody')}</p></div><button className="button primary" disabled={fitExportState.status === 'exporting'} onClick={onExportFit}>{fitExportState.status === 'exporting' ? <LoaderCircle className="spin" size={16} /> : <FileDown size={16} />} {fitExportState.status === 'exporting' ? t('repair.validating') : t('repair.createFit')}</button></div>{fitExportState.status === 'success' && <div className="fitExportStatus success" role="status"><CheckCircle2 size={16} /><span>{t('repair.validated', { records: fitExportState.report.recordCount.toLocaleString(), messages: fitExportState.report.messageCount.toLocaleString(), size: (fitExportState.report.outputBytes / 1024).toFixed(1) })}</span></div>}{fitExportState.status === 'error' && <div className="fitExportStatus error" role="alert"><AlertTriangle size={16} /><span>{fitExportState.message}</span></div>}<div className="compatibilityNote"><AlertTriangle size={15} /><span>{t('repair.compatibility')}</span></div></section>;
  }
  const selected = state.candidates.find((candidate) => candidate.id === state.selectedCandidateId);
  if (state.status === 'previewing' && selected) {
    const before = result.normalized.session?.totalDistanceM;
    const paceUnit = language === 'uk' ? '/км' : '/km';
    return <section className="diffPanel"><button className="textButton" onClick={() => onState({ status: 'ready', candidates: state.candidates, selectedCandidateId: state.selectedCandidateId })}><ArrowLeft size={15} /> {t('repair.back')}</button><h2>{t('repair.review')}</h2><p>{t('repair.reviewBody')}</p><div className="diffGrid"><div><span>{t('repair.totalDistance')}</span><del>{before == null ? '—' : `${before.toFixed(2)} m`}</del><ins>{selected.distanceM.toFixed(2)} m</ins></div><div><span>{t('repair.averagePace')}</span><del>{pace(before && result.normalized.session?.totalElapsedTimeS ? result.normalized.session.totalElapsedTimeS / (before / 1000) : undefined, paceUnit)}</del><ins>{pace(selected.averagePaceSPerKm, paceUnit)}</ins></div><div><span>{t('repair.changedRecords')}</span><del>0</del><ins>{selected.recordPatches.length.toLocaleString()}</ins></div></div><button className="button primary" onClick={() => onApply(selected)}>{t('repair.apply')}</button></section>;
  }
  const candidates = state.candidates;
  return <section className="repairCandidates"><div className="repairHeading"><div><h2>{t('repair.compare')}</h2><p>{t('repair.compareBody')}</p></div><div className="originalValue"><span>{t('repair.originalValue')}</span><strong>{result.normalized.session?.totalDistanceM == null ? '—' : `${(result.normalized.session.totalDistanceM / 1000).toFixed(3)} km`}</strong><small>{t('repair.notCandidate')}</small></div></div><div className="candidateGrid">{candidates.map((candidate) => <RepairCandidateCard key={candidate.id} candidate={candidate} originalDistanceM={result.normalized.session?.totalDistanceM} selected={state.selectedCandidateId === candidate.id} onSelect={() => onState({ status: 'ready', candidates, selectedCandidateId: candidate.id })} onCopied={onCopied} />)}</div><div className="repairFooter"><button className="button secondary" onClick={() => onState({ status: 'not-requested' })}>{t('repair.cancelRepair')}</button><button className="button primary" disabled={!selected} onClick={() => selected && onState({ status: 'previewing', candidates, selectedCandidateId: selected.id })}>{t('repair.preview')}</button></div></section>;
}
