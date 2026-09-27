import { FileJson2, Gauge, ListTree, MapPinned, Ruler, ShieldCheck, Table2 } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useToast } from '../../contexts/ToastContext';
import type {
  DistanceMode,
  FitWorkbenchController,
  WorkbenchTab,
} from '../../hooks/useFitWorkbench';
import { sportLabel, useLanguage } from '../../i18n/LanguageContext';
import { validateRepairEligibility } from '../../fit/repair/validateRepairEligibility';
import { isAlphaVersion } from '../../utils/appVersion';
import { ActivitySummary } from '../ActivitySummary/ActivitySummary';
import { AlphaGpsRepair } from '../AlphaGpsRepair/AlphaGpsRepair';
import { AnomalyPanel } from '../AnomalyPanel/AnomalyPanel';
import { AttachmentList } from '../AttachmentList/AttachmentList';
import { JsonViewer } from '../JsonViewer/JsonViewer';
import { RawMessagesView } from '../JsonViewer/RawMessagesView';
import { RecordsTable } from '../RecordsTable/RecordsTable';
import { RepairWizard } from '../RepairWizard/RepairWizard';
import { StartTimeRepair } from '../StartTimeRepair/StartTimeRepair';

export function Workbench({ workbench }: { workbench: FitWorkbenchController }) {
  const { language, t } = useLanguage();
  const { showToast } = useToast();
  const {
    activeTab,
    applyCandidate,
    applyGpsProposal,
    applyTimeOnly,
    attachments,
    calculateRepairs,
    correctedStartTime,
    distanceMode,
    exportFit,
    fitExportState,
    removeAttachment,
    returnToRepair,
    repairState,
    result,
    retryAttachment,
    selected,
    selectedId,
    selectAttachment,
    setActiveTab,
    setCorrectedStartTime,
    setDistanceMode,
    setRepairState,
    skipDistanceRepair,
  } = workbench;
  const alphaVersion = isAlphaVersion();
  const [mapOpen, setMapOpen] = useState(false);
  const eligibility = result ? validateRepairEligibility(result.normalized) : undefined;
  let distanceUnavailableReason: string | undefined;
  if (eligibility && !eligibility.eligible) {
    if (eligibility.detectedSport !== 'running') {
      distanceUnavailableReason = t('repair.runningOnly', {
        sport: sportLabel(eligibility.detectedSport, language),
      });
    } else if (!result?.normalized.session) {
      distanceUnavailableReason = t('repair.needsSession');
    } else {
      distanceUnavailableReason = t('repair.needsRecords');
    }
  }
  const settingsVisible =
    repairState.status === 'not-requested' ||
    repairState.status === 'calculating' ||
    repairState.status === 'ready';
  const selectedDistanceCandidate =
    repairState.status === 'ready'
      ? repairState.candidates.find((candidate) => candidate.id === repairState.selectedCandidateId)
      : undefined;

  const chooseDistanceMode = (mode: DistanceMode) => {
    if (mode === distanceMode) return;
    setDistanceMode(mode);
    if (mode === 'recalculate') calculateRepairs();
    else skipDistanceRepair();
  };

  useEffect(() => setMapOpen(false), [selectedId]);

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

  const repairWizard = result && (
    <RepairWizard
      result={result}
      state={repairState}
      onState={setRepairState}
      onApply={applyCandidate}
      onKeepDistance={() => chooseDistanceMode('keep')}
      correctedStartTime={correctedStartTime}
      fitExportState={fitExportState}
      onExportFit={() => {
        exportFit();
      }}
      onCopied={() => showToast(t('toast.copied'))}
      onBack={returnToRepair}
    />
  );

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
            <div className="repairSettings" hidden={!settingsVisible}>
              <StartTimeRepair result={result} onChange={setCorrectedStartTime} />
              <section className="distanceSettings" aria-labelledby="distance-settings-title">
                <div className="distanceSettingsHeading">
                  <Ruler size={18} aria-hidden="true" />
                  <div>
                    <h3 id="distance-settings-title">{t('repair.distanceSection')}</h3>
                    <p>{t('repair.distanceSectionBody')}</p>
                  </div>
                </div>
                <div
                  className="distanceChoices"
                  role="radiogroup"
                  aria-label={t('repair.distanceSection')}
                >
                  <label
                    className={distanceMode === 'keep' ? 'selected' : ''}
                    htmlFor="distance-mode-keep"
                  >
                    <input
                      id="distance-mode-keep"
                      type="radio"
                      name={`distance-mode-${selectedId}`}
                      checked={distanceMode === 'keep'}
                      onChange={() => chooseDistanceMode('keep')}
                    />
                    <span>
                      <strong>{t('repair.keepDistance')}</strong>
                      <small>{t('repair.keepDistanceBody')}</small>
                    </span>
                  </label>
                  <label
                    className={distanceMode === 'recalculate' ? 'selected' : ''}
                    htmlFor="distance-mode-recalculate"
                  >
                    <input
                      id="distance-mode-recalculate"
                      type="radio"
                      name={`distance-mode-${selectedId}`}
                      checked={distanceMode === 'recalculate'}
                      disabled={!eligibility?.eligible}
                      onChange={() => chooseDistanceMode('recalculate')}
                    />
                    <span>
                      <strong>{t('repair.recalculateDistance')}</strong>
                      <small>{t('repair.recalculateDistanceBody')}</small>
                    </span>
                  </label>
                </div>
                {distanceUnavailableReason && (
                  <p className="distanceUnavailable">{distanceUnavailableReason}</p>
                )}
                {distanceMode === 'recalculate' &&
                  (repairState.status === 'calculating' || repairState.status === 'ready') &&
                  repairWizard}
                {distanceMode === 'keep' && correctedStartTime && (
                  <div className="distanceSettingsAction">
                    <span>{t('repair.timeOnlyBody')}</span>
                    <button type="button" className="button primary" onClick={applyTimeOnly}>
                      {t('repair.applyTime')}
                    </button>
                  </div>
                )}
              </section>
              {!mapOpen && (
                <section className="mapRepairEntry" aria-labelledby="map-settings-title">
                  <div className="mapSettingsHeading">
                    <MapPinned size={18} aria-hidden="true" />
                    <div>
                      <h3 id="map-settings-title">{t('alphaGps.mapEntryTitle')}</h3>
                      <p>{t('alphaGps.mapEntryBody')}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => setMapOpen(true)}
                  >
                    {t('alphaGps.updateMap')}
                  </button>
                </section>
              )}
              {mapOpen && (
                <AlphaGpsRepair
                  result={result}
                  onApply={applyGpsProposal}
                  active={settingsVisible}
                  allowSuggestions={alphaVersion}
                  preserveDistance={distanceMode === 'keep'}
                  selectedDistanceCandidate={selectedDistanceCandidate}
                  onClose={() => setMapOpen(false)}
                />
              )}
            </div>
            {(repairState.status === 'previewing' || repairState.status === 'applied') &&
              repairWizard}
          </>
        )}
      </section>
    </div>
  );
}
