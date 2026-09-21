import { ArrowLeft, Copy, Download, ShieldAlert, Wrench } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { ParsedFitFile } from '../../models/fit';
import type { RepairCandidate, RepairState } from '../../models/repair';
import { copyJson } from '../../utils/clipboard';
import { downloadJson } from '../../utils/download';
import { pace } from '../ActivitySummary/ActivitySummary';
import { RepairCandidateCard } from '../RepairCandidateCard/RepairCandidateCard';

interface Props {
  result: ParsedFitFile;
  state: RepairState;
  onState: (state: RepairState) => void;
  onCalculate: () => void;
  onApply: (candidate: RepairCandidate) => void;
  onCopied: () => void;
}

export function RepairWizard({ result, state, onState, onCalculate, onApply, onCopied }: Props) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => { if (state.status === 'confirming') dialog.current?.focus(); }, [state.status]);
  if (state.status === 'not-requested') {
    return <div className="repairEntry"><div><strong>Distance looks wrong?</strong><span>Repair is a separate, manual workflow. Analysis above stays unchanged.</span></div><button className="button primary" onClick={() => onState({ status: 'confirming' })}><Wrench size={16} /> Repair activity</button></div>;
  }
  if (state.status === 'confirming') {
    return <div className="dialogBackdrop"><div className="dialog" role="dialog" aria-modal="true" aria-labelledby="repair-title" tabIndex={-1} ref={dialog}><ShieldAlert size={28} /><h2 id="repair-title">Create a derived activity?</h2><p>Repair creates a derived version of the activity. Your original FIT file will remain unchanged. Route coordinates cannot be reconstructed reliably without additional route evidence.</p><div className="dialogActions"><button className="button secondary" onClick={() => onState({ status: 'not-requested' })}>Cancel</button><button className="button primary" onClick={onCalculate}>Continue to repair</button></div></div></div>;
  }
  if (state.status === 'calculating') {
    return <div className="repairWorking" aria-live="polite"><span className="spinner" /> Calculating three derived distance candidates…</div>;
  }
  if (state.status === 'applied') {
    return <section className="appliedPanel"><div><strong>Derived JSON is ready</strong><p>The original activity and raw messages remain unchanged.</p></div><div className="downloadGrid"><button className="button secondary" onClick={() => downloadJson('activity.original.json', result.normalized)}><Download size={15} /> Original JSON</button><button className="button primary" onClick={() => downloadJson('activity.repaired.json', state.repairedActivity)}><Download size={15} /> Repaired JSON</button><button className="button secondary" onClick={() => downloadJson('activity.repair-patch.json', state.patch)}><Download size={15} /> Repair patch</button><button className="button secondary" onClick={() => copyJson(state.patch).then(onCopied)}><Copy size={15} /> Copy patch</button></div></section>;
  }
  const selected = state.candidates.find((candidate) => candidate.id === state.selectedCandidateId);
  if (state.status === 'previewing' && selected) {
    const before = result.normalized.session?.totalDistanceM;
    return <section className="diffPanel"><button className="textButton" onClick={() => onState({ status: 'ready', candidates: state.candidates, selectedCandidateId: state.selectedCandidateId })}><ArrowLeft size={15} /> Back</button><h2>Review derived changes</h2><p>Only distance and speed fields in the derived JSON will change.</p><div className="diffGrid"><div><span>Total distance</span><del>{before == null ? '—' : `${before.toFixed(2)} m`}</del><ins>{selected.distanceM.toFixed(2)} m</ins></div><div><span>Average pace</span><del>{pace(before && result.normalized.session?.totalElapsedTimeS ? result.normalized.session.totalElapsedTimeS / (before / 1000) : undefined)}</del><ins>{pace(selected.averagePaceSPerKm)}</ins></div><div><span>Changed records</span><del>0</del><ins>{selected.recordPatches.length.toLocaleString()}</ins></div></div><button className="button primary" onClick={() => onApply(selected)}>Apply to derived JSON</button></section>;
  }
  const candidates = state.candidates;
  return <section className="repairCandidates"><div className="repairHeading"><div><h2>Compare distance repairs</h2><p>No option is selected automatically. Inspect the evidence and choose one.</p></div><div className="originalValue"><span>Original Garmin value</span><strong>{result.normalized.session?.totalDistanceM == null ? '—' : `${(result.normalized.session.totalDistanceM / 1000).toFixed(3)} km`}</strong><small>Flagged value is not a repair candidate</small></div></div><div className="candidateGrid">{candidates.map((candidate) => <RepairCandidateCard key={candidate.id} candidate={candidate} originalDistanceM={result.normalized.session?.totalDistanceM} selected={state.selectedCandidateId === candidate.id} onSelect={() => onState({ status: 'ready', candidates, selectedCandidateId: candidate.id })} onCopied={onCopied} />)}</div><div className="repairFooter"><button className="button secondary" onClick={() => onState({ status: 'not-requested' })}>Cancel repair</button><button className="button primary" disabled={!selected} onClick={() => selected && onState({ status: 'previewing', candidates, selectedCandidateId: selected.id })}>Preview selected repair</button></div></section>;
}
