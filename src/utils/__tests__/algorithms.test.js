import { describe, it, expect } from 'vitest';
import { calculateDiveProfile } from '../diveProfile';
import { calculateZHL16C, calculateZHL16A, calculateZHL6 } from '../buhlmann';
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

describe('Algorithm interface compliance', () => {
  const algos = [
    ['ZHL-16C', calculateZHL16C],
    ['ZHL-16A', calculateZHL16A],
    ['ZHL-6', calculateZHL6],
    ['VPM-B', calculateVPM],
    ['RGBM', calculateRGBM],
    ['Haldane', calculateHaldane],
    ['Workman', calculateWorkman],
    ['Thalmann', calculateThalmann],
    ['DCIEM', calculateDCIEM],
  ];

  const phases = getPhases(30, 20);

  algos.forEach(([name, fn]) => {
    it(`${name} returns correct shape`, () => {
      const result = fn(phases, { fO2: 0.21, gfLow: 50, gfHigh: 70, ascentRate: 9 });
      expect(result).toHaveProperty('decoStops');
      expect(result).toHaveProperty('firstStopDepth');
      expect(result).toHaveProperty('tissueLoading');
      expect(result).toHaveProperty('ceiling');
      expect(result).toHaveProperty('noDecoLimit');
      expect(Array.isArray(result.decoStops)).toBe(true);
      expect(Array.isArray(result.tissueLoading)).toBe(true);
      expect(typeof result.ceiling).toBe('number');
      expect(typeof result.noDecoLimit).toBe('boolean');
    });

    it(`${name} deco stops have depth and time`, () => {
      const result = fn(phases, { fO2: 0.21, gfLow: 50, gfHigh: 70, ascentRate: 9 });
      result.decoStops.forEach(stop => {
        expect(stop).toHaveProperty('depth');
        expect(stop).toHaveProperty('time');
        expect(stop.depth).toBeGreaterThanOrEqual(0);
        expect(stop.time).toBeGreaterThan(0);
      });
    });

    it(`${name} doesn't crash on shallow no-deco dive`, () => {
      const shallowPhases = getPhases(10, 5);
      const result = fn(shallowPhases, 0.21, 50, 70, 9);
      expect(result).toBeDefined();
      expect(result.noDecoLimit).toBe(true);
    });
  });
});

describe('Algorithm sanity checks', () => {
  it('deeper dive produces more deco than shallow', () => {
    const shallow = calculateZHL16C(getPhases(20, 20), { fO2: 0.21, gfLow: 50, gfHigh: 70, ascentRate: 9 });
    const deep = calculateZHL16C(getPhases(60, 20), { fO2: 0.21, gfLow: 50, gfHigh: 70, ascentRate: 9 });
    
    const shallowDeco = shallow.decoStops.reduce((a, s) => a + s.time, 0);
    const deepDeco = deep.decoStops.reduce((a, s) => a + s.time, 0);
    
    expect(deepDeco).toBeGreaterThan(shallowDeco);
  });

  it('longer dive produces more deco than shorter', () => {
    const short = calculateZHL16C(getPhases(40, 10), { fO2: 0.21, gfLow: 50, gfHigh: 70, ascentRate: 9 });
    const long = calculateZHL16C(getPhases(40, 30), { fO2: 0.21, gfLow: 50, gfHigh: 70, ascentRate: 9 });
    
    const shortDeco = short.decoStops.reduce((a, s) => a + s.time, 0);
    const longDeco = long.decoStops.reduce((a, s) => a + s.time, 0);
    
    expect(longDeco).toBeGreaterThan(shortDeco);
  });

  it('higher O2 reduces deco time', () => {
    const phases = getPhases(40, 20);
    const air = calculateZHL16C(phases, { fO2: 0.21, gfLow: 50, gfHigh: 70, ascentRate: 9 });
    const nitrox = calculateZHL16C(phases, { fO2: 0.32, gfLow: 50, gfHigh: 70, ascentRate: 9 });
    
    const airDeco = air.decoStops.reduce((a, s) => a + s.time, 0);
    const nitroxDeco = nitrox.decoStops.reduce((a, s) => a + s.time, 0);
    
    expect(nitroxDeco).toBeLessThan(airDeco);
  });

  it('lower GF produces more deco', () => {
    const phases = getPhases(50, 20);
    const conservative = calculateZHL16C(phases, { fO2: 0.21, gfLow: 30, gfHigh: 70, ascentRate: 9 });
    const liberal = calculateZHL16C(phases, { fO2: 0.21, gfLow: 70, gfHigh: 85, ascentRate: 9 });
    
    const conservDeco = conservative.decoStops.reduce((a, s) => a + s.time, 0);
    const liberalDeco = liberal.decoStops.reduce((a, s) => a + s.time, 0);
    
    expect(conservDeco).toBeGreaterThan(liberalDeco);
  });

  it('VPM-B produces deeper first stop than Bühlmann for deep dive', () => {
    const phases = getPhases(60, 20);
    const buhl = calculateZHL16C(phases, { fO2: 0.21, gfLow: 50, gfHigh: 70, ascentRate: 9 });
    const vpm = calculateVPM(phases, { fO2: 0.21, gfLow: 50, gfHigh: 70, ascentRate: 9 });
    
    expect(vpm.firstStopDepth).toBeGreaterThanOrEqual(buhl.firstStopDepth);
  });

  it('Haldane is most permissive (least deco) for moderate dive', () => {
    const phases = getPhases(40, 15);
    const haldane = calculateHaldane(phases, { fO2: 0.21, gfLow: 50, gfHigh: 70, ascentRate: 9 });
    const buhl = calculateZHL16C(phases, { fO2: 0.21, gfLow: 50, gfHigh: 70, ascentRate: 9 });
    
    const haldaneDeco = haldane.decoStops.reduce((a, s) => a + s.time, 0);
    const buhlDeco = buhl.decoStops.reduce((a, s) => a + s.time, 0);
    
    expect(haldaneDeco).toBeLessThanOrEqual(buhlDeco);
  });

  it('60m/20min on air produces significant deco for ZHL-16C', () => {
    const phases = getPhases(60, 20);
    const result = calculateZHL16C(phases, { fO2: 0.21, gfLow: 50, gfHigh: 70, ascentRate: 9 });
    const totalDeco = result.decoStops.reduce((a, s) => a + s.time, 0);
    
    // Should be roughly 60-100 min deco
    expect(totalDeco).toBeGreaterThan(30);
    expect(totalDeco).toBeLessThan(200);
    expect(result.firstStopDepth).toBeGreaterThanOrEqual(18);
  });
});
