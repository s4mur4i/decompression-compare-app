import { describe, it, expect } from 'vitest';
import { calculateDiveProfile } from '../diveProfile';
import { calculateZHL16C } from '../buhlmann';
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

const allAlgos = [
  ['ZHL-16C', calculateZHL16C],
  ['VPM-B', calculateVPM],
  ['RGBM', calculateRGBM],
  ['Haldane', calculateHaldane],
  ['Workman', calculateWorkman],
  ['Thalmann', calculateThalmann],
  ['DCIEM', calculateDCIEM],
];

// ─── 0m depth ───────────────────────────────────────────────────────────

describe('Boundary: 0m depth', () => {
  it('calculateDiveProfile handles 0m depth stop', () => {
    const profile = calculateDiveProfile([{ depth: 0, time: 10 }], 18, 9);
    expect(profile.points).toBeDefined();
    // Stay at surface, no descent needed
    expect(profile.lastDepth).toBe(0);
  });

  allAlgos.forEach(([name, fn]) => {
    it(`${name} handles 0m depth phases without crash`, () => {
      const phases = [{ depth: 0, duration: 10, action: 'Stay' }];
      const result = fn(phases, OPTS);
      expect(result).toBeDefined();
      expect(result.noDecoLimit).toBe(true);
    });
  });
});

// ─── 0min time ──────────────────────────────────────────────────────────

describe('Boundary: 0min time', () => {
  it('calculateDiveProfile handles 0min stop', () => {
    const profile = calculateDiveProfile([{ depth: 30, time: 0 }], 18, 9);
    expect(profile.points).toBeDefined();
  });
});

// ─── Very deep: 150m+ ───────────────────────────────────────────────────

describe('Boundary: very deep dive (150m)', () => {
  it('ZHL-16C handles 150m/10min without crashing', () => {
    const phases = getPhases(150, 10);
    const result = calculateZHL16C(phases, OPTS);
    expect(result).toBeDefined();
    expect(result.firstStopDepth).toBeGreaterThan(30);
    expect(totalDecoTime(result)).toBeGreaterThan(100);
    for (const stop of result.decoStops) {
      expect(Number.isFinite(stop.time)).toBe(true);
      expect(Number.isFinite(stop.depth)).toBe(true);
    }
  });
});

describe('Boundary: extreme depth (300m)', () => {
  it('ZHL-16C handles 300m/5min without crashing or infinite loops', () => {
    const phases = getPhases(300, 5);
    const result = calculateZHL16C(phases, OPTS);
    expect(result).toBeDefined();
    expect(result.firstStopDepth).toBeGreaterThan(50);
    for (const stop of result.decoStops) {
      expect(stop.time).toBeLessThan(999);
      expect(Number.isFinite(stop.time)).toBe(true);
    }
  });
});

// ─── Extreme GF values ──────────────────────────────────────────────────

describe('Boundary: extreme GF values', () => {
  const phases = getPhases(40, 20);

  it('GF 1/1 produces heavy deco without crash', () => {
    const result = calculateZHL16C(phases, { ...OPTS, gfLow: 1, gfHigh: 1 });
    expect(result).toBeDefined();
    expect(totalDecoTime(result)).toBeGreaterThan(0);
    for (const stop of result.decoStops) {
      expect(Number.isFinite(stop.time)).toBe(true);
    }
  });

  it('GF 99/99 produces minimal deco', () => {
    const result = calculateZHL16C(phases, { ...OPTS, gfLow: 99, gfHigh: 99 });
    expect(result).toBeDefined();
    // Should be close to or less than GF 100/100
    const liberal = calculateZHL16C(phases, { ...OPTS, gfLow: 100, gfHigh: 100 });
    expect(totalDecoTime(result)).toBeLessThanOrEqual(totalDecoTime(liberal) + 5);
  });
});

// ─── Very long dives ────────────────────────────────────────────────────

describe('Boundary: very long dive (300min at 10m)', () => {
  it('ZHL-16C handles saturation dive', () => {
    const phases = getPhases(10, 300);
    const result = calculateZHL16C(phases, OPTS);
    expect(result).toBeDefined();
    // Should still complete without infinite loops
    for (const stop of result.decoStops) {
      expect(Number.isFinite(stop.time)).toBe(true);
    }
  });
});

// ─── Table-based algorithms with out-of-range inputs ────────────────────

describe('Boundary: table-based algorithms beyond table range', () => {
  it('DSAT handles 100m depth', () => {
    const phases = getPhases(100, 10);
    const result = calculateDSAT(phases, OPTS);
    expect(result).toBeDefined();
  });

  it('USNavy handles depth beyond table (100m)', () => {
    const phases = getPhases(100, 10);
    const result = calculateUSNavy(phases, OPTS);
    expect(result).toBeDefined();
  });

  it('BSAC handles depth beyond table (100m)', () => {
    const phases = getPhases(100, 10);
    const result = calculateBSAC(phases, OPTS);
    expect(result).toBeDefined();
  });
});
