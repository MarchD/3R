import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { ParsedFitFile } from '../../models/fit';

const duration = (seconds?: number) => {
  if (seconds == null) return '—';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const secs = Math.round(seconds % 60);
  return [hours, minutes, secs].map((part) => String(part).padStart(2, '0')).join(':');
};

export const pace = (seconds?: number) => {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')} /km`;
};

export function ActivitySummary({ result }: { result: ParsedFitFile }) {
  const { normalized, integrity } = result;
  const session = normalized.session;
  const gpsRecords = normalized.records.filter((record) => record.position?.latitude != null && record.position?.longitude != null).length;
  const paceSeconds = session?.totalDistanceM && session.totalElapsedTimeS ? session.totalElapsedTimeS / (session.totalDistanceM / 1000) : undefined;
  const metrics = [
    ['Sport', normalized.sport ?? 'Unknown'],
    ['Started', session?.startTime ? new Date(session.startTime).toLocaleString() : '—'],
    ['Elapsed', duration(session?.totalElapsedTimeS)],
    ['Timer', duration(session?.totalTimerTimeS)],
    ['Original distance', session?.totalDistanceM == null ? '—' : `${(session.totalDistanceM / 1000).toFixed(3)} km`],
    ['Average pace', pace(paceSeconds)],
    ['Heart rate', session?.avgHeartRate == null ? '—' : `${session.avgHeartRate} avg · ${session.maxHeartRate ?? '—'} max`],
    ['Records', normalized.records.length.toLocaleString()],
    ['GPS records', gpsRecords.toLocaleString()],
    ['Developer fields', normalized.developerFields.definitions.length.toLocaleString()],
  ];
  return (
    <div className="summaryLayout">
      <section className="metrics" aria-label="Activity summary">
        {metrics.map(([label, value]) => <div className="metric" key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </section>
      <section className={`integrity ${integrity.crcValid ? 'valid' : 'warning'}`}>
        {integrity.crcValid ? <CheckCircle2 aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}
        <div><strong>CRC {integrity.crcValid ? 'valid' : integrity.crcValid === false ? 'mismatch' : 'unknown'}</strong><p>{integrity.complete ? 'The FIT container decoded completely.' : 'Review warnings before using this activity.'}</p></div>
      </section>
      {!!integrity.warnings.length && <section className="noticeList"><h3>Parsing warnings</h3>{integrity.warnings.map((warning) => <p key={warning.code}>{warning.message}</p>)}</section>}
    </div>
  );
}
