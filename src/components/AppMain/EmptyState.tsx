import { useLanguage } from '../../i18n/LanguageContext';

export function EmptyState() {
  const { t } = useLanguage();

  return (
    <section className="emptyState">
      <div className="distanceRuler">
        <span>{t('empty.raw')}</span>
        <i />
        <span>{t('empty.inspect')}</span>
        <i />
        <span>{t('empty.derive')}</span>
      </div>
      <div>
        <strong>{t('empty.title')}</strong>
        <p>{t('empty.body')}</p>
      </div>
    </section>
  );
}
