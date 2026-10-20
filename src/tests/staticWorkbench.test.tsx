import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StaticWorkbench } from '../app/StaticWorkbench';
import { ThemeProvider } from '../contexts/ThemeContext';
import { ToastProvider } from '../contexts/ToastContext';
import { LanguageProvider } from '../i18n/LanguageContext';

class MockWorker {
  onmessage = null;

  onerror = null;

  postMessage = vi.fn();

  terminate = vi.fn();
}

function renderWorkbenchIsland() {
  const attachmentRoot = document.getElementById('attachment-root');
  if (!attachmentRoot) throw new Error('Missing attachment root');
  return render(
    <ThemeProvider>
      <LanguageProvider>
        <ToastProvider>
          <StaticWorkbench />
        </ToastProvider>
      </LanguageProvider>
    </ThemeProvider>,
    { container: attachmentRoot },
  );
}

describe('static shell with interactive attachment island', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <button id="theme-toggle" type="button"></button>
      <select id="language"><option value="en">English</option><option value="uk">Українська</option></select>
      <h1><span data-hero-line="0">Inspect the evidence.</span><span data-hero-line="1">Repair only by choice.</span></h1>
      <p data-i18n="hero.body">Original body</p>
      <div id="attachment-root"></div>
      <div id="workspace-root"><section id="static-empty-state">Static preview</section></div>
    `;
    vi.stubGlobal('Worker', MockWorker);
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('keeps the static controls and React upload in sync', async () => {
    renderWorkbenchIsland();
    expect(document.getElementById('static-empty-state')).toBeNull();
    expect(screen.getByText('No activity loaded')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'uk' } });
    expect(screen.getByText('Перевірте дані.')).toBeInTheDocument();
    expect(screen.getByText('Додайте файли FIT')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
    expect(document.documentElement.dataset.theme).toBe('dark');

    const file = new File([new Uint8Array([1, 2, 3])], 'test.fit', {
      type: 'application/octet-stream',
    });
    fireEvent.change(screen.getByLabelText('Вибрати файли FIT'), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText('test.fit')).toBeInTheDocument());
  });
});
