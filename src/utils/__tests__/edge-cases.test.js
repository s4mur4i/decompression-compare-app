import { describe, it, expect } from 'vitest';
import { calculateDiveProfile } from '../diveProfile';
import { calculateZHL16C, calculateBuhlmann } from '../buhlmann';
import { calculateVPM } from '../vpm';
import { calculateRGBM } from '../rgbm';
import { calculateHaldane } from '../haldane';
import { calculateWorkman } from '../workman';
import { calculateThalmann } from '../thalmann';
import { calculateDCIEM } from '../dciem';

function getPhases(depth, time) {
  const profile = calculateDiveProfile([{ depth, time }], 18, 9);
  return profile.phases;
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

// ─── Zero Bottom Time ───────────────────────────────────────────────────

describe('Zero bottom time', () => {
  allAlgos.forEach(([name, fn]) => {
    it(`${name} handles 30m/2min (transit only) without crashing`, () => {
      const profile = calculateDiveProfile([{ depth: 30, time: 2 }], 18, 9);
      const result = fn(profile.phases, OPTS);
      expect(result).toBeDefined();
      // Most algorithms should produce minimal or no deco for very short bottom time
      expect(totalDecoTime(result)).toBeLessThan(30);
    });
  });
});

// ─── Very Shallow Dive ──────────────────────────────────────────────────

describe('Very shallow dive (5m)', () => {
  const phases = getPhases(5, 30);

  allAlgos.forEach(([name, fn]) => {
    it(`${name} produces no deco for 5m/30min`, () => {
      const result = fn(phases, OPTS);
      expect(result.noDecoLimit).toBe(true);
      expect(result.decoStops.length).toBe(0);
    });
  });
});

// ─── Very Deep Dive ─────────────────────────────────────────────────────

describe('Very deep dive (100m, Bühlmann)', () => {
  const phases = getPhases(100, 10);

  it('ZHL-16C handles 100m/10min without crashing', () => {
    const result = calculateZHL16C(phases, OPTS);
    expect(result).toBeDefined();
    expect(result.firstStopDepth).toBeGreaterThanOrEqual(30);
    expect(totalDecoTime(result)).toBeGreaterThan(50);
    // Verify no absurd values
    for (const stop of result.decoStops) {
      expect(stop.time).toBeLessThan(999);
      expect(stop.depth).toBeLessThanOrEqual(100);
    }
  });
});

// ─── Very Long Dive ─────────────────────────────────────────────────────

describe('Very long dive (120min at 20m)', () => {
  const phases = getPhases(20, 120);

  it('ZHL-16C handles long saturation dive', () => {
    const result = calculateZHL16C(phases, OPTS);
    expect(result).toBeDefined();
    // Long shallow dive may still have some deco at conservative GFs
    expect(totalDecoTime(result)).toBeLessThan(60);
  });
});

// ─── GF 100/100 (no conservatism) ──────────────────────────────────────

describe('GF 100/100 (no conservatism)', () => {
  const phases = getPhases(40, 20);

  it('ZHL-16C with GF 100/100 produces minimal deco', () => {
    const result = calculateZHL16C(phases, { ...OPTS, gfLow: 100, gfHigh: 100 });
    expect(result).toBeDefined();
    // Should be less deco than default GFs
    const defaultResult = calculateZHL16C(phases, OPTS);
    expect(totalDecoTime(result)).toBeLessThanOrEqual(totalDecoTime(defaultResult));
  });
});

// ─── GF 10/50 (very conservative) ──────────────────────────────────────

describe('GF 10/50 (very conservative)', () => {
  const phases = getPhases(40, 20);

  it('ZHL-16C with GF 10/50 produces heavy deco', () => {
    const result = calculateZHL16C(phases, { ...OPTS, gfLow: 10, gfHigh: 50 });
    expect(result).toBeDefined();
    expect(totalDecoTime(result)).toBeGreaterThan(totalDecoTime(calculateZHL16C(phases, OPTS)));
  });
});

// ─── Pure O2 as deco gas ────────────────────────────────────────────────

describe('Pure O2 as deco gas', () => {
  const phases = getPhases(50, 20);

  it('O2 switch at 6m significantly reduces deco', () => {
    const noSwitch = calculateZHL16C(phases, OPTS);
    const withO2 = calculateZHL16C(phases, {
      ...OPTS,
      gasSwitches: [{ depth: 6, fO2: 1.0, fHe: 0 }],
    });
    expect(totalDecoTime(withO2)).toBeLessThan(totalDecoTime(noSwitch));
  });
});

// ─── Last Stop 3m vs 6m ────────────────────────────────────────────────

describe('Last stop depth 3m vs 6m', () => {
  const phases = getPhases(50, 20);

  it('3m last stop generates a stop at 3m', () => {
    const result = calculateZHL16C(phases, { ...OPTS, lastStopDepth: 3 });
    const has3m = result.decoStops.some(s => s.depth === 3);
    expect(has3m).toBe(true);
  });

  it('6m last stop does NOT generate a stop at 3m', () => {
    const result = calculateZHL16C(phases, { ...OPTS, lastStopDepth: 6 });
    const has3m = result.decoStops.some(s => s.depth === 3);
    expect(has3m).toBe(false);
  });
});

// ─── Different Ascent Rates ─────────────────────────────────────────────

describe('Different ascent rates', () => {
  const phases = getPhases(50, 20);

  it('ascent rate 3, 9, and 18 all produce valid results', () => {
    for (const rate of [3, 9, 18]) {
      const result = calculateZHL16C(phases, { ...OPTS, ascentRate: rate, decoAscentRate: rate });
      expect(result).toBeDefined();
      expect(result.decoStops.length).toBeGreaterThan(0);
      for (const stop of result.decoStops) {
        expect(stop.depth).toBeGreaterThanOrEqual(0);
        expect(stop.time).toBeGreaterThan(0);
      }
    }
  });
});

// ─── Algorithm doesn't crash on extreme inputs ──────────────────────────

describe('Robustness - no crashes on extreme inputs', () => {
  allAlgos.forEach(([name, fn]) => {
    it(`${name} handles empty phases array`, () => {
      const result = fn([], OPTS);
      expect(result).toBeDefined();
      expect(result.noDecoLimit).toBe(true);
    });
  });

  allAlgos.forEach(([name, fn]) => {
    it(`${name} handles single 1-min phase at 10m`, () => {
      const result = fn([{ depth: 10, duration: 1, action: 'Stay' }], OPTS);
      expect(result).toBeDefined();
    });
  });
});
