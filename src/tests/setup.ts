import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

Object.defineProperty(globalThis.crypto, 'randomUUID', {
  configurable: true,
  value: vi.fn(() => `test-${Math.random().toString(16).slice(2)}`),
});

if (!Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = function arrayBuffer() {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}

Object.defineProperty(URL, 'createObjectURL', {
  configurable: true,
  value: vi.fn(() => 'blob:test'),
});
Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
HTMLAnchorElement.prototype.click = vi.fn();
