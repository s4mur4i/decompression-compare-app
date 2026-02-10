import { describe, it, expect } from 'vitest';
import { calculateGasConsumption, calculateRockBottom, calculateTurnPressure, litersToBars } from '../gasPlanning';

describe('Gas consumption', () => {
  it('surface consumption = SAC × time', () => {
    const phases = [{ depth: 0, duration: 10, action: 'Stay' }];
    const result = calculateGasConsumption(phases, 20);
    // At surface: SAC × (0/10 + 1) × 10 = 20 × 1 × 10 = 200
    expect(result.totalLiters).toBe(200);
  });

  it('consumption at 10m = SAC × 2 × time', () => {
    const phases = [{ depth: 10, duration: 10, action: 'Stay' }];
    const result = calculateGasConsumption(phases, 20);
    // 20 × (10/10 + 1) × 10 = 20 × 2 × 10 = 400
    expect(result.totalLiters).toBe(400);
  });

  it('transit phase uses average depth', () => {
    const phases = [{ depth: 30, duration: 2, action: 'Descend' }];
    const result = calculateGasConsumption(phases, 20);
    // avg depth = 15m, ambient = 2.5, gas = 20 × 2.5 × 2 = 100
    expect(result.totalLiters).toBe(100);
  });

  it('per-phase running total is monotonically increasing', () => {
    const phases = [
      { depth: 20, duration: 5, action: 'Stay' },
      { depth: 20, duration: 5, action: 'Stay' },
    ];
    const result = calculateGasConsumption(phases, 20);
    expect(result.perPhase[1].runningLiters).toBeGreaterThan(result.perPhase[0].runningLiters);
  });
});

describe('Rock bottom', () => {
  it('includes reserve pressure', () => {
    const phases = [{ depth: 30, duration: 20, action: 'Stay' }];
    const rb = calculateRockBottom(phases, 20, 24, 50, 9);
    expect(rb.bars).toBeGreaterThan(50);
    expect(rb.reserveBar).toBe(50);
  });

  it('deeper dive needs more rock bottom gas', () => {
    const shallow = [{ depth: 15, duration: 20, action: 'Stay' }];
    const deep = [{ depth: 40, duration: 20, action: 'Stay' }];
    const rbShallow = calculateRockBottom(shallow, 20, 24);
    const rbDeep = calculateRockBottom(deep, 20, 24);
    expect(rbDeep.liters).toBeGreaterThan(rbShallow.liters);
  });

  it('returns 0 liters for 0m depth', () => {
    const phases = [{ depth: 0, duration: 10, action: 'Stay' }];
    const rb = calculateRockBottom(phases, 20, 24);
    expect(rb.liters).toBe(0);
  });
});

describe('Turn pressure', () => {
  it('rule of thirds: 200 bar start, 50 reserve', () => {
    const tp = calculateTurnPressure(200, 50, 0, 24);
    // Usable = 150, third = 50, turn at 200 - 50 = 150
    expect(tp.turnPressure).toBe(150);
    expect(tp.thirdUsable).toBe(50);
  });

  it('sufficient flag when planned consumption is within budget', () => {
    const tp = calculateTurnPressure(200, 50, 1000, 24);
    // 1000L / 24L = 42 bar needed + 50 reserve = 92 bar ≤ 200
    expect(tp.sufficient).toBe(true);
  });

  it('insufficient flag when planned consumption exceeds budget', () => {
    const tp = calculateTurnPressure(200, 50, 5000, 24);
    // 5000L / 24L = 209 bar needed + 50 = 259 > 200
    expect(tp.sufficient).toBe(false);
  });
});

describe('litersToBars', () => {
  it('converts correctly', () => {
    expect(litersToBars(240, 12)).toBe(20);
    expect(litersToBars(0, 12)).toBe(0);
  });

  it('returns 0 for zero tank size', () => {
    expect(litersToBars(100, 0)).toBe(0);
  });
});
