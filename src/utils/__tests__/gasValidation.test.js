import { describe, it, expect } from 'vitest';
import { calculateDiveProfile } from '../diveProfile';
import { calculateZHL16C } from '../buhlmann';
import { inspiredPressure, depthToPressure, pressureToDepth, calcMOD, schreiner } from '../physics';

function getPhases(depth, time) {
  return calculateDiveProfile([{ depth, time }], 18, 9).phases;
}

const OPTS = { fO2: 0.21, gfLow: 50, gfHigh: 70, ascentRate: 9, decoAscentRate: 9, lastStopDepth: 6 };

// ─── Gas fraction validation ────────────────────────────────────────────

describe('Gas validation: edge cases', () => {
  it('pure O2 (fO2=1.0, fHe=0) works', () => {
    const phases = getPhases(6, 10);
    const result = calculateZHL16C(phases, { ...OPTS, fO2: 1.0, fHe: 0 });
    expect(result).toBeDefined();
    expect(result.noDecoLimit).toBe(true);
  });

  it('high O2 nitrox (fO2=0.40) works', () => {
    const phases = getPhases(25, 20);
    const result = calculateZHL16C(phases, { ...OPTS, fO2: 0.40 });
    expect(result).toBeDefined();
  });

  it('trimix with high He (fO2=0.10, fHe=0.70) works', () => {
    const phases = getPhases(60, 15);
    const result = calculateZHL16C(phases, { ...OPTS, fO2: 0.10, fHe: 0.70 });
    expect(result).toBeDefined();
    expect(result.heLoading).not.toBeNull();
  });

  it('heliox (fO2=0.16, fHe=0.84, fN2=0) works', () => {
    const phases = getPhases(50, 15);
    const result = calculateZHL16C(phases, { ...OPTS, fO2: 0.16, fHe: 0.84 });
    expect(result).toBeDefined();
  });
});

// ─── ppO2 edge cases ────────────────────────────────────────────────────

describe('ppO2 calculations', () => {
  it('MOD calculation is correct for air', () => {
    // ppO2 1.4 / 0.21 = 6.67 ATA → 56.7m → floor = 56m
    expect(calcMOD(0.21, 1.4)).toBe(56);
  });

  it('MOD for EAN32', () => {
    // ppO2 1.4 / 0.32 = 4.375 ATA → 33.75m → floor = 33m
    expect(calcMOD(0.32, 1.4)).toBe(33);
  });

  it('MOD for pure O2 at ppO2 1.6', () => {
    // 1.6 / 1.0 = 1.6 ATA → 6m
    expect(calcMOD(1.0, 1.6)).toBe(6);
  });

  it('MOD returns 0 for fO2 = 0', () => {
    expect(calcMOD(0, 1.4)).toBe(0);
  });
});

// ─── Physics functions edge cases ───────────────────────────────────────

describe('Physics functions: edge cases', () => {
  it('depthToPressure at 0m returns surface pressure', () => {
    expect(depthToPressure(0)).toBeCloseTo(1.01325, 4);
  });

  it('pressureToDepth inverts depthToPressure', () => {
    for (const depth of [0, 10, 30, 60, 100]) {
      const p = depthToPressure(depth);
      expect(pressureToDepth(p)).toBeCloseTo(depth, 4);
    }
  });

  it('pressureToDepth returns 0 for pressures below surface', () => {
    expect(pressureToDepth(0.5)).toBe(0);
  });

  it('inspiredPressure at surface for air N2', () => {
    const pi = inspiredPressure(0, 0.79);
    // (1.01325 - 0.0627) * 0.79 ≈ 0.7509
    expect(pi).toBeCloseTo(0.7509, 3);
  });

  it('schreiner with time=0 returns initial pressure', () => {
    expect(schreiner(1.5, 2.0, 0, 10)).toBe(1.5);
  });

  it('schreiner converges to inspired pressure over long time', () => {
    const result = schreiner(0.75, 2.0, 10000, 5);
    expect(result).toBeCloseTo(2.0, 2);
  });
});
