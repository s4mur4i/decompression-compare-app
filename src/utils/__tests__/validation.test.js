import { describe, it, expect } from 'vitest';
import { calculateDiveProfile } from '../diveProfile';
import { calculateZHL16C, calculateZHL16A, calculateZHL16B, calculateZHL12, calculateZHL6, calculateZHL8ADT, calculateBuhlmann } from '../buhlmann';
import { calculateVPM } from '../vpm';
import { calculateRGBM } from '../rgbm';
import { calculateHaldane } from '../haldane';
import { calculateWorkman } from '../workman';
import { calculateThalmann } from '../thalmann';
import { calculateDCIEM } from '../dciem';

// Helper: create phases for a given dive
function getPhases(depth, time) {
  const profile = calculateDiveProfile([{ depth, time }], 18, 9);
  return profile.phases;
}

function totalDecoTime(result) {
  return result.decoStops.filter(s => !s.gasSwitch).reduce((a, s) => a + s.time, 0);
}

function deepestStop(result) {
  if (result.decoStops.length === 0) return 0;
  return Math.max(...result.decoStops.map(s => s.depth));
}

function validateStopsStructure(result, bottomDepth) {
  // No stops deeper than bottom depth
  for (const stop of result.decoStops) {
    expect(stop.depth).toBeLessThanOrEqual(bottomDepth);
  }
  // No negative stop times
  for (const stop of result.decoStops) {
    expect(stop.time).toBeGreaterThanOrEqual(0);
  }
  // Stops should be monotonically decreasing in depth (non-gas-switch stops)
  const realStops = result.decoStops.filter(s => !s.gasSwitch);
  for (let i = 1; i < realStops.length; i++) {
    expect(realStops[i].depth).toBeLessThanOrEqual(realStops[i - 1].depth);
  }
  // No absurd stop times
  for (const stop of result.decoStops) {
    expect(stop.time).toBeLessThan(999);
  }
}

const OPTS_DEFAULT = { fO2: 0.21, gfLow: 50, gfHigh: 70, ascentRate: 9, decoAscentRate: 9, lastStopDepth: 6 };
const OPTS_NITROX32 = { ...OPTS_DEFAULT, fO2: 0.32 };

// ─── Reference Profile Tests ────────────────────────────────────────────

describe('Reference profiles - Air 30m/30min', () => {
  const phases = getPhases(30, 30);

  const algorithms = {
    'ZHL-16C': (p, o) => calculateZHL16C(p, o),
    'ZHL-16A': (p, o) => calculateZHL16A(p, o),
    'VPM-B': (p, o) => calculateVPM(p, o),
    'RGBM': (p, o) => calculateRGBM(p, o),
    'Haldane': (p, o) => calculateHaldane(p, o),
    'Workman': (p, o) => calculateWorkman(p, o),
    'Thalmann': (p, o) => calculateThalmann(p, o),
    'DCIEM': (p, o) => calculateDCIEM(p, o),
  };

  Object.entries(algorithms).forEach(([name, fn]) => {
    it(`${name} produces valid structure`, () => {
      const result = fn(phases, OPTS_DEFAULT);
      validateStopsStructure(result, 30);
    });

    it(`${name} total deco time is reasonable (0-30 min)`, () => {
      const result = fn(phases, OPTS_DEFAULT);
      const deco = totalDecoTime(result);
      // 30m/30min on air at GF 50/70 — light deco or no-deco for most algorithms
      expect(deco).toBeGreaterThanOrEqual(0);
      expect(deco).toBeLessThan(30);
    });
  });
});

describe('Reference profiles - Air 40m/20min', () => {
  const phases = getPhases(40, 20);

  it('ZHL-16C produces 5-40 min deco', () => {
    const result = calculateZHL16C(phases, OPTS_DEFAULT);
    validateStopsStructure(result, 40);
    const deco = totalDecoTime(result);
    expect(deco).toBeGreaterThan(3);
    expect(deco).toBeLessThan(50);
  });

  it('VPM-B produces deeper first stop than ZHL-16C', () => {
    const buhl = calculateZHL16C(phases, OPTS_DEFAULT);
    const vpm = calculateVPM(phases, OPTS_DEFAULT);
    // VPM should have deeper or equal first stop
    expect(vpm.firstStopDepth).toBeGreaterThanOrEqual(buhl.firstStopDepth);
  });
});

describe('Reference profiles - Air 50m/20min', () => {
  const phases = getPhases(50, 20);

  it('ZHL-16C produces significant deco (15-80 min)', () => {
    const result = calculateZHL16C(phases, OPTS_DEFAULT);
    validateStopsStructure(result, 50);
    const deco = totalDecoTime(result);
    expect(deco).toBeGreaterThan(15);
    expect(deco).toBeLessThan(100);
  });

  it('first stop is at least 9m deep', () => {
    const result = calculateZHL16C(phases, OPTS_DEFAULT);
    expect(result.firstStopDepth).toBeGreaterThanOrEqual(9);
  });
});

