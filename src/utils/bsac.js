/**
 * BSAC '88 Decompression Tables.
 * 
 * British Sub-Aqua Club 1988 decompression tables.
 * Table-based NDL + deco stops for air diving.
 * Based on published BSAC '88 table data.
 */

import { P_SURFACE } from './constants.js';
import { inspiredPressure, schreiner } from './physics.js';

// BSAC '88 No-Decompression Limits (depth in meters → NDL in minutes)
const BSAC_NDL = {
  6: 325,
  9: 225,
  12: 135,
  15: 75,
  18: 51,
  21: 39,
  24: 30,
  27: 24,
  30: 21,
  33: 18,
  36: 15,
  39: 13,
  42: 12,
  45: 10,
  48: 9,
  50: 8,
};

// BSAC '88 Decompression Stops table
// Format: { depth_m: { bottom_time_min: [{ depth, time }] } }
// Stops at 9m, 6m, 3m intervals. Approximate published values.
const BSAC_DECO_TABLE = {
  15: {
    80: [{ depth: 6, time: 1 }],
    100: [{ depth: 6, time: 5 }],
    120: [{ depth: 6, time: 10 }],
  },
  18: {
    55: [{ depth: 6, time: 1 }],
    65: [{ depth: 6, time: 5 }],
    80: [{ depth: 6, time: 10 }],
    100: [{ depth: 6, time: 15 }, { depth: 3, time: 5 }],
  },
  21: {
    42: [{ depth: 6, time: 1 }],
    50: [{ depth: 6, time: 5 }],
    60: [{ depth: 6, time: 10 }],
    75: [{ depth: 6, time: 15 }, { depth: 3, time: 5 }],
  },
  24: {
    33: [{ depth: 6, time: 1 }],
    40: [{ depth: 6, time: 5 }],
    50: [{ depth: 6, time: 10 }],
    60: [{ depth: 6, time: 15 }, { depth: 3, time: 5 }],
  },
  27: {
    27: [{ depth: 6, time: 1 }],
    33: [{ depth: 6, time: 5 }],
    40: [{ depth: 6, time: 10 }],
    50: [{ depth: 9, time: 1 }, { depth: 6, time: 15 }, { depth: 3, time: 5 }],
  },
  30: {
    23: [{ depth: 6, time: 1 }],
    28: [{ depth: 6, time: 5 }],
    35: [{ depth: 6, time: 10 }],
    45: [{ depth: 9, time: 1 }, { depth: 6, time: 15 }, { depth: 3, time: 5 }],
  },
  33: {
    20: [{ depth: 6, time: 1 }],
    25: [{ depth: 6, time: 5 }],
    30: [{ depth: 6, time: 10 }],
    40: [{ depth: 9, time: 2 }, { depth: 6, time: 15 }, { depth: 3, time: 5 }],
  },
  36: {
    17: [{ depth: 6, time: 1 }],
    22: [{ depth: 6, time: 5 }],
    27: [{ depth: 6, time: 10 }],
    35: [{ depth: 9, time: 3 }, { depth: 6, time: 15 }, { depth: 3, time: 5 }],
  },
  39: {
    15: [{ depth: 6, time: 1 }],
    20: [{ depth: 6, time: 5 }],
    25: [{ depth: 9, time: 1 }, { depth: 6, time: 10 }],
    30: [{ depth: 9, time: 4 }, { depth: 6, time: 15 }, { depth: 3, time: 5 }],
  },
  42: {
    14: [{ depth: 6, time: 1 }],
    18: [{ depth: 6, time: 5 }],
    22: [{ depth: 9, time: 1 }, { depth: 6, time: 10 }],
    28: [{ depth: 9, time: 5 }, { depth: 6, time: 15 }, { depth: 3, time: 5 }],
  },
  45: {
    12: [{ depth: 6, time: 1 }],
    15: [{ depth: 6, time: 5 }],
    20: [{ depth: 9, time: 2 }, { depth: 6, time: 10 }],
    25: [{ depth: 9, time: 5 }, { depth: 6, time: 15 }, { depth: 3, time: 10 }],
  },
  48: {
    11: [{ depth: 6, time: 1 }],
    14: [{ depth: 6, time: 5 }],
    18: [{ depth: 9, time: 2 }, { depth: 6, time: 10 }],
    22: [{ depth: 9, time: 5 }, { depth: 6, time: 18 }, { depth: 3, time: 10 }],
  },
  50: {
    10: [{ depth: 6, time: 1 }],
    13: [{ depth: 6, time: 5 }],
    16: [{ depth: 9, time: 3 }, { depth: 6, time: 12 }],
    20: [{ depth: 12, time: 1 }, { depth: 9, time: 6 }, { depth: 6, time: 18 }, { depth: 3, time: 10 }],
  },
};

