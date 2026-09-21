import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { ParsedFitFile } from '../../models/fit';
import { sportLabel, useLanguage } from '../../i18n/LanguageContext';

const duration = (seconds?: number) => {
  if (seconds == null) return '—';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const secs = Math.round(seconds % 60);
  return [hours, minutes, secs].map((part) => String(part).padStart(2, '0')).join(':');
};

export const pace = (seconds?: number, unit = '/km') => {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')} ${unit}`;
};

export function ActivitySummary({ result }: { result: ParsedFitFile }) {
  const { language, t } = useLanguage();
  const { normalized, integrity } = result;
  const session = normalized.session;
  const gpsRecords = normalized.records.filter((record) => record.position?.latitude != null && record.position?.longitude != null).length;
  const paceSeconds = session?.totalDistanceM && session.totalElapsedTimeS ? session.totalElapsedTimeS / (session.totalDistanceM / 1000) : undefined;
  const metrics = [
    [t('summary.sport'), sportLabel(normalized.sport ?? 'unknown', language)],
    [t('summary.started'), session?.startTime ? new Date(session.startTime).toLocaleString(language === 'uk' ? 'uk-UA' : 'en-US') : '—'],
    [t('summary.elapsed'), duration(session?.totalElapsedTimeS)],
    [t('summary.timer'), duration(session?.totalTimerTimeS)],
    [t('summary.distance'), session?.totalDistanceM == null ? '—' : `${(session.totalDistanceM / 1000).toFixed(3)} km`],
    [t('summary.pace'), pace(paceSeconds, language === 'uk' ? '/км' : '/km')],
    [t('summary.hr'), session?.avgHeartRate == null ? '—' : `${session.avgHeartRate} ${t('summary.avg')} · ${session.maxHeartRate ?? '—'} ${t('summary.max')}`],
    [t('summary.records'), normalized.records.length.toLocaleString()],
    [t('summary.gps'), gpsRecords.toLocaleString()],
    [t('summary.developer'), normalized.developerFields.definitions.length.toLocaleString()],
  ];
  return (
    <div className="summaryLayout">
      <section className="metrics" aria-label={t('summary.label')}>
        {metrics.map(([label, value]) => <div className="metric" key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </section>
      <section className={`integrity ${integrity.crcValid ? 'valid' : 'warning'}`}>
        {integrity.crcValid ? <CheckCircle2 aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}
        <div><strong>{integrity.crcValid ? t('summary.crcValid') : integrity.crcValid === false ? t('summary.crcMismatch') : t('summary.crcUnknown')}</strong><p>{integrity.complete ? t('summary.completeBody') : t('summary.reviewBody')}</p></div>
      </section>
      {!!integrity.warnings.length && <section className="noticeList"><h3>{t('summary.warnings')}</h3>{integrity.warnings.map((warning) => <p key={warning.code}>{warning.message}</p>)}</section>}
    </div>
  );
}
