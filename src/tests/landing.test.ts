import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const landingHtml = readFileSync(resolve('index.html'), 'utf8');

describe('search-readable workbench shell', () => {
  it('contains the first screen before React starts', () => {
    expect(landingHtml).toContain('class="appHeader"');
    expect(landingHtml).toContain('class="uploadSection"');
    expect(landingHtml).toContain('Inspect the evidence.');
    expect(landingHtml).toContain('id="attachment-root"');
    expect(landingHtml).toContain('id="workspace-root"');
    expect(landingHtml).toContain('class="garminGuide"');
    expect(landingHtml).toContain('/src/main.tsx');
  });
});
