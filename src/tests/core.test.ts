import { describe, expect, it } from 'vitest';
import { detectAnomalies } from '../fit/analysis/detectAnomalies';
import { semicirclesToDegrees } from '../fit/normalization/normalizeFit';
import { applyRepairPatch } from '../fit/repair/applyRepairPatch';
import { clampDt, cleanedSpeedIntegrationCandidate, localMedianReplacement } from '../fit/repair/cleanedSpeedIntegration';
import { estimateSteps, interpretCadence } from '../fit/repair/estimateSteps';
import { isPlausibleStepLength, median, medianStepLengthCandidate } from '../fit/repair/medianStepLength';
import { weightedMean } from '../fit/repair/weightedStepLength';
import { safeStringify, toJsonCompatible } from '../utils/json';
import { activityFixture } from './fixtures';

describe('normalization and serialization', () => {
  it('converts Garmin semicircles to WGS84 degrees', () => {
    expect(semicirclesToDegrees(2 ** 30)).toBe(90);
    expect(semicirclesToDegrees(-(2 ** 30))).toBe(-90);
  });

  it('serializes dates, bigint, typed arrays and circular references', () => {
    const value: Record<string, unknown> = { date: new Date('2024-01-01T00:00:00Z'), big: 10n, bytes: new Uint8Array([1, 2]) };
    value.self = value;
    const serialized = safeStringify(value);
    expect(serialized).toContain('2024-01-01T00:00:00.000Z');
    expect(serialized).toContain('"10"');
    expect(serialized).toContain('Uint8Array');
    expect(toJsonCompatible(value)).toMatchObject({ self: '[Circular]' });
  });
});

describe('step calculations', () => {
  it('interprets one-leg running cadence and counts steps', () => {
    expect(interpretCadence('running', [88, 90, 92]).multiplier).toBe(2);
    expect(interpretCadence('cycling', [88, 90, 92]).multiplier).toBe(1);
    expect(estimateSteps(activityFixture()).totalSteps).toBe(12);
  });

  it('calculates median and weighted means and filters implausible lengths', () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(weightedMean([{ value: 1, weight: 1 }, { value: 2, weight: 3 }])).toBe(1.75);
    expect(isPlausibleStepLength(0.6)).toBe(true);
    expect(isPlausibleStepLength(1.61)).toBe(false);
  });
});

describe('speed repair and anomaly analysis', () => {
  it('filters speed outliers, uses local median replacement and clamps dt', () => {
    expect(localMedianReplacement([2, 20, 4], 1)).toBe(3);
    expect(clampDt(-1)).toBe(0);
    expect(clampDt(8)).toBe(3);
    const candidate = cleanedSpeedIntegrationCandidate(activityFixture());
    expect(candidate.calculation.replacedSamples).toBe(1);
    expect(candidate.distanceM).toBe(12);
  });

  it('reports invalid speed and suspicious session evidence', () => {
    const issues = detectAnomalies(activityFixture(), false);
    expect(issues.some((issue) => issue.type === 'invalid_crc')).toBe(true);
    expect(issues.some((issue) => issue.type === 'invalid_speed')).toBe(true);
  });
});

describe('repair patching', () => {
  it('creates a derived activity without mutating the original', () => {
    const original = activityFixture();
    const snapshot = JSON.parse(JSON.stringify(original));
    const candidate = medianStepLengthCandidate(original);
    const { patch, repairedActivity } = applyRepairPatch('test.fit', original, candidate, '2024-01-01T00:00:00Z');
    expect(original).toEqual(snapshot);
    expect(repairedActivity).not.toBe(original);
    expect(patch.recordPatches).toHaveLength(original.records.length);
    expect(repairedActivity.session?.totalDistanceM).toBe(candidate.distanceM);
  });
});