/**
 * Look up BSAC schedule. Rounds up to next table entry.
 */
function lookupBSAC(depth, bottomTime) {
  // Find NDL
  const ndlDepths = Object.keys(BSAC_NDL).map(Number).sort((a, b) => a - b);
  let ndlDepth = ndlDepths[ndlDepths.length - 1];
  for (const d of ndlDepths) {
    if (d >= depth) { ndlDepth = d; break; }
  }
  const ndl = BSAC_NDL[ndlDepth] || 0;
  
  if (bottomTime <= ndl) {
    return { stops: [], ndl: true, tableNDL: ndl };
  }

  // Look up deco table
  const decoDepths = Object.keys(BSAC_DECO_TABLE).map(Number).sort((a, b) => a - b);
  let tableDepth = decoDepths[decoDepths.length - 1];
  for (const d of decoDepths) {
    if (d >= depth) { tableDepth = d; break; }
  }

  const depthEntry = BSAC_DECO_TABLE[tableDepth];
  if (!depthEntry) return { stops: [], ndl: false, tableNDL: ndl };

  const tableTimes = Object.keys(depthEntry).map(Number).sort((a, b) => a - b);
  let tableTime = tableTimes[tableTimes.length - 1];
  for (const t of tableTimes) {
    if (t >= bottomTime) { tableTime = t; break; }
  }

  const stops = depthEntry[tableTime] || [];
  return { stops: [...stops], ndl: false, tableNDL: ndl, tableDepth, tableTime };
}

const HALFTIMES = [5, 10, 20, 40, 80, 120, 240, 480];

/**
 * Run BSAC '88 table lookup.
 */
export function calculateBSAC(phases, options = {}) {
  const { fO2 = 0.21 } = options;
  const fN2 = 1.0 - fO2;
  const nc = HALFTIMES.length;

  const surfaceN2 = inspiredPressure(0, fN2);
  const tissueLoading = new Array(nc).fill(surfaceN2);
  for (const phase of phases) {
    const pi = inspiredPressure(phase.depth, fN2);
    for (let i = 0; i < nc; i++) {
      tissueLoading[i] = schreiner(tissueLoading[i], pi, phase.duration, HALFTIMES[i]);
    }
  }

  const maxDepth = Math.max(...phases.map(p => p.depth), 0);
  const totalBottomTime = phases.reduce((sum, p) => sum + p.duration, 0);

  const { stops, ndl, tableNDL } = lookupBSAC(maxDepth, totalBottomTime);

  const decoStops = stops.sort((a, b) => b.depth - a.depth);
  const firstStopDepth = decoStops.length > 0 ? decoStops[0].depth : 0;

  const mValues = HALFTIMES.map(() => P_SURFACE * 1.5);

  return {
    decoStops,
    firstStopDepth,
    tissueLoading: [...tissueLoading],
    ceiling: firstStopDepth > 0 ? firstStopDepth : 0,
    noDecoLimit: ndl,
    compartmentCount: nc,
    halfTimes: [...HALFTIMES],
    mValues,
    tableNDL,
  };
}
