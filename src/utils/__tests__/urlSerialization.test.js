import { describe, it, expect } from 'vitest';
import { parsePlan, serializePlan } from '../diveProfile';

describe('URL serialization round-trip', () => {
  it('single stop round-trips', () => {
    const stops = [{ depth: 30, time: 20 }];
    expect(parsePlan(serializePlan(stops))).toEqual(stops);
  });

  it('multi-stop round-trips', () => {
    const stops = [{ depth: 30, time: 20 }, { depth: 20, time: 10 }, { depth: 6, time: 3 }];
    expect(parsePlan(serializePlan(stops))).toEqual(stops);
  });

  it('zero depth stop round-trips', () => {
    const stops = [{ depth: 0, time: 5 }];
    expect(parsePlan(serializePlan(stops))).toEqual(stops);
  });

  it('large values round-trip', () => {
    const stops = [{ depth: 300, time: 999 }];
    expect(parsePlan(serializePlan(stops))).toEqual(stops);
  });

  it('empty array round-trips', () => {
    expect(parsePlan(serializePlan([]))).toEqual([]);
  });
});
