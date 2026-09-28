import { describe, expect, it } from 'vitest';
import { formatZonedInput, parseZonedInput, resolveTimeZone } from '../fit/repair/zonedDateTime';
import {
  countryForTimeZone,
  isUnavailableCountry,
  isUnavailableTimeZone,
  timeZonesForCountry,
} from '../fit/repair/countryTimeZones';

describe('city and time-zone correction', () => {
  it('resolves a city or IANA zone and converts its clock time to UTC', () => {
    expect(resolveTimeZone('Lima')).toBe('America/Lima');
    expect(resolveTimeZone('Europe/Kyiv')).toBe('Europe/Kyiv');
    expect(resolveTimeZone('Europe/Kiev')).toBe('Europe/Kyiv');
    expect(resolveTimeZone('Kyiv')).toBe('Europe/Kyiv');
    expect(timeZonesForCountry('UA')[0]).toBe('Europe/Kyiv');
    expect(timeZonesForCountry('UA')).not.toContain('Europe/Kiev');
    expect(timeZonesForCountry('PE')).toEqual(['America/Lima']);
    expect(countryForTimeZone('Europe/Kiev')).toBe('UA');
    expect(isUnavailableCountry('RU')).toBe(true);
    expect(timeZonesForCountry('RU').every(isUnavailableTimeZone)).toBe(true);
    expect(isUnavailableTimeZone('Europe/Simferopol')).toBe(true);
    expect(isUnavailableTimeZone('Europe/Kyiv')).toBe(false);
    expect(parseZonedInput('2024-01-01T09:30:00', 'America/Lima')).toBe('2024-01-01T14:30:00.000Z');
    expect(formatZonedInput('2024-01-01T14:30:00.000Z', 'America/Lima')).toBe(
      '2024-01-01T09:30:00',
    );
  });

  it('uses the selected zone’s daylight-saving rules and rejects skipped local times', () => {
    expect(parseZonedInput('2024-07-01T09:30:00', 'Europe/Kyiv')).toBe('2024-07-01T06:30:00.000Z');
    expect(parseZonedInput('2024-03-31T03:30:00', 'Europe/Kyiv')).toBeUndefined();
    expect(parseZonedInput('2024-02-30T09:30:00', 'Europe/Kyiv')).toBeUndefined();
  });
});
