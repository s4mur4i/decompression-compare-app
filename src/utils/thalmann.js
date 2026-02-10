/**
 * Thalmann/VVAL-18 decompression algorithm implementation.
 * 
 * US Navy's asymmetric gas kinetics model with exponential uptake
 * and linear elimination. Different half-times for on-gassing vs off-gassing.
 * Uses linear-exponential kinetics rather than pure exponential.
 */

// Thalmann 9-compartment model
// [uptakeHalfTime(min), eliminationHalfTime(min), M0(ATA), deltaM(ATA/fsw)]
const THALMANN_COMPARTMENTS = [
  [5.0, 5.0, 3.1, 0.0523],     // Compartment 1 - Fast symmetric
  [10.0, 15.0, 2.5, 0.0415],   // Compartment 2 - Asymmetric begins
  [20.0, 30.0, 2.2, 0.0328],   // Compartment 3
  [40.0, 60.0, 1.9, 0.0269],   // Compartment 4
  [80.0, 120.0, 1.7, 0.0239],  // Compartment 5 - Peak asymmetry
  [120.0, 160.0, 1.6, 0.0221], // Compartment 6
  [160.0, 200.0, 1.5, 0.0208], // Compartment 7
  [200.0, 240.0, 1.45, 0.0199],// Compartment 8
  [240.0, 300.0, 1.4, 0.0194] // Compartment 9 - Slow asymmetric
];

import { LINEAR_THRESHOLD_FACTOR } from './constants.js';
import { depthToPressure, inspiredPressure, schreiner as exponentialUptake } from './physics.js';

/**
 * Linear elimination for off-gassing when supersaturated.
 * Key feature of Thalmann algorithm - constant elimination rate.
 */
function linearElimination(p0, pi, time, eliminationHalfTime, ambientPressure) {
  if (time <= 0) return p0;
  
  // Check if tissue is supersaturated enough for linear kinetics
  const threshold = ambientPressure * LINEAR_THRESHOLD_FACTOR;
  
  if (p0 <= threshold || pi >= p0) {
    // Use exponential kinetics for uptake or minimal supersaturation
    const k = Math.LN2 / eliminationHalfTime;
    return p0 + (pi - p0) * (1 - Math.exp(-k * time));
  }
  
  // Linear elimination rate (pressure per minute)
  // Based on assumption that bubbles limit elimination to linear rate
  const eliminationRate = (p0 - threshold) / (eliminationHalfTime * 2.0); // Half-time to threshold
  
  const newPressure = p0 - (eliminationRate * time);
  
  // Don't go below equilibrium pressure
  return Math.max(pi, newPressure);
}

/**
 * Thalmann asymmetric tissue loading update.
 */
function thalmannTissueUpdate(p0, pi, time, compartment, ambientPressure) {
  const [uptakeHalfTime, eliminationHalfTime] = THALMANN_COMPARTMENTS[compartment];
  
  if (pi >= p0) {
    // On-gassing: use exponential uptake kinetics
    return exponentialUptake(p0, pi, time, uptakeHalfTime);
  } else {
    // Off-gassing: use linear elimination if supersaturated
    return linearElimination(p0, pi, time, eliminationHalfTime, ambientPressure);
  }
}

/**
 * Calculate Thalmann M-value for given compartment at specified depth.
 * M = M0 + ΔM × depth_fsw (feet of seawater)
 */
function thalmannMValue(compartment, depth) {
  const [, , m0, deltaM] = THALMANN_COMPARTMENTS[compartment];
  const depthFsw = depth * 3.28084; // Convert meters to feet
  return m0 + deltaM * depthFsw;
}

/**
 * Calculate Thalmann ceiling depth for current tissue loading.
 */
function thalmannCeiling(tissueLoading) {
  let maxCeiling = 0;
  
  for (let i = 0; i < THALMANN_COMPARTMENTS.length; i++) {
    const pN2 = tissueLoading[i];
    const [, , m0, deltaM] = THALMANN_COMPARTMENTS[i];
    
    if (pN2 <= m0) {
      // Tissue pressure below surface M-value
      continue;
    }
    
    // Solve for depth: P_tissue = M0 + ΔM × depth_fsw
    const ceilingFsw = (pN2 - m0) / deltaM;
    const ceilingDepth = Math.max(0, ceilingFsw / 3.28084);
    
    if (ceilingDepth > maxCeiling) {
      maxCeiling = ceilingDepth;
    }
  }
  
  return maxCeiling;
}

