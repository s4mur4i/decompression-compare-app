/**
 * DSAT (Diving Science and Technology) / PADI Recreational Dive Planner algorithm.
 * 
 * Based on Spencer no-stop limits with modified Haldane model.
 * NDL-only: no decompression stops calculated. If NDL exceeded, indicates "deco required".
 * 
 * DSAT NDL table (no-decompression limits in minutes):
 * Based on the PADI Recreational Dive Planner (RDP).
 */

import { P_SURFACE } from './constants.js';
import { inspiredPressure, schreiner } from './physics.js';

// DSAT/PADI RDP No-Decompression Limits (depth in meters → NDL in minutes)
// These are the standard PADI table values
const DSAT_NDL_TABLE = [
  { depth: 10, ndl: 219 },
  { depth: 12, ndl: 147 },
  { depth: 14, ndl: 98 },
  { depth: 16, ndl: 72 },
  { depth: 18, ndl: 56 },
  { depth: 20, ndl: 45 },
  { depth: 22, ndl: 37 },
  { depth: 25, ndl: 29 },
  { depth: 30, ndl: 20 },
  { depth: 35, ndl: 14 },
  { depth: 40, ndl: 9 },
  { depth: 42, ndl: 8 },
];

// DSAT uses 14 compartments with these half-times (Spencer/Rogers modification)
const DSAT_HALFTIMES = [5, 10, 20, 30, 40, 60, 80, 100, 120, 160, 200, 240, 360, 480];

/**
 * Look up NDL from DSAT table (interpolating between entries).
 */
export function lookupNDL(depth) {
  if (depth <= 0) return Infinity;
  if (depth < DSAT_NDL_TABLE[0].depth) return 999;
  
  const last = DSAT_NDL_TABLE[DSAT_NDL_TABLE.length - 1];
  if (depth > last.depth) return 0; // Beyond table limits
  
  // Find bracketing entries
  for (let i = 0; i < DSAT_NDL_TABLE.length - 1; i++) {
    const a = DSAT_NDL_TABLE[i];
    const b = DSAT_NDL_TABLE[i + 1];
    if (depth >= a.depth && depth <= b.depth) {
      // Linear interpolation
      const ratio = (depth - a.depth) / (b.depth - a.depth);
      return Math.round(a.ndl + (b.ndl - a.ndl) * (1 - ratio));
    }
  }
  
  // Exact match at last entry
  return last.ndl;
}

/**
 * Run DSAT calculation.
 * Returns NDL info and whether deco is required (but no deco stops).
 */
export function calculateDSAT(phases, options = {}) {
  const { fO2 = 0.21 } = options;
  const fN2 = 1.0 - fO2;
  const nc = DSAT_HALFTIMES.length;

  // Initialize tissues at surface
  const surfaceN2 = inspiredPressure(0, fN2);
  const tissueLoading = new Array(nc).fill(surfaceN2);

  // Process dive phases
  for (const phase of phases) {
    const pi = inspiredPressure(phase.depth, fN2);
    for (let i = 0; i < nc; i++) {
      tissueLoading[i] = schreiner(tissueLoading[i], pi, phase.duration, DSAT_HALFTIMES[i]);
    }
  }

  // Find max depth from phases
  const maxDepth = Math.max(...phases.map(p => p.depth), 0);
  const totalBottomTime = phases.reduce((sum, p) => sum + p.duration, 0);
  const ndl = lookupNDL(maxDepth);
  const decoRequired = totalBottomTime > ndl;

  // Simple M-values (Spencer limits, approximately 1.6× surface pressure for fast, 1.3× for slow)
  const mValues = DSAT_HALFTIMES.map((ht, i) => {
    const ratio = 1.6 - (i / nc) * 0.3;
    return P_SURFACE * ratio;
  });

  return {
    decoStops: decoRequired ? [{ depth: 5, time: 3, safety: true, note: 'DSAT: deco required — exit water' }] : [],
    firstStopDepth: 0,
    tissueLoading: [...tissueLoading],
    ceiling: 0,
    noDecoLimit: !decoRequired,
    compartmentCount: nc,
    halfTimes: [...DSAT_HALFTIMES],
    mValues,
    ndl,
    decoRequired,
    maxDepth,
    totalBottomTime,
  };
}
