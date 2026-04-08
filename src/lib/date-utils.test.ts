import {
  formatCreationDate,
  formatEventDescription,
  formatEventWhen,
} from '@/lib/date-utils';

describe('date-utils (presentation copy)', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-04T12:00:00.000Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe('formatCreationDate', () => {
    it('returns empty string for undefined input', () => {
      expect(formatCreationDate(undefined)).toBe('');
    });

    it('labels yesterday relative to mocked today', () => {
      const yesterday = new Date('2026-04-03T10:00:00.000Z');
      expect(formatCreationDate(yesterday)).toBe('Created yesterday');
    });

    it('formats other dates', () => {
      expect(formatCreationDate('2026-01-05T00:00:00.000Z')).toMatch(
        /^Created \d{2}\/\d{2}\/\d{4}$/
      );
    });
  });

  describe('formatEventWhen', () => {
    it('returns relative labels for nearby dates', () => {
      const today = new Date('2026-04-04T15:00:00.000Z');
      expect(formatEventWhen(today)).toBe('today');
      expect(formatEventWhen(new Date('2026-04-05T15:00:00.000Z'))).toBe(
        'tomorrow'
      );
      expect(formatEventWhen(new Date('2026-04-03T15:00:00.000Z'))).toBe(
        'yesterday'
      );
    });
  });

  describe('formatEventDescription', () => {
    it('combines name with relative when-string', () => {
      expect(
        formatEventDescription('Dinner', new Date('2026-04-04T08:00:00.000Z'))
      ).toBe('Dinner today');
    });
  });
});
