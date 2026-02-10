/**
 * Haldane decompression algorithm implementation (1908).
 * 
 * Original decompression model with 5 tissue compartments and 2:1 supersaturation ratio.
 * Historical foundation for all modern decompression algorithms.
 */

// Original Haldane compartment half-times (5 compartments)
const HALDANE_HALFTIMES = [
  5.0,   // Fast tissue (blood, lung)
  10.0,  // Medium-fast tissue  
  20.0,  // Medium tissue
  40.0,  // Medium-slow tissue
  75.0   // Slow tissue (fat, bone)
];

import { P_SURFACE as SURFACE_PRESSURE } from './constants.js';
import { depthToPressure, inspiredPressure, schreiner as haldaneEquation } from './physics.js';

/**
 * Check if tissue can ascend safely using 2:1 supersaturation ratio.
 * Original Haldane criterion: tissue pressure must not exceed 2x ambient pressure.
 */
function canAscendHaldane(tissueLoading, newDepth) {
  const newAmbient = depthToPressure(newDepth);
  
  for (let i = 0; i < HALDANE_HALFTIMES.length; i++) {
    if (tissueLoading[i] > 2.0 * newAmbient) {
      return false;
    }
  }
  return true;
}

/**
 * Calculate Haldane ceiling (minimum depth based on 2:1 ratio).
 */
function haldaneCeiling(tissueLoading) {
  let maxCeiling = 0;
  
  for (let i = 0; i < HALDANE_HALFTIMES.length; i++) {
    // Solve: P_tissue = 2 × P_ambient
    // P_tissue = 2 × (P_surface + depth/10)
    // depth = (P_tissue/2 - P_surface) × 10
    const ceilingDepth = Math.max(0, (tissueLoading[i] / 2.0 - SURFACE_PRESSURE) * 10);
    
    if (ceilingDepth > maxCeiling) {
      maxCeiling = ceilingDepth;
    }
  }
  
  return maxCeiling;
}

/**
 * Run Haldane decompression calculation.
 * 
 * @param {Array<{depth: number, duration: number, action: string}>} phases - Dive phases from profile
 * @param {number} fO2 - Fraction of O2 in breathing gas (e.g., 0.21 for air)
 * @param {number} gfLow - Ignored (Haldane doesn't use gradient factors)
 * @param {number} gfHigh - Ignored (Haldane doesn't use gradient factors)
 * @param {number} ascentRate - Ascent rate in m/min
 * @returns {Object} Deco stops and tissue data
 */
export function calculateHaldane(phases, fO2 = 0.21, gfLow = 30, gfHigh = 70, ascentRate = 9) {
  const fN2 = 1.0 - fO2;
  
  // Initialize tissue loading at surface equilibrium
  const surfaceN2 = inspiredPressure(0, fN2);
  const tissueLoading = new Array(HALDANE_HALFTIMES.length).fill(surfaceN2);
  
  // Process each phase to build tissue loading
  for (const phase of phases) {
    const pi = inspiredPressure(phase.depth, fN2);
    const duration = phase.duration;
    
    for (let i = 0; i < HALDANE_HALFTIMES.length; i++) {
      tissueLoading[i] = haldaneEquation(tissueLoading[i], pi, duration, HALDANE_HALFTIMES[i]);
    }
  }
  
  // Calculate ceiling using 2:1 supersaturation ratio
  const rawCeiling = haldaneCeiling(tissueLoading);
  
  // Round ceiling up to next 3m stop (modern convention, original used 10ft)
  const firstStopDepth = Math.ceil(rawCeiling / 3) * 3;
  
  // Generate Haldane decompression stops
  const decoStops = [];
  const workingTissue = [...tissueLoading];
  
  if (firstStopDepth > 0) {
    let currentStop = firstStopDepth;
    
    while (currentStop >= 3) {
      // Calculate time needed at this stop using 2:1 criterion
      let stopTime = 0;
      const tempTissue = [...workingTissue];
      
      // Simulate ascent to this stop
      const prevDepth = currentStop === firstStopDepth 
        ? phases[phases.length - 1]?.depth || 0 
        : currentStop + 3;
      
      const transitTime = Math.ceil(Math.abs(prevDepth - currentStop) / ascentRate);
      const transitPi = inspiredPressure(currentStop, fN2);
      for (let i = 0; i < HALDANE_HALFTIMES.length; i++) {
        tempTissue[i] = haldaneEquation(tempTissue[i], transitPi, transitTime, HALDANE_HALFTIMES[i]);
      }
      
      // Check if we can ascend to next stop (3m shallower)
      const nextStop = currentStop - 3;
      let canAscend = false;
      const simTissue = [...tempTissue];
      
      // Wait at stop until 2:1 criterion allows ascent
      for (let minute = 1; minute <= 999; minute++) {
        if (canAscendHaldane(simTissue, nextStop)) {
          canAscend = true;
          stopTime = minute;
          break;
        }
        
        // Simulate 1 more minute at this stop
        const pi = inspiredPressure(currentStop, fN2);
        for (let i = 0; i < HALDANE_HALFTIMES.length; i++) {
          simTissue[i] = haldaneEquation(simTissue[i], pi, 1, HALDANE_HALFTIMES[i]);
        }
        stopTime = minute + 1;
      }
      
      if (stopTime > 0) {
        decoStops.push({ depth: currentStop, time: stopTime });
      }
      
      // Update working tissue with actual stop time
      const pi = inspiredPressure(currentStop, fN2);
      for (let i = 0; i < HALDANE_HALFTIMES.length; i++) {
        workingTissue[i] = haldaneEquation(workingTissue[i], pi, transitTime + stopTime, HALDANE_HALFTIMES[i]);
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