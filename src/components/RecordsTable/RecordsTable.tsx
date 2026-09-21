import { Columns3 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { List, type RowComponentProps } from 'react-window';
import type { NormalizedRecord } from '../../models/fit';
import { useLanguage } from '../../i18n/LanguageContext';

const columnDefinitions = {
  index: { label: 'Index', value: (r: NormalizedRecord) => r.index },
  timestamp: { label: 'Timestamp', value: (r: NormalizedRecord) => r.timestamp },
  latitude: { label: 'Latitude', value: (r: NormalizedRecord) => r.position?.latitude?.toFixed(6) },
  longitude: { label: 'Longitude', value: (r: NormalizedRecord) => r.position?.longitude?.toFixed(6) },
  distance: { label: 'Distance m', value: (r: NormalizedRecord) => r.distanceM?.toFixed(2) },
  speed: { label: 'Speed m/s', value: (r: NormalizedRecord) => (r.enhancedSpeedMps ?? r.speedMps)?.toFixed(3) },
  cadence: { label: 'Cadence', value: (r: NormalizedRecord) => r.runningCadenceSpm?.toFixed(0) },
  heartRate: { label: 'HR', value: (r: NormalizedRecord) => r.heartRate },
  altitude: { label: 'Altitude m', value: (r: NormalizedRecord) => (r.enhancedAltitudeM ?? r.altitudeM)?.toFixed(1) },
  heading: { label: 'Heading', value: (r: NormalizedRecord) => r.headingDeg?.toFixed(1) },
  developer: { label: 'Developer fields', value: (r: NormalizedRecord) => Object.keys(r.developerFields).length ? JSON.stringify(r.developerFields) : '—' },
};
type Column = keyof typeof columnDefinitions;
const defaults = Object.keys(columnDefinitions) as Column[];

function RecordRow({ index, style, records, columns }: RowComponentProps<{ records: NormalizedRecord[]; columns: Column[] }>) {
  return <div className="recordRow" style={{ ...style, gridTemplateColumns: `repeat(${columns.length}, minmax(120px, 1fr))` }}>{columns.map((column) => <span key={column}>{columnDefinitions[column].value(records[index]) ?? '—'}</span>)}</div>;
}

export function RecordsTable({ records }: { records: NormalizedRecord[] }) {
  const { t } = useLanguage();
  const [columns, setColumns] = useState<Column[]>(defaults);
  const rowProps = useMemo(() => ({ records, columns }), [records, columns]);
  return (
    <section className="recordsPanel">
      <details className="columnPicker"><summary><Columns3 size={16} /> {t('records.configure')}</summary><div>{defaults.map((column) => <label key={column}><input type="checkbox" checked={columns.includes(column)} onChange={() => setColumns((current) => current.includes(column) ? current.filter((item) => item !== column) : [...current, column])} /> {t(`records.${column}`)}</label>)}</div></details>
      <div className="recordTableScroll">
        <div className="recordHeader" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(120px, 1fr))` }}>{columns.map((column) => <strong key={column}>{t(`records.${column}`)}</strong>)}</div>
        <List className="recordList" rowComponent={RecordRow} rowCount={records.length} rowHeight={42} rowProps={rowProps} overscanCount={12} />
      </div>
    </section>
  );
}
