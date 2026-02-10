import { describe, it, expect } from 'vitest';
import { calculateCNS, calculateOTU } from '../oxygenToxicity';

describe('CNS O2 toxicity', () => {
  it('air at 20m for 60min produces low CNS', () => {
    const phases = [{ depth: 20, duration: 60, action: 'Stay' }];
    const result = calculateCNS(phases, 0.21);
    // ppO2 = (1.01325 + 2) * 0.21 = 0.633 → limit ~720min → CNS = 60/720*100 = 8.3%
    expect(result.totalCNS).toBeGreaterThan(5);
    expect(result.totalCNS).toBeLessThan(15);
  });

  it('EAN32 at 30m for 30min produces moderate CNS', () => {
    const phases = [{ depth: 30, duration: 30, action: 'Stay' }];
    const result = calculateCNS(phases, 0.32);
    // ppO2 = (1.01325 + 3) * 0.32 = 1.284 → limit ~180min → CNS = 30/180*100 = 16.7%
    expect(result.totalCNS).toBeGreaterThan(10);
    expect(result.totalCNS).toBeLessThan(30);
  });

  it('pure O2 at 6m for 45min = 100% CNS', () => {
    const phases = [{ depth: 6, duration: 45, action: 'Stay' }];
    const result = calculateCNS(phases, 1.0);
    // ppO2 = (1.01325 + 0.6) * 1.0 = 1.613 → limit ~45min → CNS = 100%
    expect(result.totalCNS).toBeCloseTo(100, -1);
  });

  it('CNS is 0 for ppO2 ≤ 0.5 (shallow air)', () => {
    const phases = [{ depth: 0, duration: 60, action: 'Stay' }];
    const result = calculateCNS(phases, 0.21);
    // ppO2 = 1.01325 * 0.21 = 0.213 → below 0.5 threshold
    expect(result.totalCNS).toBe(0);
  });

  it('running CNS is monotonically increasing', () => {
    const phases = [
      { depth: 30, duration: 10, action: 'Stay' },
      { depth: 30, duration: 10, action: 'Stay' },
      { depth: 30, duration: 10, action: 'Stay' },
    ];
    const result = calculateCNS(phases, 0.32);
    for (let i = 1; i < result.perPhase.length; i++) {
      expect(result.perPhase[i].runningCNS).toBeGreaterThanOrEqual(result.perPhase[i - 1].runningCNS);
    }
  });

  it('handles gas switch phases correctly', () => {
    const phases = [
      { depth: 30, duration: 20, action: 'Stay' },
      { depth: 6, duration: 10, action: 'Deco Stop', gas: '100/0' },
    ];
    const result = calculateCNS(phases, 0.21);
    // Second phase uses O2 at 6m → high ppO2, should boost CNS
    expect(result.perPhase[1].cns).toBeGreaterThan(result.perPhase[0].cns);
  });
});

describe('OTU calculations', () => {
  it('OTU is 0 for ppO2 ≤ 0.5', () => {
    const phases = [{ depth: 0, duration: 60, action: 'Stay' }];
    const result = calculateOTU(phases, 0.21);
    expect(result.totalOTU).toBe(0);
  });

  it('OTU increases with depth', () => {
    const shallow = calculateOTU([{ depth: 10, duration: 30, action: 'Stay' }], 0.32);
    const deep = calculateOTU([{ depth: 30, duration: 30, action: 'Stay' }], 0.32);
    expect(deep.totalOTU).toBeGreaterThan(shallow.totalOTU);
  });

  it('OTU increases with time', () => {
    const short = calculateOTU([{ depth: 20, duration: 10, action: 'Stay' }], 0.32);
    const long = calculateOTU([{ depth: 20, duration: 30, action: 'Stay' }], 0.32);
    expect(long.totalOTU).toBeGreaterThan(short.totalOTU);
  });

  it('OTU for pure O2 at 6m for 30min is significant', () => {
    const phases = [{ depth: 6, duration: 30, action: 'Stay' }];
    const result = calculateOTU(phases, 1.0);
    // ppO2 ≈ 1.6, OTU = 30 × ((1.6-0.5)/0.5)^0.83 ≈ 30 × 2.04 ≈ 61
    expect(result.totalOTU).toBeGreaterThan(40);
    expect(result.totalOTU).toBeLessThan(100);
  });
});
