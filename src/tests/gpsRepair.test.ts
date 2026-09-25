import { describe, expect, it, vi } from 'vitest';
import {
  analyzeGpsEvidence,
  createGpsMatchProposal,
  distanceBetween,
  hasUsableGpsShape,
  relocateGpsEvidence,
  traceDistance,
} from '../fit/gps/traceAnalysis';
import {
  decodePolyline,
  requestGpsMatch,
  requestLoopCandidates,
} from '../fit/gps/valhallaMapMatcher';
import { applyGpsRepair } from '../fit/repair/applyGpsRepair';
import { estimateDistanceConsensus } from '../fit/repair/distanceConsensus';
import { activityFixture } from './fixtures';

const MATCHED_SHAPE =
  'cfff_Bu~~ey@`AvAx@iBvByEx@cBkEsGiNsSmEuGaFmHaHgKoAiBeCyD_AwAYMWR]t@}V{_@qDuFyBgDeEqGf@gAn@uAlAkC';

describe('alpha GPS repair', () => {
  it('removes an impossible intermediate GPS spike while preserving endpoints', () => {
    const activity = activityFixture();
    activity.records[2].position = { latitude: 51, longitude: 31 };

    const evidence = analyzeGpsEvidence(activity);

    expect(evidence.sourcePoints).toHaveLength(5);
    expect(evidence.cleanedPoints).toHaveLength(4);
    expect(evidence.rejectedPoints).toBe(1);
    expect(evidence.cleanedPoints[0].recordIndex).toBe(0);
    expect(evidence.cleanedPoints.at(-1)?.recordIndex).toBe(4);
  });

  it('decodes Valhalla polyline6 geometry', () => {
    const route = decodePolyline(MATCHED_SHAPE);

    expect(route.length).toBeGreaterThan(10);
    expect(route[0].latitude).toBeCloseTo(50.45, 2);
    expect(route[0].longitude).toBeCloseTo(30.52, 2);
  });

  it('creates one reconstructed position for every FIT record', async () => {
    const activity = activityFixture();
    const evidence = analyzeGpsEvidence(activity);
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ trip: { legs: [{ shape: MATCHED_SHAPE }] } }),
    }) as unknown as typeof fetch;

    const proposal = await requestGpsMatch(activity, evidence, fetcher);
    const { patch, repairedActivity } = applyGpsRepair(
      'broken.fit',
      activity,
      proposal,
      undefined,
      '2024-01-03T00:00:00.000Z',
    );

    expect(fetcher).toHaveBeenCalledOnce();
    expect(proposal.positionPatches).toHaveLength(activity.records.length);
    expect(patch.algorithm).toBe('gps_map_match');
    expect(patch.positionPatches).toHaveLength(activity.records.length);
    expect(repairedActivity.records[0].position).toEqual({
      latitude: proposal.positionPatches[0].latitude,
      longitude: proposal.positionPatches[0].longitude,
    });
    expect(repairedActivity.repair.positionPatchedRecords).toBe(activity.records.length);
  });

  it('moves the entire surviving trace to a corrected start before matching', async () => {
    const activity = activityFixture();
    const evidence = analyzeGpsEvidence(activity);
    const correctedStart = { latitude: 50.4501, longitude: 30.5234 };
    const translated = relocateGpsEvidence(evidence, correctedStart);
    const originalSegmentDistance = distanceBetween(
      evidence.cleanedPoints[0],
      evidence.cleanedPoints[1],
    );

    expect(translated.cleanedPoints[0]).toMatchObject(correctedStart);
    expect(distanceBetween(translated.cleanedPoints[0], translated.cleanedPoints[1])).toBeCloseTo(
      originalSegmentDistance,
      2,
    );

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ trip: { legs: [{ shape: MATCHED_SHAPE }] } }),
    });
    await requestGpsMatch(
      activity,
      evidence,
      fetchMock as unknown as typeof fetch,
      undefined,
      correctedStart,
    );
    const request = JSON.parse(fetchMock.mock.calls[0][1]?.body as string) as {
      shape: { lat: number; lon: number; time?: number; type?: string }[];
    };

    expect(request.shape[0]).toMatchObject({
      lat: correctedStart.latitude,
      lon: correctedStart.longitude,
      time: 0,
      type: 'break',
    });
  });

  it('scales a 5 km GPS trace to the 12 km sensor estimate before map matching', () => {
    const activity = activityFixture();
    activity.records = [
      {
        ...activity.records[0],
        index: 0,
        timestamp: '2024-01-01T00:00:00.000Z',
        position: { latitude: 50, longitude: 30 },
      },
      {
        ...activity.records[1],
        index: 1,
        timestamp: '2024-01-01T01:00:00.000Z',
        position: { latitude: 50.045, longitude: 30 },
      },
    ];
    const evidence = analyzeGpsEvidence(activity);

    const relocated = relocateGpsEvidence(evidence, { latitude: 50.45, longitude: 30.52 }, 12_000);

    expect(evidence.traceDistanceM).toBeCloseTo(5_000, -2);
    expect(relocated.scaleFactor).toBeCloseTo(2.4, 1);
    expect(traceDistance(relocated.cleanedPoints)).toBeCloseTo(12_000, -2);
  });

  it('uses heading dead reckoning when the surviving GPS trace is severely collapsed', async () => {
    const activity = activityFixture();
    activity.records = activity.records.map((record, index) => ({
      ...record,
      timestamp: new Date(Date.UTC(2024, 0, 1, 0, index * 15)).toISOString(),
      position: { latitude: 50 + index * 0.00018, longitude: 30 },
      trackDeg: 0,
    }));
    const evidence = analyzeGpsEvidence(activity);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ trip: { legs: [{ shape: MATCHED_SHAPE }] } }),
    });

    const proposal = await requestGpsMatch(
      activity,
      evidence,
      fetchMock as unknown as typeof fetch,
      undefined,
      { latitude: 50.45, longitude: 30.52 },
      { distanceM: 12_670, source: 'repair_consensus', estimateCount: 3 },
    );
    const request = JSON.parse(fetchMock.mock.calls[0][1]?.body as string) as {
      shape: { lat: number; lon: number }[];
    };
    const submittedDistance = traceDistance(
      request.shape.map((point) => ({ latitude: point.lat, longitude: point.lon })),
    );

    expect(evidence.traceDistanceM).toBeLessThan(100);
    expect(submittedDistance).toBeCloseTo(12_670, -2);
    expect(proposal.reconstructionMethod).toBe('heading_dead_reckoning');
  });

  it('requests road loops from the corrected start and sensor distance when GPS is unusable', async () => {
    const activity = activityFixture();
    const evidence = analyzeGpsEvidence(activity);
    const start = { latitude: 50.45, longitude: 30.52 };
    expect(hasUsableGpsShape(evidence)).toBe(true);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ trip: { legs: [{ shape: MATCHED_SHAPE }] } }),
    });

    const candidates = await requestLoopCandidates(
      activity,
      evidence,
      start,
      { distanceM: 12_670, source: 'repair_consensus' },
      fetchMock as unknown as typeof fetch,
    );
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string) as {
      locations: { lat: number; lon: number }[];
    };

    expect(url).toMatch(/\/route$/);
    expect(body.locations).toHaveLength(4);
    expect(body.locations[0]).toEqual({ lat: start.latitude, lon: start.longitude, type: 'break' });
    expect(body.locations.at(-1)).toEqual(body.locations[0]);
    expect(
      distanceBetween(start, {
        latitude: body.locations[1].lat,
        longitude: body.locations[1].lon,
      }),
    ).toBeCloseTo(12_670 / 4, 0);
    expect(candidates.length).toBeGreaterThanOrEqual(4);
    expect(
      candidates.every((candidate) => candidate.reconstructionMethod === 'generated_loop'),
    ).toBe(true);
    expect(candidates.every((candidate) => candidate.confidence === 'low')).toBe(true);
    expect(candidates.every((candidate) => candidate.originalTrace.length === 0)).toBe(true);
  });

  it('assigns confidence from route and recorded distance agreement', () => {
    const activity = activityFixture();
    const evidence = analyzeGpsEvidence(activity);
    const route = [
      { latitude: 50, longitude: 30 },
      { latitude: 50.0045, longitude: 30 },
    ];

    const proposal = createGpsMatchProposal(activity, evidence, evidence.cleanedPoints, route);

    expect(proposal.routeDistanceM).toBeCloseTo(500, -1);
    expect(proposal.confidence).toBe('high');
  });

  it('combines heading, distance, and trace proximity without penalizing missing altitude', () => {
    const activity = activityFixture();
    activity.records = activity.records.map((record) => ({ ...record, trackDeg: 0 }));
    const evidence = analyzeGpsEvidence(activity);
    const route = evidence.cleanedPoints.map(({ latitude, longitude }) => ({
      latitude,
      longitude,
    }));
    activity.session!.totalDistanceM = route
      .slice(1)
      .reduce((total, point, index) => total + distanceBetween(route[index], point), 0);

    const proposal = createGpsMatchProposal(activity, evidence, evidence.cleanedPoints, route);

    expect(proposal.evidenceScores.heading?.score).toBeGreaterThan(95);
    expect(proposal.evidenceScores.proximity?.score).toBe(100);
    expect(proposal.evidenceScores.altitude).toBeUndefined();
    expect(proposal.evidenceScores.overall).toBeGreaterThan(95);
  });

  it('builds an independent distance consensus when sensor algorithms agree', () => {
    const activity = activityFixture();
    activity.session = {
      ...activity.session,
      totalElapsedTimeS: 100,
      totalTimerTimeS: 100,
      totalStrides: 165,
    };
    activity.records = Array.from({ length: 101 }, (_, index) => ({
      index,
      timestamp: new Date(Date.UTC(2024, 0, 1, 0, 0, index)).toISOString(),
      distanceM: index * 3.3,
      enhancedSpeedMps: 3.3,
      cadenceRaw: 99,
      runningCadenceSpm: 198,
      nativeStepLengthM: 1,
      position: { latitude: 50 + index * 0.00001, longitude: 30 },
      developerFields: {},
    }));

    const consensus = estimateDistanceConsensus(activity);

    expect(consensus?.estimateCount).toBe(3);
    expect(consensus?.distanceM).toBeCloseTo(330, 0);
    expect(consensus?.spreadPercent).toBeLessThan(1);
  });

  it('flags a 5 km road against a 12 km sensor estimate as low-confidence', () => {
    const activity = activityFixture();
    const evidence = analyzeGpsEvidence(activity);
    const route = [
      { latitude: 50, longitude: 30 },
      { latitude: 50.045, longitude: 30 },
    ];

    const proposal = createGpsMatchProposal(activity, evidence, evidence.cleanedPoints, route, [], {
      distanceM: 12_000,
      source: 'repair_consensus',
      estimateCount: 3,
    });

    expect(proposal.routeDistanceM).toBeCloseTo(5_000, -2);
    expect(proposal.distanceDeltaPercent).toBeCloseTo(58.3, 1);
    expect(proposal.distanceConflict).toBe(true);
    expect(proposal.evidenceScores.overall).toBeLessThanOrEqual(35);
    expect(proposal.confidence).toBe('low');
  });
});
