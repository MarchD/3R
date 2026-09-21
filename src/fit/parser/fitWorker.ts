/// <reference lib="webworker" />
import { createRepairCandidates } from '../repair/createRepairCandidates';
import { parseFitBuffer } from './fitDecoder';
import type { NormalizedActivity } from '../../models/fit';

type WorkerRequest =
  | { id: string; type: 'parse'; buffer: ArrayBuffer; file: { name: string; size: number; lastModified: number } }
  | { id: string; type: 'repair'; activity: NormalizedActivity };

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  try {
    if (request.type === 'parse') {
      self.postMessage({ id: request.id, type: 'progress', progress: 20 });
      const result = parseFitBuffer(request.buffer, request.file);
      self.postMessage({ id: request.id, type: 'parsed', result });
    } else {
      const candidates = createRepairCandidates(request.activity);
      self.postMessage({ id: request.id, type: 'repaired', candidates });
    }
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'The FIT file could not be processed.';
    self.postMessage({ id: request.id, type: 'error', error: { code: 'processing_failed', message } });
  }
};

export {};
