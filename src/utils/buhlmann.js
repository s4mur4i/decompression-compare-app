/**
 * Bühlmann ZHL-16C decompression algorithm implementation.
 * 
 * Calculates tissue loading and required decompression stops
 * based on the ZHL-16C compartment model with gradient factors.
 */

// ZHL-16C compartment parameters for Nitrogen (N2)
// [halfTime(min), a, b] for each of 16 compartments
const ZHL16C_N2 = [
  [4.0, 1.2599, 0.5050],
  [8.0, 1.0000, 0.6514],
  [12.5, 0.8618, 0.7222],
  [18.5, 0.7562, 0.7825],
  [27.0, 0.6200, 0.8126],
  [38.3, 0.5043, 0.8434],
  [54.3, 0.4410, 0.8693],
  [77.0, 0.4000, 0.8910],
  [109.0, 0.3750, 0.9092],
  [146.0, 0.3500, 0.9222],
  [187.0, 0.3295, 0.9319],
  [239.0, 0.3065, 0.9403],
  [305.0, 0.2835, 0.9477],
  [390.0, 0.2610, 0.9544],
  [498.0, 0.2480, 0.9602],
  [635.0, 0.2327, 0.9653],
];

// Water vapor pressure in lungs (bar)
const P_WATER_VAPOR = 0.0627;

// Surface atmospheric pressure (bar)
const P_SURFACE = 1.01325;

/**
 * Convert depth in meters to absolute pressure in bar (saltwater).
 */
function depthToPressure(depth) {
  return P_SURFACE + (depth / 10.0);
}

/**
 * Calculate inspired gas pressure at given depth.
 */
function inspiredPressure(depth, fGas) {
  const ambientPressure = depthToPressure(depth);
  return (ambientPressure - P_WATER_VAPOR) * fGas;
}

/**
 * Schreiner equation: tissue loading after time at constant depth.
 * P = P0 + (Pi - P0) * (1 - 2^(-t/halfTime))
 */
function schreiner(p0, pi, time, halfTime) {
  if (time <= 0) return p0;
  const k = Math.LN2 / halfTime;
  return p0 + (pi - p0) * (1 - Math.exp(-k * time));
}

/**
 * Calculate M-value (max tolerated pressure) at given ambient pressure
 * using gradient factors.
 */
function mValue(compartment, ambientPressure, gfLow, gfHigh, firstStopDepth, currentDepth) {
  const [, a, b] = ZHL16C_N2[compartment];
  const mValue0 = a + ambientPressure / b; // Bühlmann M-value

  // Calculate GF at current depth (linear interpolation between GF_low at first stop and GF_high at surface)
  let gf;
  if (firstStopDepth <= 0) {
    gf = gfHigh;
  } else {
    gf = gfHigh + ((gfLow - gfHigh) * currentDepth) / firstStopDepth;
  }
  gf = Math.min(gf, gfHigh);
  gf = Math.max(gf, gfLow);

  // Apply gradient factor
  const ambientTolerated = ambientPressure + (mValue0 - ambientPressure) * (gf / 100);
  return ambientTolerated;
}

/**
 * Calculate ceiling (minimum depth) for a given tissue state.
 */
function calcCeiling(tissueLoading, gfLow, gfHigh, firstStopDepth) {
  let maxCeiling = 0;

  for (let i = 0; i < 16; i++) {
    const [, a, b] = ZHL16C_N2[i];
    const pN2 = tissueLoading[i];

    // Solve for ambient pressure where tissue is at GF limit
    // Using GF_low for first stop calculation
    const gf = gfLow / 100;
    const ceiling = (pN2 - a * gf) / (gf / b - gf + 1);
    const ceilingDepth = Math.max(0, (ceiling - P_SURFACE) * 10);

    if (ceilingDepth > maxCeiling) {
      maxCeiling = ceilingDepth;
    }
  }

  return maxCeiling;
}

