import { ClipboardList } from 'lucide-react';
import type { RepairCandidate } from '../../models/repair';
import { copyJson } from '../../utils/clipboard';
import { pace } from '../ActivitySummary/ActivitySummary';
import { useLanguage } from '../../i18n/LanguageContext';

const ukCandidates: Record<string, { name: string; description: string }> = {
  'steps-median': {
    name: 'Кроки × медіанна довжина кроку',
    description:
      'Використовує стійку медіану правдоподібних початкових або спостережуваних значень довжини кроку.',
  },
  'steps-weighted': {
    name: 'Кроки × зважена середня довжина кроку',
    description:
      'Зважує правдоподібну довжину кроку за кількістю кроків і якістю сегмента, обмежуючи вплив пошкоджених сегментів.',
  },
  'speed-integration': {
    name: 'Інтегрування очищеної швидкості',
    description: 'Замінює недійсні швидкості локальною медіаною та інтегрує очищену часову шкалу.',
  },
};

const ukAssumptions: Record<string, string> = {
  'Plausible step length is between 0.6 and 1.6 metres.':
    'Правдоподібна довжина кроку становить від 0,6 до 1,6 метра.',
  'Samples require valid time, cadence, speed and distance deltas.':
    'Зразки повинні мати коректні значення часу, каденсу, швидкості та зміни дистанції.',
  'Speed is plausible from 0 to 6 m/s.': 'Правдоподібна швидкість становить від 0 до 6 м/с.',
  'Time deltas are clamped to 0–3 seconds.': 'Різницю часу обмежено діапазоном 0–3 секунди.',
  'Running cadence is stored as cycles per minute for one leg.':
    'Каденс бігу зберігається як кількість циклів за хвилину для однієї ноги.',
  'Cadence already appears to represent full steps per minute.':
    'Каденс уже, схоже, відображає повну кількість кроків за хвилину.',
};

interface Props {
  candidate: RepairCandidate;
  selected: boolean;
  originalDistanceM?: number;
  onSelect: () => void;
  onCopied: () => void;
}

export function RepairCandidateCard({
  candidate,
  selected,
  originalDistanceM,
  onSelect,
  onCopied,
}: Props) {
  const { language, t } = useLanguage();
  const difference =
    originalDistanceM == null ? undefined : candidate.distanceM - originalDistanceM;
  const localized = language === 'uk' ? ukCandidates[candidate.id] : undefined;
  return (
    <article className={`candidate ${selected ? 'candidateSelected' : ''}`}>
      <label className="candidateChoice" htmlFor={`repair-candidate-${candidate.id}`}>
        <input
          id={`repair-candidate-${candidate.id}`}
          type="radio"
          name="repair-candidate"
          checked={selected}
          onChange={onSelect}
        />
        <span>
          <strong>{(candidate.distanceM / 1000).toFixed(3)} km</strong>
          <small>{localized?.name ?? candidate.name}</small>
        </span>
        <em>{t('candidate.confidence', { level: t(`candidate.${candidate.confidence}`) })}</em>
      </label>
      <dl>
        <div>
          <dt>{t('repair.averagePace')}</dt>
          <dd>{pace(candidate.averagePaceSPerKm, language === 'uk' ? '/км' : '/km')}</dd>
        </div>
        <div>
          <dt>{t('candidate.difference')}</dt>
          <dd>
            {difference == null
              ? '—'
              : `${difference > 0 ? '+' : ''}${(difference / 1000).toFixed(3)} km`}
          </dd>
        </div>
        <div>
          <dt>{t('candidate.samples')}</dt>
          <dd>
            {t('candidate.sampleCounts', {
              accepted: candidate.calculation.acceptedSamples.toLocaleString(),
              rejected: candidate.calculation.rejectedSamples.toLocaleString(),
            })}
          </dd>
        </div>
      </dl>
      <p>{localized?.description ?? candidate.description}</p>
      <details>
        <summary>{t('candidate.inspect')}</summary>
        <pre>{JSON.stringify(candidate.calculation, null, 2)}</pre>
        <h4>{t('candidate.assumptions')}</h4>
        <ul>
          {candidate.assumptions.map((item) => (
            <li key={item}>{language === 'uk' ? (ukAssumptions[item] ?? item) : item}</li>
          ))}
        </ul>
        {candidate.warnings.map((item) => (
          <p className="warningText" key={item}>
            {item}
          </p>
        ))}
      </details>
      <button
        type="button"
        className="textButton"
        onClick={() => copyJson(candidate).then(onCopied)}
      >
        <ClipboardList size={15} /> {t('candidate.copy')}
      </button>
    </article>
  );
}
