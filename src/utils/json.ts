const BINARY_TAG = '$binary';

function normalize(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (ArrayBuffer.isView(value)) {
    return { [BINARY_TAG]: value.constructor.name, values: Array.from(value as unknown as ArrayLike<number>) };
  }
  if (value instanceof ArrayBuffer) {
    return { [BINARY_TAG]: 'ArrayBuffer', values: Array.from(new Uint8Array(value)) };
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    return value.map((item) => normalize(item, seen));
  }
  if (value && typeof value === 'object') {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalize(item, seen)]),
    );
  }
  if (typeof value === 'number' && !Number.isFinite(value)) return String(value);
  if (typeof value === 'undefined') return '[undefined]';
  return value;
}

export function toJsonCompatible<T = unknown>(value: T): unknown {
  return normalize(value, new WeakSet());
}

export function safeStringify(value: unknown, space = 2): string {
  return JSON.stringify(toJsonCompatible(value), null, space);
}

export function searchJson(value: unknown, query: string): boolean {
  if (!query.trim()) return true;
  return safeStringify(value, 0).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
}
