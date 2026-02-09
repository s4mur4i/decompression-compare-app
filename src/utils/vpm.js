/**
 * VPM-B (Varying Permeability Model) decompression algorithm.
 * 
 * Based on Yount's bubble nucleation model. Key concept: bubbles form when
 * tissue supersaturation exceeds a threshold determined by bubble radius.
 * VPM-B adds Boyle's law compensation for bubble growth during ascent.
 * 
 * Produces deeper first stops than Bühlmann — characteristic of bubble models.
 */

// ZHL-16C compartment parameters [halfTime, a, b]
const COMPARTMENTS = [
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

// VPM-B physical constants
const GAMMA = 0.0179;          // Surface tension (N/m)
const GAMMA_C = 0.0257;        // Skin compression (crumbling compression) (N/m)
const P_SURFACE = 1.01325;     // Surface pressure (bar)
const P_WATER_VAPOR = 0.0627;  // Water vapor pressure (bar)

// Initial critical radii for N2 (meters) — from VPM literature
// These represent the smallest bubble nuclei that can grow at surface pressure
const R0_N2 = 0.90e-6; // ~0.9 micrometers for N2

// Critical volume lambda — controls how much total bubble volume is tolerated
const LAMBDA = 7500;

function depthToPressure(depth) {
  return P_SURFACE + depth / 10.0;
}

function pressureToDepth(pressure) {
  return Math.max(0, (pressure - P_SURFACE) * 10.0);
}

function inspiredPressure(depth, fGas) {
  return (depthToPressure(depth) - P_WATER_VAPOR) * fGas;
}

function schreiner(p0, pi, time, halfTime) {
  if (time <= 0) return p0;
  const k = Math.LN2 / halfTime;
  return p0 + (pi - p0) * (1 - Math.exp(-k * time));
}

/**
 * Calculate the minimum allowed bubble radius at a given max depth.
 * As depth increases, higher pressure crushes bubbles smaller,
 * allowing greater supersaturation tolerance on ascent.
 * 
 * r_min = 1 / ( 1/r0 + (P_max - P_surface) / (2 * (gamma + gamma_c)) )
 * where pressures are in Pascals
 */
function calcMinRadius(maxAmbientPressure) {
  const deltaPressurePa = (maxAmbientPressure - P_SURFACE) * 100000; // bar to Pa
  const denom = 1.0 / R0_N2 + deltaPressurePa / (2.0 * (GAMMA + GAMMA_C));
  return 1.0 / denom;
}

/**
 * Calculate the maximum allowable tissue tension (supersaturation) for a compartment.
 * 
 * In VPM, the allowed supersaturation gradient is:
 *   G = (2 * (gamma + gamma_c)) / (r * 100000)   [converted to bar]
 * 
 * So max tissue tension = ambient_pressure + G
 * 
 * The "-B" variant adjusts this with Boyle's law: as the diver ascends,
 * bubbles at depth expand. The allowed gradient at shallower stops is reduced
 * to compensate.
 */
function allowedTissueTension(ambientPressure, minRadius, boyleCompensation) {
  // Allowed supersaturation gradient from bubble radius
  const gradientPa = 2.0 * (GAMMA + GAMMA_C) / minRadius;
  let gradientBar = gradientPa / 100000.0;

  // VPM-B: reduce gradient at shallow stops due to Boyle's law bubble expansion
  gradientBar = Math.max(0, gradientBar - boyleCompensation);

  return ambientPressure + gradientBar;
}

/**
 * Calculate Boyle's law compensation for VPM-B.
 * Bubbles formed at depth expand as the diver ascends.
 * This reduces the allowable gradient at shallower stops.
 */
function calcBoyleCompensation(firstStopPressure, currentStopPressure, initialGradient) {
  if (firstStopPressure <= P_SURFACE || currentStopPressure >= firstStopPressure) return 0;

  // Boyle's law: P1 * V1 = P2 * V2
  // Volume ratio = firstStopPressure / currentStopPressure
  const volumeRatio = firstStopPressure / currentStopPressure;

  // The gradient must be reduced proportionally to bubble expansion
  const compensation = initialGradient * (volumeRatio - 1.0) * 0.4; // 0.4 empirical damping
  return Math.max(0, compensation);
}

/**
 * Run VPM-B decompression calculation.
 */
export function calculateVPM(phases, fO2 = 0.21, gfLow = 50, gfHigh = 70, ascentRate = 9) {
  const fN2 = 1.0 - fO2;
  const maxDepth = Math.max(...phases.map(p => p.depth), 0);
  const maxAmbientPressure = depthToPressure(maxDepth);

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

  // Calculate minimum bubble radius from max depth exposure
  const minRadius = calcMinRadius(maxAmbientPressure);

  // Initial allowed gradient (at first stop)
  const initialGradientPa = 2.0 * (GAMMA + GAMMA_C) / minRadius;
  const initialGradientBar = initialGradientPa / 100000.0;

  // Apply conservatism via GF (scale the allowed gradient)
  const conservatism = gfLow / 100.0;

  // Find ceiling: shallowest depth where all tissues are within VPM limits
  let rawCeiling = 0;
  for (let i = 0; i < 16; i++) {
    // For ceiling calc, use initial gradient (no Boyle compensation yet)
    const maxGradient = initialGradientBar * conservatism;
    const requiredAmbient = tissueLoading[i] - maxGradient;
    const ceilingDepth = pressureToDepth(requiredAmbient);
    if (ceilingDepth > rawCeiling) rawCeiling = ceilingDepth;
  }

  const firstStopDepth = Math.ceil(rawCeiling / 3) * 3;

  // Generate deco stops
  const decoStops = [];
  const workingTissue = [...tissueLoading];

  if (firstStopDepth > 0) {
    let currentStop = firstStopDepth;
    const firstStopPressure = depthToPressure(firstStopDepth);

    while (currentStop >= 3) {
      const prevDepth = currentStop === firstStopDepth
        ? phases[phases.length - 1]?.depth || 0
        : currentStop + 3;

      // Transit to this stop
      const transitTime = Math.ceil(Math.abs(prevDepth - currentStop) / ascentRate);
      const transitPi = inspiredPressure(currentStop, fN2);
      for (let i = 0; i < 16; i++) {
        workingTissue[i] = schreiner(workingTissue[i], transitPi, transitTime, COMPARTMENTS[i][0]);
      }

      // Determine stop time needed
      const nextStop = currentStop - 3;
      const nextAmbient = depthToPressure(nextStop);

      // VPM-B: Boyle's compensation increases at shallower stops
      const boyleComp = calcBoyleCompensation(firstStopPressure, nextAmbient, initialGradientBar);

      // GF interpolation: gfLow at first stop, gfHigh at surface
      const gfAtStop = firstStopDepth > 0
        ? gfLow + (gfHigh - gfLow) * (1 - currentStop / firstStopDepth)
        : gfHigh;
      const gfFactor = gfAtStop / 100.0;

      let stopTime = 0;
      const simTissue = [...workingTissue];

      for (let minute = 0; minute <= 999; minute++) {
        let canAscend = true;
        for (let i = 0; i < 16; i++) {
          const maxGradient = Math.max(0, initialGradientBar * gfFactor - boyleComp);
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
          simTissue[i] = schreiner(simTissue[i], pi, 1, COMPARTMENTS[i][0]);
        }
        stopTime = minute + 1;
      }

      if (stopTime > 0) {
        decoStops.push({ depth: currentStop, time: stopTime });
      }

      // Apply actual stop time to working tissue
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
