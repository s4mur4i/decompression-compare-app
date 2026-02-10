/**
 * DCIEM (Defence and Civil Institute of Environmental Medicine) decompression algorithm.
 * 
 * Kidd/Stubbs SERIAL compartment model where gas flows through compartments
 * in series (compartment 1 → 2 → 3 → 4) rather than parallel uptake.
 * Known for being very conservative. Canadian military standard.
 */

// DCIEM serial compartment parameters
// [halfTime(min), allowableSupersaturation(ATA)]
const DCIEM_COMPARTMENTS = [
  [5.0, 2.3],   // Compartment 1 - Fast perfusion (blood, lung)
  [40.0, 1.9],  // Compartment 2 - Medium perfusion (muscle)  
  [120.0, 1.6], // Compartment 3 - Slow perfusion (fat)
  [480.0, 1.4]  // Compartment 4 - Very slow perfusion (bone, cartilage)
];

import { P_SURFACE as SURFACE_PRESSURE, DCIEM_ASCENT_PENALTY, DCIEM_SAFETY_FACTOR, MAX_STOP_MINUTES } from './constants.js';
import { depthToPressure, inspiredPressure, schreiner as exponentialUpdate } from './physics.js';

/**
 * Update DCIEM serial compartments where gas flows in series.
 * Input from alveoli goes to compartment 1, output goes to compartment 2, etc.
 * Each compartment acts as input source for the next.
 */
function updateDCIEMCompartments(tissueLoading, alveolarPressure, time) {
  const newLoading = [...tissueLoading];
  
  // Compartment 1: Takes input directly from alveoli
  newLoading[0] = exponentialUpdate(
    tissueLoading[0], 
    alveolarPressure, 
    time, 
    DCIEM_COMPARTMENTS[0][0]
  );
  
  // Compartment 2: Takes input from compartment 1's output
  // Output pressure is between current pressure and equilibrium
  const comp1Output = (tissueLoading[0] + newLoading[0]) / 2;
  newLoading[1] = exponentialUpdate(
    tissueLoading[1], 
    comp1Output, 
    time, 
    DCIEM_COMPARTMENTS[1][0]
  );
  
  // Compartment 3: Takes input from compartment 2's output
  const comp2Output = (tissueLoading[1] + newLoading[1]) / 2;
  newLoading[2] = exponentialUpdate(
    tissueLoading[2], 
    comp2Output, 
    time, 
    DCIEM_COMPARTMENTS[2][0]
  );
  
  // Compartment 4: Takes input from compartment 3's output
  const comp3Output = (tissueLoading[2] + newLoading[2]) / 2;
  newLoading[3] = exponentialUpdate(
    tissueLoading[3], 
    comp3Output, 
    time, 
    DCIEM_COMPARTMENTS[3][0]
  );
  
  return newLoading;
}

/**
 * Calculate DCIEM allowable ascent pressure for given compartment.
 * Uses fixed supersaturation ratios with safety factors.
 */
function dciemAllowablePressure(compartment, ambientPressure) {
  const allowableRatio = DCIEM_COMPARTMENTS[compartment][1];
  return ambientPressure * allowableRatio * DCIEM_SAFETY_FACTOR;
}

/**
 * Calculate DCIEM ceiling depth for current tissue loading.
 */
function dciemCeiling(tissueLoading) {
  let maxCeiling = 0;
  
  for (let i = 0; i < DCIEM_COMPARTMENTS.length; i++) {
    const pN2 = tissueLoading[i];
    const allowableRatio = DCIEM_COMPARTMENTS[i][1] * DCIEM_SAFETY_FACTOR;
    
    // Solve: P_tissue = allowableRatio × P_ambient
    // P_tissue = allowableRatio × (P_surface + depth/10)
    // depth = (P_tissue/allowableRatio - P_surface) × 10
    const ceilingDepth = Math.max(0, (pN2 / allowableRatio - SURFACE_PRESSURE) * 10);
    
    if (ceilingDepth > maxCeiling) {
      maxCeiling = ceilingDepth;
    }
  }
  
  return maxCeiling;
}

/**
 * Check if tissue can ascend safely to specified depth using DCIEM criteria.
 */
function canAscendDCIEM(tissueLoading, newDepth) {
  const newAmbient = depthToPressure(newDepth);
  
  for (let i = 0; i < DCIEM_COMPARTMENTS.length; i++) {
    const allowable = dciemAllowablePressure(i, newAmbient);
    if (tissueLoading[i] > allowable) {
      return false;
    }
  }
  return true;
}

