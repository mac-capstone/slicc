import React from 'react';
import { Text } from 'react-native';
import { useMMKVString } from 'react-native-mmkv';

import { render, screen } from '@/lib/test-utils';
import { type UserIdT } from '@/types';

import { storage } from '../storage';
import {
  getDefaultTaxRate,
  getDefaultTipPercent,
  USER_SETTINGS_DEFAULT_TAX_RATE_KEY,
  USER_SETTINGS_DEFAULT_TIP_PERCENT_KEY,
  USER_SETTINGS_DIETARY_IDS_KEY,
  USER_SETTINGS_PAYOUT_EMAIL_KEY,
  userSettingsStorageKey,
  useUserSettings,
} from './use-user-settings';

const testUserId = 'user_test_1' as UserIdT;

jest.mock('../storage', () => ({
  storage: {
    getString: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
  },
}));

jest.mock('react-native-mmkv');

jest.mock('@/lib/auth', () => ({
  useAuth: {
    use: {
      userId: jest.fn(() => testUserId),
    },
  },
}));

const { useAuth } = jest.requireMock('@/lib/auth') as {
  useAuth: { use: { userId: jest.Mock } };
};

describe('useUserSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.use.userId.mockReturnValue(testUserId);
  });

  it('reads scoped default tax from storage synchronously', () => {
    const scopedTax = userSettingsStorageKey(
      testUserId,
      USER_SETTINGS_DEFAULT_TAX_RATE_KEY
    );
    const scopedTip = userSettingsStorageKey(
      testUserId,
      USER_SETTINGS_DEFAULT_TIP_PERCENT_KEY
    );

    (storage.getString as jest.Mock).mockImplementation((key: string) => {
      if (key === scopedTax) return '13';
      if (key === scopedTip) return '18';
      return undefined;
    });

    expect(getDefaultTaxRate(testUserId)).toBe(13);
    expect(getDefaultTipPercent(testUserId)).toBe(18);
  });

  it('exposes all local settings through one hook contract', () => {
    const setValue = jest.fn();

    (useMMKVString as jest.Mock).mockImplementation((key: string) => {
      switch (key) {
        case userSettingsStorageKey(
          testUserId,
          USER_SETTINGS_DEFAULT_TAX_RATE_KEY
        ):
          return ['8.5', setValue];
        case userSettingsStorageKey(
          testUserId,
          USER_SETTINGS_DEFAULT_TIP_PERCENT_KEY
        ):
          return ['15', setValue];
        case userSettingsStorageKey(testUserId, USER_SETTINGS_DIETARY_IDS_KEY):
          return ['["vegetarian","nut_free"]', setValue];
        case userSettingsStorageKey(testUserId, USER_SETTINGS_PAYOUT_EMAIL_KEY):
          return ['test@example.com', setValue];
        default:
          return [undefined, setValue];
      }
    });

    const Probe = () => {
      const settings = useUserSettings();

      return (
        <Text>
          {`${settings.defaultTaxRate}|${settings.defaultTipPercent}|${settings.dietaryPreferenceIds.join(',')}|${settings.payoutEmail}`}
        </Text>
      );
    };

    render(<Probe />);

    expect(
      screen.getByText('8.5|15|vegetarian,nut_free|test@example.com')
    ).toBeOnTheScreen();
  });
});
