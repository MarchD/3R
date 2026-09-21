import { Activity, FileJson2, Gauge, Globe2, ListTree, ShieldCheck, Table2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivitySummary } from '../components/ActivitySummary/ActivitySummary';
import { AnomalyPanel } from '../components/AnomalyPanel/AnomalyPanel';
import { AttachmentList } from '../components/AttachmentList/AttachmentList';
import { FileDropzone } from '../components/FileDropzone/FileDropzone';
import { JsonViewer } from '../components/JsonViewer/JsonViewer';
import { GarminWorkflowGuide } from '../components/GarminWorkflowGuide/GarminWorkflowGuide';
import { RawMessagesView } from '../components/JsonViewer/RawMessagesView';
import { RecordsTable } from '../components/RecordsTable/RecordsTable';
import { RepairWizard } from '../components/RepairWizard/RepairWizard';
import type { FitExportUiState } from '../components/RepairWizard/RepairWizard';
import { applyRepairPatch } from '../fit/repair/applyRepairPatch';
import { validateRepairEligibility } from '../fit/repair/validateRepairEligibility';
import type { Attachment, FitParseError } from '../models/fit';
import type { RepairCandidate, RepairState } from '../models/repair';
import { downloadBlob } from '../utils/download';
import { useLanguage } from '../i18n/LanguageContext';

type Tab = 'summary' | 'normalized' | 'raw' | 'records' | 'issues';
const initialRepair: RepairState = { status: 'not-requested' };

