import { Clock3 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ParsedFitFile } from '../../models/fit';
import { useLanguage } from '../../i18n/LanguageContext';

interface Props {
  result: ParsedFitFile;
  onApply: (correctedStartTime: string) => void;
}

function toLocalInputValue(timestamp: string): string {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return '';
  const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localTime.toISOString().slice(0, 16);
}

function toIsoTimestamp(localValue: string): string | undefined {
  const date = new Date(localValue);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

function describeOffset(offsetMs: number): string {
  const sign = offsetMs >= 0 ? '+' : '−';
  const totalMinutes = Math.round(Math.abs(offsetMs) / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  return `${sign}${days ? `${days}d ` : ''}${hours}h ${minutes}m`;
}

export function StartTimeRepair({ result, onApply }: Props) {
  const { language, t } = useLanguage();
  const originalStartTime = result.normalized.session?.startTime;
  const originalStartMs = originalStartTime ? Date.parse(originalStartTime) : NaN;
  const validOriginalStartTime = Number.isFinite(originalStartMs) ? originalStartTime : undefined;
  const [enabled, setEnabled] = useState(false);
  const [correctedLocalTime, setCorrectedLocalTime] = useState('');

  useEffect(() => {
    setEnabled(false);
    setCorrectedLocalTime(validOriginalStartTime ? toLocalInputValue(validOriginalStartTime) : '');
  }, [validOriginalStartTime, result.file.name]);

  const correctedStartTime = useMemo(
    () => toIsoTimestamp(correctedLocalTime),
    [correctedLocalTime],
  );
  const offsetMs = correctedStartTime ? Date.parse(correctedStartTime) - originalStartMs : 0;
  const canApply = Boolean(correctedStartTime && validOriginalStartTime && offsetMs !== 0);
  const applyCorrection = () => {
    if (correctedStartTime) onApply(correctedStartTime);
  };

  return (
    <section className="startTimeRepair" aria-labelledby="repair-options-title">
      <div className="repairOptionsHeading">
        <Clock3 size={18} aria-hidden="true" />
        <div>
          <h2 id="repair-options-title">{t('repair.options')}</h2>
          <p>{t('repair.optionsBody')}</p>
        </div>
      </div>
      <label className="repairOption" htmlFor="repair-start-time">
        <input
          id="repair-start-time"
          type="checkbox"
          checked={enabled}
          disabled={!validOriginalStartTime}
          onChange={(event) => setEnabled(event.target.checked)}
        />
        <span>
          <strong>{t('repair.startTimeWrong')}</strong>
          <small>
            {validOriginalStartTime
              ? t('repair.startTimeCurrent', {
                  time: new Date(validOriginalStartTime).toLocaleString(
                    language === 'uk' ? 'uk-UA' : 'en-US',
                  ),
                })
              : t('repair.startTimeMissing')}
          </small>
        </span>
      </label>
      {enabled && validOriginalStartTime && (
        <div className="startTimeEditor">
          <label htmlFor="corrected-start-time">{t('repair.startTimeCorrected')}</label>
          <input
            id="corrected-start-time"
            type="datetime-local"
            value={correctedLocalTime}
            onChange={(event) => setCorrectedLocalTime(event.target.value)}
          />
          <p>{t('repair.startTimeHelp')}</p>
          {canApply && (
            <p className="timeOffset">
              {t('repair.timeOffset', { offset: describeOffset(offsetMs) })}
            </p>
          )}
          <button
            type="button"
            className="button primary"
            disabled={!canApply}
            onClick={applyCorrection}
          >
            {t('repair.applyTime')}
          </button>
        </div>
      )}
    </section>
  );
}
