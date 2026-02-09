/**
 * Workman M-value decompression algorithm implementation (1965).
 * 
 * Robert Workman's M-value approach with 9 tissue compartments.
 * Uses linear M-value relationship: M = M0 + ΔM × depth
 * Foundation for modern M-value based algorithms like Bühlmann.
 */

// Workman 9-compartment half-times (minutes)
const WORKMAN_HALFTIMES = [
  5.0,    // Compartment 1
  10.0,   // Compartment 2
  20.0,   // Compartment 3
  40.0,   // Compartment 4
  80.0,   // Compartment 5
  120.0,  // Compartment 6
  160.0,  // Compartment 7
  200.0,  // Compartment 8
  240.0   // Compartment 9
];

// Workman M-value parameters
// M-value = M0 + ΔM × depth_in_feet
// Converted to metric: M = M0 + ΔM × (depth_meters × 3.28084)
const WORKMAN_M_VALUES = [
  // [M0 (bar), ΔM (bar/foot)]
  [2.30, 0.0523],  // Compartment 1
  [2.00, 0.0415],  // Compartment 2  
  [1.70, 0.0328],  // Compartment 3
  [1.50, 0.0269],  // Compartment 4
  [1.35, 0.0239],  // Compartment 5
  [1.25, 0.0221],  // Compartment 6
  [1.18, 0.0208],  // Compartment 7
  [1.12, 0.0199],  // Compartment 8
  [1.08, 0.0194]   // Compartment 9
];

// Physical constants
const WATER_VAPOR_PRESSURE = 0.0627; // bar
const SURFACE_PRESSURE = 1.01325; // bar

/**
 * Convert depth in meters to absolute pressure in bar (saltwater).
 */
function depthToPressure(depth) {
  return SURFACE_PRESSURE + (depth / 10.0);
}

/**
 * Calculate inspired gas pressure at given depth.
 */
function inspiredPressure(depth, fGas) {
  const ambientPressure = depthToPressure(depth);
  return (ambientPressure - WATER_VAPOR_PRESSURE) * fGas;
}

/**
 * Exponential gas loading equation (Haldanian kinetics).
 */
function exponentialLoading(p0, pi, time, halfTime) {
  if (time <= 0) return p0;
  const k = Math.LN2 / halfTime;
  return p0 + (pi - p0) * (1 - Math.exp(-k * time));
}

/**
 * Calculate Workman M-value for given compartment at specified depth.
 * M = M0 + ΔM × depth_in_feet
 */
function workmanMValue(compartment, depth) {
  const [m0, deltaM] = WORKMAN_M_VALUES[compartment];
  const depthFeet = depth * 3.28084; // Convert meters to feet
  return m0 + deltaM * depthFeet;
}

/**
 * Calculate Workman ceiling depth for current tissue loading.
 */
function workmanCeiling(tissueLoading) {
  let maxCeiling = 0;
  
  for (let i = 0; i < WORKMAN_HALFTIMES.length; i++) {
    const pN2 = tissueLoading[i];
    
    // Solve for depth where tissue pressure equals M-value
    // P_tissue = M0 + ΔM × depth_feet
    // depth_feet = (P_tissue - M0) / ΔM
    // depth_meters = depth_feet / 3.28084
    
    const [m0, deltaM] = WORKMAN_M_VALUES[i];
    if (pN2 <= m0) {
      // Tissue pressure below surface M-value, no ceiling
      continue;
    }
    
    const ceilingFeet = (pN2 - m0) / deltaM;
    const ceilingDepth = Math.max(0, ceilingFeet / 3.28084);
    
    if (ceilingDepth > maxCeiling) {
      maxCeiling = ceilingDepth;
    }
  }
  
  return maxCeiling;
}

/**
 * Check if tissue can ascend safely to specified depth.
 */
function canAscendWorkman(tissueLoading, newDepth) {
  for (let i = 0; i < WORKMAN_HALFTIMES.length; i++) {
    const allowable = workmanMValue(i, newDepth);
    if (tissueLoading[i] > allowable) {
      return false;
    }
  }
  return true;
}

/**
 * Run Workman M-value decompression calculation.
 * 
 * @param {Array<{depth: number, duration: number, action: string}>} phases - Dive phases from profile
 * @param {number} fO2 - Fraction of O2 in breathing gas (e.g., 0.21 for air)
 * @param {number} gfLow - Ignored (original Workman doesn't use gradient factors)
 * @param {number} gfHigh - Ignored (original Workman doesn't use gradient factors)
 * @param {number} ascentRate - Ascent rate in m/min
 * @returns {Object} Deco stops and tissue data
 */
export function calculateWorkman(phases, fO2 = 0.21, gfLow = 30, gfHigh = 70, ascentRate = 9) {
  const fN2 = 1.0 - fO2;
  
  // Initialize tissue loading at surface equilibrium
  const surfaceN2 = inspiredPressure(0, fN2);
  const tissueLoading = new Array(WORKMAN_HALFTIMES.length).fill(surfaceN2);
  
  // Process each phase to build tissue loading
  for (const phase of phases) {
    const pi = inspiredPressure(phase.depth, fN2);
    const duration = phase.duration;
    
    for (let i = 0; i < WORKMAN_HALFTIMES.length; i++) {
      tissueLoading[i] = exponentialLoading(tissueLoading[i], pi, duration, WORKMAN_HALFTIMES[i]);
    }
  }
  
  // Calculate ceiling using Workman M-values
  const rawCeiling = workmanCeiling(tissueLoading);
  
  // Round ceiling up to next 3m stop
  const firstStopDepth = Math.ceil(rawCeiling / 3) * 3;
  
  // Generate Workman decompression stops
  const decoStops = [];
  const workingTissue = [...tissueLoading];
  
  if (firstStopDepth > 0) {
    let currentStop = firstStopDepth;
    
    while (currentStop >= 3) {
      let stopTime = 0;
      const tempTissue = [...workingTissue];
      
      // Simulate ascent to this stop
      const prevDepth = currentStop === firstStopDepth
        ? phases[phases.length - 1]?.depth || 0
        : currentStop + 3;
      
      const transitTime = Math.ceil(Math.abs(prevDepth - currentStop) / ascentRate);
      const transitPi = inspiredPressure(currentStop, fN2);
      for (let i = 0; i < WORKMAN_HALFTIMES.length; i++) {
        tempTissue[i] = exponentialLoading(tempTissue[i], transitPi, transitTime, WORKMAN_HALFTIMES[i]);
      }
      
      // Check if we can ascend to next stop
      const nextStop = currentStop - 3;
      let canAscend = false;
      const simTissue = [...tempTissue];
      
      // Stay at stop until M-value allows ascent
      for (let minute = 1; minute <= 999; minute++) {
        if (canAscendWorkman(simTissue, nextStop)) {
          canAscend = true;
          stopTime = minute;
          break;
        }
        
        // Simulate 1 more minute at this stop
        const pi = inspiredPressure(currentStop, fN2);
        for (let i = 0; i < WORKMAN_HALFTIMES.length; i++) {
          simTissue[i] = exponentialLoading(simTissue[i], pi, 1, WORKMAN_HALFTIMES[i]);
        }
        stopTime = minute + 1;
      }
      
      if (stopTime > 0) {
        decoStops.push({ depth: currentStop, time: stopTime });
      }
      
      // Update working tissue with actual stop time
      const pi = inspiredPressure(currentStop, fN2);
      for (let i = 0; i < WORKMAN_HALFTIMES.length; i++) {
        workingTissue[i] = exponentialLoading(workingTissue[i], pi, transitTime + stopTime, WORKMAN_HALFTIMES[i]);
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