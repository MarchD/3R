import { safeStringify } from './json';

export function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([safeStringify(value)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
