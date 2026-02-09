/**
 * Bühlmann ZHL decompression algorithm implementation with all variants.
 * 
 * Calculates tissue loading and required decompression stops
 * based on various ZHL compartment models with gradient factors.
 */

// Helper function to calculate a-value from half-time
function calculateAValue(halfTime) {
  return 2 * Math.pow(halfTime, -1/3);
}

// Helper function to calculate b-value from half-time
function calculateBValue(halfTime) {
  return 1.005 - Math.pow(halfTime, -1/2);
}

// ZHL-16C compartment half-times (minutes) - shared across variants
const ZHL16_HALFTIMES = [
  4.0, 8.0, 12.5, 18.5, 27.0, 38.3, 54.3, 77.0, 109.0, 146.0, 187.0, 239.0, 305.0, 390.0, 498.0, 635.0
];

// Parameter sets for different ZHL variants
const PARAM_SETS = {
  'zhl16a': {
    name: 'ZH-L 16A',
    compartments: 16,
    halfTimes: ZHL16_HALFTIMES,
    // Original theoretical a-values derived from half-times
    aValues: [1.2599, 1.0000, 0.8618, 0.7562, 0.6200, 0.5043, 0.4410, 0.4000, 0.3750, 0.3500, 0.3295, 0.3065, 0.2835, 0.2610, 0.2480, 0.2327],
    // b-values from ZH-L16C (same across variants)
    bValues: [0.5578, 0.6514, 0.7222, 0.7825, 0.8126, 0.8434, 0.8693, 0.8910, 0.9092, 0.9222, 0.9319, 0.9403, 0.9477, 0.9544, 0.9602, 0.9653]
  },
  'zhl16b': {
    name: 'ZH-L 16B',
    compartments: 16,
    halfTimes: ZHL16_HALFTIMES,
    // Same as 16A but reduced 'a' for compartments 6,7,8
    aValues: [1.2599, 1.0000, 0.8618, 0.7562, 0.6200, 0.4770, 0.4170, 0.3798, 0.3750, 0.3500, 0.3295, 0.3065, 0.2835, 0.2610, 0.2480, 0.2327],
    bValues: [0.5578, 0.6514, 0.7222, 0.7825, 0.8126, 0.8434, 0.8693, 0.8910, 0.9092, 0.9222, 0.9319, 0.9403, 0.9477, 0.9544, 0.9602, 0.9653]
  },
  'zhl16c': {
    name: 'ZH-L 16C',
    compartments: 16,
    halfTimes: ZHL16_HALFTIMES,
    // Wikipedia values - note compartment 1 differs from 16A: 1.1696 vs 1.2599
    aValues: [1.1696, 1.0000, 0.8618, 0.7562, 0.6200, 0.5043, 0.4410, 0.4000, 0.3750, 0.3500, 0.3295, 0.3065, 0.2835, 0.2610, 0.2480, 0.2327],
    bValues: [0.5578, 0.6514, 0.7222, 0.7825, 0.8126, 0.8434, 0.8693, 0.8910, 0.9092, 0.9222, 0.9319, 0.9403, 0.9477, 0.9544, 0.9602, 0.9653]
  },
  'zhl12': {
    name: 'ZH-L 12',
    compartments: 16,
    halfTimes: ZHL16_HALFTIMES,
    // Use ZH-L16A values for historical compatibility
    aValues: [1.2599, 1.0000, 0.8618, 0.7562, 0.6200, 0.5043, 0.4410, 0.4000, 0.3750, 0.3500, 0.3295, 0.3065, 0.2835, 0.2610, 0.2480, 0.2327],
    bValues: [0.5578, 0.6514, 0.7222, 0.7825, 0.8126, 0.8434, 0.8693, 0.8910, 0.9092, 0.9222, 0.9319, 0.9403, 0.9477, 0.9544, 0.9602, 0.9653]
  },
  'zhl6': {
    name: 'ZH-L 6',
    compartments: 6,
    halfTimes: [6, 14, 34, 64, 124, 320],
    // Calculate a and b from formulas
    aValues: [6, 14, 34, 64, 124, 320].map(t => calculateAValue(t)),
    bValues: [6, 14, 34, 64, 124, 320].map(t => calculateBValue(t))
  },
  'zhl8adt': {
    name: 'ZH-L 8 ADT',
    compartments: 8,
    halfTimes: [5, 10, 20, 40, 80, 120, 240, 480],
    // Calculate a and b from formulas
    aValues: [5, 10, 20, 40, 80, 120, 240, 480].map(t => calculateAValue(t)),
    bValues: [5, 10, 20, 40, 80, 120, 240, 480].map(t => calculateBValue(t))
  }
};

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
function mValue(compartment, ambientPressure, gfLow, gfHigh, firstStopDepth, currentDepth, paramSet) {
  const a = paramSet.aValues[compartment];
  const b = paramSet.bValues[compartment];
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
function calcCeiling(tissueLoading, gfLow, gfHigh, firstStopDepth, paramSet) {
  let maxCeiling = 0;

  for (let i = 0; i < paramSet.compartments; i++) {
    const a = paramSet.aValues[i];
    const b = paramSet.bValues[i];
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
 * Run Bühlmann ZHL decompression calculation with specified variant.
 * 
 * @param {Array<{depth: number, duration: number, action: string}>} phases - Dive phases from profile
 * @param {number} fO2 - Fraction of O2 in breathing gas (e.g., 0.21 for air)
 * @param {number} gfLow - Gradient factor low (e.g., 30)
 * @param {number} gfHigh - Gradient factor high (e.g., 70)
 * @param {number} descentRate - Descent/ascent rate in m/min
 * @param {string} variant - ZHL variant to use ('zhl16a', 'zhl16b', 'zhl16c', 'zhl12', 'zhl6', 'zhl8adt')
 * @returns {Object} Deco stops and tissue data
 */
export function calculateBuhlmann(phases, fO2 = 0.21, gfLow = 30, gfHigh = 70, descentRate = 9, variant = 'zhl16c') {
  const paramSet = PARAM_SETS[variant];
  if (!paramSet) {
    throw new Error(`Unknown ZHL variant: ${variant}`);
  }

  const fN2 = 1.0 - fO2;

  // Initialize tissue loading at surface equilibrium
  const surfaceN2 = inspiredPressure(0, fN2);
  const tissueLoading = new Array(paramSet.compartments).fill(surfaceN2);

  // Process each phase to build tissue loading
  for (const phase of phases) {
    const pi = inspiredPressure(phase.depth, fN2);
    const duration = phase.duration;

    for (let i = 0; i < paramSet.compartments; i++) {
      tissueLoading[i] = schreiner(tissueLoading[i], pi, duration, paramSet.halfTimes[i]);
    }
  }

  // Calculate ceiling after bottom phase
  const rawCeiling = calcCeiling(tissueLoading, gfLow, gfHigh, 0, paramSet);

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
      for (let i = 0; i < paramSet.compartments; i++) {
        tempTissue[i] = schreiner(tempTissue[i], transitPi, transitTime, paramSet.halfTimes[i]);
      }

      // Check if we can ascend further
      const nextStop = currentStop - 3;
      const nextAmbient = depthToPressure(nextStop);

      // Stay until all compartments are below M-value for next stop
      let canAscend = false;
      const simTissue = [...tempTissue];
      
      for (let minute = 0; minute <= 999; minute++) {
        canAscend = true;
        for (let i = 0; i < paramSet.compartments; i++) {
          const mv = mValue(i, nextAmbient, gfLow, gfHigh, firstStopDepth, currentStop, paramSet);
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
        for (let i = 0; i < paramSet.compartments; i++) {
          simTissue[i] = schreiner(simTissue[i], pi, 1, paramSet.halfTimes[i]);
        }
        stopTime = minute + 1;
      }

      if (stopTime > 0) {
        decoStops.push({ depth: currentStop, time: stopTime });
      }

      // Update working tissue with actual stop time
      const pi = inspiredPressure(currentStop, fN2);
      for (let i = 0; i < paramSet.compartments; i++) {
        workingTissue[i] = schreiner(workingTissue[i], pi, transitTime + stopTime, paramSet.halfTimes[i]);
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
    variant: paramSet.name,
  };
}

// Exported convenience functions for each variant
export function calculateZHL16A(phases, fO2 = 0.21, gfLow = 30, gfHigh = 70, descentRate = 9) {
  return calculateBuhlmann(phases, fO2, gfLow, gfHigh, descentRate, 'zhl16a');
}

export function calculateZHL16B(phases, fO2 = 0.21, gfLow = 30, gfHigh = 70, descentRate = 9) {
  return calculateBuhlmann(phases, fO2, gfLow, gfHigh, descentRate, 'zhl16b');
}

export function calculateZHL16C(phases, fO2 = 0.21, gfLow = 30, gfHigh = 70, descentRate = 9) {
  return calculateBuhlmann(phases, fO2, gfLow, gfHigh, descentRate, 'zhl16c');
}

export function calculateZHL12(phases, fO2 = 0.21, gfLow = 30, gfHigh = 70, descentRate = 9) {
  return calculateBuhlmann(phases, fO2, gfLow, gfHigh, descentRate, 'zhl12');
}

export function calculateZHL6(phases, fO2 = 0.21, gfLow = 30, gfHigh = 70, descentRate = 9) {
  return calculateBuhlmann(phases, fO2, gfLow, gfHigh, descentRate, 'zhl6');
}

export function calculateZHL8ADT(phases, fO2 = 0.21, gfLow = 30, gfHigh = 70, descentRate = 9) {
  return calculateBuhlmann(phases, fO2, gfLow, gfHigh, descentRate, 'zhl8adt');
}

/**
 * Get algorithm display info.
 */
export const ALGORITHMS = {
  none: {
    name: 'No Algorithm',
    description: 'Direct ascent at descent rate, no deco calculation',
  },
  zhl16a: {
    name: 'ZH-L 16A',
    description: 'Original experimental (1986). Theoretical a-values derived from half-times.',
  },
  zhl16b: {
    name: 'ZH-L 16B',
    description: 'For printed tables. Reduced conservatism in compartments 6,7,8.',
  },
  zhl16c: {
    name: 'ZH-L 16C',
    description: 'For dive computers. Most widely used. More conservative than 16A/B.',
  },
  zhl12: {
    name: 'ZH-L 12',
    description: 'Original 1983 version. 16 compartments but 12 unique parameter pairs.',
  },
  zhl6: {
    name: 'ZH-L 6',
    description: 'Simplified 6-compartment model for early dive computers.',
  },
  zhl8adt: {
    name: 'ZH-L 8 ADT',
    description: '8-compartment adaptive model with variable half-times.',
  },
  vpm: {
    name: 'VPM-B',
    description: 'Varying Permeability Model with bubble mechanics. Produces deeper first stops than Bühlmann.',
  },
  rgbm: {
    name: 'RGBM',
    description: 'Reduced Gradient Bubble Model. Dual-phase algorithm with explicit bubble tracking.',
  },
  haldane: {
    name: 'Haldane (1908)',
    description: 'Original model. 5 compartments, 2:1 supersaturation ratio. The foundation of all modern algorithms.',
  },
  workman: {
    name: 'Workman (1965)',
    description: 'US Navy M-value approach. 9 compartments with linear pressure limits. Predecessor to Bühlmann.',
  },
  thalmann: {
    name: 'Thalmann VVAL-18',
    description: 'US Navy model with asymmetric gas kinetics. Different half-times for on-gassing vs off-gassing.',
  },
  dciem: {
    name: 'DCIEM',
    description: 'Canadian serial compartment model. 4 compartments in series (not parallel). Very conservative.',
  },
};

// Legacy export for backward compatibility  
export { calculateZHL16C as default };