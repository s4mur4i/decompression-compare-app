/**
 * Web Worker for offloading deco calculations from the main thread.
 * Receives settings + stops, returns full calculation result.
 */
import { calculateDiveProfile, addAscentPhases, simpleAscent } from '../utils/diveProfile';
import { calculateZHL16A, calculateZHL16B, calculateZHL16C, calculateZHL12, calculateZHL6, calculateZHL8ADT } from '../utils/buhlmann';
import { calculateVPM } from '../utils/vpm';
import { calculateRGBM } from '../utils/rgbm';
import { calculateHaldane } from '../utils/haldane';
import { calculateWorkman } from '../utils/workman';
import { calculateThalmann } from '../utils/thalmann';
import { calculateDCIEM } from '../utils/dciem';
import { calculateDSAT } from '../utils/dsat';
import { calculateUSNavy } from '../utils/usnavy';
import { calculateBSAC } from '../utils/bsac';

const ALGO_FNS = {
  zhl16a: calculateZHL16A,
  zhl16b: calculateZHL16B,
  zhl16c: calculateZHL16C,
  zhl12: calculateZHL12,
  zhl6: calculateZHL6,
  zhl8adt: calculateZHL8ADT,
  vpm: calculateVPM,
  rgbm: calculateRGBM,
  haldane: calculateHaldane,
  workman: calculateWorkman,
  thalmann: calculateThalmann,
  dciem: calculateDCIEM,
  dsat: calculateDSAT,
  usnavy: calculateUSNavy,
  bsac: calculateBSAC,
};

function calcMOD(fO2, ppO2) {
  return fO2 > 0 ? Math.floor(10 * (ppO2 / fO2 - 1)) : 0;
}

function runAlgorithm(settings, phases) {
  const { algorithm, fO2, fHe, gfLow, gfHigh, ascentRate, decoGas1, decoGas2, ppO2Deco } = settings;
  const gasSwitches = [];
  if (decoGas1?.fO2) {
    gasSwitches.push({ depth: calcMOD(decoGas1.fO2, ppO2Deco), fO2: decoGas1.fO2, fHe: 0 });
  }
  if (decoGas2?.fO2) {
    gasSwitches.push({ depth: calcMOD(decoGas2.fO2, ppO2Deco), fO2: decoGas2.fO2, fHe: 0 });
  }
  gasSwitches.sort((a, b) => b.depth - a.depth);

  const decoAscentRate = settings.decoAscentRate || ascentRate;
  const opts = { fO2, fHe, gfLow, gfHigh, ascentRate, decoAscentRate, gasSwitches, lastStopDepth: settings.lastStopDepth || 6 };
  const fn = ALGO_FNS[algorithm];
  if (!fn) return null;
  return fn(phases, opts);
}

function calculateFull(settings, stops) {
  if (stops.length === 0) return null;
  const { descentRate, ascentRate, decoAscentRate = 9, gasSwitchTime } = settings;
  const profile = calculateDiveProfile(stops, descentRate, ascentRate);
  const decoInfo = runAlgorithm(settings, profile.phases);
  if (decoInfo) {
    const adjustedStops = gasSwitchTime
      ? decoInfo.decoStops.map(s => s.gasSwitch ? { ...s, time: 1 } : s)
      : decoInfo.decoStops;
    const fullProfile = addAscentPhases(profile, adjustedStops, decoAscentRate);
    return { ...fullProfile, decoInfo };
  } else {
    const fullProfile = simpleAscent(profile, ascentRate);
    return { ...fullProfile, decoInfo };
  }
}

self.onmessage = function (e) {
  const { id, settings, stops } = e.data;
  try {
    const result = calculateFull(settings, stops);
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};