/**
 * Run DCIEM serial compartment decompression calculation.
 * 
 * @param {Array<{depth: number, duration: number, action: string}>} phases - Dive phases from profile
 * @param {number} fO2 - Fraction of O2 in breathing gas (e.g., 0.21 for air)
 * @param {number} gfLow - Ignored (DCIEM doesn't use gradient factors)
 * @param {number} gfHigh - Ignored (DCIEM doesn't use gradient factors)
 * @param {number} ascentRate - Ascent rate in m/min
 * @returns {Object} Deco stops and tissue data
 */
export function calculateDCIEM(phases, options = {}) {
  const { fO2 = 0.21, ascentRate = 9, decoAscentRate = 9, lastStopDepth = 6 } = options;
  const fN2 = 1.0 - fO2;
  
  // Initialize tissue loading at surface equilibrium
  const surfaceN2 = inspiredPressure(0, fN2);
  const tissueLoading = new Array(DCIEM_COMPARTMENTS.length).fill(surfaceN2);
  
  // Process each phase using serial compartment model
  for (const phase of phases) {
    const alveolarPressure = inspiredPressure(phase.depth, fN2);
    const duration = phase.duration;
    
    // Apply ascent penalty if this is an ascent phase
    let effectiveDuration = duration;
    if (phase.action === 'ascent') {
      effectiveDuration *= DCIEM_ASCENT_PENALTY;
    }
    
    // Update all compartments using serial flow model
    const newLoading = updateDCIEMCompartments(tissueLoading, alveolarPressure, effectiveDuration);
    
    // Copy updated values
    for (let i = 0; i < DCIEM_COMPARTMENTS.length; i++) {
      tissueLoading[i] = newLoading[i];
    }
  }
  
  // Calculate ceiling using DCIEM supersaturation limits
  const rawCeiling = dciemCeiling(tissueLoading);
  
  // Round ceiling up to next 3m stop
  const firstStopDepth = Math.ceil(rawCeiling / 3) * 3;
  
  // Generate DCIEM decompression stops
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
      const transitAlveolar = inspiredPressure(currentStop, fN2);
      
      // Apply ascent penalty during transit
      const penalizedTransitTime = transitTime * DCIEM_ASCENT_PENALTY;
      
      // Update tissue during transit using serial model
      const transitLoading = updateDCIEMCompartments(tempTissue, transitAlveolar, penalizedTransitTime);
      for (let i = 0; i < DCIEM_COMPARTMENTS.length; i++) {
        tempTissue[i] = transitLoading[i];
      }
      
      // Check if we can ascend to next stop
      const nextStop = currentStop - 3;
      let canAscend = false;
      const simTissue = [...tempTissue];
      
      // Stay at stop until DCIEM criteria allow ascent
      for (let minute = 1; minute <= MAX_STOP_MINUTES; minute++) {
        if (canAscendDCIEM(simTissue, nextStop)) {
          canAscend = true;
          stopTime = minute;
          break;
        }
        
        // Simulate 1 more minute at this stop using serial compartments
        const alveolar = inspiredPressure(currentStop, fN2);
        const minuteUpdate = updateDCIEMCompartments(simTissue, alveolar, 1);
        for (let i = 0; i < DCIEM_COMPARTMENTS.length; i++) {
          simTissue[i] = minuteUpdate[i];
        }
        stopTime = minute + 1;
      }
      
      if (stopTime > 0) {
        decoStops.push({ depth: currentStop, time: stopTime });
      }
      
      // Update working tissue with actual stop time
      const alveolar = inspiredPressure(currentStop, fN2);
      const finalUpdate = updateDCIEMCompartments(workingTissue, alveolar, stopTime);
      for (let i = 0; i < DCIEM_COMPARTMENTS.length; i++) {
        workingTissue[i] = finalUpdate[i];
      }
      
      currentStop -= 3;
    }
  }
  
  const mValues = DCIEM_COMPARTMENTS.map((c) => SURFACE_PRESSURE * c[1] * DCIEM_SAFETY_FACTOR);

  return {
    decoStops,
    firstStopDepth,
    tissueLoading: [...tissueLoading],
    ceiling: rawCeiling,
    noDecoLimit: firstStopDepth === 0,
    compartmentCount: DCIEM_COMPARTMENTS.length,
    halfTimes: DCIEM_COMPARTMENTS.map(c => c[0]),
    mValues,
  };
}