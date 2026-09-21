import { ClipboardList } from 'lucide-react';
import type { RepairCandidate } from '../../models/repair';
import { copyJson } from '../../utils/clipboard';
import { pace } from '../ActivitySummary/ActivitySummary';
import { useLanguage } from '../../i18n/LanguageContext';

const ukCandidates: Record<string, { name: string; description: string }> = {
  'steps-median': { name: 'Кроки × медіанна довжина кроку', description: 'Використовує стійку медіану правдоподібних початкових або спостережуваних значень довжини кроку.' },
  'steps-weighted': { name: 'Кроки × зважена середня довжина кроку', description: 'Зважує правдоподібну довжину кроку за кількістю кроків і якістю сегмента, обмежуючи вплив пошкоджених сегментів.' },
  'speed-integration': { name: 'Інтегрування очищеної швидкості', description: 'Замінює недійсні швидкості локальною медіаною та інтегрує очищену часову шкалу.' },
};

function ukAssumption(value: string) {
  if (value.includes('0.6 and 1.6')) return 'Правдоподібна довжина кроку становить від 0,6 до 1,6 метра.';
  if (value.includes('valid time, cadence')) return 'Зразки повинні мати коректні значення часу, каденсу, швидкості та зміни дистанції.';
  if (value.includes('0 to 6 m/s')) return 'Правдоподібна швидкість становить від 0 до 6 м/с.';
  if (value.includes('0–3 seconds')) return 'Різницю часу обмежено діапазоном 0–3 секунди.';
  if (value.includes('Cadence')) return value.replace('Cadence', 'Каденс').replace('steps per minute', 'кроків за хвилину');
  return value;
}

export function RepairCandidateCard({ candidate, selected, originalDistanceM, onSelect, onCopied }: { candidate: RepairCandidate; selected: boolean; originalDistanceM?: number; onSelect: () => void; onCopied: () => void }) {
  const { language, t } = useLanguage();
  const difference = originalDistanceM == null ? undefined : candidate.distanceM - originalDistanceM;
  const localized = language === 'uk' ? ukCandidates[candidate.id] : undefined;
  return (
    <article className={`candidate ${selected ? 'candidateSelected' : ''}`}>
      <label className="candidateChoice"><input type="radio" name="repair-candidate" checked={selected} onChange={onSelect} /><span><strong>{(candidate.distanceM / 1000).toFixed(3)} km</strong><small>{localized?.name ?? candidate.name}</small></span><em>{t('candidate.confidence', { level: t(`candidate.${candidate.confidence}`) })}</em></label>
      <dl><div><dt>{t('repair.averagePace')}</dt><dd>{pace(candidate.averagePaceSPerKm, language === 'uk' ? '/км' : '/km')}</dd></div><div><dt>{t('candidate.difference')}</dt><dd>{difference == null ? '—' : `${difference > 0 ? '+' : ''}${(difference / 1000).toFixed(3)} km`}</dd></div><div><dt>{t('candidate.samples')}</dt><dd>{t('candidate.sampleCounts', { accepted: candidate.calculation.acceptedSamples.toLocaleString(), rejected: candidate.calculation.rejectedSamples.toLocaleString() })}</dd></div></dl>
      <p>{localized?.description ?? candidate.description}</p>
      <details><summary>{t('candidate.inspect')}</summary><pre>{JSON.stringify(candidate.calculation, null, 2)}</pre><h4>{t('candidate.assumptions')}</h4><ul>{candidate.assumptions.map((item) => <li key={item}>{language === 'uk' ? ukAssumption(item) : item}</li>)}</ul>{candidate.warnings.map((item) => <p className="warningText" key={item}>{item}</p>)}</details>
      <button className="textButton" onClick={() => copyJson(candidate).then(onCopied)}><ClipboardList size={15} /> {t('candidate.copy')}</button>
    </article>
  );
}