/**
 * Run Bühlmann ZHL-16C decompression calculation.
 * 
 * @param {Array<{depth: number, duration: number, action: string}>} phases - Dive phases from profile
 * @param {number} fO2 - Fraction of O2 in breathing gas (e.g., 0.21 for air)
 * @param {number} gfLow - Gradient factor low (e.g., 30)
 * @param {number} gfHigh - Gradient factor high (e.g., 70)
 * @param {number} descentRate - Descent/ascent rate in m/min
 * @returns {Object} Deco stops and tissue data
 */
export function calculateBuhlmann(phases, fO2 = 0.21, gfLow = 30, gfHigh = 70, descentRate = 9) {
  const fN2 = 1.0 - fO2;

  // Initialize tissue loading at surface equilibrium
  const surfaceN2 = inspiredPressure(0, fN2);
  const tissueLoading = new Array(16).fill(surfaceN2);

  // Process each phase to build tissue loading
  for (const phase of phases) {
    const pi = inspiredPressure(phase.depth, fN2);
    const duration = phase.duration;

    for (let i = 0; i < 16; i++) {
      tissueLoading[i] = schreiner(tissueLoading[i], pi, duration, ZHL16C_N2[i][0]);
    }
  }

  // Calculate ceiling after bottom phase
  const rawCeiling = calcCeiling(tissueLoading, gfLow, gfHigh, 0);

  // Round ceiling up to next 3m stop
  const firstStopDepth = Math.ceil(rawCeiling / 3) * 3;

  // Generate deco stops
  const decoStops = [];
  const workingTissue = [...tissueLoading];

  if (firstStopDepth > 0) {
    let currentStop = firstStopDepth;

    while (currentStop >= 3) {
      // Calculate how long we need to stay at this stop
      let stopTime = 0;
      const tempTissue = [...workingTissue];

      // Simulate ascent to this stop from previous position
      const prevDepth = currentStop === firstStopDepth
        ? phases[phases.length - 1]?.depth || 0
        : currentStop + 3;

      // Load tissues during transit
      const transitTime = Math.ceil(Math.abs(prevDepth - currentStop) / descentRate);
      const transitPi = inspiredPressure(currentStop, fN2);
      for (let i = 0; i < 16; i++) {
        tempTissue[i] = schreiner(tempTissue[i], transitPi, transitTime, ZHL16C_N2[i][0]);
      }

      // Check if we can ascend further
      const nextStop = currentStop - 3;
      const nextAmbient = depthToPressure(nextStop);

      // Stay until all compartments are below M-value for next stop
      let canAscend = false;
      const simTissue = [...tempTissue];
      
      for (let minute = 0; minute <= 999; minute++) {
        canAscend = true;
        for (let i = 0; i < 16; i++) {
          const mv = mValue(i, nextAmbient, gfLow, gfHigh, firstStopDepth, currentStop);
          if (simTissue[i] > mv) {
            canAscend = false;
            break;
          }
        }
        if (canAscend) {
          stopTime = minute;
          break;
        }
        // Simulate 1 more minute at this stop
        const pi = inspiredPressure(currentStop, fN2);
        for (let i = 0; i < 16; i++) {
          simTissue[i] = schreiner(simTissue[i], pi, 1, ZHL16C_N2[i][0]);
        }
        stopTime = minute + 1;
      }

      if (stopTime > 0) {
        decoStops.push({ depth: currentStop, time: stopTime });
      }

      // Update working tissue with actual stop time
      const pi = inspiredPressure(currentStop, fN2);
      for (let i = 0; i < 16; i++) {
        workingTissue[i] = schreiner(workingTissue[i], pi, transitTime + stopTime, ZHL16C_N2[i][0]);
      }

      currentStop -= 3;
    }
  }

  return {
    decoStops,
    firstStopDepth,
    tissueLoading: [...tissueLoading],
    ceiling: rawCeiling,
    noDecoLimit: firstStopDepth === 0,
  };
}

/**
 * Get algorithm display info.
 */
export const ALGORITHMS = {
  none: {
    name: 'No Algorithm',
    description: 'Direct ascent at descent rate, no deco calculation',
  },
  buhlmann: {
    name: 'Bühlmann ZHL-16C',
    description: 'Most widely used deco algorithm. Uses 16 tissue compartments with gradient factors.',
  },
};
