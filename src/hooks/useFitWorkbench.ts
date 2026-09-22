import { useCallback, useEffect, useRef, useState } from 'react';
import type { FitExportUiState } from '../components/RepairWizard/RepairWizard';
import { useToast } from '../contexts/ToastContext';
import { applyRepairPatch } from '../fit/repair/applyRepairPatch';
import { validateRepairEligibility } from '../fit/repair/validateRepairEligibility';
import { useLanguage } from '../i18n/LanguageContext';
import type { Attachment, FitParseError } from '../models/fit';
import type { RepairCandidate, RepairState } from '../models/repair';
import { downloadBlob } from '../utils/download';

export type WorkbenchTab = 'summary' | 'normalized' | 'raw' | 'records' | 'issues';

const INITIAL_REPAIR_STATE: RepairState = { status: 'not-requested' };
const INITIAL_EXPORT_STATE: FitExportUiState = { status: 'idle' };

function createFitWorker(): Worker {
  return new Worker(new URL('../fit/parser/fitWorker.ts', import.meta.url), { type: 'module' });
}

function withoutKey<T>(values: Record<string, T>, key: string): Record<string, T> {
  const next = { ...values };
  delete next[key];
  return next;
}

export function useFitWorkbench() {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [activeTab, setActiveTab] = useState<WorkbenchTab>('summary');
  const [repairStates, setRepairStates] = useState<Record<string, RepairState>>({});
  const [fitExportStates, setFitExportStates] = useState<Record<string, FitExportUiState>>({});
  const [correctedStartTimes, setCorrectedStartTimes] = useState<
    Record<string, string | undefined>
  >({});
  const workers = useRef(new Map<string, Worker>());

  const stopWorker = useCallback((key: string) => {
    workers.current.get(key)?.terminate();
    workers.current.delete(key);
  }, []);

  useEffect(
    () => () => {
      workers.current.forEach((worker) => worker.terminate());
      workers.current.clear();
    },
    [],
  );

  const updateAttachment = useCallback(
    (id: string, updater: (attachment: Attachment) => Attachment) => {
      setAttachments((current) =>
        current.map((attachment) => (attachment.id === id ? updater(attachment) : attachment)),
      );
    },
    [],
  );

  const parseAttachment = useCallback(
    async (id: string, file: File) => {
      stopWorker(id);
      updateAttachment(id, (item) => ({ ...item, state: { status: 'parsing', progress: 5 } }));

      try {
        const buffer = await file.arrayBuffer();
        const worker = createFitWorker();
        workers.current.set(id, worker);

        worker.onmessage = (event) => {
          const response = event.data;
          if (response.type === 'progress') {
            updateAttachment(id, (item) => ({
              ...item,
              state: { status: 'parsing', progress: response.progress },
            }));
            return;
          }
          if (response.type === 'parsed') {
            updateAttachment(id, (item) => ({
              ...item,
              state: { status: 'parsed', result: response.result },
            }));
          }
          if (response.type === 'error') {
            updateAttachment(id, (item) => ({
              ...item,
              state: { status: 'error', error: response.error },
            }));
          }
          stopWorker(id);
        };

        worker.onerror = () => {
          updateAttachment(id, (item) => ({
            ...item,
            state: {
              status: 'error',
              error: {
                code: 'worker_failed',
                message: 'The local parsing worker stopped unexpectedly.',
              },
            },
          }));
          stopWorker(id);
        };

        worker.postMessage(
          {
            id,
            type: 'parse',
            buffer,
            file: { name: file.name, size: file.size, lastModified: file.lastModified },
          },
          [buffer],
        );
      } catch (cause) {
        const error: FitParseError = {
          code: 'read_failed',
          message: cause instanceof Error ? cause.message : 'The file could not be read.',
        };
        updateAttachment(id, (item) => ({ ...item, state: { status: 'error', error } }));
      }
    },
    [stopWorker, updateAttachment],
  );

  const addFiles = useCallback(
    (files: File[]) => {
      const created = files
        .filter((file) => file.name.toLowerCase().endsWith('.fit'))
        .map((file) => ({
          id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
          file,
          state: { status: 'idle' } as const,
        }));

      setAttachments((current) => [...current, ...created]);
      if (created[0]) setSelectedId((current) => current ?? created[0].id);
      created.forEach((attachment) => {
        void parseAttachment(attachment.id, attachment.file);
      });
    },
    [parseAttachment],
  );

  const removeAttachment = useCallback(
    (id: string) => {
      [id, `repair-${id}`, `export-${id}`].forEach(stopWorker);
      setAttachments((current) => {
        const remaining = current.filter((attachment) => attachment.id !== id);
        if (selectedId === id) setSelectedId(remaining[0]?.id);
        return remaining;
      });
      setRepairStates((current) => withoutKey(current, id));
      setFitExportStates((current) => withoutKey(current, id));
      setCorrectedStartTimes((current) => withoutKey(current, id));
    },
    [selectedId, stopWorker],
  );

  const selectAttachment = useCallback((id: string) => {
    setSelectedId(id);
    setActiveTab('summary');
  }, []);

  const retryAttachment = useCallback(
    (id: string) => {
      const attachment = attachments.find((item) => item.id === id);
      if (attachment) void parseAttachment(id, attachment.file);
    },
    [attachments, parseAttachment],
  );

  const selected = attachments.find((attachment) => attachment.id === selectedId);
  const result = selected?.state.status === 'parsed' ? selected.state.result : undefined;
  const repairState = selectedId
    ? (repairStates[selectedId] ?? INITIAL_REPAIR_STATE)
    : INITIAL_REPAIR_STATE;
  const fitExportState = selectedId
    ? (fitExportStates[selectedId] ?? INITIAL_EXPORT_STATE)
    : INITIAL_EXPORT_STATE;
  const correctedStartTime = selectedId ? correctedStartTimes[selectedId] : undefined;

  const setCorrectedStartTime = useCallback(
    (value: string | undefined) => {
      if (!selectedId) return;
      setCorrectedStartTimes((current) => ({ ...current, [selectedId]: value }));
    },
    [selectedId],
  );

  const setRepairState = useCallback(
    (state: RepairState) => {
      if (!selectedId) return;
      setRepairStates((current) => ({ ...current, [selectedId]: state }));
    },
    [selectedId],
  );

  const calculateRepairs = useCallback(() => {
    if (!selectedId || !result) return;
    const eligibility = validateRepairEligibility(result.normalized);
    if (!eligibility.eligible) {
      showToast(eligibility.reason);
      setRepairState(INITIAL_REPAIR_STATE);
      return;
    }

    setRepairState({ status: 'calculating' });
    const key = `repair-${selectedId}`;
    const worker = createFitWorker();
    workers.current.set(key, worker);
    worker.onmessage = (event) => {
      if (event.data.type === 'repaired') {
        setRepairState({ status: 'ready', candidates: event.data.candidates });
      }
      if (event.data.type === 'error') {
        showToast(event.data.error.message);
        setRepairState(INITIAL_REPAIR_STATE);
      }
      stopWorker(key);
    };
    worker.postMessage({ id: selectedId, type: 'repair', activity: result.normalized });
  }, [result, selectedId, setRepairState, showToast, stopWorker]);

  const applyCandidate = useCallback(
    (candidate: RepairCandidate) => {
      if (!result) return;
      const applied = applyRepairPatch(
        result.file.name,
        result.normalized,
        candidate,
        undefined,
        correctedStartTime,
      );
      setRepairState({
        status: 'applied',
        ...applied,
        candidates: repairState.status === 'previewing' ? repairState.candidates : [],
      });
      if (selectedId) {
        setFitExportStates((current) => ({
          ...current,
          [selectedId]: INITIAL_EXPORT_STATE,
        }));
      }
    },
    [correctedStartTime, repairState, result, selectedId, setRepairState],
  );

  const exportFit = useCallback(async () => {
    if (!selectedId || !selected || repairState.status !== 'applied') return;
    const key = `export-${selectedId}`;
    setFitExportStates((current) => ({
      ...current,
      [selectedId]: { status: 'exporting' },
    }));

    try {
      const buffer = await selected.file.arrayBuffer();
      const worker = createFitWorker();
      workers.current.set(key, worker);
      worker.onmessage = (event) => {
        if (event.data.type === 'fit-exported') {
          const baseName = selected.file.name.replace(/\.fit$/i, '');
          downloadBlob(
            `${baseName}.repaired.fit`,
            new Blob([event.data.buffer], { type: 'application/octet-stream' }),
          );
          setFitExportStates((current) => ({
            ...current,
            [selectedId]: { status: 'success', report: event.data.report },
          }));
          showToast(t('toast.fitDownloaded'));
        } else if (event.data.type === 'error') {
          setFitExportStates((current) => ({
            ...current,
            [selectedId]: { status: 'error', message: event.data.error.message },
          }));
        }
        stopWorker(key);
      };
      worker.onerror = () => {
        setFitExportStates((current) => ({
          ...current,
          [selectedId]: { status: 'error', message: 'The local FIT encoder stopped unexpectedly.' },
        }));
        stopWorker(key);
      };
      worker.postMessage({ id: selectedId, type: 'export-fit', buffer, patch: repairState.patch }, [
        buffer,
      ]);
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : 'The original FIT file could not be read for export.';
      setFitExportStates((current) => ({
        ...current,
        [selectedId]: { status: 'error', message },
      }));
    }
  }, [repairState, selected, selectedId, showToast, stopWorker, t]);

  return {
    activeTab,
    addFiles,
    applyCandidate,
    attachments,
    calculateRepairs,
    correctedStartTime,
    exportFit,
    fitExportState,
    removeAttachment,
    repairState,
    result,
    retryAttachment,
    selected,
    selectedId,
    selectAttachment,
    setActiveTab,
    setCorrectedStartTime,
    setRepairState,
  };
}

export type FitWorkbenchController = ReturnType<typeof useFitWorkbench>;
