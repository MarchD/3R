import { CheckCircle2, CircleAlert, LoaderCircle, RotateCw, Trash2 } from 'lucide-react';
import type { Attachment } from '../../models/fit';
import { useLanguage } from '../../i18n/LanguageContext';

interface Props {
  attachments: Attachment[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}

const size = (bytes: number) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function AttachmentList({ attachments, selectedId, onSelect, onRemove, onRetry }: Props) {
  const { t } = useLanguage();
  return (
    <div className="attachmentList" aria-label={t('attachments.label')}>
      {attachments.map((attachment) => {
        const { state } = attachment;
        const Icon = state.status === 'parsed' ? CheckCircle2 : state.status === 'error' ? CircleAlert : LoaderCircle;
        const details = state.status === 'parsed'
          ? t('attachments.records', { records: state.result.normalized.records.length.toLocaleString(), messages: state.result.raw.messages.length.toLocaleString() })
          : state.status === 'error' ? state.error.message : state.status === 'parsing' ? `${t('attachments.parsing')}${state.progress ? ` ${state.progress}%` : '…'}` : t('attachments.queued');
        return (
          <div className={`attachment ${selectedId === attachment.id ? 'selected' : ''}`} key={attachment.id}>
            <button className="attachmentMain" type="button" onClick={() => onSelect(attachment.id)}>
              <Icon className={state.status === 'parsing' ? 'spin' : ''} size={17} aria-hidden="true" />
              <span><strong>{attachment.file.name}</strong><small>{size(attachment.file.size)} · {details}</small></span>
            </button>
            <div className="attachmentActions">
              {state.status === 'error' && <button aria-label={t('attachments.retry', { file: attachment.file.name })} onClick={() => onRetry(attachment.id)}><RotateCw size={15} /></button>}
              <button aria-label={t('attachments.remove', { file: attachment.file.name })} onClick={() => onRemove(attachment.id)}><Trash2 size={15} /></button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
