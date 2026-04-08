import {
  formatAppName,
  formatPercent,
  mapFirestoreDietaryToIds,
  normalizeTextValue,
  sanitizeNumeric,
  validateEmail,
  validatePercent,
} from '@/lib/settings-screen-helpers';

describe('settings-screen-helpers', () => {
  describe('mapFirestoreDietaryToIds', () => {
    it('maps hyphenated Firestore labels to canonical ids', () => {
      expect(mapFirestoreDietaryToIds(['gluten-free', '  Vegan '])).toEqual([
        'gluten_free',
        'vegan',
      ]);
    });

    it('skips empty, none, and invalid entries', () => {
      expect(mapFirestoreDietaryToIds(['', 'none', 'unknown'])).toEqual([]);
    });
  });

  describe('sanitizeNumeric', () => {
    it('strips non-numeric characters except one decimal point', () => {
      expect(sanitizeNumeric('12.34abc')).toBe('12.34');
      expect(sanitizeNumeric('1.2.3')).toBe('1.23');
    });
  });

  describe('formatPercent', () => {
    it('formats integers and decimals as plain strings', () => {
      expect(formatPercent(0)).toBe('0');
      expect(formatPercent(13)).toBe('13');
      expect(formatPercent(12.5)).toBe('12.5');
    });
  });

  describe('validatePercent', () => {
    it('returns null for valid in-range values', () => {
      expect(validatePercent('0')).toBeNull();
      expect(validatePercent('100')).toBeNull();
      expect(validatePercent(' 13.5 ')).toBeNull();
    });

    it('returns an error message for out-of-range or invalid input', () => {
      expect(validatePercent('')).toBeNull();
      expect(validatePercent('-1')).toBe('Enter a value between 0 and 100.');
      expect(validatePercent('101')).toBe('Enter a value between 0 and 100.');
      expect(validatePercent('x')).toBe('Enter a value between 0 and 100.');
    });
  });

  describe('validateEmail', () => {
    it('returns null for empty input', () => {
      expect(validateEmail('')).toBeNull();
    });

    it('accepts a simple valid email', () => {
      expect(validateEmail('a@b.co')).toBeNull();
    });

    it('rejects invalid patterns', () => {
      expect(validateEmail('not-an-email')).toBe(
        'Enter a valid email address.'
      );
    });
  });

  describe('normalizeTextValue', () => {
    it('trims whitespace', () => {
      expect(normalizeTextValue('  hi  ')).toBe('hi');
    });
  });

  describe('formatAppName', () => {
    it('capitalizes the first character', () => {
      expect(formatAppName('slicc')).toBe('Slicc');
    });
  });
});
