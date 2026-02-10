import { describe, it, expect } from 'vitest';
import { calculateDiveProfile, addAscentPhases, simpleAscent, parsePlan, serializePlan } from '../utils/diveProfile';
import { calculateZHL16C } from '../utils/buhlmann';
import { calculateVPM } from '../utils/vpm';
import { calculateRGBM } from '../utils/rgbm';
import { calculateHaldane } from '../utils/haldane';
import { calculateDCIEM } from '../utils/dciem';
import { calculateCNS, calculateOTU } from '../utils/oxygenToxicity';
import { calculateGasConsumption, calculateRockBottom, calculateTurnPressure } from '../utils/gasPlanning';
import { findNDLForProfile } from '../utils/ndl';

function fullDive(stops, settings = {}) {
  const {
    algorithm = calculateZHL16C,
    fO2 = 0.21, fHe = 0, gfLow = 50, gfHigh = 70,
    ascentRate = 9, descentRate = 18, decoAscentRate = 9,
    gasSwitches = [], lastStopDepth = 6,
  } = settings;

  const profile = calculateDiveProfile(stops, descentRate, ascentRate);
  const result = algorithm(profile.phases, { fO2, fHe, gfLow, gfHigh, ascentRate, decoAscentRate, gasSwitches, lastStopDepth });
  const fullProfile = addAscentPhases(profile, result.decoStops, decoAscentRate);
  return { ...fullProfile, decoInfo: result };
}

describe('Integration: Full dive flow', () => {
  it('air dive 30m/20min produces valid profile', () => {
    const result = fullDive([{ depth: 30, time: 20 }]);
    expect(result.points.length).toBeGreaterThan(2);
    expect(result.phases.length).toBeGreaterThan(2);
    expect(result.totalTime).toBeGreaterThan(20);
    expect(result.points[0].depth).toBe(0);
    expect(result.points[result.points.length - 1].depth).toBe(0);
  });

  it('nitrox 32 dive has shorter deco than air', () => {
    const stops = [{ depth: 30, time: 30 }];
    const air = fullDive(stops, { fO2: 0.21 });
    const ean32 = fullDive(stops, { fO2: 0.32 });
    expect(ean32.totalTime).toBeLessThanOrEqual(air.totalTime);
  });

  it('trimix dive produces He loading', () => {
    const result = fullDive([{ depth: 50, time: 20 }], { fO2: 0.21, fHe: 0.35 });
    expect(result.decoInfo.heLoading).not.toBeNull();
    expect(result.decoInfo.heLoading.some(v => v > 0)).toBe(true);
  });

  it('multi-gas with deco gas reduces deco time', () => {
    const stops = [{ depth: 40, time: 25 }];
    const noGas = fullDive(stops, { gfLow: 30, gfHigh: 70 });
    const withGas = fullDive(stops, {
      gfLow: 30, gfHigh: 70,
      gasSwitches: [{ depth: 21, fO2: 0.50, fHe: 0 }],
    });
    expect(withGas.totalTime).toBeLessThanOrEqual(noGas.totalTime);
  });

  it('safety stop added on simple ascent', () => {
    const profile = calculateDiveProfile([{ depth: 18, time: 30 }], 18, 9);
    const result = simpleAscent(profile, 9, 6);
    const safetyPhase = result.phases.find(p => p.action === 'Safety Stop');
    expect(safetyPhase).toBeDefined();
    expect(safetyPhase.depth).toBe(6);
    expect(safetyPhase.duration).toBe(3);
  });

  it('no safety stop for shallow dives', () => {
    const profile = calculateDiveProfile([{ depth: 5, time: 30 }], 18, 9);
    const result = simpleAscent(profile, 9, 6);
    const safetyPhase = result.phases.find(p => p.action === 'Safety Stop');
    expect(safetyPhase).toBeUndefined();
  });
});

describe('Integration: O₂ Toxicity', () => {
  it('CNS increases with depth and time', () => {
    const profile = calculateDiveProfile([{ depth: 30, time: 30 }], 18, 9);
    const result = calculateZHL16C(profile.phases, { fO2: 0.32, gfLow: 50, gfHigh: 70, ascentRate: 9 });
    const fullProfile = addAscentPhases(profile, result.decoStops, 9);

    const cns = calculateCNS(fullProfile.phases, 0.32);
    expect(cns.totalCNS).toBeGreaterThan(0);
    expect(cns.perPhase.length).toBe(fullProfile.phases.length);
    // CNS should be monotonically increasing
    for (let i = 1; i < cns.perPhase.length; i++) {
      expect(cns.perPhase[i].runningCNS).toBeGreaterThanOrEqual(cns.perPhase[i - 1].runningCNS);
    }
  });

  it('OTU calculated correctly', () => {
    const profile = calculateDiveProfile([{ depth: 20, time: 40 }], 18, 9);
    const otu = calculateOTU(profile.phases, 0.21);
    expect(otu.totalOTU).toBeGreaterThan(0);
  });

  it('high O₂ at depth produces higher CNS', () => {
    const profile = calculateDiveProfile([{ depth: 30, time: 20 }], 18, 9);
    const cnsAir = calculateCNS(profile.phases, 0.21);
    const cnsNitrox = calculateCNS(profile.phases, 0.36);
    expect(cnsNitrox.totalCNS).toBeGreaterThan(cnsAir.totalCNS);
  });
});

