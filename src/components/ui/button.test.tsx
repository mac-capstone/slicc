/**
 * V&V §6.1.1 / §6.1.3 — presentation interactions + snapshot (see also title.test.tsx §6.1.2).
 */
import React from 'react';

import { cleanup, fireEvent, render, screen } from '@/lib/test-utils';

import { Button } from './button';

afterEach(cleanup);

describe('Button (presentation, §6.1.1)', () => {
  it('invokes onPress when enabled', () => {
    const onPress = jest.fn();
    render(<Button testID="btn" label="Save" onPress={onPress} />);
    fireEvent.press(screen.getByTestId('btn'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not invoke onPress while loading', () => {
    const onPress = jest.fn();
    render(<Button testID="btn" label="Save" loading onPress={onPress} />);
    fireEvent.press(screen.getByTestId('btn'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('matches snapshot for default variant', () => {
    expect(
      render(<Button testID="snap-btn" label="Continue" />).toJSON()
    ).toMatchSnapshot();
  });

  it('initial render stays within the §6.1.2 interactivity budget', () => {
    const t0 = global.performance.now();
    render(<Button testID="perf-btn" label="Go" onPress={() => {}} />);
    expect(global.performance.now() - t0).toBeLessThan(2000);
  });
});
