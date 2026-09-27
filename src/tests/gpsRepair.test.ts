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
import { createManualRouteProposal } from '../fit/gps/manualRoute';
import { createGpsTraceDistanceProposal } from '../fit/gps/gpsTraceDistance';
import { applyGpsRepair } from '../fit/repair/applyGpsRepair';
import { estimateDistanceConsensus } from '../fit/repair/distanceConsensus';
import { rebuildDistanceLaps } from '../fit/repair/rebuildDistanceLaps';
import { activityFixture } from './fixtures';

const MATCHED_SHAPE =
  'cfff_Bu~~ey@`AvAx@iBvByEx@cBkEsGiNsSmEuGaFmHaHgKoAiBeCyD_AwAYMWR]t@}V{_@qDuFyBgDeEqGf@gAn@uAlAkC';

describe('alpha GPS repair', () => {
  it('rebuilds only automatic distance laps at the new distance boundaries', () => {
    const activity = activityFixture();
    activity.session!.totalDistanceM = 3_500;
    activity.laps = [
      ...Array.from({ length: 3 }, (_, index) => ({
        index,
        lapTrigger: 'distance',
        totalDistanceM: 1_000,
      })),
      { index: 3, lapTrigger: 'sessionEnd', totalDistanceM: 500 },
    ];
    const repairedRecords = activity.records.map((record, index) => ({
      ...record,
      distanceM: [0, 500, 1_000, 1_500, 2_200][index],
    }));

    const laps = rebuildDistanceLaps(activity, repairedRecords, 2_200);

    expect(laps?.map((lap) => lap.totalDistanceM)).toEqual([1_000, 1_000, 200]);
    expect(laps?.map((lap) => lap.lapTrigger)).toEqual(['distance', 'distance', 'sessionEnd']);
    expect(laps?.every((lap) => Date.parse(lap.endTime) > Date.parse(lap.startTime))).toBe(true);

    activity.laps[1].lapTrigger = 'manual';
    expect(rebuildDistanceLaps(activity, repairedRecords, 2_200)).toBeUndefined();
  });
  it('aligns broken record and lap distances to an unchanged recorded GPS track', () => {
    const activity = activityFixture();
    activity.records = Array.from({ length: 61 }, (_, index) => ({
      ...activity.records[0],
      index,
      timestamp: new Date(Date.parse('2024-01-01T00:00:00.000Z') + index * 1000).toISOString(),
      position: { latitude: 50.45 + index * 0.00002, longitude: 30.52 },
      distanceM: index * 10,
    }));
    activity.laps = [
      {
        index: 0,
        startTime: activity.records[0].timestamp,
        endTime: activity.records[30].timestamp,
        totalTimerTimeS: 30,
        totalDistanceM: 300,
      },
      {
        index: 1,
        startTime: activity.records[30].timestamp,
        endTime: activity.records[60].timestamp,
        totalTimerTimeS: 30,
        totalDistanceM: 300,
      },
    ];
    const proposal = createGpsTraceDistanceProposal(activity, analyzeGpsEvidence(activity));
    const { patch, repairedActivity } = applyGpsRepair('gps.fit', activity, proposal);

    expect(proposal.positionPatches).toEqual([]);
    expect(patch.algorithm).toBe('gps_trace_distance');
    expect(repairedActivity.records.map((record) => record.position)).toEqual(
      activity.records.map((record) => record.position),
    );
    expect(repairedActivity.session?.totalDistanceM).toBeCloseTo(proposal.routeDistanceM, 4);
    expect(repairedActivity.laps[0].totalDistanceM).toBeCloseTo(proposal.routeDistanceM / 2, 4);
    expect(repairedActivity.laps[1].totalDistanceM).toBeCloseTo(proposal.routeDistanceM / 2, 4);
    expect(repairedActivity.laps[0].totalTimerTimeS).toBe(30);
    expect(repairedActivity.laps[1].startTime).toBe(activity.laps[1].startTime);
  });

  it('draws an out-and-back loop without a routing service', () => {
    const activity = activityFixture();
    const start = { latitude: 50.45, longitude: 30.52 };
    const waypoint = { latitude: 50.46, longitude: 30.53 };
    const proposal = createManualRouteProposal(
      activity,
      analyzeGpsEvidence(activity),
      start,
      [waypoint],
      { distanceM: 3_000, source: 'repair_consensus' },
      start,
    );

    expect(proposal.routeAnchors).toEqual([start, waypoint, start]);
    expect(proposal.matchedRoute.at(-1)).toEqual(start);
    expect(proposal.provider).toBe('Manual drawing');
  });

  it('uses a separate finish when one is selected', () => {
    const activity = activityFixture();
    const start = { latitude: 50.45, longitude: 30.52 };
    const finish = { latitude: 50.47, longitude: 30.54 };
    const proposal = createManualRouteProposal(
      activity,
      analyzeGpsEvidence(activity),
      start,
      [],
      { distanceM: 3_000, source: 'repair_consensus' },
      finish,
    );

    expect(proposal.routeAnchors).toEqual([start, finish]);
    expect(proposal.matchedRoute.at(-1)).toEqual(finish);
  });

  it('supports more than 20 drawn points and labels the exported repair accurately', () => {
    const activity = activityFixture();
    const evidence = analyzeGpsEvidence(activity);
    const start = { latitude: 50.45, longitude: 30.52 };
    const waypoints = Array.from({ length: 25 }, (_, index) => ({
      latitude: 50.45 + (index + 1) * 0.0001,
      longitude: 30.52 + (index + 1) * 0.0001,
    }));
    const route = [start, ...waypoints];
    const distanceReference = { distanceM: 12_670, source: 'repair_consensus' as const };
    const proposal = createManualRouteProposal(
      activity,
      evidence,
      start,
      waypoints,
      distanceReference,
    );
    const { patch } = applyGpsRepair('manual.fit', activity, proposal);

    expect(proposal.reconstructionMethod).toBe('manual_route');
    expect(proposal.routeAnchors).toEqual(route);
    expect(proposal.routeDistanceM).toBeCloseTo(traceDistance(route), 5);
    expect(proposal.positionPatches).toHaveLength(activity.records.length);
    expect(proposal.evidenceScores.overall).toBeLessThanOrEqual(49);
    expect(patch.algorithm).toBe('gps_manual_draw');
    expect(patch.assumptions.join(' ')).toContain('manually drawn');
    expect(patch.warnings.join(' ')).not.toContain('map-matched');
  });

  it('calibrates lap boundaries and distances after manually redrawing the route', () => {
    const activity = activityFixture();
    activity.laps = [
      {
        index: 0,
        startTime: '2024-01-01T00:00:00.000Z',
        endTime: '2024-01-01T00:00:02.000Z',
        totalTimerTimeS: 2,
        totalDistanceM: 500,
      },
      {
        index: 1,
        startTime: '2024-01-01T00:00:02.000Z',
        endTime: '2024-01-01T00:00:04.000Z',
        totalTimerTimeS: 2,
        totalDistanceM: 500,
      },
    ];
    const recordPatches = activity.records.map((record) => ({
      recordIndex: record.index,
      distanceM: record.index * 10,
      derivedSpeedMps: 10,
    }));
    const proposal = createManualRouteProposal(
      activity,
      analyzeGpsEvidence(activity),
      { latitude: 50.45, longitude: 30.52 },
      [{ latitude: 50.46, longitude: 30.53 }],
      {
        distanceM: 40,
        source: 'repair_consensus',
        recordPatches,
        recordProgresses: [0, 0.25, 0.5, 0.75, 1],
      },
    );
    const { patch, repairedActivity } = applyGpsRepair('manual.fit', activity, proposal);

    expect(patch.lapPatches).toHaveLength(2);
    expect(repairedActivity.laps.map((lap) => lap.totalDistanceM)).toEqual([20, 20]);
    expect(repairedActivity.laps.map((lap) => lap.avgSpeedMps)).toEqual([10, 10]);
    expect(repairedActivity.laps[0].startPosition).toEqual(repairedActivity.records[0].position);
    expect(repairedActivity.laps[0].endPosition).toEqual(repairedActivity.records[2].position);
    expect(repairedActivity.laps[1].startPosition).toEqual(repairedActivity.records[2].position);
    expect(repairedActivity.laps[1].endPosition).toEqual(repairedActivity.records[4].position);
    expect(repairedActivity.laps[0].startTime).toBe(activity.laps[0].startTime);
  });

  it('preserves distance and speed data when only the drawn map is updated', () => {
    const activity = activityFixture();
    activity.session!.avgSpeedMps = 2.5;
    activity.laps = [
      {
        index: 0,
        startTime: activity.records[0].timestamp,
        endTime: activity.records[4].timestamp,
        totalTimerTimeS: 4,
        totalDistanceM: 500,
        avgSpeedMps: 2.5,
      },
    ];
    const proposal = createManualRouteProposal(
      activity,
      analyzeGpsEvidence(activity),
      { latitude: 50.45, longitude: 30.52 },
      [{ latitude: 50.46, longitude: 30.53 }],
      {
        distanceM: 1_000,
        source: 'repair_consensus',
        recordPatches: activity.records.map((record) => ({
          recordIndex: record.index,
          distanceM: record.index * 100,
          derivedSpeedMps: 100,
        })),
      },
    );
    const { patch, repairedActivity } = applyGpsRepair('manual.fit', activity, {
      ...proposal,
      preserveDistance: true,
    });

    expect(patch.recordPatches).toEqual([]);
    expect(patch.lapPatches?.[0].totalDistanceM).toBeUndefined();
    expect(patch.repairedSummary.totalDistanceM).toBe(activity.session?.totalDistanceM);
    expect(repairedActivity.session?.totalDistanceM).toBe(activity.session?.totalDistanceM);
    expect(repairedActivity.session?.avgSpeedMps).toBe(activity.session?.avgSpeedMps);
    expect(repairedActivity.records.map((record) => record.distanceM)).toEqual(
      activity.records.map((record) => record.distanceM),
    );
    expect(repairedActivity.records.map((record) => record.enhancedSpeedMps)).toEqual(
      activity.records.map((record) => record.enhancedSpeedMps),
    );
    expect(repairedActivity.laps[0].totalDistanceM).toBe(activity.laps[0].totalDistanceM);
    expect(repairedActivity.laps[0].avgSpeedMps).toBe(activity.laps[0].avgSpeedMps);
    expect(repairedActivity.laps[0].startPosition).toEqual(repairedActivity.records[0].position);
    expect(repairedActivity.laps[0].endPosition).toEqual(repairedActivity.records[4].position);
  });

  it('allows a map-only drawn route without a sensor distance estimate', () => {
    const activity = activityFixture();
    const proposal = createManualRouteProposal(
      activity,
      analyzeGpsEvidence(activity),
      { latitude: 50.45, longitude: 30.52 },
      [{ latitude: 50.46, longitude: 30.53 }],
      undefined,
    );
    const { patch } = applyGpsRepair('manual.fit', activity, {
      ...proposal,
      preserveDistance: true,
    });

    expect(patch.positionPatches).toHaveLength(activity.records.length);
    expect(patch.recordPatches).toEqual([]);
  });

  it('leaves the route open at the last added point by default', () => {
    const activity = activityFixture();
    const start = { latitude: 50.45, longitude: 30.52 };
    const waypoint = { latitude: 50.46, longitude: 30.53 };
    const proposal = createManualRouteProposal(
      activity,
      analyzeGpsEvidence(activity),
      start,
      [waypoint],
      { distanceM: 3_000, source: 'repair_consensus' },
    );

    expect(proposal.routeAnchors).toEqual([start, waypoint]);
    expect(proposal.matchedRoute.at(-1)).toEqual(waypoint);
  });
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
