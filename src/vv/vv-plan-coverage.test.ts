import { vvPlanCoverage } from '@/vv/vv-plan-coverage';

describe('vv-plan-coverage (V&V §6 traceability)', () => {
  it('includes every Section 6 subsection from the written plan', () => {
    expect(Object.keys(vvPlanCoverage).sort()).toEqual(
      [
        '6.1.1',
        '6.1.2',
        '6.1.3',
        '6.2.1',
        '6.2.2',
        '6.3.1',
        '6.3.2',
        '6.4.1',
        '6.4.2',
        '6.5.1',
        '6.5.2',
        '6.6',
        '6.7.1',
        '6.7.2',
      ].sort()
    );
  });
});
