import { useToast } from '../../contexts/ToastContext';
import type { FitWorkbenchController } from '../../hooks/useFitWorkbench';
import { GarminWorkflowGuide } from '../GarminWorkflowGuide/GarminWorkflowGuide';
import { Workbench } from '../Workbench/Workbench';
import { EmptyState } from './EmptyState';
import { UploadSection } from './UploadSection';

export function AppMain({ workbench }: { workbench: FitWorkbenchController }) {
  const { showToast } = useToast();
  const hasAttachments = workbench.attachments.length > 0;

  return (
    <main>
      <UploadSection onFiles={workbench.addFiles} onRejected={showToast} />
      {hasAttachments ? <Workbench workbench={workbench} /> : <EmptyState />}
      <GarminWorkflowGuide />
    </main>
  );
}
