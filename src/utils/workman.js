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
// Converted to metric: M = M0 + ΔM × (depth_meters × METERS_TO_FEET)
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

import { P_SURFACE as SURFACE_PRESSURE, MAX_STOP_MINUTES, METERS_TO_FEET } from './constants.js';
import { depthToPressure, inspiredPressure, schreiner as exponentialLoading } from './physics.js';

/**
 * Calculate Workman M-value for given compartment at specified depth.
 * M = M0 + ΔM × depth_in_feet
 */
function workmanMValue(compartment, depth) {
  const [m0, deltaM] = WORKMAN_M_VALUES[compartment];
  const depthFeet = depth * METERS_TO_FEET; // Convert meters to feet
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
    // depth_meters = depth_feet / METERS_TO_FEET
    
    const [m0, deltaM] = WORKMAN_M_VALUES[i];
    if (pN2 <= m0) {
      // Tissue pressure below surface M-value, no ceiling
      continue;
    }
    
    const ceilingFeet = (pN2 - m0) / deltaM;
    const ceilingDepth = Math.max(0, ceilingFeet / METERS_TO_FEET);
    
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
export function calculateWorkman(phases, options = {}) {
  const { fO2 = 0.21, ascentRate = 9, decoAscentRate = 9, lastStopDepth = 6 } = options;
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
    
    while (currentStop >= lastStopDepth) {
      let stopTime = 0;
      const tempTissue = [...workingTissue];
      
      // Simulate ascent to this stop
      const prevDepth = currentStop === firstStopDepth
        ? phases[phases.length - 1]?.depth || 0
        : currentStop + 3;
      
      const transitTime = Math.ceil(Math.abs(prevDepth - currentStop) / decoAscentRate);
      const transitPi = inspiredPressure(currentStop, fN2);
      for (let i = 0; i < WORKMAN_HALFTIMES.length; i++) {
        tempTissue[i] = exponentialLoading(tempTissue[i], transitPi, transitTime, WORKMAN_HALFTIMES[i]);
      }
      
      // Check if we can ascend to next stop
      const nextStop = currentStop - 3;
      let canAscend = false;
      const simTissue = [...tempTissue];
      
      // Stay at stop until M-value allows ascent
      for (let minute = 1; minute <= MAX_STOP_MINUTES; minute++) {
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
  
  // M-values at surface (depth=0)
  const mValues = WORKMAN_HALFTIMES.map((_, i) => workmanMValue(i, 0));

  return {
    decoStops,
    firstStopDepth,
    tissueLoading: [...tissueLoading],
    ceiling: rawCeiling,
    noDecoLimit: firstStopDepth === 0,
    compartmentCount: WORKMAN_HALFTIMES.length,
    halfTimes: [...WORKMAN_HALFTIMES],
    mValues,
  };
}