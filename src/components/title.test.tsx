import React from 'react';

import { cleanup, render, screen } from '@/lib/test-utils';

import { Title } from './title';

afterEach(cleanup);

/**
 * V&V §6.1.1 / §6.1.3 — presentation rendering + snapshot contract.
 * (Image/screenshot thresholds like 90% similarity are enforced in E2E / visual pipelines;
 * here we lock the RN component tree snapshot.)
 */
describe('Title (presentation)', () => {
  it('renders the provided text', () => {
    render(<Title text="Balances" />);
    expect(screen.getByText('Balances')).toBeOnTheScreen();
  });

  it('matches snapshot', () => {
    expect(render(<Title text="Snapshot" />).toJSON()).toMatchSnapshot();
  });

  it('initial render stays within the §6.1.2 interactivity budget', () => {
    const t0 = global.performance.now();
    render(<Title text="Perf" />);
    expect(global.performance.now() - t0).toBeLessThan(2000);
  });
});
