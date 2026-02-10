/**
 * RGBM (Reduced Gradient Bubble Model) decompression algorithm.
 * 
 * Wienke's model applies bubble reduction factors to dissolved gas M-values
 * (Bühlmann-style). The key insight: free-phase bubbles form during ascent,
 * and the allowable supersaturation must be REDUCED to account for them.
 * 
 * RGBM is more conservative than Bühlmann, especially for:
 * - Deep dives (more bubble formation)
 * - Fast ascents (more bubble excitation) 
 * - Long dives (more dissolved gas → more bubbles)
 * 
 * This implementation uses Bühlmann ZHL-16C as the base dissolved gas model
 * and applies RGBM bubble reduction factors to the M-values.
 */

// ZHL-16C parameters now imported from buhlmann.js via PARAM_SETS

import { P_SURFACE } from './constants.js';
import { depthToPressure, inspiredPressure, schreiner } from './physics.js';
import { PARAM_SETS } from './buhlmann.js';

// Reuse ZHL-16C half-times from Bühlmann; a/b values are RGBM-specific
const ZHL16C = PARAM_SETS['zhl16c'];
const RGBM_A = [1.2599, 1.0000, 0.8618, 0.7562, 0.6200, 0.5043, 0.4410, 0.4000, 0.3750, 0.3500, 0.3295, 0.3065, 0.2835, 0.2610, 0.2480, 0.2327];
const RGBM_B = [0.5050, 0.6514, 0.7222, 0.7825, 0.8126, 0.8434, 0.8693, 0.8910, 0.9092, 0.9222, 0.9319, 0.9403, 0.9477, 0.9544, 0.9602, 0.9653];
const COMPARTMENTS = ZHL16C.halfTimes.map((ht, i) => [ht, RGBM_A[i], RGBM_B[i]]);

/**
 * Calculate RGBM bubble reduction factor for each compartment.
 * 
 * The bubble factor reduces the allowable M-value based on:
 * 1. Maximum depth (deeper = more bubble excitation)
 * 2. Total bottom time (longer = more gas loading)
 * 3. Compartment half-time (faster tissues form bubbles more readily)
 * 
 * Factor ranges from ~0.6 (very deep/long) to ~0.95 (shallow/short)
 * Applied as: M_reduced = ambient + (M_buhlmann - ambient) * factor
 */
function calcBubbleFactors(maxDepth, totalBottomTime) {
  const factors = [];
  
  for (let i = 0; i < 16; i++) {
    const halfTime = COMPARTMENTS[i][0];
    
    // Depth factor: deeper dives excite more bubble nuclei
    // Normalized to typical recreational range
    const depthFactor = 1.0 - 0.15 * Math.min(1.0, maxDepth / 100.0);
    
    // Time factor: longer dives allow more bubble formation
    const timeFactor = 1.0 - 0.10 * Math.min(1.0, totalBottomTime / 60.0);
    
    // Compartment factor: fast compartments are more affected by bubbles
    // Slow compartments have less bubble issue
    const compartmentFactor = 1.0 - 0.08 * Math.exp(-halfTime / 30.0);
    
    // Combined bubble reduction factor
    let factor = depthFactor * timeFactor * compartmentFactor;
    
    // Clamp to reasonable range
    factor = Math.max(0.55, Math.min(0.98, factor));
    
    factors.push(factor);
  }
  
  return factors;
}

/**
 * Run RGBM decompression calculation.
 */
