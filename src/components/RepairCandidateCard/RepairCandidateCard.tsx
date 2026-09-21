import { ClipboardList } from 'lucide-react';
import type { RepairCandidate } from '../../models/repair';
import { copyJson } from '../../utils/clipboard';
import { pace } from '../ActivitySummary/ActivitySummary';

export function RepairCandidateCard({ candidate, selected, originalDistanceM, onSelect, onCopied }: { candidate: RepairCandidate; selected: boolean; originalDistanceM?: number; onSelect: () => void; onCopied: () => void }) {
  const difference = originalDistanceM == null ? undefined : candidate.distanceM - originalDistanceM;
  return (
    <article className={`candidate ${selected ? 'candidateSelected' : ''}`}>
      <label className="candidateChoice"><input type="radio" name="repair-candidate" checked={selected} onChange={onSelect} /><span><strong>{(candidate.distanceM / 1000).toFixed(3)} km</strong><small>{candidate.name}</small></span><em>{candidate.confidence} confidence</em></label>
      <dl><div><dt>Average pace</dt><dd>{pace(candidate.averagePaceSPerKm)}</dd></div><div><dt>Difference</dt><dd>{difference == null ? '—' : `${difference > 0 ? '+' : ''}${(difference / 1000).toFixed(3)} km`}</dd></div><div><dt>Samples</dt><dd>{candidate.calculation.acceptedSamples.toLocaleString()} accepted · {candidate.calculation.rejectedSamples.toLocaleString()} rejected</dd></div></dl>
      <p>{candidate.description}</p>
      <details><summary>Inspect calculation</summary><pre>{JSON.stringify(candidate.calculation, null, 2)}</pre><h4>Assumptions</h4><ul>{candidate.assumptions.map((item) => <li key={item}>{item}</li>)}</ul>{candidate.warnings.map((item) => <p className="warningText" key={item}>{item}</p>)}</details>
      <button className="textButton" onClick={() => copyJson(candidate).then(onCopied)}><ClipboardList size={15} /> Copy calculation</button>
    </article>
  );
}
