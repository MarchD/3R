import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../app/App';
import { ToastProvider } from '../contexts/ToastContext';
import { createRepairCandidates } from '../fit/repair/createRepairCandidates';
import { parsedFixture } from './fixtures';
import { LanguageProvider } from '../i18n/LanguageContext';

vi.mock('../components/AlphaGpsRepair/RouteComparisonMap', () => ({
  RouteComparisonMap: ({ matchedLabel }: { matchedLabel: string }) => (
    <div role="img" aria-label={matchedLabel} />
  ),
}));
vi.mock('../components/AlphaGpsRepair/EditableRouteMap', () => ({
  EditableRouteMap: ({
    mapLabel,
    waypoints,
    onAdd,
    onRemove,
  }: {
    mapLabel: string;
    waypoints: unknown[];
    onAdd: (point: { latitude: number; longitude: number }) => void;
    onRemove: (index: number) => void;
  }) => (
    <div role="img" aria-label={mapLabel}>
      <button
        type="button"
        onClick={() => onAdd({ latitude: 50.46 + waypoints.length * 0.0001, longitude: 30.53 })}
      >
        Add on map
      </button>
      {waypoints.map((_, index) => (
        // The test map exposes the same removal callback as the Leaflet marker popup.
        // eslint-disable-next-line react/no-array-index-key
        <button key={index} type="button" onClick={() => onRemove(index)}>
          Remove on map {index + 1}
        </button>
      ))}
    </div>
  ),
}));

let repairRequests = 0;
let workerParsedResult = parsedFixture();
const MATCHED_SHAPE =
  'cfff_Bu~~ey@`AvAx@iBvByEx@cBkEsGiNsSmEuGaFmHaHgKoAiBeCyD_AwAYMWR]t@}V{_@qDuFyBgDeEqGf@gAn@uAlAkC';

function renderApp() {
  return render(
    <LanguageProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </LanguageProvider>,
  );
}

class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;

  onerror: (() => void) | null = null;

  postMessage(message: { type: string }) {
    queueMicrotask(() => {
      if (message.type === 'parse')
        this.onmessage?.({ data: { type: 'parsed', result: workerParsedResult } } as MessageEvent);
      if (message.type === 'repair') {
        repairRequests += 1;
        this.onmessage?.({
          data: {
            type: 'repaired',
            candidates: createRepairCandidates(parsedFixture().normalized),
          },
        } as MessageEvent);
      }
      if (message.type === 'export-fit') {
        this.onmessage?.({
          data: {
            type: 'fit-exported',
            buffer: new Uint8Array([1, 2, 3]).buffer,
            report: {
              messageCount: 8,
              recordCount: 5,
              shiftedTimestampFields: 0,
              developerFieldCount: 0,
              unknownMessageTypes: 0,
              outputBytes: 3,
              positionPatchedRecords: 0,
              warnings: [],
            },
          },
        } as MessageEvent);
      }
    });
  }

  terminate = vi.fn();
}

