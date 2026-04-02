import {
  normalizeDietaryPreferenceIds,
  VALID_DIETARY_IDS,
} from '@/lib/dietary-preference-options';

export function mapFirestoreDietaryToIds(prefs: string[]): string[] {
  const hyphenMap: Record<string, string> = {
    'gluten-free': 'gluten_free',
    'dairy-free': 'dairy_free',
    'nut-free': 'nut_free',
  };
  const out: string[] = [];
  for (const raw of prefs) {
    const t = raw.trim().toLowerCase();
    if (!t || t === 'none') continue;
    const mapped = hyphenMap[t] ?? t.replace(/-/g, '_');
    if (VALID_DIETARY_IDS.has(mapped)) out.push(mapped);
  }
  return normalizeDietaryPreferenceIds(out);
}

export function sanitizeNumeric(text: string): string {
  let cleaned = text.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');

  if (parts.length > 2) {
    cleaned = `${parts[0]}.${parts.slice(1).join('')}`;
  }

  return cleaned;
}

export function formatPercent(value: number): string {
  if (value === 0) return '0';
  return Number.isInteger(value) ? value.toString() : value.toString();
}

export function validatePercent(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return 'Enter a value between 0 and 100.';
  }

  return null;
}

export function validateEmail(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  return isValid ? null : 'Enter a valid email address.';
}

export function normalizeTextValue(value: string): string {
  return value.trim();
}

export function formatAppName(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
