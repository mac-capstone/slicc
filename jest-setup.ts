import '@testing-library/react-native/extend-expect';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///mock-documents/',
  getInfoAsync: jest.fn(async () => ({ exists: false, isDirectory: false })),
  readAsStringAsync: jest.fn(async () => ''),
  writeAsStringAsync: jest.fn(async () => undefined),
}));

// react-hook form setup for testing
// @ts-ignore
global.window = {};
// @ts-ignore
global.window = global;
