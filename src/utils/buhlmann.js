/**
 * Bühlmann ZHL decompression algorithm with trimix and multi-gas support.
 */

function calculateAValue(halfTime) {
  return 2 * Math.pow(halfTime, -1/3);
}

function calculateBValue(halfTime) {
  return 1.005 - Math.pow(halfTime, -1/2);
}

const ZHL16_HALFTIMES = [4.0, 8.0, 12.5, 18.5, 27.0, 38.3, 54.3, 77.0, 109.0, 146.0, 187.0, 239.0, 305.0, 390.0, 498.0, 635.0];

// Helium half-times (approximately 2.65x faster than N₂)
const ZHL16_HE_HALFTIMES = [1.51, 3.02, 4.72, 6.99, 10.21, 14.48, 20.53, 29.11, 41.20, 55.19, 70.69, 90.34, 115.29, 147.42, 188.24, 240.03];

// Helium a and b values (from ZHL-16A He parameters)
const ZHL16_HE_A = [1.6189, 1.3830, 1.1919, 1.0458, 0.9220, 0.8205, 0.7305, 0.6502, 0.5950, 0.5545, 0.5333, 0.5189, 0.5181, 0.5176, 0.5172, 0.5119];
const ZHL16_HE_B = [0.4770, 0.5747, 0.6527, 0.7223, 0.7582, 0.7957, 0.8279, 0.8553, 0.8757, 0.8903, 0.8997, 0.9073, 0.9122, 0.9171, 0.9217, 0.9267];

export const PARAM_SETS = {
  'zhl16a': {
    name: 'ZH-L 16A', compartments: 16, halfTimes: ZHL16_HALFTIMES,
    aValues: [1.2599, 1.0000, 0.8618, 0.7562, 0.6200, 0.5043, 0.4410, 0.4000, 0.3750, 0.3500, 0.3295, 0.3065, 0.2835, 0.2610, 0.2480, 0.2327],
    bValues: [0.5578, 0.6514, 0.7222, 0.7825, 0.8126, 0.8434, 0.8693, 0.8910, 0.9092, 0.9222, 0.9319, 0.9403, 0.9477, 0.9544, 0.9602, 0.9653],
    heHalfTimes: ZHL16_HE_HALFTIMES, heA: ZHL16_HE_A, heB: ZHL16_HE_B,
  },
  'zhl16b': {
    name: 'ZH-L 16B', compartments: 16, halfTimes: ZHL16_HALFTIMES,
    aValues: [1.2599, 1.0000, 0.8618, 0.7562, 0.6200, 0.4770, 0.4170, 0.3798, 0.3750, 0.3500, 0.3295, 0.3065, 0.2835, 0.2610, 0.2480, 0.2327],
    bValues: [0.5578, 0.6514, 0.7222, 0.7825, 0.8126, 0.8434, 0.8693, 0.8910, 0.9092, 0.9222, 0.9319, 0.9403, 0.9477, 0.9544, 0.9602, 0.9653],
    heHalfTimes: ZHL16_HE_HALFTIMES, heA: ZHL16_HE_A, heB: ZHL16_HE_B,
  },
  'zhl16c': {
    name: 'ZH-L 16C', compartments: 16, halfTimes: ZHL16_HALFTIMES,
    aValues: [1.1696, 1.0000, 0.8618, 0.7562, 0.6200, 0.5043, 0.4410, 0.4000, 0.3750, 0.3500, 0.3295, 0.3065, 0.2835, 0.2610, 0.2480, 0.2327],
    bValues: [0.5578, 0.6514, 0.7222, 0.7825, 0.8126, 0.8434, 0.8693, 0.8910, 0.9092, 0.9222, 0.9319, 0.9403, 0.9477, 0.9544, 0.9602, 0.9653],
    heHalfTimes: ZHL16_HE_HALFTIMES, heA: ZHL16_HE_A, heB: ZHL16_HE_B,
  },
  'zhl12': {
    name: 'ZH-L 12', compartments: 16, halfTimes: ZHL16_HALFTIMES,
    aValues: [1.2599, 1.0000, 0.8618, 0.7562, 0.6200, 0.5043, 0.4410, 0.4000, 0.3750, 0.3500, 0.3295, 0.3065, 0.2835, 0.2610, 0.2480, 0.2327],
    bValues: [0.5578, 0.6514, 0.7222, 0.7825, 0.8126, 0.8434, 0.8693, 0.8910, 0.9092, 0.9222, 0.9319, 0.9403, 0.9477, 0.9544, 0.9602, 0.9653],
    heHalfTimes: ZHL16_HE_HALFTIMES, heA: ZHL16_HE_A, heB: ZHL16_HE_B,
  },
  'zhl6': {
    name: 'ZH-L 6', compartments: 6,
    halfTimes: [6, 14, 34, 64, 124, 320],
    aValues: [6, 14, 34, 64, 124, 320].map(t => calculateAValue(t)),
    bValues: [6, 14, 34, 64, 124, 320].map(t => calculateBValue(t)),
    heHalfTimes: [6, 14, 34, 64, 124, 320].map(t => t / 2.65),
    heA: [6, 14, 34, 64, 124, 320].map(t => calculateAValue(t / 2.65)),
    heB: [6, 14, 34, 64, 124, 320].map(t => calculateBValue(t / 2.65)),
  },
  'zhl8adt': {
    name: 'ZH-L 8 ADT', compartments: 8,
    halfTimes: [5, 10, 20, 40, 80, 120, 240, 480],
    aValues: [5, 10, 20, 40, 80, 120, 240, 480].map(t => calculateAValue(t)),
    bValues: [5, 10, 20, 40, 80, 120, 240, 480].map(t => calculateBValue(t)),
    heHalfTimes: [5, 10, 20, 40, 80, 120, 240, 480].map(t => t / 2.65),
    heA: [5, 10, 20, 40, 80, 120, 240, 480].map(t => calculateAValue(t / 2.65)),
    heB: [5, 10, 20, 40, 80, 120, 240, 480].map(t => calculateBValue(t / 2.65)),
  }
};

