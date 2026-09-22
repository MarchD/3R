import type { MatchEvidenceMetric, MatchEvidenceScores } from '../../fit/gps/types';
import { useLanguage } from '../../i18n/LanguageContext';

interface Props {
  scores: MatchEvidenceScores;
}

type MetricName = 'distance' | 'heading' | 'proximity' | 'altitude';

function metricValue(name: MetricName, metric: MatchEvidenceMetric): string {
  if (name === 'heading') return `${metric.value.toFixed(0)}°`;
  if (name === 'proximity') return `${metric.value.toFixed(1)} m`;
  return `${metric.value.toFixed(1)}%`;
}

export function MatchEvidencePanel({ scores }: Props) {
  const { t } = useLanguage();
  const metrics: { name: MetricName; metric?: MatchEvidenceMetric }[] = [
    { name: 'distance', metric: scores.distance },
    { name: 'heading', metric: scores.heading },
    { name: 'proximity', metric: scores.proximity },
    { name: 'altitude', metric: scores.altitude },
  ];
  return (
    <section className="matchEvidencePanel" aria-labelledby="match-evidence-title">
      <div className="matchEvidenceHeading">
        <div>
          <h3 id="match-evidence-title">{t('alphaGps.evidenceTitle')}</h3>
          <p>{t('alphaGps.evidenceBody')}</p>
        </div>
        <strong>{scores.overall}/100</strong>
      </div>
      <div className="matchEvidenceRows">
        {metrics.map(({ name, metric }) => (
          <div className={`matchEvidenceRow ${metric ? '' : 'unavailable'}`} key={name}>
            <span>{t(`alphaGps.metric.${name}`)}</span>
            <div className="matchEvidenceTrack" aria-hidden="true">
              <i style={{ width: `${metric?.score ?? 0}%` }} />
            </div>
            <strong>{metric ? `${metric.score}/100` : t('alphaGps.unavailable')}</strong>
            <small>
              {metric ? metricValue(name, metric) : t(`alphaGps.metric.${name}Missing`)}
            </small>
          </div>
        ))}
      </div>
    </section>
  );
}
