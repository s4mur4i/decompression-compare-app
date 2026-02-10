import { describe, it, expect } from 'vitest';
import { buildGasTimeline, getGasAtTime } from '../gasTimeline';

describe('buildGasTimeline', () => {
  it('returns default gas for empty phases', () => {
    const tl = buildGasTimeline([], 0.21, 0);
    expect(tl).toEqual([{ startTime: 0, fO2: 0.21, fHe: 0, fN2: 0.79 }]);
  });

  it('returns default gas for null phases', () => {
    const tl = buildGasTimeline(null, 0.32, 0);
    expect(tl[0].fO2).toBe(0.32);
  });

  it('parses gas labels from phases', () => {
    const phases = [
      { depth: 30, duration: 20, action: 'Stay' },
      { depth: 6, duration: 5, action: 'Deco Stop', gas: '50/0' },
    ];
    const tl = buildGasTimeline(phases, 0.21, 0);
    expect(tl.length).toBe(2);
    expect(tl[0].fO2).toBe(0.21);
    expect(tl[1].fO2).toBe(0.50);
    expect(tl[1].startTime).toBe(20);
  });

  it('handles trimix gas labels', () => {
    const phases = [
      { depth: 60, duration: 20, action: 'Stay', gas: '21/35' },
    ];
    const tl = buildGasTimeline(phases, 0.21, 0);
    expect(tl[0].fO2).toBe(0.21);
    expect(tl[0].fHe).toBe(0.35);
    expect(tl[0].fN2).toBeCloseTo(0.44);
  });
});

describe('getGasAtTime', () => {
  const timeline = [
    { startTime: 0, fO2: 0.21, fHe: 0, fN2: 0.79 },
    { startTime: 20, fO2: 0.50, fHe: 0, fN2: 0.50 },
    { startTime: 30, fO2: 1.0, fHe: 0, fN2: 0 },
  ];

  it('returns first gas at t=0', () => {
    expect(getGasAtTime(timeline, 0).fO2).toBe(0.21);
  });

  it('returns first gas before first switch', () => {
    expect(getGasAtTime(timeline, 10).fO2).toBe(0.21);
  });

  it('returns second gas at switch time', () => {
    expect(getGasAtTime(timeline, 20).fO2).toBe(0.50);
  });

  it('returns second gas between switches', () => {
    expect(getGasAtTime(timeline, 25).fO2).toBe(0.50);
  });

  it('returns last gas after last switch', () => {
    expect(getGasAtTime(timeline, 35).fO2).toBe(1.0);
  });
});