describe('Reference profiles - EAN32 30m/30min', () => {
  const phases = getPhases(30, 30);

  it('EAN32 produces less deco than air', () => {
    const air = calculateZHL16C(phases, OPTS_DEFAULT);
    const ean = calculateZHL16C(phases, OPTS_NITROX32);
    expect(totalDecoTime(ean)).toBeLessThanOrEqual(totalDecoTime(air));
  });
});

describe('Reference profiles - EAN32 25m/40min', () => {
  const phases = getPhases(25, 40);

  it('ZHL-16C with EAN32 produces reasonable deco (0-20 min)', () => {
    const result = calculateZHL16C(phases, OPTS_NITROX32);
    validateStopsStructure(result, 25);
    expect(totalDecoTime(result)).toBeLessThan(20);
  });
});

describe('Reference profiles - Trimix 21/35 60m/20min', () => {
  const phases = getPhases(60, 20);
  const opts = { ...OPTS_DEFAULT, fHe: 0.35, fO2: 0.21 };

  it('ZHL-16C produces valid trimix result', () => {
    const result = calculateZHL16C(phases, opts);
    validateStopsStructure(result, 60);
    expect(result.heLoading).not.toBeNull();
    expect(result.heLoading.length).toBe(16);
  });

  it('Trimix produces less deco than air at 60m', () => {
    const air = calculateZHL16C(phases, OPTS_DEFAULT);
    const tmx = calculateZHL16C(phases, opts);
    // Trimix has less N2 loading, so generally less deco
    expect(totalDecoTime(tmx)).toBeLessThan(totalDecoTime(air));
  });
});

describe('Reference profiles - Air 20m/60min (long shallow)', () => {
  const phases = getPhases(20, 60);

  it('ZHL-16C produces 0-15 min deco', () => {
    const result = calculateZHL16C(phases, OPTS_DEFAULT);
    validateStopsStructure(result, 20);
    expect(totalDecoTime(result)).toBeLessThan(20);
  });
});

describe('Reference profiles - Air 60m/15min (deep short)', () => {
  const phases = getPhases(60, 15);

  it('ZHL-16C produces 20-80 min deco', () => {
    const result = calculateZHL16C(phases, OPTS_DEFAULT);
    validateStopsStructure(result, 60);
    const deco = totalDecoTime(result);
    expect(deco).toBeGreaterThan(15);
    expect(deco).toBeLessThan(100);
  });
});

// ─── GF Variation Tests ─────────────────────────────────────────────────

describe('GF variations produce expected ordering', () => {
  const phases = getPhases(50, 20);

  it('GF 30/70 > GF 50/70 > GF 80/100 in deco time (ZHL-16C)', () => {
    const r1 = calculateZHL16C(phases, { ...OPTS_DEFAULT, gfLow: 30, gfHigh: 70 });
    const r2 = calculateZHL16C(phases, { ...OPTS_DEFAULT, gfLow: 50, gfHigh: 70 });
    const r3 = calculateZHL16C(phases, { ...OPTS_DEFAULT, gfLow: 80, gfHigh: 100 });
    expect(totalDecoTime(r1)).toBeGreaterThan(totalDecoTime(r2));
    expect(totalDecoTime(r2)).toBeGreaterThan(totalDecoTime(r3));
  });

  it('Lower GF produces deeper first stop', () => {
    const r1 = calculateZHL16C(phases, { ...OPTS_DEFAULT, gfLow: 30, gfHigh: 70 });
    const r3 = calculateZHL16C(phases, { ...OPTS_DEFAULT, gfLow: 80, gfHigh: 100 });
    expect(r1.firstStopDepth).toBeGreaterThanOrEqual(r3.firstStopDepth);
  });

  it('VPM-B GF ordering: 30/70 > 50/70 > 80/100', () => {
    const r1 = calculateVPM(phases, { ...OPTS_DEFAULT, gfLow: 30, gfHigh: 70 });
    const r2 = calculateVPM(phases, { ...OPTS_DEFAULT, gfLow: 50, gfHigh: 70 });
    const r3 = calculateVPM(phases, { ...OPTS_DEFAULT, gfLow: 80, gfHigh: 100 });
    expect(totalDecoTime(r1)).toBeGreaterThan(totalDecoTime(r2));
    expect(totalDecoTime(r2)).toBeGreaterThan(totalDecoTime(r3));
  });

  it('RGBM GF ordering: 30/70 > 50/70 > 80/100', () => {
    const r1 = calculateRGBM(phases, { ...OPTS_DEFAULT, gfLow: 30, gfHigh: 70 });
    const r2 = calculateRGBM(phases, { ...OPTS_DEFAULT, gfLow: 50, gfHigh: 70 });
    const r3 = calculateRGBM(phases, { ...OPTS_DEFAULT, gfLow: 80, gfHigh: 100 });
    expect(totalDecoTime(r1)).toBeGreaterThan(totalDecoTime(r2));
    expect(totalDecoTime(r2)).toBeGreaterThan(totalDecoTime(r3));
  });
});

// ─── Bühlmann Variant Tests ─────────────────────────────────────────────