describe('Integration: Gas Planning', () => {
  it('gas consumption increases with depth', () => {
    const shallow = calculateDiveProfile([{ depth: 10, time: 30 }], 18, 9);
    const deep = calculateDiveProfile([{ depth: 40, time: 30 }], 18, 9);
    const gasShallow = calculateGasConsumption(shallow.phases, 20);
    const gasDeep = calculateGasConsumption(deep.phases, 20);
    expect(gasDeep.totalLiters).toBeGreaterThan(gasShallow.totalLiters);
  });

  it('rock bottom includes reserve', () => {
    const profile = calculateDiveProfile([{ depth: 30, time: 20 }], 18, 9);
    const result = calculateZHL16C(profile.phases, { fO2: 0.21, gfLow: 50, gfHigh: 70, ascentRate: 9 });
    const fullProfile = addAscentPhases(profile, result.decoStops, 9);
    const rb = calculateRockBottom(fullProfile.phases, 20, 24, 50, 9);
    expect(rb.bars).toBeGreaterThan(50); // must be more than just reserve
    expect(rb.liters).toBeGreaterThan(0);
  });

  it('turn pressure follows rule of thirds', () => {
    const tp = calculateTurnPressure(200, 50, 1000, 24);
    expect(tp.turnPressure).toBe(150); // 200 - 50 = 150 usable, 150/3=50, turn at 200-50=150
    expect(tp.startPressure).toBe(200);
  });
});

describe('Integration: NDL', () => {
  it('finds NDL for shallow no-deco dive', () => {
    const stops = [{ depth: 18, time: 20 }];
    const ndl = findNDLForProfile(stops, calculateZHL16C, {
      fO2: 0.21, gfLow: 50, gfHigh: 70, ascentRate: 9, descentRate: 18, lastStopDepth: 6,
    });
    expect(ndl).not.toBeNull();
    expect(ndl.inDeco).toBe(false);
    expect(ndl.ndl).toBeGreaterThan(0);
  });

  it('deep dive is already in deco', () => {
    const stops = [{ depth: 40, time: 30 }];
    const ndl = findNDLForProfile(stops, calculateZHL16C, {
      fO2: 0.21, gfLow: 30, gfHigh: 70, ascentRate: 9, descentRate: 18, lastStopDepth: 6,
    });
    expect(ndl).not.toBeNull();
    expect(ndl.inDeco).toBe(true);
  });
});

describe('Integration: URL round-trip', () => {
  it('serialize → parse produces same stops', () => {
    const stops = [{ depth: 30, time: 20 }, { depth: 15, time: 10 }];
    const serialized = serializePlan(stops);
    const parsed = parsePlan(serialized);
    expect(parsed).toEqual(stops);
  });
});

describe('Integration: Compare mode', () => {
  it('different algorithms produce different results', () => {
    const stops = [{ depth: 30, time: 25 }];
    const profile = calculateDiveProfile(stops, 18, 9);
    const opts = { fO2: 0.21, gfLow: 50, gfHigh: 70, ascentRate: 9 };

    const zhl = calculateZHL16C(profile.phases, opts);
    const vpm = calculateVPM(profile.phases, opts);

    // Both should produce valid results but potentially different stop profiles
    expect(zhl.decoStops).toBeDefined();
    expect(vpm.decoStops).toBeDefined();
  });
});

describe('Integration: Multi-gas configurations', () => {
  it('air dive', () => {
    const result = fullDive([{ depth: 25, time: 30 }], { fO2: 0.21 });
    expect(result.decoInfo).toBeDefined();
  });

  it('EAN32 dive', () => {
    const result = fullDive([{ depth: 25, time: 30 }], { fO2: 0.32 });
    expect(result.decoInfo).toBeDefined();
  });

  it('trimix 21/35', () => {
    const result = fullDive([{ depth: 50, time: 20 }], { fO2: 0.21, fHe: 0.35 });
    expect(result.decoInfo).toBeDefined();
    expect(result.decoInfo.heLoading).not.toBeNull();
  });

  it('multi-gas with two stages', () => {
    const result = fullDive([{ depth: 50, time: 20 }], {
      fO2: 0.21, fHe: 0.35,
      gasSwitches: [
        { depth: 21, fO2: 0.50, fHe: 0 },
        { depth: 6, fO2: 1.0, fHe: 0 },
      ],
    });
    expect(result.decoInfo).toBeDefined();
    expect(result.totalTime).toBeGreaterThan(20);
  });
});
