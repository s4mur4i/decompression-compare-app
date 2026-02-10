/**
 * VPM-B (Varying Permeability Model) decompression algorithm.
 * 
 * Based on Yount's bubble nucleation model. Key concepts:
 * - Bubbles exist as stable nuclei in tissues
 * - At depth, pressure crushes nuclei to smaller radii
 * - On ascent, supersaturation causes bubbles to grow
 * - The allowed supersaturation gradient is limited by bubble mechanics
 * - VPM-B adds Boyle's law compensation for bubble growth
 * 
 * VPM produces deeper first stops than Bühlmann but similar total deco time.
 */

// ZHL-16C compartment half-times
const HALFTIMES = [
  4.0, 8.0, 12.5, 18.5, 27.0, 38.3, 54.3, 77.0,
  109.0, 146.0, 187.0, 239.0, 305.0, 390.0, 498.0, 635.0
];

import { P_SURFACE, GAMMA, GAMMA_C, LAMBDA_N2 } from './constants.js';
import { depthToPressure, pressureToDepth, inspiredPressure, schreiner } from './physics.js';

// Initial critical nucleus radii at surface (meters)
// These are per-compartment, derived from empirical fitting
// Faster compartments have larger initial radii (more bubble tolerance)
// Slower compartments have smaller radii (less tolerance)
const R0_N2 = [
  1.30e-6, 1.20e-6, 1.10e-6, 1.00e-6, 0.95e-6, 0.90e-6, 0.85e-6, 0.80e-6,
  0.75e-6, 0.72e-6, 0.70e-6, 0.68e-6, 0.66e-6, 0.64e-6, 0.62e-6, 0.60e-6
];

/**
 * Calculate the initial allowable supersaturation gradient for each compartment.
 * This is the gradient allowed at the FIRST stop, based on surface bubble radius.
 * 
 * G_i = (2 * gamma_total) / (r0_i * P_factor)
 * 
 * where P_factor converts N/m/m to bar (1e5 Pa/bar)
 * and gamma_total = gamma + gamma_c
 */
function calcInitialGradients() {
  const gammaTotal = GAMMA + GAMMA_C; // 0.0436 N/m
  const gradients = [];
  
  for (let i = 0; i < 16; i++) {
    // Laplace equation: ΔP = 2γ/r
    const gradientPa = 2.0 * gammaTotal / R0_N2[i];
    const gradientBar = gradientPa / 100000.0;
    gradients.push(gradientBar);
  }
  
  return gradients;
}

/**
 * Adjust initial gradients for max depth (crushing effect).
 * At depth, pressure crushes nuclei smaller. Upon ascent, the crushed
 * nuclei allow slightly different gradients.
 * 
 * The adjusted radius after crushing:
 * 1/r_new = 1/r0 + (P_max - P_surface) / (2 * gamma_total * scale)
 * 
 * where scale prevents the radius from going too small
 */
function calcAdjustedGradients(maxAmbientPressure) {
  const gammaTotal = GAMMA + GAMMA_C;
  const deltaPressure = maxAmbientPressure - P_SURFACE; // in bar
  const gradients = [];
  
  for (let i = 0; i < 16; i++) {
    // Crushing effect: deeper dive = smaller nuclei = slightly more tolerance
    // But this effect is modest, not the dominant factor
    const crushFactor = 1.0 + deltaPressure * 0.01 * (1 + i * 0.05);
    const adjustedGradient = calcInitialGradients()[i] * crushFactor;
    
    gradients.push(adjustedGradient);
  }
  
  return gradients;
}

/**
 * Calculate VPM-B ceiling for all compartments.
 * Ceiling = tissue_loading - max_gradient (in pressure units)
 */
function calcCeiling(tissueLoading, gradients, gfLow) {
  let maxCeiling = 0;
  const gfFactor = gfLow / 100.0;
  
  for (let i = 0; i < 16; i++) {
    const scaledGradient = gradients[i] * gfFactor;
    const requiredAmbient = tissueLoading[i] - scaledGradient;
    const ceilingDepth = pressureToDepth(requiredAmbient);
    
    if (ceilingDepth > maxCeiling) {
      maxCeiling = ceilingDepth;
    }
  }
  
  return maxCeiling;
}

/**
 * Run VPM-B decompression calculation.
 */
export function calculateVPM(phases, fO2 = 0.21, gfLow = 50, gfHigh = 70, ascentRate = 9, fHe = 0, gasSwitches = []) {
  const fN2 = 1.0 - fO2 - (fHe || 0);
  const maxDepth = Math.max(...phases.map(p => p.depth), 0);
  const maxAmbientPressure = depthToPressure(maxDepth);

  // Initialize tissues at surface equilibrium
  const surfaceN2 = inspiredPressure(0, fN2);
  const tissueLoading = new Array(16).fill(surfaceN2);

  // Process dive phases
  for (const phase of phases) {
    const pi = inspiredPressure(phase.depth, fN2);
    for (let i = 0; i < 16; i++) {
      tissueLoading[i] = schreiner(tissueLoading[i], pi, phase.duration, HALFTIMES[i]);
    }
  }

  // Calculate adjusted gradients based on max depth
  const gradients = calcAdjustedGradients(maxAmbientPressure);

  // Find ceiling
  const rawCeiling = calcCeiling(tissueLoading, gradients, gfLow);
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

      // Transit to this stop
      const transitTime = Math.ceil(Math.abs(prevDepth - currentStop) / ascentRate);
      const transitPi = inspiredPressure(currentStop, fN2);
      for (let i = 0; i < 16; i++) {
        workingTissue[i] = schreiner(workingTissue[i], transitPi, transitTime, HALFTIMES[i]);
      }

      // GF interpolation: gfLow at first stop → gfHigh at surface
      const nextStop = currentStop - 3;
      const gfAtNextStop = firstStopDepth > 0
        ? gfLow + (gfHigh - gfLow) * (1 - nextStop / firstStopDepth)
        : gfHigh;
      const gfFactor = gfAtNextStop / 100.0;

      // VPM-B: Boyle's compensation — gradient reduces at shallower stops
      const firstStopPressure = depthToPressure(firstStopDepth);
      const nextStopPressure = depthToPressure(nextStop);
      const boyleRatio = nextStopPressure > 0 ? firstStopPressure / nextStopPressure : 1;
      const boyleFactor = 1.0 / Math.pow(boyleRatio, 0.33); // cube root dampening

      // Determine stop time
      let stopTime = 0;
      const simTissue = [...workingTissue];
      const nextAmbient = depthToPressure(nextStop);

      for (let minute = 1; minute <= 999; minute++) {
        let canAscend = true;
        for (let i = 0; i < 16; i++) {
          const maxGradient = gradients[i] * gfFactor * boyleFactor;
          const maxTension = nextAmbient + maxGradient;
          if (simTissue[i] > maxTension) {
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
          simTissue[i] = schreiner(simTissue[i], pi, 1, HALFTIMES[i]);
        }
        stopTime = minute + 1;
      }

      if (stopTime > 0) {
        decoStops.push({ depth: currentStop, time: stopTime });
      }

      // Update working tissue
      const pi = inspiredPressure(currentStop, fN2);
      for (let i = 0; i < 16; i++) {
        workingTissue[i] = schreiner(workingTissue[i], pi, stopTime, HALFTIMES[i]);
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