export function App() {
  const { language, setLanguage, t } = useLanguage();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [repairStates, setRepairStates] = useState<Record<string, RepairState>>({});
  const [fitExportStates, setFitExportStates] = useState<Record<string, FitExportUiState>>({});
  const [toast, setToast] = useState<string>();
  const workers = useRef(new Map<string, Worker>());

  useEffect(() => () => workers.current.forEach((worker) => worker.terminate()), []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(undefined), 1800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const updateAttachment = useCallback((id: string, updater: (attachment: Attachment) => Attachment) => {
    setAttachments((current) => current.map((attachment) => attachment.id === id ? updater(attachment) : attachment));
  }, []);

  const parseAttachment = useCallback(async (id: string, file: File) => {
    workers.current.get(id)?.terminate();
    updateAttachment(id, (item) => ({ ...item, state: { status: 'parsing', progress: 5 } }));
    try {
      const buffer = await file.arrayBuffer();
      const worker = new Worker(new URL('../fit/parser/fitWorker.ts', import.meta.url), { type: 'module' });
      workers.current.set(id, worker);
      worker.onmessage = (event) => {
        const response = event.data;
        if (response.type === 'progress') updateAttachment(id, (item) => ({ ...item, state: { status: 'parsing', progress: response.progress } }));
        if (response.type === 'parsed') {
          updateAttachment(id, (item) => ({ ...item, state: { status: 'parsed', result: response.result } }));
          workers.current.delete(id);
          worker.terminate();
        }
        if (response.type === 'error') {
          updateAttachment(id, (item) => ({ ...item, state: { status: 'error', error: response.error } }));
          workers.current.delete(id);
          worker.terminate();
        }
      };
      worker.onerror = () => updateAttachment(id, (item) => ({ ...item, state: { status: 'error', error: { code: 'worker_failed', message: 'The local parsing worker stopped unexpectedly.' } } }));
      worker.postMessage({ id, type: 'parse', buffer, file: { name: file.name, size: file.size, lastModified: file.lastModified } }, [buffer]);
    } catch (cause) {
      const error: FitParseError = { code: 'read_failed', message: cause instanceof Error ? cause.message : 'The file could not be read.' };
      updateAttachment(id, (item) => ({ ...item, state: { status: 'error', error } }));
    }
  }, [updateAttachment]);

  const addFiles = useCallback((files: File[]) => {
    const fresh = files.filter((file) => file.name.toLowerCase().endsWith('.fit'));
    const created = fresh.map((file) => ({ id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`, file, state: { status: 'idle' } as const }));
    setAttachments((current) => [...current, ...created]);
    if (created[0]) setSelectedId((current) => current ?? created[0].id);
    created.forEach((attachment) => void parseAttachment(attachment.id, attachment.file));
  }, [parseAttachment]);

  const remove = (id: string) => {
    workers.current.get(id)?.terminate();
    workers.current.delete(id);
    setAttachments((current) => {
      const remaining = current.filter((attachment) => attachment.id !== id);
      if (selectedId === id) setSelectedId(remaining[0]?.id);
      return remaining;
    });
    setRepairStates((current) => { const next = { ...current }; delete next[id]; return next; });
    setFitExportStates((current) => { const next = { ...current }; delete next[id]; return next; });
  };

  const selected = attachments.find((attachment) => attachment.id === selectedId);
  const result = selected?.state.status === 'parsed' ? selected.state.result : undefined;
  const repairState = selectedId ? repairStates[selectedId] ?? initialRepair : initialRepair;
  const fitExportState: FitExportUiState = selectedId ? fitExportStates[selectedId] ?? { status: 'idle' } : { status: 'idle' };
  const setRepairState = (state: RepairState) => selectedId && setRepairStates((current) => ({ ...current, [selectedId]: state }));

  const calculateRepairs = () => {
    if (!selectedId || !result) return;
    const eligibility = validateRepairEligibility(result.normalized);
    if (!eligibility.eligible) {
      setToast(eligibility.reason);
      setRepairState({ status: 'not-requested' });
      return;
    }
    setRepairState({ status: 'calculating' });
    const key = `repair-${selectedId}`;
    const worker = new Worker(new URL('../fit/parser/fitWorker.ts', import.meta.url), { type: 'module' });
    workers.current.set(key, worker);
    worker.onmessage = (event) => {
      if (event.data.type === 'repaired') setRepairState({ status: 'ready', candidates: event.data.candidates });
      if (event.data.type === 'error') {
        setToast(event.data.error.message);
        setRepairState({ status: 'not-requested' });
      }
      workers.current.delete(key);
      worker.terminate();
    };
    worker.postMessage({ id: selectedId, type: 'repair', activity: result.normalized });
  };

  const applyCandidate = (candidate: RepairCandidate) => {
    if (!result) return;
    const applied = applyRepairPatch(result.file.name, result.normalized, candidate);
    setRepairState({ status: 'applied', ...applied, candidates: repairState.status === 'previewing' ? repairState.candidates : [] });
    if (selectedId) setFitExportStates((current) => ({ ...current, [selectedId]: { status: 'idle' } }));
  };

  const exportFit = async () => {
    if (!selectedId || !selected || repairState.status !== 'applied') return;
    const key = `export-${selectedId}`;
    setFitExportStates((current) => ({ ...current, [selectedId]: { status: 'exporting' } }));
    try {
      const buffer = await selected.file.arrayBuffer();
      const worker = new Worker(new URL('../fit/parser/fitWorker.ts', import.meta.url), { type: 'module' });
      workers.current.set(key, worker);
      worker.onmessage = (event) => {
        if (event.data.type === 'fit-exported') {
          const baseName = selected.file.name.replace(/\.fit$/i, '');
          downloadBlob(`${baseName}.repaired.fit`, new Blob([event.data.buffer], { type: 'application/octet-stream' }));
          setFitExportStates((current) => ({ ...current, [selectedId]: { status: 'success', report: event.data.report } }));
          setToast(t('toast.fitDownloaded'));
        } else if (event.data.type === 'error') {
          setFitExportStates((current) => ({ ...current, [selectedId]: { status: 'error', message: event.data.error.message } }));
        }
        workers.current.delete(key);
        worker.terminate();
      };
      worker.onerror = () => {
        setFitExportStates((current) => ({ ...current, [selectedId]: { status: 'error', message: 'The local FIT encoder stopped unexpectedly.' } }));
        workers.current.delete(key);
        worker.terminate();
      };
      worker.postMessage({ id: selectedId, type: 'export-fit', buffer, patch: repairState.patch }, [buffer]);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'The original FIT file could not be read for export.';
      setFitExportStates((current) => ({ ...current, [selectedId]: { status: 'error', message } }));
    }
  };

  const content = useMemo(() => {
    if (!result) return null;
    if (activeTab === 'summary') return <ActivitySummary result={result} />;
    if (activeTab === 'normalized') return <JsonViewer value={result.normalized} filename="activity.normalized.json" label={t('tab.normalized')} onCopied={() => setToast(t('toast.copied'))} />;
    if (activeTab === 'raw') return <RawMessagesView messages={result.raw.messages} onCopied={() => setToast(t('toast.copied'))} />;
    if (activeTab === 'records') return <RecordsTable records={result.normalized.records} />;
    return <AnomalyPanel anomalies={result.anomalies} />;
  }, [activeTab, result, t]);

  const tabs: { id: Tab; label: string; icon: typeof Gauge }[] = [
    { id: 'summary', label: t('tab.summary'), icon: Gauge },
    { id: 'normalized', label: t('tab.normalized'), icon: FileJson2 },
    { id: 'raw', label: t('tab.raw'), icon: ListTree },
    { id: 'records', label: t('tab.records'), icon: Table2 },
    { id: 'issues', label: t('tab.issues'), icon: ShieldCheck },
  ];

  return (
    <div className="appShell">
      <header className="appHeader"><div className="brand"><span><Activity size={21} /></span><div><strong>3R</strong><small>{t('app.subtitle')}</small></div></div><div className="headerActions"><div className="privacy"><ShieldCheck size={16} /> {t('app.privacy')}</div><label className="languagePicker"><Globe2 size={15} aria-hidden="true" /><span className="srOnly">{t('language.label')}</span><select aria-label={t('language.label')} value={language} onChange={(event) => setLanguage(event.target.value as 'en' | 'uk')}><option value="en">English</option><option value="uk">Українська</option></select></label></div></header>
      <main>
        <section className="uploadSection"><div className="sectionIntro"><h1>{t('hero.title').split('\n').map((line, index) => <span key={line}>{line}{index === 0 && <br />}</span>)}</h1><p>{t('hero.body')}</p></div><FileDropzone onFiles={addFiles} onRejected={setToast} /></section>
        {attachments.length > 0 && <div className="workbench"><aside><div className="asideHeading"><strong>{t('attachments.title')}</strong><span>{attachments.length}</span></div><AttachmentList attachments={attachments} selectedId={selectedId} onSelect={(id) => { setSelectedId(id); setActiveTab('summary'); }} onRemove={remove} onRetry={(id) => { const item = attachments.find((attachment) => attachment.id === id); if (item) void parseAttachment(id, item.file); }} /></aside><section className="workspace">
          {!selected && <div className="emptyPanel">{t('workspace.select')}</div>}
          {selected?.state.status === 'parsing' && <div className="loadingPanel" aria-live="polite"><span className="spinner" /><strong>{t('workspace.parsing')}</strong><p>{t('workspace.parsingBody')}</p></div>}
          {selected?.state.status === 'error' && <div className="errorPanel" aria-live="assertive"><strong>{t('workspace.decodeError')}</strong><p>{selected.state.error.message}</p><button className="button secondary" onClick={() => void parseAttachment(selected.id, selected.file)}>{t('workspace.retry')}</button></div>}
          {result && <><div className="fileHeading"><div><span>{t('workspace.selected')}</span><h2>{result.file.name}</h2></div><div className={`statusPill ${result.integrity.complete ? 'complete' : 'partial'}`}>{result.integrity.complete ? t('workspace.complete') : t('workspace.partial')}</div></div><nav className="tabs" aria-label={t('workspace.views')}>{tabs.map(({ id, label, icon: Icon }) => <button key={id} className={activeTab === id ? 'active' : ''} onClick={() => setActiveTab(id)}><Icon size={16} />{label}{id === 'issues' && result.anomalies.length > 0 && <span>{result.anomalies.length}</span>}</button>)}</nav><div className="tabContent">{content}</div><RepairWizard result={result} state={repairState} onState={setRepairState} onCalculate={calculateRepairs} onApply={applyCandidate} fitExportState={fitExportState} onExportFit={() => void exportFit()} onCopied={() => setToast(t('toast.copied'))} /></>}
        </section></div>}
        {!attachments.length && <section className="emptyState"><div className="distanceRuler"><span>{t('empty.raw')}</span><i /><span>{t('empty.inspect')}</span><i /><span>{t('empty.derive')}</span></div><div><strong>{t('empty.title')}</strong><p>{t('empty.body')}</p></div></section>}
        <GarminWorkflowGuide />
      </main>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
