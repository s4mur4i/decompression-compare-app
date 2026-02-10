/**
 * Calculate ceiling depth at each minute of the dive profile.
 * Uses Bühlmann-style calculation for ceiling from tissue loading.
 */
import { P_SURFACE, P_WATER_VAPOR } from './constants.js';
import { depthToPressure, inspiredPressure, schreiner } from './physics.js';
import { PARAM_SETS } from './buhlmann.js';

/**
 * Calculate ceiling timeline for a dive profile.
 * Returns array of { time, ceiling } for each minute.
 */
export function calculateCeilingTimeline(points, settings) {
  const { algorithm, fO2 = 0.21, fHe = 0, gfLow = 50, gfHigh = 70 } = settings;
  if (algorithm === 'none' || !points || points.length < 2) return [];

  // Use ZHL-16C params for Bühlmann variants, simplified for others
  const isBuhlmann = algorithm.startsWith('zhl');
  const paramKey = isBuhlmann ? algorithm : 'zhl16c';
  const paramSet = PARAM_SETS[paramKey];
  if (!paramSet) return [];

  const nc = paramSet.compartments;
  const fN2 = 1 - fO2 - fHe;
  const hasHe = fHe > 0;

  const n2 = new Array(nc).fill(inspiredPressure(0, fN2));
  const he = hasHe ? new Array(nc).fill(0) : null;

  const maxTime = points[points.length - 1].time;
  const result = [];

  // Get depth at time t by interpolating points
  function depthAt(t) {
    if (t <= 0) return 0;
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i], p2 = points[i + 1];
      if (t >= p1.time && t <= p2.time) {
        if (p1.time === p2.time) return p1.depth;
        const ratio = (t - p1.time) / (p2.time - p1.time);
        return p1.depth + (p2.depth - p1.depth) * ratio;
      }
    }
    return points[points.length - 1].depth;
  }

  let prevDepth = 0;
  for (let t = 0; t <= maxTime; t++) {
    const depth = depthAt(t);

    // Update tissues for 1 minute at current depth
    if (t > 0) {
      const piN2 = inspiredPressure(depth, fN2);
      const piHe = hasHe ? inspiredPressure(depth, fHe) : 0;
      for (let i = 0; i < nc; i++) {
        n2[i] = schreiner(n2[i], piN2, 1, paramSet.halfTimes[i]);
        if (hasHe) {
          const heIdx = Math.min(i, paramSet.heHalfTimes.length - 1);
          he[i] = schreiner(he[i], piHe, 1, paramSet.heHalfTimes[heIdx]);
        }
      }
    }

    // Calculate ceiling
    let maxCeiling = 0;
    const gf = gfLow / 100;
    for (let i = 0; i < nc; i++) {
      const pTotal = n2[i] + (he ? he[i] : 0);
      const a = paramSet.aValues[i];
      const b = paramSet.bValues[i];
      const ceiling = (pTotal - a * gf) / (gf / b - gf + 1);
      const ceilingDepth = Math.max(0, (ceiling - P_SURFACE) * 10);
      if (ceilingDepth > maxCeiling) maxCeiling = ceilingDepth;
    }

    result.push(maxCeiling);
    prevDepth = depth;
  }

  return result;
}
