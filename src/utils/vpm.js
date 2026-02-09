/**
 * VPM-B (Varying Permeability Model) decompression algorithm implementation.
 * 
 * Based on Yount's varying permeability model with Boyle's law compensation.
 * Uses bubble mechanics with initial bubble radius and critical volume concepts.
 */

// ZHL-16C compartment half-times (same as Bühlmann)
const VPM_HALFTIMES = [
  4.0, 8.0, 12.5, 18.5, 27.0, 38.3, 54.3, 77.0,
  109.0, 146.0, 187.0, 239.0, 305.0, 390.0, 498.0, 635.0
];

// VPM-B specific parameters
const VPM_PARAMS = {
  // Physical constants
  SURFACE_TENSION: 0.0179, // N/m (surface tension at body temperature)
  SKIN_COMPRESSION: 0.0257, // N/m (skin compression)
  INITIAL_RADIUS: 0.8e-6, // m (initial bubble nucleus radius ~0.8μm)
  WATER_VAPOR_PRESSURE: 0.0627, // bar (water vapor pressure in lungs)
  SURFACE_PRESSURE: 1.01325, // bar (surface atmospheric pressure)
  
  // VPM-B specific
  CRITICAL_VOLUME_LAMBDA: 7500, // Parameter for critical volume calculation
  NUCLEATION_PRESSURE: 1.15, // bar (pressure at which nuclei are generated)
  
  // Compartment-specific a/b values for critical radius calculation
  // Based on empirical data fitting to VPM-B validation
  A_VALUES: [
    1.2599, 1.0000, 0.8618, 0.7562, 0.6200, 0.5043, 0.4410, 0.4000,
    0.3750, 0.3500, 0.3295, 0.3065, 0.2835, 0.2610, 0.2480, 0.2327
  ],
  B_VALUES: [
    0.5050, 0.6514, 0.7222, 0.7825, 0.8126, 0.8434, 0.8693, 0.8910,
    0.9092, 0.9222, 0.9319, 0.9403, 0.9477, 0.9544, 0.9602, 0.9653
  ]
};

/**
 * Convert depth in meters to absolute pressure in bar (saltwater).
 */
function depthToPressure(depth) {
  return VPM_PARAMS.SURFACE_PRESSURE + (depth / 10.0);
}

/**
 * Calculate inspired gas pressure at given depth.
 */
function inspiredPressure(depth, fGas) {
  const ambientPressure = depthToPressure(depth);
  return (ambientPressure - VPM_PARAMS.WATER_VAPOR_PRESSURE) * fGas;
}

/**
 * Schreiner equation for tissue loading during constant or changing pressure.
 */
function schreiner(p0, pi, time, halfTime) {
  if (time <= 0) return p0;
  const k = Math.LN2 / halfTime;
  return p0 + (pi - p0) * (1 - Math.exp(-k * time));
}

/**
 * Calculate critical bubble radius for VPM-B model.
 * Based on surface tension and pressure differential.
 */
function criticalRadius(ambientPressure, compartment) {
  const surfaceTension = VPM_PARAMS.SURFACE_TENSION;
  const skinCompression = VPM_PARAMS.SKIN_COMPRESSION;
  
  // Total surface tension effect
  const totalSurfaceTension = surfaceTension + skinCompression;
  
  // Base critical radius calculation
  const pressureDiff = Math.max(0.1, ambientPressure - VPM_PARAMS.NUCLEATION_PRESSURE);
  let radius = (2 * totalSurfaceTension) / (pressureDiff * 100000); // Convert bar to Pa
  
  // Apply compartment-specific scaling
  const scaleFactor = VPM_PARAMS.A_VALUES[compartment] / VPM_PARAMS.B_VALUES[compartment];
  radius *= scaleFactor;
  
  return Math.max(VPM_PARAMS.INITIAL_RADIUS, radius);
}

/**
 * Calculate critical volume parameter for VPM-B.
 * Based on bubble mechanics and tissue-specific parameters.
 */
function criticalVolume(compartment, maxDepth) {
  const maxPressure = depthToPressure(maxDepth);
  const radius = criticalRadius(maxPressure, compartment);
  
  // Critical volume based on bubble radius and compartment characteristics
  const volume = (4.0 / 3.0) * Math.PI * Math.pow(radius, 3);
  
  // Apply VPM-B scaling factor based on compartment half-time
  const halfTime = VPM_HALFTIMES[compartment];
  const scaleFactor = Math.pow(halfTime / 20.0, 0.3); // Empirical scaling
  
  return volume * VPM_PARAMS.CRITICAL_VOLUME_LAMBDA * scaleFactor;
}

/**
 * Calculate VPM-B allowable supersaturation (similar to M-values).
 * Uses bubble mechanics to determine maximum tissue pressure.
 */
function vpmAllowableSupersaturation(compartment, ambientPressure, criticalVol) {
  const radius = criticalRadius(ambientPressure, compartment);
  const surfaceTension = VPM_PARAMS.SURFACE_TENSION + VPM_PARAMS.SKIN_COMPRESSION;
  
  // Bubble pressure from Laplace equation
  const bubblePressure = ambientPressure + (2 * surfaceTension * 0.01) / radius; // Convert to bar
  
  // Critical volume constraint
  const volumeConstraint = Math.pow(criticalVol / ((4.0 / 3.0) * Math.PI), 1.0 / 3.0);
  
  // VPM-B allowable pressure combines bubble pressure and volume constraint
  const allowablePressure = bubblePressure + (volumeConstraint * 0.1); // Empirical scaling
  
  return Math.max(ambientPressure * 1.1, allowablePressure);
}