/**
 * Check if tissue can ascend safely to specified depth.
 */
function canAscendThalmann(tissueLoading, newDepth) {
  for (let i = 0; i < THALMANN_COMPARTMENTS.length; i++) {
    const allowable = thalmannMValue(i, newDepth);
    if (tissueLoading[i] > allowable) {
      return false;
    }
  }
  return true;
}

/**
 * Run Thalmann/VVAL-18 asymmetric decompression calculation.
 * 
 * @param {Array<{depth: number, duration: number, action: string}>} phases - Dive phases from profile
 * @param {number} fO2 - Fraction of O2 in breathing gas (e.g., 0.21 for air)
 * @param {number} gfLow - Ignored (Thalmann doesn't use gradient factors)
 * @param {number} gfHigh - Ignored (Thalmann doesn't use gradient factors)
 * @param {number} ascentRate - Ascent rate in m/min
 * @returns {Object} Deco stops and tissue data
 */
export function calculateThalmann(phases, options = {}) {
  const { fO2 = 0.21, ascentRate = 9 } = options;
  const fN2 = 1.0 - fO2;
  
  // Initialize tissue loading at surface equilibrium
  const surfaceN2 = inspiredPressure(0, fN2);
  const tissueLoading = new Array(THALMANN_COMPARTMENTS.length).fill(surfaceN2);
  
  // Process each phase to build tissue loading using asymmetric kinetics
  for (const phase of phases) {
    const pi = inspiredPressure(phase.depth, fN2);
    const ambientPressure = depthToPressure(phase.depth);
    const duration = phase.duration;
    
    for (let i = 0; i < THALMANN_COMPARTMENTS.length; i++) {
      tissueLoading[i] = thalmannTissueUpdate(
        tissueLoading[i], 
        pi, 
        duration, 
        i, 
        ambientPressure
      );
    }
  }
  
  // Calculate ceiling using Thalmann M-values
  const rawCeiling = thalmannCeiling(tissueLoading);
  
  // Round ceiling up to next 3m stop
  const firstStopDepth = Math.ceil(rawCeiling / 3) * 3;
  
  // Generate Thalmann decompression stops
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
      const transitAmbient = depthToPressure(currentStop);
      
      for (let i = 0; i < THALMANN_COMPARTMENTS.length; i++) {
        tempTissue[i] = thalmannTissueUpdate(
          tempTissue[i], 
          transitPi, 
          transitTime, 
          i, 
          transitAmbient
        );
      }
      
      // Check if we can ascend to next stop
      const nextStop = currentStop - 3;
      let canAscend = false;
      const simTissue = [...tempTissue];
      
      // Stay at stop until M-value allows ascent
      for (let minute = 1; minute <= 999; minute++) {
        if (canAscendThalmann(simTissue, nextStop)) {
          canAscend = true;
          stopTime = minute;
          break;
        }
        
        // Simulate 1 more minute at this stop using asymmetric kinetics
        const pi = inspiredPressure(currentStop, fN2);
        const ambient = depthToPressure(currentStop);
        
        for (let i = 0; i < THALMANN_COMPARTMENTS.length; i++) {
          simTissue[i] = thalmannTissueUpdate(simTissue[i], pi, 1, i, ambient);
        }
        stopTime = minute + 1;
      }
      
      if (stopTime > 0) {
        decoStops.push({ depth: currentStop, time: stopTime });
      }
      
      // Update working tissue with actual stop time using asymmetric kinetics
      const pi = inspiredPressure(currentStop, fN2);
      const ambient = depthToPressure(currentStop);
      
      for (let i = 0; i < THALMANN_COMPARTMENTS.length; i++) {
        workingTissue[i] = thalmannTissueUpdate(
          workingTissue[i], 
          pi, 
          transitTime + stopTime, 
          i, 
          ambient
        );
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