import { P_SURFACE, MAX_STOP_MINUTES } from './constants.js';
import { depthToPressure, inspiredPressure, schreiner } from './physics.js';

/**
 * Calculate combined a and b values for trimix (weighted by tissue loading).
 * a_combined = (a_N2 * P_N2 + a_He * P_He) / (P_N2 + P_He)
 * b_combined = (b_N2 * P_N2 + b_He * P_He) / (P_N2 + P_He)
 */
function combinedAB(i, pN2, pHe, paramSet) {
  const total = pN2 + pHe;
  if (total <= 0) return { a: paramSet.aValues[i], b: paramSet.bValues[i] };
  
  const heIdx = Math.min(i, (paramSet.heA?.length || 1) - 1);
  const a = (paramSet.aValues[i] * pN2 + paramSet.heA[heIdx] * pHe) / total;
  const b = (paramSet.bValues[i] * pN2 + paramSet.heB[heIdx] * pHe) / total;
  return { a, b };
}

/**
 * Calculate ceiling for trimix tissue state.
 */
function calcCeiling(n2Loading, heLoading, gfLow, paramSet) {
  let maxCeiling = 0;
  const gf = gfLow / 100;

  for (let i = 0; i < paramSet.compartments; i++) {
    const pTotal = n2Loading[i] + (heLoading ? heLoading[i] : 0);
    const { a, b } = combinedAB(i, n2Loading[i], heLoading ? heLoading[i] : 0, paramSet);
    
    const ceiling = (pTotal - a * gf) / (gf / b - gf + 1);
    const ceilingDepth = Math.max(0, (ceiling - P_SURFACE) * 10);
    if (ceilingDepth > maxCeiling) maxCeiling = ceilingDepth;
  }
  return maxCeiling;
}

/**
 * Check if we can ascend to nextDepth given current tissue state.
 */
function canAscendTo(n2Loading, heLoading, nextDepth, gfAtStop, paramSet) {
  const nextAmbient = depthToPressure(nextDepth);
  for (let i = 0; i < paramSet.compartments; i++) {
    const pTotal = n2Loading[i] + (heLoading ? heLoading[i] : 0);
    const { a, b } = combinedAB(i, n2Loading[i], heLoading ? heLoading[i] : 0, paramSet);
    
    const mVal = a + nextAmbient / b;
    const allowed = nextAmbient + (mVal - nextAmbient) * (gfAtStop / 100);
    if (pTotal > allowed) return false;
  }
  return true;
}

/**
 * Get the active gas at a given depth during ascent, considering gas switches.
 * Pick the shallowest gas whose switch depth >= current depth.
 * E.g. at 3m with switches at 22m (EAN50) and 6m (O2): use O2 (6>=3, shallowest).
 */
function getGasAtDepth(depth, bottomGas, gasSwitches) {
  if (!gasSwitches || gasSwitches.length === 0) return bottomGas;
  
  const sorted = [...gasSwitches].sort((a, b) => a.depth - b.depth);
  for (const gas of sorted) {
    if (depth <= gas.depth) {
      return { fO2: gas.fO2, fHe: gas.fHe || 0, fN2: 1 - gas.fO2 - (gas.fHe || 0) };
    }
  }
  return bottomGas;
}

