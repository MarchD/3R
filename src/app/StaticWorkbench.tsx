import { useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { EmptyState } from '../components/AppMain/EmptyState';
import { FileDropzone } from '../components/FileDropzone/FileDropzone';
import { Workbench } from '../components/Workbench/Workbench';
import { useToast } from '../contexts/ToastContext';
import { useTheme } from '../contexts/ThemeContext';
import { useFitWorkbench } from '../hooks/useFitWorkbench';
import { useLanguage, type Language } from '../i18n/LanguageContext';

function StaticShellControls() {
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const themeButton = document.getElementById('theme-toggle');
    const languageSelect = document.getElementById('language') as HTMLSelectElement | null;
    const changeLanguage = () => setLanguage(languageSelect?.value as Language);

    themeButton?.addEventListener('click', toggleTheme);
    languageSelect?.addEventListener('change', changeLanguage);
    return () => {
      themeButton?.removeEventListener('click', toggleTheme);
      languageSelect?.removeEventListener('change', changeLanguage);
    };
  }, [setLanguage, toggleTheme]);

  useEffect(() => {
    for (const element of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
      const key = element.dataset.i18n;
      if (key) element.textContent = t(key);
    }
    const lines = t('hero.title').split('\n');
    for (const [index, element] of document
      .querySelectorAll<HTMLElement>('[data-hero-line]')
      .entries()) {
      element.textContent = lines[index] ?? '';
    }
    const languageSelect = document.getElementById('language') as HTMLSelectElement | null;
    if (languageSelect) {
      languageSelect.value = language;
      languageSelect.setAttribute('aria-label', t('language.label'));
    }
  }, [language, t]);

  useEffect(() => {
    document
      .getElementById('theme-toggle')
      ?.setAttribute(
        'aria-label',
        theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
      );
  }, [theme]);

  return null;
}

export function StaticWorkbench() {
  const workbench = useFitWorkbench();
  const { showToast } = useToast();
  const workspace = document.getElementById('workspace-root');

  useLayoutEffect(() => {
    document.getElementById('static-empty-state')?.remove();
  }, []);

  return (
    <>
      <StaticShellControls />
      <FileDropzone onFiles={workbench.addFiles} onRejected={showToast} />
      {workspace &&
        createPortal(
          workbench.attachments.length > 0 ? <Workbench workbench={workbench} /> : <EmptyState />,
          workspace,
        )}
    </>
  );
}
