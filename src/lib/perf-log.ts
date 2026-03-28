import {
  documentDirectory,
  getInfoAsync,
  readAsStringAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';

const LOG_NAME = 'slicc-perf.log';
/** Trim log if it grows past this (keeps most recent tail). */
const MAX_CHARS = 10_500_000;

const queue: string[] = [];
let scheduled = false;

function getPath(): string {
  const base = documentDirectory;
  if (!base) return '';
  return `${base}${LOG_NAME}`;
}

function scheduleFlush(): void {
  if (scheduled) return;
  scheduled = true;
  setTimeout(() => {
    scheduled = false;
    void flush();
  }, 400);
}

async function flush(): Promise<void> {
  const path = getPath();
  if (!path || queue.length === 0) return;

  const chunk = queue.splice(0, queue.length).join('\n') + '\n';

  try {
    let existing = '';
    const info = await getInfoAsync(path);
    if (info.exists) {
      existing = await readAsStringAsync(path);
      if (existing.length > MAX_CHARS) {
        existing = existing.slice(-Math.floor(MAX_CHARS / 2));
      }
    }
    await writeAsStringAsync(path, existing + chunk, { encoding: 'utf8' });
  } catch (e) {
    console.warn('[perf-log] flush failed', e);
  }
}

function nowMs(): number {
  try {
    return globalThis.performance?.now?.() ?? Date.now();
  } catch {
    return Date.now();
  }
}

/**
 * Append one performance line to `documentDirectory/slicc-perf.log`.
 * Buffered and flushed async so call sites stay cheap.
 */
export function perfLog(
  message: string,
  data?: Record<string, string | number | boolean | null | undefined>
): void {
  const ts = new Date().toISOString();
  const t = nowMs();
  const extra = data ? ` ${JSON.stringify(data)}` : '';
  queue.push(`[${ts}] t=${t.toFixed(1)}ms ${message}${extra}`);
  scheduleFlush();
}

/** Absolute file URI for pulling logs off the device (e.g. adb run-as / file manager). */
export function getPerfLogFileUri(): string {
  return getPath();
}
