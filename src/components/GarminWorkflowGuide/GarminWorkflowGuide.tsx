import { Download, ExternalLink, Upload, Wrench } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

const EXPORT_FAQ = 'https://support.garmin.com/en-US/?faq=W1TvTPW8JZ6LfJSfK512Q8';
const IMPORT_FAQ = 'https://support.garmin.com/en-US/?faq=Ht3ZP52Kju075uKvqTqu99';

export function GarminWorkflowGuide() {
  const { t } = useLanguage();
  return (
    <section className="garminGuide" aria-labelledby="garmin-guide-title">
      <div className="guideHeading">
        <div>
          <h2 id="garmin-guide-title">{t('guide.title')}</h2>
          <p>{t('guide.body')}</p>
        </div>
        <span>{t('guide.badge')}</span>
      </div>
      <ol className="guideSteps">
        <li>
          <span>
            <Download size={18} />
          </span>
          <div>
            <strong>{t('guide.downloadTitle')}</strong>
            <p>{t('guide.downloadBody')}</p>
            <a href={EXPORT_FAQ} target="_blank" rel="noreferrer">
              {t('guide.exportLink')} <ExternalLink size={13} />
            </a>
          </div>
        </li>
        <li>
          <span>
            <Wrench size={18} />
          </span>
          <div>
            <strong>{t('guide.repairTitle')}</strong>
            <p>{t('guide.repairBody')}</p>
          </div>
        </li>
        <li>
          <span>
            <Upload size={18} />
          </span>
          <div>
            <strong>{t('guide.uploadTitle')}</strong>
            <p>{t('guide.uploadBody')}</p>
            <a href={IMPORT_FAQ} target="_blank" rel="noreferrer">
              {t('guide.importLink')} <ExternalLink size={13} />
            </a>
          </div>
        </li>
      </ol>
    </section>
  );
}
