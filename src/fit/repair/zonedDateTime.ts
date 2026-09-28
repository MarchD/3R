const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;
  let runtimeZone = timeZone;
  if (timeZone === 'Europe/Kyiv') {
    try {
      Intl.DateTimeFormat('en', { timeZone: 'Europe/Kyiv' }).format(0);
    } catch {
      runtimeZone = 'Europe/Kiev';
    }
  }
  const created = new Intl.DateTimeFormat('en-GB', {
    timeZone: runtimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  formatterCache.set(timeZone, created);
  return created;
}

function parts(timestampMs: number, timeZone: string) {
  const values = Object.fromEntries(
    formatter(timeZone)
      .formatToParts(timestampMs)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function asUtc(value: ReturnType<typeof parts>): number {
  return Date.UTC(value.year, value.month - 1, value.day, value.hour, value.minute, value.second);
}

export function supportedTimeZones(): string[] {
  return (Intl.supportedValuesOf?.('timeZone') ?? []).map((zone) =>
    zone === 'Europe/Kiev' ? 'Europe/Kyiv' : zone,
  );
}

export function resolveTimeZone(value: string, zones?: string[]): string | undefined {
  const query = value.trim().replaceAll(' ', '_').toLowerCase();
  if (!query) return undefined;
  const aliases: Record<string, string> = { kyiv: 'Europe/Kyiv', kiev: 'Europe/Kyiv' };
  const requested = aliases[query] ?? value.trim().replaceAll(' ', '_');
  try {
    const resolved = Intl.DateTimeFormat('en', { timeZone: requested }).resolvedOptions().timeZone;
    return resolved === 'Europe/Kiev' ? 'Europe/Kyiv' : resolved;
  } catch {
    if (requested === 'Europe/Kyiv') {
      try {
        Intl.DateTimeFormat('en', { timeZone: 'Europe/Kiev' }).format(0);
        return 'Europe/Kyiv';
      } catch {
        return undefined;
      }
    }
    const matches = (zones ?? supportedTimeZones()).filter(
      (zone) => zone.split('/').at(-1)?.toLowerCase() === query,
    );
    return matches.length === 1 ? matches[0] : undefined;
  }
}

export function formatZonedInput(timestamp: string, timeZone: string): string {
  const timestampMs = Date.parse(timestamp);
  if (!Number.isFinite(timestampMs)) return '';
  const wall = parts(timestampMs, timeZone);
  const pad = (number: number) => String(number).padStart(2, '0');
  return `${wall.year}-${pad(wall.month)}-${pad(wall.day)}T${pad(wall.hour)}:${pad(wall.minute)}:${pad(wall.second)}`;
}

export function parseZonedInput(localValue: string, timeZone: string): string | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(localValue);
  if (!match) return undefined;
  const wall = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? 0),
  };
  const naiveUtc = asUtc(wall);
  if (!Number.isFinite(naiveUtc)) return undefined;
  const normalized = parts(naiveUtc, 'UTC');
  if (
    Object.keys(wall).some(
      (key) => wall[key as keyof typeof wall] !== normalized[key as keyof typeof wall],
    )
  )
    return undefined;
  const candidates = [-86_400_000, 0, 86_400_000]
    .map((delta) => naiveUtc + delta)
    .map((sample) => naiveUtc - (asUtc(parts(sample, timeZone)) - sample))
    .filter((candidate) => asUtc(parts(candidate, timeZone)) === naiveUtc);
  const first = candidates.sort((a, b) => a - b)[0];
  return first == null ? undefined : new Date(first).toISOString();
}
