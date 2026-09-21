import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../app/App';
import { createRepairCandidates } from '../fit/repair/createRepairCandidates';
import { parsedFixture } from './fixtures';

let repairRequests = 0;
let workerParsedResult = parsedFixture();

class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage(message: { type: string }) {
    queueMicrotask(() => {
      if (message.type === 'parse') this.onmessage?.({ data: { type: 'parsed', result: workerParsedResult } } as MessageEvent);
      if (message.type === 'repair') {
        repairRequests += 1;
        this.onmessage?.({ data: { type: 'repaired', candidates: createRepairCandidates(parsedFixture().normalized) } } as MessageEvent);
      }
      if (message.type === 'export-fit') {
        this.onmessage?.({ data: { type: 'fit-exported', buffer: new Uint8Array([1, 2, 3]).buffer, report: { messageCount: 8, recordCount: 5, developerFieldCount: 0, unknownMessageTypes: 0, outputBytes: 3, warnings: [] } } } as MessageEvent);
      }
    });
  }
  terminate() {}
}

describe('complete local analysis and repair flow', () => {
  beforeEach(() => {
    repairRequests = 0;
    workerParsedResult = parsedFixture();
    vi.stubGlobal('Worker', MockWorker);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('waits for explicit confirmation, then applies repair and exports a derived FIT file', async () => {
    const user = userEvent.setup();
    render(<App />);
    const file = new File([new Uint8Array([1, 2, 3])], 'test.fit', { type: 'application/octet-stream', lastModified: 1 });
    await user.upload(screen.getByLabelText('Choose FIT files'), file);
    expect(await screen.findByText('Complete decode')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Normalized JSON' }));
    expect(screen.getByPlaceholderText('Search key or value')).toBeInTheDocument();
    expect(repairRequests).toBe(0);

    await user.click(screen.getByRole('button', { name: 'Repair activity' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/original FIT file will remain unchanged/i)).toBeInTheDocument();
    expect(repairRequests).toBe(0);

    await user.click(within(dialog).getByRole('button', { name: 'Continue to repair' }));
    await waitFor(() => expect(repairRequests).toBe(1));
    const choices = await screen.findAllByRole('radio');
    expect(choices).toHaveLength(3);
    expect(choices.every((choice) => !(choice as HTMLInputElement).checked)).toBe(true);

    await user.click(choices[0]);
    await user.click(screen.getByRole('button', { name: 'Preview selected repair' }));
    expect(screen.getByText('Review derived changes')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Apply to derived JSON' }));
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
    render(<App />);
    const file = new File([new Uint8Array([1])], 'ride.fit', { type: 'application/octet-stream', lastModified: 2 });
    await user.upload(screen.getByLabelText('Choose FIT files'), file);
    expect(await screen.findByText('Repair unavailable')).toBeInTheDocument();
    expect(screen.getByText(/supports running activities only/i)).toBeInTheDocument();
    expect(screen.getByText('Detected: cycling')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Repair activity' })).not.toBeInTheDocument();
    expect(repairRequests).toBe(0);
  });
});
