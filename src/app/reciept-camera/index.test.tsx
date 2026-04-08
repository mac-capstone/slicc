/**
 * Presentation + receipt OCR flow (SRS §4.1 P0 scan receipt; V&V §6.4 Gemini path, §3.5 ML Kit stack).
 * Mocks camera + Gemini client; asserts resize/compress/base64 → structured lines behaviour at integration boundary.
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import React, { type Ref } from 'react';
import { Alert } from 'react-native';

import ReceiptCameraScreen from '@/app/reciept-camera/index';

const mockRouterBack = jest.fn();
const mockExtractReceiptInfo = jest.fn();
const mockParseReceiptInfo = jest.fn();
const mockAddItem = jest.fn();
const mockClearTempExpenseItems = jest.fn();
const mockTakePictureAsync = jest.fn();

jest.mock('@expo/vector-icons', () => ({
  Octicons: () => null,
}));
jest.mock('@expo/vector-icons/Ionicons', () => {
  const ReactNs = require('react') as typeof React;
  const { Text } = require('react-native');
  return ({ name }: { name: string }) =>
    ReactNs.createElement(Text, { testID: `ion-${name}` }, name);
});

jest.mock('expo-router', () => ({
  router: { back: (...args: unknown[]) => mockRouterBack(...args) },
  Stack: { Screen: () => null },
}));

jest.mock('@/api/camera-receipt/extract-receipt-info', () => ({
  extractReceiptInfo: (...args: unknown[]) => mockExtractReceiptInfo(...args),
}));
jest.mock(
  '@infinitered/react-native-mlkit-text-recognition',
  () => ({
    recognizeText: jest.fn(async () => ''),
  }),
  { virtual: true }
);

jest.mock('@/lib/utils', () => {
  const actual = jest.requireActual('@/lib/utils');
  return {
    ...actual,
    parseReceiptInfo: (...args: unknown[]) => mockParseReceiptInfo(...args),
  };
});

jest.mock('@/lib/store', () => ({
  useExpenseCreation: () => ({
    addItem: mockAddItem,
    clearTempExpenseItems: mockClearTempExpenseItems,
  }),
}));

jest.mock('@/lib/hooks/use-default-tax-rate', () => ({
  useDefaultTaxRate: () => ({ defaultTaxRate: 13 }),
}));

jest.mock('@/lib/use-theme-config', () => ({
  useThemeConfig: () => ({ dark: false }),
}));

jest.mock('uuid', () => ({
  v4: () => '00000000-0000-4000-8000-000000000001',
}));

const mockUseCameraPermissions = jest.fn();

type CameraViewImperativeRef = Ref<{
  takePictureAsync: typeof mockTakePictureAsync;
}>;

jest.mock('expo-camera', () => {
  const ReactNs = require('react') as typeof React;
  const { View } = require('react-native');
  const CameraView = ReactNs.forwardRef(
    (_props: object, ref: CameraViewImperativeRef) => {
      ReactNs.useImperativeHandle(ref, () => ({
        takePictureAsync: mockTakePictureAsync,
      }));
      return <View testID="camera-view" />;
    }
  );
  return {
    CameraView,
    useCameraPermissions: () => mockUseCameraPermissions(),
  };
});

describe('ReceiptCameraScreen (SRS receipt scan + V&V OCR UI boundary)', () => {
  let alertSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockUseCameraPermissions.mockReturnValue([
      { granted: true },
      jest.fn().mockResolvedValue({ granted: true }),
    ]);
    mockTakePictureAsync.mockResolvedValue({ base64: 'YmFzZTY0' });
    mockExtractReceiptInfo.mockResolvedValue('[{"dish":"Tea","price":"$2"}]');
    mockParseReceiptInfo.mockReturnValue({
      success: true,
      data: [{ dish: 'Tea', price: 2 }],
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
    alertSpy.mockRestore();
  });

  it('shows a loading state while camera permission is unresolved', () => {
    mockUseCameraPermissions.mockReturnValue([null, jest.fn()]);
    render(<ReceiptCameraScreen />);
    const { ActivityIndicator } = require('react-native');
    expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it('renders permission request UI when camera is not granted', () => {
    mockUseCameraPermissions.mockReturnValue([
      { granted: false },
      jest.fn().mockResolvedValue({ granted: true }),
    ]);
    render(<ReceiptCameraScreen />);
    expect(screen.getByText('Camera Access Required')).toBeTruthy();
    expect(screen.getByText('Allow Camera Access')).toBeTruthy();
  });

  it('calls requestPermission when tapping Allow Camera Access', () => {
    const req = jest.fn().mockResolvedValue({ granted: true });
    mockUseCameraPermissions.mockReturnValue([{ granted: false }, req]);
    render(<ReceiptCameraScreen />);
    fireEvent.press(screen.getByText('Allow Camera Access'));
    expect(req).toHaveBeenCalled();
  });

  it('renders main camera UI when permission granted', () => {
    render(<ReceiptCameraScreen />);
    expect(screen.getByText('Receipt Camera')).toBeTruthy();
    expect(screen.getByText('Capture Reciept')).toBeTruthy();
    expect(screen.getByText('Enter Manually')).toBeTruthy();
    expect(screen.getByTestId('camera-view')).toBeTruthy();
  });

  it('navigates back when Enter Manually is pressed', () => {
    render(<ReceiptCameraScreen />);
    fireEvent.press(screen.getByText('Enter Manually'));
    expect(mockRouterBack).toHaveBeenCalled();
  });

  it('toggles flash mode between auto/on and off (SRS image-quality / capture control)', () => {
    render(<ReceiptCameraScreen />);
    // Initial flash is `auto`; getFlashIconProps maps non-off to flash-outline
    expect(screen.getByTestId('ion-flash-outline')).toBeTruthy();
    fireEvent.press(screen.getByTestId('ion-flash-outline'));
    expect(screen.getByTestId('ion-flash-off-outline')).toBeTruthy();
    fireEvent.press(screen.getByTestId('ion-flash-off-outline'));
    expect(screen.getByTestId('ion-flash-outline')).toBeTruthy();
  });

  it('completes capture: OCR → parse → temp items → back (happy path)', async () => {
    render(<ReceiptCameraScreen />);
    fireEvent.press(screen.getByText('Capture Reciept'));
    await waitFor(() => {
      expect(mockTakePictureAsync).toHaveBeenCalledWith(
        expect.objectContaining({ base64: true, quality: 0.4 })
      );
      expect(mockExtractReceiptInfo).toHaveBeenCalledWith('YmFzZTY0');
      expect(mockClearTempExpenseItems).toHaveBeenCalled();
      expect(mockAddItem).toHaveBeenCalled();
      expect(mockRouterBack).toHaveBeenCalled();
    });
  });

  it('alerts when AI returns empty result (SRS manual fallback)', async () => {
    mockExtractReceiptInfo.mockResolvedValue('');
    render(<ReceiptCameraScreen />);
    fireEvent.press(screen.getByText('Capture Reciept'));
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Failed to process image',
        'No response from AI service'
      );
    });
  });

  it('alerts when parseReceiptInfo returns null', async () => {
    mockParseReceiptInfo.mockReturnValue(null);
    render(<ReceiptCameraScreen />);
    fireEvent.press(screen.getByText('Capture Reciept'));
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Failed to process image',
        'No response from AI service'
      );
    });
  });

  it('alerts when parsed result has schema error', async () => {
    mockParseReceiptInfo.mockReturnValue({
      success: false,
      error: Object.assign(new Error('invalid'), { message: 'bad json shape' }),
    });
    render(<ReceiptCameraScreen />);
    fireEvent.press(screen.getByText('Capture Reciept'));
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Failed to process image: bad json shape'
      );
    });
  });

  it('uses unknown error message when capture pipeline throws non-Error', async () => {
    mockExtractReceiptInfo.mockRejectedValue('network');
    render(<ReceiptCameraScreen />);
    fireEvent.press(screen.getByText('Capture Reciept'));
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Failed to process image: Unknown error occurred'
      );
    });
  });

  it('shows Error message when capture pipeline throws Error', async () => {
    mockExtractReceiptInfo.mockRejectedValue(new Error('boom'));
    render(<ReceiptCameraScreen />);
    fireEvent.press(screen.getByText('Capture Reciept'));
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Failed to process image: boom');
    });
  });
});
