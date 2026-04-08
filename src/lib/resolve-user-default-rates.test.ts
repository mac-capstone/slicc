import {
  resolveDefaultTaxRate,
  resolveDefaultTipRate,
} from '@/lib/resolve-user-default-rates';
import { type UserWithId } from '@/types';

describe('resolve-user-default-rates (business)', () => {
  it('uses MMKV fallback when user is missing', () => {
    expect(resolveDefaultTaxRate(undefined, 13)).toBe(13);
    expect(resolveDefaultTipRate(null, 18)).toBe(18);
  });

  it('uses explicit user rates when defined', () => {
    const user = {
      id: 'u1' as UserWithId['id'],
      username: 'x',
      displayName: 'X',
      friends: [],
      defaultTaxRate: 5,
      defaultTipRate: 20,
    } satisfies UserWithId;
    expect(resolveDefaultTaxRate(user, 13)).toBe(5);
    expect(resolveDefaultTipRate(user, 18)).toBe(20);
  });

  it('treats undefined saved rates as 0 (not MMKV)', () => {
    const user = {
      id: 'u1' as UserWithId['id'],
      username: 'x',
      displayName: 'X',
      friends: [],
    } satisfies UserWithId;
    expect(resolveDefaultTaxRate(user, 13)).toBe(0);
    expect(resolveDefaultTipRate(user, 18)).toBe(0);
  });
});
