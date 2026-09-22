import { FileUp } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { useLanguage } from '../../i18n/LanguageContext';

interface Props {
  onFiles: (files: File[]) => void;
  onRejected: (message: string) => void;
}

export function FileDropzone({ onFiles, onRejected }: Props) {
  const { t } = useLanguage();
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/octet-stream': ['.fit'] },
    multiple: true,
    onDropAccepted: onFiles,
    onDropRejected: () => onRejected(t('drop.rejected')),
    validator: (file) =>
      file.size === 0 ? { code: 'empty-file', message: 'The file is empty.' } : null,
  });
  return (
    <div {...getRootProps({ className: `dropzone ${isDragActive ? 'dropzoneActive' : ''}` })}>
      <input {...getInputProps()} aria-label={t('drop.chooseLabel')} />
      <FileUp size={24} aria-hidden="true" />
      <div>
        <strong>{isDragActive ? t('drop.active') : t('drop.title')}</strong>
        <span>{t('drop.body')}</span>
      </div>
      <button type="button" className="button secondary" tabIndex={-1}>
        {t('drop.choose')}
      </button>
    </div>
  );
}
