/**
 * NDL (No-Decompression Limit) calculation for current dive profile.
 */
import { calculateDiveProfile } from './diveProfile';

/**
 * Find the NDL for the current profile — how many more minutes at max depth
 * before deco is required.
 * Uses binary search.
 */
export function findNDLForProfile(stops, algorithmFn, settings) {
  if (!stops || stops.length === 0 || !algorithmFn) return null;

  const { fO2 = 0.21, fHe = 0, gfLow = 50, gfHigh = 70, ascentRate = 9, descentRate = 18, lastStopDepth = 6 } = settings;
  const opts = { fO2, fHe, gfLow, gfHigh, ascentRate, lastStopDepth };

  // Current bottom time produces deco?
  const currentProfile = calculateDiveProfile(stops, descentRate, ascentRate);
  const currentResult = algorithmFn(currentProfile.phases, opts);

  if (!currentResult) return null;

  // If already in deco, NDL = 0
  if (!currentResult.noDecoLimit && currentResult.decoStops.length > 0) {
    return { ndl: 0, inDeco: true };
  }

  // Binary search for max additional bottom time on last stop
  const maxDepth = Math.max(...stops.map(s => s.depth));
  const lastStop = stops[stops.length - 1];

  let lo = 1, hi = 300, ndl = 0;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    // Extend last stop time
    const extStops = stops.map((s, i) =>
      i === stops.length - 1 ? { ...s, time: s.time + mid } : s
    );
    const profile = calculateDiveProfile(extStops, descentRate, ascentRate);
    const result = algorithmFn(profile.phases, opts);

    if (result && (result.noDecoLimit || result.decoStops.length === 0)) {
      ndl = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return { ndl, inDeco: false, maxDepth };
}
