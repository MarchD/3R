import { describe, expect, it, vi } from 'vitest';
import {
  analyzeGpsEvidence,
  createGpsMatchProposal,
  distanceBetween,
  relocateGpsEvidence,
} from '../fit/gps/traceAnalysis';
import { decodePolyline, requestGpsMatch } from '../fit/gps/valhallaMapMatcher';
import { applyGpsRepair } from '../fit/repair/applyGpsRepair';
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
});
