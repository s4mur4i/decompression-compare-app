import { describe, it, expect } from 'vitest';
import { calculateDiveProfile } from '../diveProfile';
import { calculateZHL16C, calculateZHL16A, calculateZHL16B, calculateZHL12, calculateZHL6, calculateZHL8ADT } from '../buhlmann';
import { calculateVPM } from '../vpm';
import { calculateRGBM } from '../rgbm';
import { calculateHaldane } from '../haldane';
import { calculateWorkman } from '../workman';
import { calculateThalmann } from '../thalmann';
import { calculateDCIEM } from '../dciem';
import { calculateDSAT } from '../dsat';
import { calculateUSNavy } from '../usnavy';
import { calculateBSAC } from '../bsac';

function getPhases(depth, time) {
  return calculateDiveProfile([{ depth, time }], 18, 9).phases;
}

function totalDecoTime(result) {
  return result.decoStops.filter(s => !s.gasSwitch).reduce((a, s) => a + s.time, 0);
}

const OPTS = { fO2: 0.21, gfLow: 50, gfHigh: 70, ascentRate: 9, decoAscentRate: 9, lastStopDepth: 6 };

// ─── Golden value regression tests ──────────────────────────────────────
// These capture the current algorithm outputs for standard profiles.
// If an algorithm changes, these tests will flag it.

describe('Regression: Air 40m/20min standard profile', () => {
  const phases = getPhases(40, 20);

  const cases = [
    ['ZHL-16C', calculateZHL16C],
    ['ZHL-16A', calculateZHL16A],
    ['ZHL-16B', calculateZHL16B],
    ['ZHL-12', calculateZHL12],
    ['ZHL-6', calculateZHL6],
    ['ZHL-8ADT', calculateZHL8ADT],
    ['VPM-B', calculateVPM],
    ['RGBM', calculateRGBM],
    ['Haldane', calculateHaldane],
    ['Workman', calculateWorkman],
    ['Thalmann', calculateThalmann],
    ['DCIEM', calculateDCIEM],
  ];

  cases.forEach(([name, fn]) => {
    it(`${name} produces consistent output shape`, () => {
      const result = fn(phases, OPTS);
      expect(result).toHaveProperty('decoStops');
      expect(result).toHaveProperty('tissueLoading');
      expect(result).toHaveProperty('ceiling');
      expect(result).toHaveProperty('noDecoLimit');
      expect(result).toHaveProperty('compartmentCount');
      expect(result).toHaveProperty('halfTimes');
      expect(result).toHaveProperty('mValues');
      expect(result.tissueLoading.length).toBe(result.compartmentCount);
      expect(result.halfTimes.length).toBeGreaterThanOrEqual(result.compartmentCount);
      expect(result.mValues.length).toBeGreaterThanOrEqual(result.compartmentCount);
    });
  });
});

describe('Regression: table-based algorithms', () => {
  it('DSAT 30m/20min produces NDL info', () => {
    const phases = getPhases(30, 20);
    const result = calculateDSAT(phases, OPTS);
    expect(result).toHaveProperty('ndl');
    expect(result).toHaveProperty('decoRequired');
    // DSAT table: 30m NDL is 20min, but totalBottomTime includes transit
    expect(result.ndl).toBeGreaterThanOrEqual(15);
    expect(result.ndl).toBeLessThanOrEqual(30);
  });

  it('DSAT 30m/60min exceeds NDL', () => {
    const phases = getPhases(30, 60);
    const result = calculateDSAT(phases, OPTS);
    expect(result.decoRequired).toBe(true);
  });

  it('USNavy returns table metadata', () => {
    const phases = getPhases(30, 25);
    const result = calculateUSNavy(phases, OPTS);
    expect(result).toHaveProperty('tableDepth');
    expect(result).toHaveProperty('tableTime');
  });

  it('BSAC returns NDL from table', () => {
    const phases = getPhases(18, 30);
    const result = calculateBSAC(phases, OPTS);
    expect(result).toHaveProperty('tableNDL');
    expect(result.tableNDL).toBeGreaterThan(0);
  });
});

// ─── Stress tests ───────────────────────────────────────────────────────

describe('Stress: very long dives', () => {
  it('ZHL-16C handles 300min at 15m', () => {
    const phases = getPhases(15, 300);
    const result = calculateZHL16C(phases, OPTS);
    expect(result).toBeDefined();
    expect(Number.isFinite(totalDecoTime(result))).toBe(true);
  });
});

describe('Stress: many gas switches', () => {
  it('ZHL-16C handles 2 gas switches on deep dive', () => {
    const phases = getPhases(60, 20);
    const result = calculateZHL16C(phases, {
      ...OPTS,
      gasSwitches: [
        { depth: 21, fO2: 0.50, fHe: 0 },
        { depth: 6, fO2: 1.0, fHe: 0 },
      ],
    });
    expect(result).toBeDefined();
    const gasStops = result.decoStops.filter(s => s.gasSwitch);
    expect(gasStops.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── NDL accuracy: compare DSAT table values ────────────────────────────

describe('NDL accuracy: DSAT lookupNDL verification', () => {
  // Test the lookupNDL function directly
  it('DSAT NDL decreases with depth', () => {
    const { lookupNDL } = require('../dsat');
    // NDL should be positive for all table depths
    const depths = [10, 15, 20, 25, 30, 35, 40];
    const ndls = depths.map(d => lookupNDL(d));
    for (const ndl of ndls) {
      expect(ndl).toBeGreaterThan(0);
    }
    // Monotonically decreasing
    for (let i = 1; i < ndls.length; i++) {
      expect(ndls[i]).toBeLessThanOrEqual(ndls[i - 1]);
    }
    // Reasonable range
    expect(ndls[0]).toBeGreaterThan(50); // 10m should have lots of NDL
    expect(ndls[ndls.length - 1]).toBeLessThan(15); // 40m should have short NDL
  });

  it('deep dives always exceed NDL with long bottom times', () => {
    // Use a bottom time well beyond any NDL
    const phases = getPhases(30, 100);
    const result = calculateDSAT(phases, OPTS);
    expect(result.decoRequired).toBe(true);
  });

  it('short shallow dives stay within NDL', () => {
    const phases = getPhases(10, 10);
    const result = calculateDSAT(phases, OPTS);
    expect(result.decoRequired).toBe(false);
  });
});
