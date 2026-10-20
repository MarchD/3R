import { Globe2, Moon, ShieldCheck, Sun } from 'lucide-react';
import { useLanguage, type Language } from '../../i18n/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';

const homeUrl = import.meta.env.BASE_URL;

export function AppHeader() {
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="appHeader">
      <a className="brand" href={homeUrl} aria-label="3R home">
        <span aria-hidden="true">
          <img src={`${homeUrl}favicon.svg`} alt="" width="24" height="24" />
        </span>
        <div>
          <strong>3R</strong>
          <small>{t('app.subtitle')}</small>
        </div>
      </a>
      <div className="headerActions">
        <div className="privacy">
          <ShieldCheck size={16} /> {t('app.privacy')}
        </div>
        <button
          type="button"
          className="themeToggle"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
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
