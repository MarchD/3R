import { Activity, Globe2, Moon, ShieldCheck, Sun } from 'lucide-react';
import { useLanguage, type Language } from '../../i18n/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';

export function AppHeader() {
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();

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
        <button
          type="button"
          className="themeToggle"
          onClick={toggleTheme}
          aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </div>
    </header>
  );
}
