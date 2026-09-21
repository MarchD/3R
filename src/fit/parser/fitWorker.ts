/// <reference lib="webworker" />
import { createRepairCandidates } from '../repair/createRepairCandidates';
import { encodeRepairedFit } from '../encoder/fitEncoder';
import { parseFitBuffer } from './fitDecoder';
import type { NormalizedActivity } from '../../models/fit';
import type { RepairPatch } from '../../models/repair';

type WorkerRequest =
  | { id: string; type: 'parse'; buffer: ArrayBuffer; file: { name: string; size: number; lastModified: number } }
  | { id: string; type: 'repair'; activity: NormalizedActivity }
  | { id: string; type: 'export-fit'; buffer: ArrayBuffer; patch: RepairPatch };

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  try {
    if (request.type === 'parse') {
      self.postMessage({ id: request.id, type: 'progress', progress: 20 });
      const result = parseFitBuffer(request.buffer, request.file);
      self.postMessage({ id: request.id, type: 'parsed', result });
    } else if (request.type === 'repair') {
      const candidates = createRepairCandidates(request.activity);
      self.postMessage({ id: request.id, type: 'repaired', candidates });
    } else {
      const { bytes, report } = encodeRepairedFit(request.buffer, request.patch);
      const output = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      self.postMessage({ id: request.id, type: 'fit-exported', buffer: output, report }, [output]);
    }
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'The FIT file could not be processed.';
    self.postMessage({ id: request.id, type: 'error', error: { code: 'processing_failed', message } });
  }
};

export {};
