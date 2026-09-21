import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import type { ActivityAnomaly } from '../../models/fit';
import { useLanguage } from '../../i18n/LanguageContext';

const ukMessages: Record<string, string> = {
  invalid_crc: 'Контрольна сума CRC контейнера FIT не збігається.', missing_timestamps: 'У деяких записах немає часової позначки.',
  invalid_time_deltas: 'Часові позначки деяких записів не рухаються вперед.', timestamp_jumps: 'Деякі проміжки між записами незвично довгі.',
  missing_coordinates: 'У деяких записах немає координат GPS. Це нормально у приміщенні або під час втрати сигналу.', gps_jumps: 'Координати містять великі стрибки між точками.',
  coordinate_speed: 'Швидкість, обчислена за координатами, перевищує правдоподібний поріг для бігу.', distance_decreases: 'Накопичена дистанція зменшується в деяких записах.',
  distance_jumps: 'Часова шкала дистанції містить неправдоподібні стрибки.', invalid_speed: 'Записана швидкість перевищує межу відновлення 6 м/с.',
  abnormal_step_length: 'Початкова довжина кроку виходить за правдоподібний діапазон 0,6–1,6 м.', developer_field_types: 'Деякі поля розробника містять значення, які не можна безпечно представити.',
  suspicious_activity_date: 'Дата активності виходить за очікуваний діапазон.', implausible_session_distance: 'Дистанція сесії передбачає неправдоподібно високу середню швидкість бігу.',
  session_distance_disagreement: 'Дистанція сесії не збігається з часовою шкалою записів.',
};

export function AnomalyPanel({ anomalies }: { anomalies: ActivityAnomaly[] }) {
  const { language, t } = useLanguage();
  if (!anomalies.length) return <div className="emptyPanel"><Info /> {t('issues.none')}</div>;
  return <div className="anomalyList">{anomalies.map((item) => {
    const Icon = item.severity === 'critical' ? AlertCircle : item.severity === 'warning' ? AlertTriangle : Info;
    return <article className={`anomaly ${item.severity}`} key={item.id}><Icon aria-hidden="true" /><div><div className="anomalyTitle"><strong>{language === 'uk' ? ukMessages[item.type] ?? item.message : item.message}</strong><span>{t(`severity.${item.severity}`)}</span></div><p>{item.recordIndexes.length ? t('issues.records', { records: `${item.recordIndexes.slice(0, 8).join(', ')}${item.recordIndexes.length > 8 ? t('issues.more', { count: item.recordIndexes.length - 8 }) : ''}` }) : t('issues.activity')}</p><details><summary>{t('issues.evidence')}</summary><pre>{JSON.stringify(item.evidence, null, 2)}</pre></details></div></article>;
  })}</div>;
}
