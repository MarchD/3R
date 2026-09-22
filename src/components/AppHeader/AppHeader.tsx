import { Activity, Globe2, ShieldCheck } from 'lucide-react';
import { useLanguage, type Language } from '../../i18n/LanguageContext';

export function AppHeader() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <header className="appHeader">
      <div className="brand">
        <span>
          <Activity size={21} />
        </span>
        <div>
          <strong>3R</strong>
          <small>{t('app.subtitle')}</small>
        </div>
      </div>
      <div className="headerActions">
        <div className="privacy">
          <ShieldCheck size={16} /> {t('app.privacy')}
        </div>
        <label className="languagePicker" htmlFor="language">
          <Globe2 size={15} aria-hidden="true" />
          <span className="srOnly">{t('language.label')}</span>
          <select
            id="language"
            aria-label={t('language.label')}
            value={language}
            onChange={(event) => setLanguage(event.target.value as Language)}
          >
            <option value="en">English</option>
            <option value="uk">Українська</option>
          </select>
        </label>
      </div>
    </header>
  );
}
