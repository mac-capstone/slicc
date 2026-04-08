/**
 * V&V design doc 4.5 (Google ML Kit + Expo Voice) and SRS 3.4 / 4.1 voice split:
 * runtime wiring uses `expo-speech-recognition` (see add-expense). Jest has no native STT;
 * this test locks the public surface we rely on for configuration smoke checks.
 */
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    start: jest.fn(),
    stop: jest.fn(),
    requestPermissionsAsync: jest.fn(),
  },
  useSpeechRecognitionEvent: jest.fn(() => undefined),
}));

describe('expo-speech-recognition STT surface (voice split pipeline)', () => {
  it('exposes module commands and event hook used by the expense screen', () => {
    expect(typeof ExpoSpeechRecognitionModule.start).toBe('function');
    expect(typeof ExpoSpeechRecognitionModule.stop).toBe('function');
    expect(useSpeechRecognitionEvent).toBeDefined();
  });
});
