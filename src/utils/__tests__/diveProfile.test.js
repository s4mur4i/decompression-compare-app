import { describe, it, expect } from 'vitest';
import { calculateDiveProfile, parsePlan, serializePlan, getMaxDepth } from '../diveProfile';

describe('parsePlan', () => {
  it('parses valid plan string', () => {
    expect(parsePlan('25:10,20:5')).toEqual([
      { depth: 25, time: 10 },
      { depth: 20, time: 5 },
    ]);
  });

  it('returns empty for null/empty', () => {
    expect(parsePlan(null)).toEqual([]);
    expect(parsePlan('')).toEqual([]);
  });

  it('filters invalid entries', () => {
    expect(parsePlan('25:10,bad,20:5')).toEqual([
      { depth: 25, time: 10 },
      { depth: 20, time: 5 },
    ]);
  });
});

describe('serializePlan', () => {
  it('serializes stops to plan string', () => {
    expect(serializePlan([{ depth: 25, time: 10 }, { depth: 20, time: 5 }]))
      .toBe('25:10,20:5');
  });
});

describe('getMaxDepth', () => {
  it('returns max depth from stops', () => {
    expect(getMaxDepth([{ depth: 25, time: 10 }, { depth: 60, time: 5 }])).toBe(60);
  });

  it('returns 0 for empty', () => {
    expect(getMaxDepth([])).toBe(0);
  });
});

describe('calculateDiveProfile', () => {
  it('returns empty profile for no stops', () => {
    const result = calculateDiveProfile([], 18, 9);
    expect(result.points).toEqual([{ time: 0, depth: 0 }]);
    expect(result.phases).toEqual([]);
  });

  it('calculates single stop with transit included in time', () => {
    // 25m at 18m/min = ceil(25/18) = 2 min descent
    // 10 min total - 2 min transit = 8 min at depth
    const result = calculateDiveProfile([{ depth: 25, time: 10 }], 18, 9);
    
    expect(result.phases.length).toBe(2); // descend + stay
    expect(result.phases[0]).toEqual({ depth: 25, duration: 2, runTime: 0, action: 'Descend' });
    expect(result.phases[1]).toEqual({ depth: 25, duration: 8, runTime: 2, action: 'Stay' });
    expect(result.lastStopEnd).toBe(10);
    expect(result.lastDepth).toBe(25);
  });

  it('calculates multi-stop with transit included', () => {
    // Stop 1: 25m, 10min → 2min descent + 8min stay
    // Stop 2: 20m, 5min → ceil(5/9)=1min ascent + 4min stay
    const result = calculateDiveProfile(
      [{ depth: 25, time: 10 }, { depth: 20, time: 5 }], 18, 9
    );

    expect(result.phases.length).toBe(4);
    // Descent to 25m
    expect(result.phases[0].action).toBe('Descend');
    expect(result.phases[0].duration).toBe(2);
    // Stay at 25m
    expect(result.phases[1].action).toBe('Stay');
    expect(result.phases[1].duration).toBe(8);
    // Ascend to 20m
    expect(result.phases[2].action).toBe('Ascend');
    expect(result.phases[2].duration).toBe(1);
    // Stay at 20m
    expect(result.phases[3].action).toBe('Stay');
    expect(result.phases[3].duration).toBe(4);

    expect(result.lastStopEnd).toBe(15); // 10 + 5
  });

  it('rounds transit time up (ceiling)', () => {
    // 10m at 18m/min = 0.556min → ceil to 1 min
    const result = calculateDiveProfile([{ depth: 10, time: 5 }], 18, 9);
    expect(result.phases[0].duration).toBe(1); // ceil(10/18) = 1
    expect(result.phases[1].duration).toBe(4); // 5 - 1 = 4
  });

  it('handles descent deeper after shallow stop', () => {
    const result = calculateDiveProfile(
      [{ depth: 20, time: 5 }, { depth: 40, time: 10 }], 18, 9
    );
    // Second stop is deeper — should be "Descend"
    expect(result.phases[2].action).toBe('Descend');
  });
});