/**
 * Main Bühlmann calculation with trimix and multi-gas support.
 */
export function calculateBuhlmann(phases, options = {}) {
  const { fO2 = 0.21, gfLow = 30, gfHigh = 70, ascentRate = 9, decoAscentRate = 9, variant = 'zhl16c', fHe = 0, gasSwitches = [], lastStopDepth = 6 } = options;
  const paramSet = PARAM_SETS[variant];
  if (!paramSet) throw new Error(`Unknown variant: ${variant}`);

  const fN2 = 1.0 - fO2 - fHe;
  const hasHe = fHe > 0 || gasSwitches.some(g => g.fHe > 0);
  const bottomGas = { fO2, fHe, fN2 };
  const nc = paramSet.compartments;

  // Initialize at surface equilibrium
  const n2Loading = new Array(nc).fill(inspiredPressure(0, fN2));
  const heLoading = hasHe ? new Array(nc).fill(0) : null;

  // Process bottom phases with bottom gas
  for (const phase of phases) {
    const piN2 = inspiredPressure(phase.depth, fN2);
    const piHe = hasHe ? inspiredPressure(phase.depth, fHe) : 0;
    for (let i = 0; i < nc; i++) {
      n2Loading[i] = schreiner(n2Loading[i], piN2, phase.duration, paramSet.halfTimes[i]);
      if (hasHe) {
        const heIdx = Math.min(i, paramSet.heHalfTimes.length - 1);
        heLoading[i] = schreiner(heLoading[i], piHe, phase.duration, paramSet.heHalfTimes[heIdx]);
      }
    }
  }

  // Calculate ceiling
  const rawCeiling = calcCeiling(n2Loading, heLoading, gfLow, paramSet);
  const firstStopDepth = Math.ceil(rawCeiling / 3) * 3;

  // Generate deco stops
  const decoStops = [];
  const wN2 = [...n2Loading];
  const wHe = hasHe ? [...heLoading] : null;
  let prevGasLabel = `${Math.round(fO2*100)}/${Math.round((fHe||0)*100)}`;

  if (firstStopDepth > 0) {
    let currentStop = firstStopDepth;

    while (currentStop >= lastStopDepth) {
      const prevDepth = currentStop === firstStopDepth
        ? phases[phases.length - 1]?.depth || 0
        : currentStop + 3;

      // Determine gas at this stop
      const gas = getGasAtDepth(currentStop, bottomGas, gasSwitches);

      // Transit
      const transitTime = Math.ceil(Math.abs(prevDepth - currentStop) / decoAscentRate);
      const transitPiN2 = inspiredPressure(currentStop, gas.fN2);
      const transitPiHe = hasHe ? inspiredPressure(currentStop, gas.fHe || 0) : 0;
      for (let i = 0; i < nc; i++) {
        wN2[i] = schreiner(wN2[i], transitPiN2, transitTime, paramSet.halfTimes[i]);
        if (hasHe) {
          const heIdx = Math.min(i, paramSet.heHalfTimes.length - 1);
          wHe[i] = schreiner(wHe[i], transitPiHe, transitTime, paramSet.heHalfTimes[heIdx]);
        }
      }

      // GF at next stop
      const nextStop = currentStop - 3;
      const gfAtStop = gfHigh + ((gfLow - gfHigh) * Math.max(0, nextStop)) / firstStopDepth;

      // Find stop time
      let stopTime = 0;
      const simN2 = [...wN2];
      const simHe = hasHe ? [...wHe] : null;

      for (let minute = 1; minute <= MAX_STOP_MINUTES; minute++) {
        if (canAscendTo(simN2, simHe, nextStop, Math.min(gfAtStop, gfHigh), paramSet)) {
          stopTime = minute;
          break;
        }
        const piN2 = inspiredPressure(currentStop, gas.fN2);
        const piHe = hasHe ? inspiredPressure(currentStop, gas.fHe || 0) : 0;
        for (let i = 0; i < nc; i++) {
          simN2[i] = schreiner(simN2[i], piN2, 1, paramSet.halfTimes[i]);
          if (hasHe) {
            const heIdx = Math.min(i, paramSet.heHalfTimes.length - 1);
            simHe[i] = schreiner(simHe[i], piHe, 1, paramSet.heHalfTimes[heIdx]);
          }
        }
        stopTime = minute + 1;
      }

      const gasLabel = `${Math.round(gas.fO2*100)}/${Math.round((gas.fHe||0)*100)}`;
      const isGasSwitch = prevGasLabel && gasLabel !== prevGasLabel;
      
      if (isGasSwitch) {
        // Gas switch marker (time added by UI toggle)
        decoStops.push({ depth: currentStop, time: 0, gas: gasLabel, gasSwitch: true });
      }
      // Every deco stop is minimum 1 min
      decoStops.push({ depth: currentStop, time: Math.max(1, stopTime), gas: gasLabel });
      prevGasLabel = gasLabel;

      // Update working tissue
      const piN2 = inspiredPressure(currentStop, gas.fN2);
      const piHe = hasHe ? inspiredPressure(currentStop, gas.fHe || 0) : 0;
      for (let i = 0; i < nc; i++) {
        wN2[i] = schreiner(wN2[i], piN2, stopTime, paramSet.halfTimes[i]);
        if (hasHe) {
          const heIdx = Math.min(i, paramSet.heHalfTimes.length - 1);
          wHe[i] = schreiner(wHe[i], piHe, stopTime, paramSet.heHalfTimes[heIdx]);
        }
      }

      currentStop -= 3;
    }
  }

  return {
    decoStops,
    firstStopDepth,
    tissueLoading: [...n2Loading],
    heLoading: hasHe ? [...heLoading] : null,
    ceiling: rawCeiling,
    noDecoLimit: firstStopDepth === 0,
    variant: paramSet.name,
  };
}

