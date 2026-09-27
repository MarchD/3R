import { CheckCircle2, Clock3 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { formatZonedInput, parseZonedInput, resolveTimeZone } from '../../fit/repair/zonedDateTime';
import {
  countriesWithTimeZones,
  countryForTimeZone,
  isUnavailableCountry,
  isUnavailableTimeZone,
  timeZonesForCountry,
} from '../../fit/repair/countryTimeZones';
import type { ParsedFitFile } from '../../models/fit';
import { useLanguage } from '../../i18n/LanguageContext';
import { CustomDropdown } from './CustomDropdown';

interface Props {
  result: ParsedFitFile;
  onChange: (correctedStartTime: string | undefined) => void;
}

function describeOffset(offsetMs: number): string {
  const sign = offsetMs >= 0 ? '+' : '−';
  const totalMinutes = Math.round(Math.abs(offsetMs) / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  return `${sign}${days ? `${days}d ` : ''}${hours}h ${minutes}m`;
}

export function StartTimeRepair({ result, onChange }: Props) {
  const { language, t } = useLanguage();
  const originalStartTime = result.normalized.session?.startTime;
  const originalStartMs = originalStartTime ? Date.parse(originalStartTime) : NaN;
  const validOriginalStartTime = Number.isFinite(originalStartMs) ? originalStartTime : undefined;
  const [correctedLocalTime, setCorrectedLocalTime] = useState('');
  const browserTimeZone =
    resolveTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC') ?? 'UTC';
  const browserCountryCandidate = countryForTimeZone(browserTimeZone) ?? '';
  const browserCountry = isUnavailableCountry(browserCountryCandidate)
    ? ''
    : browserCountryCandidate;
  const defaultZones = timeZonesForCountry(browserCountry).filter(
    (zone) => resolveTimeZone(zone) != null && !isUnavailableTimeZone(zone),
  );
  let defaultTimeZone = '';
  if (browserCountry) {
    defaultTimeZone = defaultZones.includes(browserTimeZone)
      ? browserTimeZone
      : (defaultZones[0] ?? '');
  }
  const [country, setCountry] = useState(browserCountry);
  const [timeZoneInput, setTimeZoneInput] = useState(defaultTimeZone);
  const countries = useMemo(() => {
    const displayNames = new Intl.DisplayNames([language], { type: 'region' });
    return countriesWithTimeZones()
      .map((code) => ({ code, name: displayNames.of(code) ?? code }))
      .sort((first, second) => first.name.localeCompare(second.name, language));
  }, [language]);
  const zones = useMemo(
    () => timeZonesForCountry(country).filter((zone) => resolveTimeZone(zone) != null),
    [country],
  );
  const timeZone =
    zones.includes(timeZoneInput) && !isUnavailableTimeZone(timeZoneInput)
      ? timeZoneInput
      : undefined;

  useEffect(() => {
    setCountry(browserCountry);
    setTimeZoneInput(defaultTimeZone);
    setCorrectedLocalTime(
      validOriginalStartTime
        ? formatZonedInput(validOriginalStartTime, defaultTimeZone || browserTimeZone)
        : '',
    );
    onChange(undefined);
  }, [
    validOriginalStartTime,
    onChange,
    result.file.name,
    browserTimeZone,
    browserCountry,
    defaultTimeZone,
  ]);

  const correctedStartTime = useMemo(
    () => (timeZone ? parseZonedInput(correctedLocalTime, timeZone) : undefined),
    [correctedLocalTime, timeZone],
  );
  const offsetMs = correctedStartTime ? Date.parse(correctedStartTime) - originalStartMs : 0;
  const canApply = Boolean(correctedStartTime && validOriginalStartTime && offsetMs !== 0);
  return (
    <section className="startTimeRepair" aria-labelledby="repair-options-title">
      <div className="repairOptionsHeading">
        <Clock3 size={18} aria-hidden="true" />
        <div>
          <h2 id="repair-options-title">{t('repair.options')}</h2>
          <p>{t('repair.optionsBody')}</p>
        </div>
      </div>
      <div className="repairOption">
        <span>
          <strong>{t('repair.startTimeSection')}</strong>
          <small>
            {validOriginalStartTime
              ? t('repair.startTimeCurrent', {
                  time: new Date(validOriginalStartTime).toLocaleString(
                    language === 'uk' ? 'uk-UA' : 'en-US',
                    timeZone ? { timeZone } : undefined,
                  ),
                })
              : t('repair.startTimeMissing')}
          </small>
        </span>
        {canApply && (
          <span className="timeChangedNote" role="status">
            <CheckCircle2 size={15} aria-hidden="true" /> {t('repair.startTimeChanged')}
          </span>
        )}
      </div>
      <div className="startTimeEditor">
        <CustomDropdown
          label={t('repair.country')}
          value={country}
          placeholder={t('repair.chooseCountry')}
          searchPlaceholder={t('repair.searchOptions')}
          unavailableLabel={t('repair.unavailableOption')}
          emptyLabel={t('repair.noOptions')}
          disabled={!validOriginalStartTime}
          options={countries.map((item) => ({
            value: item.code,
            label: item.name,
            disabled: isUnavailableCountry(item.code),
          }))}
          onChange={(nextCountry) => {
            if (isUnavailableCountry(nextCountry)) return;
            const nextZones = timeZonesForCountry(nextCountry).filter(
              (zone) => resolveTimeZone(zone) != null && !isUnavailableTimeZone(zone),
            );
            const nextZone = nextZones.includes(timeZoneInput) ? timeZoneInput : nextZones[0];
            setCountry(nextCountry);
            setTimeZoneInput(nextZone ?? '');
            const nextTime = nextZone ? parseZonedInput(correctedLocalTime, nextZone) : undefined;
            onChange(nextTime && Date.parse(nextTime) !== originalStartMs ? nextTime : undefined);
          }}
        />
        <CustomDropdown
          label={t('repair.timeZone')}
          value={timeZoneInput}
          placeholder={t('repair.chooseTimeZone')}
          searchPlaceholder={t('repair.searchOptions')}
          unavailableLabel={t('repair.unavailableOption')}
          emptyLabel={t('repair.noOptions')}
          disabled={!country || !validOriginalStartTime}
          options={zones.map((zone) => ({
            value: zone,
            label: zone,
            disabled: isUnavailableTimeZone(zone),
          }))}
          onChange={(nextInput) => {
            if (isUnavailableTimeZone(nextInput)) return;
            setTimeZoneInput(nextInput);
            const nextTime = parseZonedInput(correctedLocalTime, nextInput);
            onChange(nextTime && Date.parse(nextTime) !== originalStartMs ? nextTime : undefined);
          }}
        />
        <p>{t('repair.timeZoneHelp')}</p>
        <label htmlFor="corrected-start-time">{t('repair.startTimeCorrected')}</label>
        <input
          id="corrected-start-time"
          type="datetime-local"
          step="1"
          disabled={!validOriginalStartTime}
          value={correctedLocalTime}
          onChange={(event) => {
            const nextLocalTime = event.target.value;
            const nextStartTime = timeZone ? parseZonedInput(nextLocalTime, timeZone) : undefined;
            setCorrectedLocalTime(nextLocalTime);
            onChange(
              nextStartTime && Date.parse(nextStartTime) !== originalStartMs
                ? nextStartTime
                : undefined,
            );
          }}
        />
        <p>{t('repair.startTimeHelp')}</p>
        {timeZone && correctedLocalTime && !correctedStartTime && (
          <p role="alert">{t('repair.timeInvalidInZone')}</p>
        )}
        {canApply && (
          <p className="timeOffset">
            {t('repair.timeOffset', { offset: describeOffset(offsetMs) })}
          </p>
        )}
      </div>
    </section>
  );
}