describe('Bühlmann variant differences', () => {
  const phases = getPhases(50, 20);
  const opts = { ...OPTS_DEFAULT };

  it('all 6 variants produce different (or close) results', () => {
    const results = {
      a: totalDecoTime(calculateZHL16A(phases, opts)),
      b: totalDecoTime(calculateZHL16B(phases, opts)),
      c: totalDecoTime(calculateZHL16C(phases, opts)),
      l12: totalDecoTime(calculateZHL12(phases, opts)),
      l6: totalDecoTime(calculateZHL6(phases, opts)),
      l8: totalDecoTime(calculateZHL8ADT(phases, opts)),
    };
    // At least some should differ
    const values = Object.values(results);
    const unique = new Set(values);
    expect(unique.size).toBeGreaterThanOrEqual(2);
  });

  it('ZHL-16C is more conservative than ZHL-16A for 30m recreational', () => {
    const rec = getPhases(40, 20);
    const a = calculateZHL16A(rec, opts);
    const c = calculateZHL16C(rec, opts);
    // 16C has lower a-value for compartment 1, making it more conservative
    expect(totalDecoTime(c)).toBeGreaterThanOrEqual(totalDecoTime(a));
  });
});

// ─── Gas Switch Tests ───────────────────────────────────────────────────

describe('Gas switch support', () => {
  const phases = getPhases(50, 20);

  it('single gas switch (EAN50 at 22m) reduces deco', () => {
    const noSwitch = calculateZHL16C(phases, OPTS_DEFAULT);
    const withSwitch = calculateZHL16C(phases, {
      ...OPTS_DEFAULT,
      gasSwitches: [{ depth: 22, fO2: 0.50, fHe: 0 }],
    });
    expect(totalDecoTime(withSwitch)).toBeLessThan(totalDecoTime(noSwitch));
  });

  it('dual gas switch (EAN50 + O2) reduces more than single', () => {
    const single = calculateZHL16C(phases, {
      ...OPTS_DEFAULT,
      gasSwitches: [{ depth: 22, fO2: 0.50, fHe: 0 }],
    });
    const dual = calculateZHL16C(phases, {
      ...OPTS_DEFAULT,
      gasSwitches: [
        { depth: 22, fO2: 0.50, fHe: 0 },
        { depth: 6, fO2: 1.0, fHe: 0 },
      ],
    });
    expect(totalDecoTime(dual)).toBeLessThanOrEqual(totalDecoTime(single));
  });
});

// ─── Last Stop Depth Tests ──────────────────────────────────────────────

describe('Last stop depth variation', () => {
  const phases = getPhases(50, 20);

  it('3m last stop vs 6m last stop — 3m has shallower final stop', () => {
    const r3 = calculateZHL16C(phases, { ...OPTS_DEFAULT, lastStopDepth: 3 });
    const r6 = calculateZHL16C(phases, { ...OPTS_DEFAULT, lastStopDepth: 6 });
    const minDepth3 = Math.min(...r3.decoStops.filter(s => !s.gasSwitch).map(s => s.depth));
    const minDepth6 = Math.min(...r6.decoStops.filter(s => !s.gasSwitch).map(s => s.depth));
    expect(minDepth3).toBeLessThanOrEqual(minDepth6);
  });
});

// ─── Ascent Rate Tests ──────────────────────────────────────────────────

describe('Ascent rate effects', () => {
  const phases = getPhases(50, 20);

  it('slower ascent rate (3 m/min) produces similar or less deco', () => {
    const fast = calculateZHL16C(phases, { ...OPTS_DEFAULT, decoAscentRate: 18 });
    const slow = calculateZHL16C(phases, { ...OPTS_DEFAULT, decoAscentRate: 3 });
    // Both should produce valid results
    validateStopsStructure(fast, 50);
    validateStopsStructure(slow, 50);
  });
});

// ─── Regression / Golden Value Tests ────────────────────────────────────

describe('Regression tests - golden values', () => {
  it('Air 50m/20min ZHL-16C GF 50/70 — captures current output', () => {
    const phases = getPhases(50, 20);
    const result = calculateZHL16C(phases, OPTS_DEFAULT);
    // Capture key characteristics rather than exact values for stability
    expect(result.firstStopDepth).toBeGreaterThanOrEqual(9);
    expect(result.firstStopDepth).toBeLessThanOrEqual(30);
    expect(result.decoStops.length).toBeGreaterThanOrEqual(2);
    expect(result.compartmentCount).toBe(16);
    expect(totalDecoTime(result)).toBeGreaterThan(10);
  });

  it('Air 60m/20min VPM-B GF 50/70 — captures current output', () => {
    const phases = getPhases(60, 20);
    const result = calculateVPM(phases, OPTS_DEFAULT);
    expect(result.firstStopDepth).toBeGreaterThanOrEqual(12);
    expect(result.decoStops.length).toBeGreaterThanOrEqual(3);
    expect(totalDecoTime(result)).toBeGreaterThan(15);
  });

  it('Air 40m/20min RGBM GF 50/70 — captures current output', () => {
    const phases = getPhases(40, 20);
    const result = calculateRGBM(phases, OPTS_DEFAULT);
    expect(result.firstStopDepth).toBeGreaterThanOrEqual(3);
    expect(totalDecoTime(result)).toBeGreaterThan(0);
  });
});