describe('complete local analysis and repair flow', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    localStorage.clear();
    repairRequests = 0;
    workerParsedResult = parsedFixture();
    vi.stubGlobal('Worker', MockWorker);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('calculates distance from settings, then applies and exports a derived FIT file', async () => {
    const user = userEvent.setup();
    renderApp();
    const file = new File([new Uint8Array([1, 2, 3])], 'test.fit', {
      type: 'application/octet-stream',
      lastModified: 1,
    });
    await user.upload(screen.getByLabelText('Choose FIT files'), file);
    expect(await screen.findByText('Complete decode')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Update activity map' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Map changes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update map' })).toBeInTheDocument();
    expect(
      screen.queryByRole('img', { name: 'Editable running route map' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Normalized JSON' }));
    expect(screen.getByPlaceholderText('Search key or value')).toBeInTheDocument();
    expect(repairRequests).toBe(0);

    await user.click(screen.getByRole('radio', { name: /Recalculate distance/ }));
    await waitFor(() => expect(repairRequests).toBe(1));
    const choices = (await screen.findAllByRole('radio')).slice(-3);
    expect(choices).toHaveLength(3);
    expect(choices.every((choice) => !(choice as HTMLInputElement).checked)).toBe(true);

    await user.click(choices[0]);
    await user.click(screen.getByRole('button', { name: 'Preview selected repair' }));
    expect(screen.getByText('Review derived changes')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByText('Derived files are ready')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to previous step' }));
    expect(screen.getByText('Review derived changes')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByText('Derived files are ready')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Repair patch' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy patch' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create repaired FIT' }));
    expect(await screen.findByText(/Validated and downloaded/)).toBeInTheDocument();
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('blocks repair when the FIT activity is not running', async () => {
    workerParsedResult = parsedFixture();
    workerParsedResult.normalized.sport = 'cycling';
    const user = userEvent.setup();
    renderApp();
    const file = new File([new Uint8Array([1])], 'ride.fit', {
      type: 'application/octet-stream',
      lastModified: 2,
    });
    await user.upload(screen.getByLabelText('Choose FIT files'), file);
    expect(await screen.findByText(/supports running activities only/i)).toBeInTheDocument();
    expect(screen.getByText(/supports running activities only/i)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Recalculate distance/ })).toBeDisabled();
    expect(repairRequests).toBe(0);
  });

  it('applies a start-time correction while keeping recorded distance', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.upload(
      screen.getByLabelText('Choose FIT files'),
      new File([new Uint8Array([1])], 'time-only.fit'),
    );

    await user.click(screen.getByRole('button', { name: /^Country/ }));
    await user.type(screen.getByRole('combobox', { name: 'Country: Search options' }), 'Peru');
    await user.click(screen.getByRole('option', { name: 'Peru' }));
    fireEvent.change(screen.getByLabelText('Correct start date and time'), {
      target: { value: '2024-01-02T03:30' },
    });

    expect(screen.getByRole('radio', { name: /Keep recorded distance/ })).toBeChecked();
    expect(repairRequests).toBe(0);
    await user.click(screen.getByRole('button', { name: 'Apply time correction' }));
    expect(screen.getByText('Derived files are ready')).toBeInTheDocument();
    expect(screen.getByText('Activity start corrected')).toBeInTheDocument();
    expect(repairRequests).toBe(0);
    await user.click(screen.getByRole('button', { name: 'Back to previous step' }));
    expect(screen.getByRole('radio', { name: /Keep recorded distance/ })).toBeChecked();
  });

  it('applies the corrected start time and repaired distance together', async () => {
    const user = userEvent.setup();
    renderApp();
    const file = new File([new Uint8Array([1, 2, 3])], 'wrong-time.fit', {
      type: 'application/octet-stream',
      lastModified: 3,
    });
    await user.upload(screen.getByLabelText('Choose FIT files'), file);
    expect(await screen.findByText('Complete decode')).toBeInTheDocument();

    expect(screen.getByLabelText('Correct start date and time')).toBeVisible();
    await user.click(screen.getByRole('button', { name: /^Country/ }));
    await user.type(screen.getByRole('combobox', { name: 'Country: Search options' }), 'Peru');
    await user.click(screen.getByRole('option', { name: 'Peru' }));
    expect(screen.getByRole('button', { name: 'Time zone America/Lima' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Correct start date and time'), {
      target: { value: '2024-01-02T03:30' },
    });
    expect(screen.getByText('Start time changed')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /Recalculate distance/ }));
    await waitFor(() => expect(repairRequests).toBe(1));
    await user.click((await screen.findAllByRole('radio'))[2]);
    await user.click(screen.getByRole('button', { name: 'Preview selected repair' }));
    expect(screen.getByText('Activity start corrected')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    expect(screen.getByText('Activity start corrected')).toBeInTheDocument();
    expect(screen.getByText('Derived files are ready')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to previous step' }));
    expect(screen.getByText('Review derived changes')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(screen.getByRole('button', { name: 'Cancel repair' }));
    expect(screen.getByRole('button', { name: 'Country Peru' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Time zone America/Lima' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Country/ }));
    const countrySearch = screen.getByRole('combobox', { name: 'Country: Search options' });
    await user.type(countrySearch, 'Russia');
    const russia = screen.getByRole('option', { name: /Russia/ });
    expect(russia).toHaveAttribute('aria-disabled', 'true');
    await user.click(russia);
    expect(screen.getByRole('button', { name: 'Country Peru' })).toBeInTheDocument();
    await user.clear(countrySearch);
    await user.type(countrySearch, 'Ukraine');
    await user.click(screen.getByRole('option', { name: 'Ukraine' }));
    expect(screen.getByRole('button', { name: 'Time zone Europe/Kyiv' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Time zone/ }));
    expect(screen.getByRole('option', { name: /Europe\/Simferopol/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.queryByRole('option', { name: 'Europe/Kiev' })).not.toBeInTheDocument();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(screen.getByRole('button', { name: 'Time zone Europe/Kyiv' })).toBeInTheDocument();
  });

  it('switches the complete interface to Ukrainian and remembers the choice', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Language' }), 'uk');
    expect(screen.getByRole('heading', { name: /Перевірте дані/ })).toBeInTheDocument();
    expect(screen.getByText('Файли залишаються у цьому браузері')).toBeInTheDocument();
    expect(screen.getByText('З Garmin Connect до 3R — і назад')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('uk');
    expect(localStorage.getItem('3r-language')).toBe('uk');
  });

  it('uses the browser language when no preference has been saved', () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['uk-UA', 'en-US']);

    renderApp();

    expect(screen.getByRole('heading', { name: /Перевірте дані/ })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('uk');
    expect(localStorage.getItem('3r-language')).toBeNull();
  });

  it('keeps only suggested routes behind the alpha query parameter', async () => {
    window.history.replaceState({}, '', '/?version=alpha');
    const user = userEvent.setup();
    renderApp();
    const file = new File([new Uint8Array([1])], 'gps.fit', {
      type: 'application/octet-stream',
      lastModified: 4,
    });

    await user.upload(screen.getByLabelText('Choose FIT files'), file);

    await user.click(await screen.findByRole('button', { name: 'Update map' }));
    expect(screen.getByRole('heading', { name: 'Update activity map' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Suggest a route' }));
    expect(screen.getByRole('button', { name: 'Send trace and find route' })).toBeEnabled();
  });

  it('opens map editing only on request outside alpha', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.upload(
      screen.getByLabelText('Choose FIT files'),
      new File([new Uint8Array([1])], 'map.fit'),
    );

    expect(
      screen.queryByRole('img', { name: 'Editable running route map' }),
    ).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Update map' }));
    expect(screen.getByRole('img', { name: 'Editable running route map' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recalculate from recorded GPS' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Suggest a route' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close map editor' }));
    expect(
      screen.queryByRole('img', { name: 'Editable running route map' }),
    ).not.toBeInTheDocument();
  });

  it('replaces the start editor with a dedicated route review after matching', async () => {
    window.history.replaceState({}, '', '/?version=alpha');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ trip: { legs: [{ shape: MATCHED_SHAPE }] } }),
      }),
    );
    const user = userEvent.setup();
    renderApp();
    const file = new File([new Uint8Array([1])], 'gps.fit', {
      type: 'application/octet-stream',
      lastModified: 5,
    });
    await user.upload(screen.getByLabelText('Choose FIT files'), file);
    await user.click(await screen.findByRole('button', { name: 'Update map' }));
    await user.click(screen.getByRole('button', { name: 'Suggest a route' }));

    expect(
      await screen.findByRole('heading', { name: 'Where did the activity really start?' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send trace and find route' }));

    expect(
      await screen.findByRole('heading', { name: 'Review the reconstructed road' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Where did the activity really start?' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Suggested route' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change start location' })).toBeInTheDocument();
  });

  it('offers road loop alternatives when GPS is damaged and only the start is known', async () => {
    window.history.replaceState({}, '', '/?version=alpha');
    workerParsedResult = parsedFixture();
    workerParsedResult.normalized.session = {
      ...workerParsedResult.normalized.session,
      totalElapsedTimeS: 100,
      totalTimerTimeS: 100,
      totalStrides: 165,
    };
    workerParsedResult.normalized.records = Array.from({ length: 101 }, (_, index) => ({
      ...workerParsedResult.normalized.records[0],
      index,
      timestamp: new Date(Date.UTC(2024, 0, 1, 0, 0, index)).toISOString(),
      distanceM: index * 3.3,
      enhancedSpeedMps: 3.3,
      nativeStepLengthM: 1,
      position: { latitude: 50 + index * 0.01, longitude: 30 },
    }));
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ trip: { legs: [{ shape: MATCHED_SHAPE }] } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderApp();
    await user.upload(
      screen.getByLabelText('Choose FIT files'),
      new File([new Uint8Array([1])], 'damaged.fit'),
    );

    await user.click(await screen.findByRole('button', { name: 'Update map' }));
    await user.click(screen.getByRole('button', { name: 'Suggest a route' }));
    const findLoops = await screen.findByRole('button', { name: 'Find possible road loops' });
    await user.click(findLoops);

    expect(await screen.findByText('Possible road loops near the start')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Option \d+ ·/ }).length).toBeGreaterThanOrEqual(
      4,
    );
    expect(fetchMock).toHaveBeenCalled();
    expect(fetchMock.mock.calls[0][0] as string).toMatch(/\/route$/);
  });

  it('draws more than 20 points locally without a routing request', async () => {
    window.history.replaceState({}, '', '/?version=alpha');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ trip: { legs: [{ shape: MATCHED_SHAPE }] } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderApp();
    await user.upload(
      screen.getByLabelText('Choose FIT files'),
      new File([new Uint8Array([1])], 'manual.fit'),
    );

    await user.click(await screen.findByRole('button', { name: 'Update map' }));
    expect(screen.getByRole('img', { name: 'Editable running route map' })).toBeInTheDocument();
    expect(document.querySelector('.startLocationMap')).toBeNull();
    const coordinateForm = screen.getByRole('button', { name: 'Add point' }).closest('form')!;
    const latitude = within(coordinateForm).getByLabelText('Latitude');
    const longitude = within(coordinateForm).getByLabelText('Longitude');
    await user.type(latitude, '50.46');
    await user.type(longitude, '30.53');
    await user.click(screen.getByRole('button', { name: 'Add point' }));
    expect(screen.getByText(/Drawn distance:/)).toBeInTheDocument();
    await user.type(latitude, '50.455');
    await user.type(longitude, '30.54');
    await user.click(screen.getByRole('button', { name: 'Add point' }));
    expect(screen.getByText('Points: 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove on map 2' }));
    expect(screen.getByText('Points: 1')).toBeInTheDocument();
    for (let index = 0; index < 20; index += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Add on map' }));
    }
    expect(screen.getByText('Points: 21')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Set finish' }));
    await user.type(latitude, '50.47');
    await user.type(longitude, '30.55');
    await user.click(within(coordinateForm).getByRole('button', { name: 'Set finish' }));
    await user.click(screen.getByRole('button', { name: 'Review drawn route' }));
    expect(screen.getByRole('heading', { name: 'Review your drawn path' })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lets a map-only redraw proceed despite a distance mismatch', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.upload(
      screen.getByLabelText('Choose FIT files'),
      new File([new Uint8Array([1])], 'map-only.fit'),
    );

    await user.click(await screen.findByRole('button', { name: 'Update map' }));
    await user.click(screen.getByRole('button', { name: 'Add on map' }));
    await user.click(screen.getByRole('button', { name: 'Review drawn route' }));
    const apply = screen.getByRole('button', { name: 'Apply drawn path' });
    expect(screen.getByRole('radio', { name: /Keep recorded distance/ })).toBeChecked();
    expect(apply).toBeEnabled();
    expect(screen.getByText(/Original record, lap, and session distances/)).toBeInTheDocument();
    await user.click(apply);
    expect(await screen.findByText(/record positions reconstructed/)).toBeInTheDocument();
  });

  it('uses the selected distance estimate for a map-and-distance redraw', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.upload(
      screen.getByLabelText('Choose FIT files'),
      new File([new Uint8Array([1])], 'map-and-distance.fit'),
    );

    await user.click(screen.getByRole('radio', { name: /Recalculate distance/ }));
    await screen.findByRole('heading', { name: 'Compare distance repairs' });
    await user.click(screen.getByRole('button', { name: 'Update map' }));
    await user.click(screen.getByRole('button', { name: 'Add on map' }));
    expect(screen.getByRole('button', { name: 'Review drawn route' })).toBeDisabled();
    expect(screen.getByText(/Select a calculated distance above/)).toBeInTheDocument();

    await user.click(screen.getAllByRole('radio').slice(-3)[0]);
    expect(screen.getByRole('button', { name: 'Review drawn route' })).toBeEnabled();
  });

  it('offers a local GPS-distance repair outside alpha without routing requests', async () => {
    workerParsedResult = parsedFixture();
    workerParsedResult.normalized.records = Array.from({ length: 61 }, (_, index) => ({
      ...workerParsedResult.normalized.records[0],
      index,
      timestamp: new Date(Date.parse('2024-01-01T00:00:00.000Z') + index * 1000).toISOString(),
      position: { latitude: 50.45 + index * 0.00002, longitude: 30.52 },
    }));
    const originalDistanceM = workerParsedResult.normalized.session!.totalDistanceM;
    const originalFinalRecordDistanceM = workerParsedResult.normalized.records.at(-1)?.distanceM;
    const originalPositions = workerParsedResult.normalized.records.map(
      (record) => record.position,
    );
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    let repairedJson: Blob | undefined;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      repairedJson = blob as Blob;
      return 'blob:test';
    });
    const user = userEvent.setup();
    renderApp();
    await user.upload(
      screen.getByLabelText('Choose FIT files'),
      new File([new Uint8Array([1])], 'good-gps.fit'),
    );

    expect(await screen.findByRole('radio', { name: /Keep recorded distance/ })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Update map' }));
    await user.click(screen.getByRole('button', { name: 'Recalculate from recorded GPS' }));
    expect(screen.getByRole('heading', { name: 'Review recorded GPS track' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Recorded GPS track' })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(repairRequests).toBe(0);
    await user.click(screen.getByRole('button', { name: 'Apply GPS distance' }));
    expect(
      await screen.findByText(/Record distances and lap summaries aligned/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Repaired JSON' }));
    const repaired = JSON.parse(new TextDecoder().decode(await repairedJson!.arrayBuffer()));
    expect(repaired.session.totalDistanceM).toBeGreaterThan(0);
    expect(repaired.session.totalDistanceM).not.toBe(originalDistanceM);
    expect(repaired.records.at(-1).distanceM).not.toBe(originalFinalRecordDistanceM);
    expect(repaired.records.map((record: { position: unknown }) => record.position)).toEqual(
      originalPositions,
    );
    await user.click(screen.getByRole('button', { name: 'Back to previous step' }));
    expect(screen.getByRole('heading', { name: 'Review recorded GPS track' })).toBeInTheDocument();
  });
});
