import { describe, it, expect } from 'vitest';
import { calculateDiveProfile } from '../diveProfile';
import { calculateZHL16C, calculateZHL16A } from '../buhlmann';
import { calculateVPM } from '../vpm';
import { calculateRGBM } from '../rgbm';
import { calculateHaldane } from '../haldane';
import { calculateWorkman } from '../workman';
import { calculateThalmann } from '../thalmann';
import { calculateDCIEM } from '../dciem';

function getPhases(depth, time) {
  return calculateDiveProfile([{ depth, time }], 18, 9).phases;
}

function totalDecoTime(result) {
  return result.decoStops.filter(s => !s.gasSwitch).reduce((a, s) => a + s.time, 0);
}

const OPTS = { fO2: 0.21, gfLow: 50, gfHigh: 70, ascentRate: 9, decoAscentRate: 9, lastStopDepth: 6 };

// ─── Relative Conservatism ──────────────────────────────────────────────

describe('Relative conservatism ordering', () => {
  it('Air 50m/20min: Haldane ≤ Bühlmann (GF 50/70)', () => {
    const phases = getPhases(50, 20);
    const haldane = totalDecoTime(calculateHaldane(phases, OPTS));
    const buhl = totalDecoTime(calculateZHL16C(phases, OPTS));
    expect(haldane).toBeLessThanOrEqual(buhl);
  });

  it('Air 50m/20min: DCIEM produces meaningful deco', () => {
    const phases = getPhases(50, 20);
    const dciem = totalDecoTime(calculateDCIEM(phases, OPTS));
    // DCIEM serial model produces deco for 50m/20min
    expect(dciem).toBeGreaterThan(0);
  });

  it('Air 60m/20min: VPM-B first stop deeper than Bühlmann', () => {
    const phases = getPhases(60, 20);
    const buhl = calculateZHL16C(phases, OPTS);
    const vpm = calculateVPM(phases, OPTS);
    expect(vpm.firstStopDepth).toBeGreaterThanOrEqual(buhl.firstStopDepth);
  });

  it('Air 60m/20min: RGBM first stop deeper than Bühlmann', () => {
    const phases = getPhases(60, 20);
    const buhl = calculateZHL16C(phases, OPTS);
    const rgbm = calculateRGBM(phases, OPTS);
    expect(rgbm.firstStopDepth).toBeGreaterThanOrEqual(buhl.firstStopDepth);
  });
});

// ─── No Absurd Results ──────────────────────────────────────────────────

describe('No absurd results for moderate profiles', () => {
  const profiles = [
    { depth: 30, time: 30, label: '30m/30min' },
    { depth: 40, time: 20, label: '40m/20min' },
    { depth: 50, time: 20, label: '50m/20min' },
  ];

  const algos = [
    ['ZHL-16C', calculateZHL16C],
    ['ZHL-16A', calculateZHL16A],
    ['VPM-B', calculateVPM],
    ['RGBM', calculateRGBM],
    ['Haldane', calculateHaldane],
    ['Workman', calculateWorkman],
    ['Thalmann', calculateThalmann],
    ['DCIEM', calculateDCIEM],
  ];

  profiles.forEach(({ depth, time, label }) => {
    algos.forEach(([name, fn]) => {
      it(`${name} @ ${label}: no >999min stops, no negative depths`, () => {
        const phases = getPhases(depth, time);
        const result = fn(phases, OPTS);
        for (const stop of result.decoStops) {
          expect(stop.time).toBeLessThan(999);
          expect(stop.time).toBeGreaterThanOrEqual(0);
          expect(stop.depth).toBeGreaterThanOrEqual(0);
          expect(stop.depth).toBeLessThanOrEqual(depth);
        }
      });
    });
  });
});

// ─── Stop Count Consistency ─────────────────────────────────────────────

describe('Stop count consistency for 50m/20min', () => {
  const phases = getPhases(50, 20);

  it('all algorithms produce 0-15 stops', () => {
    const algos = [
      calculateZHL16C, calculateVPM, calculateRGBM,
      calculateHaldane, calculateWorkman, calculateThalmann, calculateDCIEM,
    ];
    for (const fn of algos) {
      const result = fn(phases, OPTS);
      const realStops = result.decoStops.filter(s => !s.gasSwitch);
      expect(realStops.length).toBeLessThanOrEqual(15);
    }
  });
});

// ─── All algorithms agree on no-deco for shallow ────────────────────────

describe('All algorithms agree: 10m/10min is no-deco or minimal', () => {
  const phases = getPhases(10, 10);
  const algos = [
    ['ZHL-16C', calculateZHL16C],
    ['Haldane', calculateHaldane],
    ['Workman', calculateWorkman],
    ['Thalmann', calculateThalmann],
  ];

  algos.forEach(([name, fn]) => {
    it(`${name} says no-deco`, () => {
      const result = fn(phases, OPTS);
      expect(result.noDecoLimit).toBe(true);
    });
  });

  // VPM/RGBM/DCIEM may have different thresholds, just verify minimal deco
  it('VPM-B, RGBM, DCIEM produce ≤5min deco for 10m/10min', () => {
    for (const fn of [calculateVPM, calculateRGBM, calculateDCIEM]) {
      const result = fn(phases, OPTS);
      expect(totalDecoTime(result)).toBeLessThanOrEqual(5);
    }
  });
});

// ─── All algorithms agree deep dive needs deco ──────────────────────────

describe('All algorithms agree: 60m/20min requires deco', () => {
  const phases = getPhases(60, 20);
  const algos = [
    ['ZHL-16C', calculateZHL16C],
    ['VPM-B', calculateVPM],
    ['RGBM', calculateRGBM],
    ['Haldane', calculateHaldane],
    ['Workman', calculateWorkman],
    ['Thalmann', calculateThalmann],
    ['DCIEM', calculateDCIEM],
  ];

  algos.forEach(([name, fn]) => {
    it(`${name} requires deco`, () => {
      const result = fn(phases, OPTS);
      expect(result.noDecoLimit).toBe(false);
      expect(result.decoStops.length).toBeGreaterThan(0);
    });
  });
});
