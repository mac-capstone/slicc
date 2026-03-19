import { Linking } from 'react-native';

import { type BankPreference } from '@/types';

export type BankOption = {
  label: string;
  value: BankPreference;
};

export const BANK_OPTIONS: BankOption[] = [
  { label: 'None selected', value: 'none' },
  { label: 'All banks (Interac)', value: 'all-banks' },
  { label: 'Interac e-Transfer', value: 'interac' },
  { label: 'RBC', value: 'rbc' },
  { label: 'TD', value: 'td' },
  { label: 'Scotiabank', value: 'scotia' },
  { label: 'CIBC', value: 'cibc' },
  { label: 'BMO', value: 'bmo' },
  { label: 'National Bank', value: 'national-bank' },
  { label: 'Desjardins', value: 'desjardins' },
  { label: 'Tangerine', value: 'tangerine' },
  { label: 'Simplii Financial', value: 'simplii' },
  { label: 'Laurentian Bank', value: 'laurentian' },
  { label: 'Meridian Credit Union', value: 'meridian' },
  { label: 'Coast Capital', value: 'coast-capital' },
  { label: 'Vancity', value: 'vancity' },
  { label: 'ATB Financial', value: 'atb' },
  { label: 'EQ Bank', value: 'eq-bank' },
  { label: 'Wealthsimple', value: 'wealthsimple' },
  { label: 'KOHO', value: 'koho' },
  { label: 'Neo Financial', value: 'neo' },
  { label: 'Other', value: 'other' },
];

export function isBankPreference(value: string): value is BankPreference {
  return BANK_OPTIONS.some((option) => option.value === value);
}

type BankLaunchConfig = {
  appDeepLink?: string;
  webUrl: string;
};

const BANK_LAUNCH_CONFIG: Record<BankPreference, BankLaunchConfig> = {
  none: {
    webUrl: 'https://www.interac.ca/en/consumers/products/interac-e-transfer/',
  },
  'all-banks': {
    webUrl: 'https://www.interac.ca/en/consumers/products/interac-e-transfer/',
  },
  interac: {
    webUrl: 'https://www.interac.ca/en/consumers/products/interac-e-transfer/',
  },
  rbc: {
    appDeepLink: 'rbcmobile://',
    webUrl:
      'https://www.rbcroyalbank.com/ways-to-bank/mobile/rbc-mobile-app.html',
  },
  td: {
    appDeepLink: 'tdct://',
    webUrl:
      'https://www.td.com/ca/en/personal-banking/how-to/ways-to-bank/mobile-app',
  },
  scotia: {
    appDeepLink: 'scotiabank://',
    webUrl:
      'https://www.scotiabank.com/ca/en/personal/ways-to-bank/mobile.html',
  },
  cibc: {
    appDeepLink: 'cibcmobilebanking://',
    webUrl: 'https://www.cibc.com/en/mobile-banking.html',
  },
  bmo: {
    appDeepLink: 'bmomobile://',
    webUrl: 'https://www.bmo.com/main/personal/ways-to-bank/mobile-banking/',
  },
  'national-bank': {
    webUrl:
      'https://www.nbc.ca/personal/help-centre/security/interac-e-transfer.html',
  },
  desjardins: {
    webUrl:
      'https://www.desjardins.com/ca/personal/accounts-services/interac-e-transfer/index.jsp',
  },
  tangerine: {
    webUrl: 'https://www.tangerine.ca/en/help-and-support/e-transfers',
  },
  simplii: {
    webUrl:
      'https://www.simplii.com/en/banking-simplii/interac-e-transfer.html',
  },
  laurentian: {
    webUrl:
      'https://www.banquelaurentienne.ca/en/personal_banking_services/electronic_services/interac_e_transfer.html',
  },
  meridian: {
    webUrl:
      'https://www.meridiancu.ca/personal/ways-to-bank/interac-e-transfer',
  },
  'coast-capital': {
    webUrl:
      'https://www.coastcapitalsavings.com/ways-to-bank/interac-e-transfer',
  },
  vancity: {
    webUrl: 'https://www.vancity.com/Banking/WaysToBank/InteraceTransfer/',
  },
  atb: {
    webUrl: 'https://www.atb.com/personal/everyday-banking/interac-e-transfer/',
  },
  'eq-bank': {
    webUrl:
      'https://www.eqbank.ca/personal-banking/payments/interac-e-transfer',
  },
  wealthsimple: {
    webUrl: 'https://help.wealthsimple.com/hc/en-ca/articles/4402390786203',
  },
  koho: {
    webUrl: 'https://help.koho.ca/en/articles/1500128-interac-e-transfer',
  },
  neo: {
    webUrl: 'https://help.neofinancial.com/hc/en-ca/articles/4410426280973',
  },
  other: {
    webUrl: 'https://www.interac.ca/en/consumers/products/interac-e-transfer/',
  },
};

export async function openBankFlow(
  bankPreference?: BankPreference
): Promise<void> {
  const preference: BankPreference = bankPreference ?? 'none';
  const config = BANK_LAUNCH_CONFIG[preference];

  if (config.appDeepLink) {
    const canOpenApp = await Linking.canOpenURL(config.appDeepLink);
    if (canOpenApp) {
      await Linking.openURL(config.appDeepLink);
      return;
    }
  }

  await Linking.openURL(config.webUrl);
}

export function getBankLabel(bankPreference?: BankPreference): string {
  if (!bankPreference) return 'Bank app';
  const option = BANK_OPTIONS.find((item) => item.value === bankPreference);
  return option?.label ?? 'Bank app';
}
