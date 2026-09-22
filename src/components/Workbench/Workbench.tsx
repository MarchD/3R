import { FileJson2, Gauge, ListTree, ShieldCheck, Table2 } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { useToast } from '../../contexts/ToastContext';
import type { FitWorkbenchController, WorkbenchTab } from '../../hooks/useFitWorkbench';
import { useLanguage } from '../../i18n/LanguageContext';
import { ActivitySummary } from '../ActivitySummary/ActivitySummary';
import { AnomalyPanel } from '../AnomalyPanel/AnomalyPanel';
import { AttachmentList } from '../AttachmentList/AttachmentList';
import { JsonViewer } from '../JsonViewer/JsonViewer';
import { RawMessagesView } from '../JsonViewer/RawMessagesView';
import { RecordsTable } from '../RecordsTable/RecordsTable';
import { RepairWizard } from '../RepairWizard/RepairWizard';
import { StartTimeRepair } from '../StartTimeRepair/StartTimeRepair';

export function Workbench({ workbench }: { workbench: FitWorkbenchController }) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const {
    activeTab,
    applyCandidate,
    applyStartTime,
    attachments,
    calculateRepairs,
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
    setRepairState,
  } = workbench;

  const content = useMemo(() => {
    if (!result) return null;
    const onCopied = () => showToast(t('toast.copied'));
    const views = {
      summary: <ActivitySummary result={result} />,
      normalized: (
        <JsonViewer
          value={result.normalized}
          filename="activity.normalized.json"
          label={t('tab.normalized')}
          onCopied={onCopied}
        />
      ),
      raw: <RawMessagesView messages={result.raw.messages} onCopied={onCopied} />,
      records: <RecordsTable records={result.normalized.records} />,
      issues: <AnomalyPanel anomalies={result.anomalies} />,
    } satisfies Record<WorkbenchTab, ReactNode>;
    return views[activeTab];
  }, [activeTab, result, showToast, t]);

  const tabs: { id: WorkbenchTab; label: string; icon: typeof Gauge }[] = [
    { id: 'summary', label: t('tab.summary'), icon: Gauge },
    { id: 'normalized', label: t('tab.normalized'), icon: FileJson2 },
    { id: 'raw', label: t('tab.raw'), icon: ListTree },
    { id: 'records', label: t('tab.records'), icon: Table2 },
    { id: 'issues', label: t('tab.issues'), icon: ShieldCheck },
  ];

  return (
    <div className="workbench">
      <aside>
        <div className="asideHeading">
          <strong>{t('attachments.title')}</strong>
          <span>{attachments.length}</span>
        </div>
        <AttachmentList
          attachments={attachments}
          selectedId={selectedId}
          onSelect={selectAttachment}
          onRemove={removeAttachment}
          onRetry={retryAttachment}
        />
      </aside>
      <section className="workspace">
        {!selected && <div className="emptyPanel">{t('workspace.select')}</div>}
        {selected?.state.status === 'parsing' && (
          <div className="loadingPanel" aria-live="polite">
            <span className="spinner" />
            <strong>{t('workspace.parsing')}</strong>
            <p>{t('workspace.parsingBody')}</p>
          </div>
        )}
        {selected?.state.status === 'error' && (
          <div className="errorPanel" aria-live="assertive">
            <strong>{t('workspace.decodeError')}</strong>
            <p>{selected.state.error.message}</p>
            <button
              type="button"
              className="button secondary"
              onClick={() => retryAttachment(selected.id)}
            >
              {t('workspace.retry')}
            </button>
          </div>
        )}
        {result && (
          <>
            <div className="fileHeading">
              <div>
                <span>{t('workspace.selected')}</span>
                <h2>{result.file.name}</h2>
              </div>
              <div className={`statusPill ${result.integrity.complete ? 'complete' : 'partial'}`}>
                {result.integrity.complete ? t('workspace.complete') : t('workspace.partial')}
              </div>
            </div>
            <nav className="tabs" aria-label={t('workspace.views')}>
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  type="button"
                  key={id}
                  className={activeTab === id ? 'active' : ''}
                  onClick={() => setActiveTab(id)}
                >
                  <Icon size={16} />
                  {label}
                  {id === 'issues' && result.anomalies.length > 0 && (
                    <span>{result.anomalies.length}</span>
                  )}
                </button>
              ))}
            </nav>
            <div className="tabContent">{content}</div>
            {repairState.status === 'not-requested' && (
              <StartTimeRepair result={result} onApply={applyStartTime} />
            )}
            <RepairWizard
              result={result}
              state={repairState}
              onState={setRepairState}
              onCalculate={calculateRepairs}
              onApply={applyCandidate}
              fitExportState={fitExportState}
              onExportFit={() => {
                void exportFit();
              }}
              onCopied={() => showToast(t('toast.copied'))}
            />
          </>
        )}
      </section>
    </div>
  );
}