// Convenience wrappers — now accept fHe and gasSwitches
export function calculateZHL16A(phases, options = {}) { return calculateBuhlmann(phases, { ...options, variant: 'zhl16a' }); }
export function calculateZHL16B(phases, options = {}) { return calculateBuhlmann(phases, { ...options, variant: 'zhl16b' }); }
export function calculateZHL16C(phases, options = {}) { return calculateBuhlmann(phases, { ...options, variant: 'zhl16c' }); }
export function calculateZHL12(phases, options = {}) { return calculateBuhlmann(phases, { ...options, variant: 'zhl12' }); }
export function calculateZHL6(phases, options = {}) { return calculateBuhlmann(phases, { ...options, variant: 'zhl6' }); }
export function calculateZHL8ADT(phases, options = {}) { return calculateBuhlmann(phases, { ...options, variant: 'zhl8adt' }); }

// Capability flags: trimix (He tracking), multiGas (deco gas switches), gf (gradient factors)
export const ALGORITHMS = {
  none:    { name: 'No Algorithm',       description: 'Direct ascent, no deco calculation',                          trimix: false, multiGas: false, gf: false },
  zhl16a:  { name: 'ZH-L 16A',          description: 'Original experimental (1986). Trimix + multi-gas.',           trimix: true,  multiGas: true,  gf: true },
  zhl16b:  { name: 'ZH-L 16B',          description: 'For printed tables. Trimix + multi-gas.',                     trimix: true,  multiGas: true,  gf: true },
  zhl16c:  { name: 'ZH-L 16C',          description: 'For dive computers. Most widely used. Trimix + multi-gas.',   trimix: true,  multiGas: true,  gf: true },
  zhl12:   { name: 'ZH-L 12',           description: 'Original 1983 version. Trimix + multi-gas.',                  trimix: true,  multiGas: true,  gf: true },
  zhl6:    { name: 'ZH-L 6',            description: 'Simplified 6-compartment. Trimix + multi-gas.',               trimix: true,  multiGas: true,  gf: true },
  zhl8adt: { name: 'ZH-L 8 ADT',        description: '8-compartment adaptive. Trimix + multi-gas.',                 trimix: true,  multiGas: true,  gf: true },
  vpm:     { name: 'VPM-B',             description: 'Bubble mechanics model. Deeper first stops. Nitrox only.',    trimix: false, multiGas: false, gf: true },
  rgbm:    { name: 'RGBM',              description: 'Dual-phase bubble model. Nitrox only.',                       trimix: false, multiGas: false, gf: true },
  haldane: { name: 'Haldane (1908)',     description: '5 compartments, 2:1 ratio. Air/Nitrox only.',                 trimix: false, multiGas: false, gf: false },
  workman: { name: 'Workman (1965)',     description: 'US Navy M-values. 9 compartments. Air/Nitrox only.',          trimix: false, multiGas: false, gf: false },
  thalmann:{ name: 'Thalmann VVAL-18',  description: 'US Navy asymmetric kinetics. Air/Nitrox only.',               trimix: false, multiGas: false, gf: false },
  dciem:   { name: 'DCIEM',             description: 'Canadian serial compartments. Very conservative. Air/Nitrox.', trimix: false, multiGas: false, gf: false },
};

export { calculateZHL16C as default };