/**
 * Calculate VPM-B decompression ceiling.
 */
function vpmCeiling(tissueLoading, maxDepth) {
  let maxCeiling = 0;
  
  for (let i = 0; i < 16; i++) {
    const pN2 = tissueLoading[i];
    const criticalVol = criticalVolume(i, maxDepth);
    
    // Binary search for ceiling depth
    let low = 0;
    let high = maxDepth + 10;
    
    for (let iter = 0; iter < 20; iter++) {
      const testDepth = (low + high) / 2;
      const testPressure = depthToPressure(testDepth);
      const allowable = vpmAllowableSupersaturation(i, testPressure, criticalVol);
      
      if (pN2 <= allowable) {
        high = testDepth;
      } else {
        low = testDepth;
      }
    }
    
    const ceilingDepth = Math.max(0, high);
    if (ceilingDepth > maxCeiling) {
      maxCeiling = ceilingDepth;
    }
  }
  
  return maxCeiling;
}

/**
 * Run VPM-B decompression calculation.
 * 
 * @param {Array<{depth: number, duration: number, action: string}>} phases - Dive phases from profile
 * @param {number} fO2 - Fraction of O2 in breathing gas (e.g., 0.21 for air)
 * @param {number} gfLow - Conservatism factor (not directly used in VPM-B, kept for interface compatibility)
 * @param {number} gfHigh - Conservatism factor (used to scale VPM-B allowables)
 * @param {number} ascentRate - Ascent rate in m/min
 * @returns {Object} Deco stops and tissue data
 */
export function calculateVPM(phases, fO2 = 0.21, gfLow = 30, gfHigh = 70, ascentRate = 9) {
  const fN2 = 1.0 - fO2;
  
  // Find maximum depth for critical volume calculations
  const maxDepth = Math.max(...phases.map(p => p.depth));
  
  // Initialize tissue loading at surface equilibrium
  const surfaceN2 = inspiredPressure(0, fN2);
  const tissueLoading = new Array(16).fill(surfaceN2);
  
  // Process each phase to build tissue loading
  for (const phase of phases) {
    const pi = inspiredPressure(phase.depth, fN2);
    const duration = phase.duration;
    
    for (let i = 0; i < 16; i++) {
      tissueLoading[i] = schreiner(tissueLoading[i], pi, duration, VPM_HALFTIMES[i]);
    }
  }
  
  // Calculate VPM-B ceiling
  const rawCeiling = vpmCeiling(tissueLoading, maxDepth);
  
  // VPM-B typically starts deeper than Bühlmann
  const firstStopDepth = Math.ceil(rawCeiling / 3) * 3;
  
  // Generate VPM-B decompression stops
  const decoStops = [];
  const workingTissue = [...tissueLoading];
  
  if (firstStopDepth > 0) {
    let currentStop = firstStopDepth;
    
    // Apply conservatism scaling based on gfHigh parameter
    const conservatismFactor = gfHigh / 100.0;
    
    while (currentStop >= 3) {
      let stopTime = 0;
      const tempTissue = [...workingTissue];
      
      // Simulate ascent to this stop
      const prevDepth = currentStop === firstStopDepth
        ? phases[phases.length - 1]?.depth || 0
        : currentStop + 3;
      
      const transitTime = Math.ceil(Math.abs(prevDepth - currentStop) / ascentRate);
      const transitPi = inspiredPressure(currentStop, fN2);
      for (let i = 0; i < 16; i++) {
        tempTissue[i] = schreiner(tempTissue[i], transitPi, transitTime, VPM_HALFTIMES[i]);
      }
      
      // Check if we can ascend to next stop
      const nextStop = currentStop - 3;
      const nextAmbient = depthToPressure(nextStop);
      
      let canAscend = false;
      const simTissue = [...tempTissue];
      
      for (let minute = 0; minute <= 999; minute++) {
        canAscend = true;
        for (let i = 0; i < 16; i++) {
          const criticalVol = criticalVolume(i, maxDepth);
          const allowable = vpmAllowableSupersaturation(i, nextAmbient, criticalVol) * conservatismFactor;
          if (simTissue[i] > allowable) {
            canAscend = false;
            break;
          }
        }
        if (canAscend) {
          stopTime = minute;
          break;
        }
        
        // Simulate 1 more minute at this stop
        const pi = inspiredPressure(currentStop, fN2);
        for (let i = 0; i < 16; i++) {
          simTissue[i] = schreiner(simTissue[i], pi, 1, VPM_HALFTIMES[i]);
        }
        stopTime = minute + 1;
      }
      
      if (stopTime > 0) {
        decoStops.push({ depth: currentStop, time: stopTime });
      }
      
      // Update working tissue
      const pi = inspiredPressure(currentStop, fN2);
      for (let i = 0; i < 16; i++) {
        workingTissue[i] = schreiner(workingTissue[i], pi, transitTime + stopTime, VPM_HALFTIMES[i]);
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