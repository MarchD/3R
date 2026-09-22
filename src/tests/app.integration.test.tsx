import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../app/App';
import { ToastProvider } from '../contexts/ToastContext';
import { createRepairCandidates } from '../fit/repair/createRepairCandidates';
import { parsedFixture } from './fixtures';
import { LanguageProvider } from '../i18n/LanguageContext';

let repairRequests = 0;
let workerParsedResult = parsedFixture();

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

  it('waits for explicit confirmation, then applies repair and exports a derived FIT file', async () => {
    const user = userEvent.setup();
    renderApp();
    const file = new File([new Uint8Array([1, 2, 3])], 'test.fit', {
      type: 'application/octet-stream',
      lastModified: 1,
    });
    await user.upload(screen.getByLabelText('Choose FIT files'), file);
    expect(await screen.findByText('Complete decode')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'GPS repair lab' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Normalized JSON' }));
    expect(screen.getByPlaceholderText('Search key or value')).toBeInTheDocument();
    expect(repairRequests).toBe(0);

    await user.click(screen.getByRole('button', { name: 'Repair activity' }));
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText(/original FIT file will remain unchanged/i),
    ).toBeInTheDocument();
    expect(repairRequests).toBe(0);

    await user.click(within(dialog).getByRole('button', { name: 'Continue to repair' }));
    await waitFor(() => expect(repairRequests).toBe(1));
    const choices = await screen.findAllByRole('radio');
    expect(choices).toHaveLength(3);
    expect(choices.every((choice) => !(choice as HTMLInputElement).checked)).toBe(true);

    await user.click(choices[0]);
    await user.click(screen.getByRole('button', { name: 'Preview selected repair' }));
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
    expect(await screen.findByText('Repair unavailable')).toBeInTheDocument();
    expect(screen.getByText(/supports running activities only/i)).toBeInTheDocument();
    expect(screen.getByText('Detected: cycling')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Repair activity' })).not.toBeInTheDocument();
    expect(repairRequests).toBe(0);
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

    await user.click(screen.getByRole('checkbox', { name: /start date or time is wrong/i }));
    fireEvent.change(screen.getByLabelText('Correct start date and time'), {
      target: { value: '2024-01-02T03:30' },
    });
    expect(screen.getByText(/applied together with the distance repair/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Repair activity' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Continue to repair' }),
    );
    await waitFor(() => expect(repairRequests).toBe(1));
    await user.click((await screen.findAllByRole('radio'))[0]);
    await user.click(screen.getByRole('button', { name: 'Preview selected repair' }));
    expect(screen.getByText('Activity start corrected')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    expect(screen.getByText('Activity start corrected')).toBeInTheDocument();
    expect(screen.getByText('Derived files are ready')).toBeInTheDocument();
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

  it('reveals GPS repair only through the alpha query parameter', async () => {
    window.history.replaceState({}, '', '/?version=alpha');
    const user = userEvent.setup();
    renderApp();
    const file = new File([new Uint8Array([1])], 'gps.fit', {
      type: 'application/octet-stream',
      lastModified: 4,
    });

    await user.upload(screen.getByLabelText('Choose FIT files'), file);

    expect(await screen.findByRole('heading', { name: 'GPS repair lab' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send trace and find route' })).toBeEnabled();
  });
});
