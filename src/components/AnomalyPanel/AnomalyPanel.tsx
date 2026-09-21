import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import type { ActivityAnomaly } from '../../models/fit';

export function AnomalyPanel({ anomalies }: { anomalies: ActivityAnomaly[] }) {
  if (!anomalies.length) return <div className="emptyPanel"><Info /> No anomalies were detected by the current checks.</div>;
  return <div className="anomalyList">{anomalies.map((item) => {
    const Icon = item.severity === 'critical' ? AlertCircle : item.severity === 'warning' ? AlertTriangle : Info;
    return <article className={`anomaly ${item.severity}`} key={item.id}><Icon aria-hidden="true" /><div><div className="anomalyTitle"><strong>{item.message}</strong><span>{item.severity}</span></div><p>{item.recordIndexes.length ? `Records: ${item.recordIndexes.slice(0, 8).join(', ')}${item.recordIndexes.length > 8 ? ` and ${item.recordIndexes.length - 8} more` : ''}` : 'Activity-level issue'}</p><details><summary>Supporting evidence</summary><pre>{JSON.stringify(item.evidence, null, 2)}</pre></details></div></article>;
  })}</div>;
}