export function calculateRGBM(phases, options = {}) {
  const { fO2 = 0.21, gfLow = 50, gfHigh = 70, ascentRate = 9, fHe = 0, gasSwitches = [] } = options;
  const fN2 = 1.0 - fO2 - (fHe || 0);
  const maxDepth = Math.max(...phases.map(p => p.depth), 0);
  const totalBottomTime = phases.reduce((sum, p) => sum + p.duration, 0);

  // Initialize tissues at surface equilibrium
  const surfaceN2 = inspiredPressure(0, fN2);
  const tissueLoading = new Array(16).fill(surfaceN2);

  // Process dive phases
  for (const phase of phases) {
    const pi = inspiredPressure(phase.depth, fN2);
    for (let i = 0; i < 16; i++) {
      tissueLoading[i] = schreiner(tissueLoading[i], pi, phase.duration, COMPARTMENTS[i][0]);
    }
  }

  // Calculate bubble reduction factors
  const bubbleFactors = calcBubbleFactors(maxDepth, totalBottomTime);

  // Find ceiling using reduced M-values
  let rawCeiling = 0;
  for (let i = 0; i < 16; i++) {
    const [, a, b] = COMPARTMENTS[i];
    const pN2 = tissueLoading[i];
    const gf = gfLow / 100.0;
    const bf = bubbleFactors[i];
    
    // Bühlmann ceiling: ambient where tissue is at M-value limit
    // M = a + P_ambient / b
    // With GF: allowed = P_ambient + (M - P_ambient) * GF * BF
    // Solve for P_ambient where pN2 = P_ambient + (a + P_ambient/b - P_ambient) * GF * BF
    // pN2 = P_ambient + (a + P_ambient*(1/b - 1)) * GF * BF
    // pN2 = P_ambient * (1 + (1/b - 1) * GF * BF) + a * GF * BF
    const combinedFactor = gf * bf;
    const ceilingPressure = (pN2 - a * combinedFactor) / (1 + (1/b - 1) * combinedFactor);
    const ceilingDepth = Math.max(0, (ceilingPressure - P_SURFACE) * 10);
    
    if (ceilingDepth > rawCeiling) rawCeiling = ceilingDepth;
  }

  const firstStopDepth = Math.ceil(rawCeiling / 3) * 3;

  // Generate deco stops
  const decoStops = [];
  const workingTissue = [...tissueLoading];

  if (firstStopDepth > 0) {
    let currentStop = firstStopDepth;

    while (currentStop >= 3) {
      const prevDepth = currentStop === firstStopDepth
        ? phases[phases.length - 1]?.depth || 0
        : currentStop + 3;

      const transitTime = Math.ceil(Math.abs(prevDepth - currentStop) / ascentRate);
      const transitPi = inspiredPressure(currentStop, fN2);
      for (let i = 0; i < 16; i++) {
        workingTissue[i] = schreiner(workingTissue[i], transitPi, transitTime, COMPARTMENTS[i][0]);
      }

      const nextStop = currentStop - 3;
      const nextAmbient = depthToPressure(nextStop);

      // GF interpolation with bubble factor
      const gfAtStop = firstStopDepth > 0
        ? gfLow + (gfHigh - gfLow) * (1 - nextStop / firstStopDepth)
        : gfHigh;

      let stopTime = 0;
      const simTissue = [...workingTissue];

      for (let minute = 1; minute <= 999; minute++) {
        let canAscend = true;
        for (let i = 0; i < 16; i++) {
          const [, a, b] = COMPARTMENTS[i];
          const bf = bubbleFactors[i];
          const gf = gfAtStop / 100.0;
          
          // Reduced M-value
          const mValue = a + nextAmbient / b;
          const allowedTension = nextAmbient + (mValue - nextAmbient) * gf * bf;
          
          if (simTissue[i] > allowedTension) {
            canAscend = false;
            break;
          }
        }
        if (canAscend) {
          stopTime = minute;
          break;
        }
        const pi = inspiredPressure(currentStop, fN2);
        for (let i = 0; i < 16; i++) {
          simTissue[i] = schreiner(simTissue[i], pi, 1, COMPARTMENTS[i][0]);
        }
        stopTime = minute + 1;
      }

      if (stopTime > 0) {
        decoStops.push({ depth: currentStop, time: stopTime });
      }

      const pi = inspiredPressure(currentStop, fN2);
      for (let i = 0; i < 16; i++) {
        workingTissue[i] = schreiner(workingTissue[i], pi, stopTime, COMPARTMENTS[i][0]);
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
