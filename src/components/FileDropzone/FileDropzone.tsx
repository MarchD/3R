import { FileUp } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

interface Props {
  onFiles: (files: File[]) => void;
  onRejected: (message: string) => void;
}

export function FileDropzone({ onFiles, onRejected }: Props) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/octet-stream': ['.fit'] },
    multiple: true,
    onDropAccepted: onFiles,
    onDropRejected: () => onRejected('Only non-empty .fit files can be attached.'),
    validator: (file) => file.size === 0 ? { code: 'empty-file', message: 'The file is empty.' } : null,
  });
  return (
    <div {...getRootProps({ className: `dropzone ${isDragActive ? 'dropzoneActive' : ''}` })}>
      <input {...getInputProps()} aria-label="Choose FIT files" />
      <FileUp size={24} aria-hidden="true" />
      <div>
        <strong>{isDragActive ? 'Drop FIT files here' : 'Attach FIT files'}</strong>
        <span>Drop files here or choose from your device</span>
      </div>
      <button type="button" className="button secondary" tabIndex={-1}>Choose files</button>
    </div>
  );
}
