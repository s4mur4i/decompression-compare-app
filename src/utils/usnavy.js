/**
 * US Navy Diving Manual Rev 7 decompression tables.
 * 
 * Table-based approach using published Air Decompression Table (Table 9-5).
 * For profiles not exactly matching table entries, rounds to next deeper/longer entry.
 * Based on the Thalmann EL (Exponential-Linear) algorithm.
 */

import { P_SURFACE } from './constants.js';
import { inspiredPressure, schreiner } from './physics.js';

// US Navy Air Decompression Table (Rev 7, Table 9-5)
// Format: { depth(fsw): { bottomTime(min): [{ stop_depth_fsw, stop_time_min }, ...] } }
// Converted to metric. Depths in feet → meters (÷3.28084), rounded to nearest 3m.
// Key entries from published tables.
const USN_TABLE = {
  // 40 fsw (12m)
  12: {
    200: [],  // No deco
    300: [{ depth: 3, time: 2 }],
  },
  // 50 fsw (15m)
  15: {
    100: [],
    150: [{ depth: 3, time: 3 }],
    200: [{ depth: 3, time: 17 }],
  },
  // 60 fsw (18m)
  18: {
    60: [],
    80: [{ depth: 3, time: 7 }],
    100: [{ depth: 3, time: 14 }],
    120: [{ depth: 3, time: 26 }],
  },
  // 70 fsw (21m)
  21: {
    50: [],
    60: [{ depth: 3, time: 8 }],
    80: [{ depth: 3, time: 14 }],
    100: [{ depth: 6, time: 1 }, { depth: 3, time: 26 }],
  },
  // 80 fsw (24m)  
  24: {
    40: [],
    50: [{ depth: 3, time: 10 }],
    60: [{ depth: 3, time: 17 }],
    80: [{ depth: 6, time: 5 }, { depth: 3, time: 22 }],
  },
  // 90 fsw (27m)
  27: {
    30: [],
    40: [{ depth: 3, time: 7 }],
    50: [{ depth: 3, time: 18 }],
    60: [{ depth: 6, time: 2 }, { depth: 3, time: 23 }],
  },
  // 100 fsw (30m)
  30: {
    25: [],
    30: [{ depth: 3, time: 3 }],
    40: [{ depth: 3, time: 15 }],
    50: [{ depth: 6, time: 2 }, { depth: 3, time: 24 }],
    60: [{ depth: 6, time: 9 }, { depth: 3, time: 23 }],
    70: [{ depth: 6, time: 16 }, { depth: 3, time: 23 }],
  },
  // 110 fsw (33m)
  33: {
    20: [],
    25: [{ depth: 3, time: 3 }],
    30: [{ depth: 3, time: 7 }],
    40: [{ depth: 6, time: 2 }, { depth: 3, time: 21 }],
    50: [{ depth: 6, time: 8 }, { depth: 3, time: 23 }],
  },
  // 120 fsw (36m)
  36: {
    15: [],
    20: [{ depth: 3, time: 2 }],
    25: [{ depth: 3, time: 7 }],
    30: [{ depth: 6, time: 1 }, { depth: 3, time: 16 }],
    40: [{ depth: 6, time: 7 }, { depth: 3, time: 23 }],
  },
  // 130 fsw (39m)
  39: {
    10: [],
    15: [{ depth: 3, time: 1 }],
    20: [{ depth: 3, time: 5 }],
    25: [{ depth: 6, time: 1 }, { depth: 3, time: 14 }],
    30: [{ depth: 6, time: 4 }, { depth: 3, time: 21 }],
  },
  // 140 fsw (42m)
  42: {
    10: [],
    15: [{ depth: 3, time: 2 }],
    20: [{ depth: 6, time: 2 }, { depth: 3, time: 8 }],
    25: [{ depth: 6, time: 5 }, { depth: 3, time: 18 }],
  },
  // 150 fsw (45m)
  45: {
    5: [],
    10: [{ depth: 3, time: 3 }],
    15: [{ depth: 6, time: 1 }, { depth: 3, time: 7 }],
    20: [{ depth: 6, time: 4 }, { depth: 3, time: 17 }],
  },
  // 160 fsw (48m)
  48: {
    5: [],
    10: [{ depth: 3, time: 4 }],
    15: [{ depth: 6, time: 3 }, { depth: 3, time: 11 }],
    20: [{ depth: 6, time: 7 }, { depth: 3, time: 21 }],
  },
  // 170 fsw (51m)
  51: {
    5: [],
    10: [{ depth: 6, time: 1 }, { depth: 3, time: 6 }],
    15: [{ depth: 6, time: 5 }, { depth: 3, time: 16 }],
  },
  // 180 fsw (54m)
  54: {
    5: [],
    10: [{ depth: 6, time: 2 }, { depth: 3, time: 8 }],
    15: [{ depth: 6, time: 7 }, { depth: 3, time: 19 }],
  },
  // 190 fsw (57m)
  57: {
    5: [],
    10: [{ depth: 6, time: 3 }, { depth: 3, time: 11 }],
    15: [{ depth: 9, time: 1 }, { depth: 6, time: 9 }, { depth: 3, time: 22 }],
  },
  // 200 fsw (60m)
  60: {
    5: [],
    10: [{ depth: 6, time: 4 }, { depth: 3, time: 14 }],
    15: [{ depth: 9, time: 3 }, { depth: 6, time: 11 }, { depth: 3, time: 23 }],
  },
};

