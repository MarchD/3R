import { useLanguage } from '../../i18n/LanguageContext';
import { FileDropzone } from '../FileDropzone/FileDropzone';

interface Props {
  onFiles: (files: File[]) => void;
  onRejected: (message: string) => void;
}

export function UploadSection({ onFiles, onRejected }: Props) {
  const { t } = useLanguage();

  return (
    <section className="uploadSection">
      <div className="sectionIntro">
        <h1>
          {t('hero.title')
            .split('\n')
            .map((line, index) => (
              <span key={line}>
                {line}
                {index === 0 && <br />}
              </span>
            ))}
        </h1>
        <p>{t('hero.body')}</p>
      </div>
      <FileDropzone onFiles={onFiles} onRejected={onRejected} />
    </section>
  );
}