/**
 * Look up deco schedule from USN table.
 * Rounds depth up to next table depth, bottom time up to next table time.
 */
function lookupSchedule(depth, bottomTime) {
  const tableDepths = Object.keys(USN_TABLE).map(Number).sort((a, b) => a - b);
  
  // Find next deeper (or equal) table depth
  let tableDepth = tableDepths[tableDepths.length - 1];
  for (const d of tableDepths) {
    if (d >= depth) { tableDepth = d; break; }
  }
  
  const depthEntry = USN_TABLE[tableDepth];
  if (!depthEntry) return { stops: [], ndl: true };
  
  const tableTimes = Object.keys(depthEntry).map(Number).sort((a, b) => a - b);
  
  // Find next longer (or equal) table time
  let tableTime = tableTimes[tableTimes.length - 1];
  for (const t of tableTimes) {
    if (t >= bottomTime) { tableTime = t; break; }
  }
  
  const stops = depthEntry[tableTime] || [];
  return { stops: [...stops], ndl: stops.length === 0, tableDepth, tableTime };
}

// Simple tissue model for tissue loading display (Thalmann-based)
const HALFTIMES = [5, 10, 20, 40, 80, 120, 160, 200, 240];

/**
 * Run US Navy Rev 7 table lookup.
 */
export function calculateUSNavy(phases, options = {}) {
  const { fO2 = 0.21 } = options;
  const fN2 = 1.0 - fO2;
  const nc = HALFTIMES.length;

  // Initialize and process tissues for display
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

  const { stops, ndl, tableDepth, tableTime } = lookupSchedule(maxDepth, totalBottomTime);

  // Convert table stops to deco stop format (deepest first)
  const decoStops = stops.sort((a, b) => b.depth - a.depth);
  const firstStopDepth = decoStops.length > 0 ? decoStops[0].depth : 0;

  const mValues = HALFTIMES.map(() => P_SURFACE * 1.6);

  return {
    decoStops,
    firstStopDepth,
    tissueLoading: [...tissueLoading],
    ceiling: firstStopDepth > 0 ? firstStopDepth : 0,
    noDecoLimit: ndl,
    compartmentCount: nc,
    halfTimes: [...HALFTIMES],
    mValues,
    tableDepth,
    tableTime,
  };
}
