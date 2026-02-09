/**
 * RGBM (Reduced Gradient Bubble Model) decompression algorithm implementation.
 * 
 * Based on Wienke's dual-phase model combining dissolved gas transport
 * with explicit bubble formation and growth mechanics.
 */

// ZHL-16C compartment half-times (reduced set for RGBM efficiency)
const RGBM_HALFTIMES = [
  4.0, 8.0, 12.5, 18.5, 27.0, 38.3, 54.3, 77.0,
  109.0, 146.0, 187.0, 239.0, 305.0, 390.0, 498.0, 635.0
];

// RGBM specific parameters
const RGBM_PARAMS = {
  // Physical constants
  WATER_VAPOR_PRESSURE: 0.0627, // bar
  SURFACE_PRESSURE: 1.01325, // bar
  
  // Bubble formation parameters
  BUBBLE_FORMATION_GRADIENT: 0.8, // bar (gradient needed for bubble formation)
  SURFACE_TENSION: 0.0179, // N/m
  CRITICAL_BUBBLE_SIZE: 1.0e-6, // m (critical bubble radius)
  
  // RGBM specific coefficients
  BUBBLE_GROWTH_RATE: 0.2, // Bubble growth rate coefficient
  GRADIENT_REDUCTION_FACTOR: 0.85, // Factor to reduce gradients when bubbles present
  
  // Bühlmann-based M-values (modified for RGBM)
  // [a, b] coefficients for each compartment
  M_VALUES: [
    [1.2599, 0.5050], [1.0000, 0.6514], [0.8618, 0.7222], [0.7562, 0.7825],
    [0.6200, 0.8126], [0.5043, 0.8434], [0.4410, 0.8693], [0.4000, 0.8910],
    [0.3750, 0.9092], [0.3500, 0.9222], [0.3295, 0.9319], [0.3065, 0.9403],
    [0.2835, 0.9477], [0.2610, 0.9544], [0.2480, 0.9602], [0.2327, 0.9653]
  ],
  
  // Bubble reduction factors for different dive conditions
  ASCENT_RATE_FACTORS: {
    SLOW: 0.95,   // < 10 m/min
    NORMAL: 0.85, // 10-18 m/min
    FAST: 0.75    // > 18 m/min
  },
  
  // Depth-dependent bubble factors
  DEPTH_FACTOR_SHALLOW: 0.9, // < 18m
  DEPTH_FACTOR_MEDIUM: 0.8,  // 18-40m
  DEPTH_FACTOR_DEEP: 0.7     // > 40m
};

/**
 * Convert depth in meters to absolute pressure in bar (saltwater).
 */
function depthToPressure(depth) {
  return RGBM_PARAMS.SURFACE_PRESSURE + (depth / 10.0);
}

/**
 * Calculate inspired gas pressure at given depth.
 */
function inspiredPressure(depth, fGas) {
  const ambientPressure = depthToPressure(depth);
  return (ambientPressure - RGBM_PARAMS.WATER_VAPOR_PRESSURE) * fGas;
}

/**
 * Schreiner equation for tissue loading.
 */
function schreiner(p0, pi, time, halfTime) {
  if (time <= 0) return p0;
  const k = Math.LN2 / halfTime;
  return p0 + (pi - p0) * (1 - Math.exp(-k * time));
}

/**
 * Calculate bubble formation probability based on supersaturation.
 */
function bubbleFormationProbability(tissuePress, ambientPress, compartment) {
  const gradient = tissuePress - ambientPress;
  
  if (gradient <= RGBM_PARAMS.BUBBLE_FORMATION_GRADIENT) {
    return 0.0; // No bubbles below threshold gradient
  }
  
  // Probability increases with gradient and varies by compartment
  const halfTime = RGBM_HALFTIMES[compartment];
  const tissueSpecificThreshold = RGBM_PARAMS.BUBBLE_FORMATION_GRADIENT * 
                                   (1.0 + halfTime / 100.0); // Slower tissues more susceptible
  
  const excessGradient = gradient - tissueSpecificThreshold;
  const maxProbability = 0.8; // Maximum bubble formation probability
  
  return Math.min(maxProbability, excessGradient / (tissueSpecificThreshold * 2.0));
}

/**
 * Calculate bubble reduction factor based on dive conditions.
 */
function calculateBubbleReductionFactor(depth, ascentRate, diveTime, compartment) {
  let reductionFactor = 1.0;
  
  // Ascent rate factor
  let ascentFactor;
  if (ascentRate <= 10) {
    ascentFactor = RGBM_PARAMS.ASCENT_RATE_FACTORS.SLOW;
  } else if (ascentRate <= 18) {
    ascentFactor = RGBM_PARAMS.ASCENT_RATE_FACTORS.NORMAL;
  } else {
    ascentFactor = RGBM_PARAMS.ASCENT_RATE_FACTORS.FAST;
  }
  
  // Depth factor
  let depthFactor;
  if (depth < 18) {
    depthFactor = RGBM_PARAMS.DEPTH_FACTOR_SHALLOW;
  } else if (depth < 40) {
    depthFactor = RGBM_PARAMS.DEPTH_FACTOR_MEDIUM;
  } else {
    depthFactor = RGBM_PARAMS.DEPTH_FACTOR_DEEP;
  }
  
  // Time factor (longer dives = more conservative)
  const timeFactor = Math.max(0.7, 1.0 - (diveTime / 300.0)); // More conservative for dives > 5 hours
  
  // Compartment-specific factor (slower compartments more affected)
  const compartmentFactor = 1.0 - (compartment * 0.02); // Linear decrease with compartment number
  
  reductionFactor = ascentFactor * depthFactor * timeFactor * compartmentFactor;
  
  return Math.max(0.5, Math.min(1.0, reductionFactor));
}

/**
 * Calculate RGBM modified M-value (allowable supersaturation).
 * Combines Bühlmann M-value with bubble reduction factors.
 */
function rgbmMValue(compartment, ambientPressure, bubblePhase, reductionFactor, conservatism) {
  const [a, b] = RGBM_PARAMS.M_VALUES[compartment];
  
  // Base Bühlmann M-value
  const baseMValue = a + ambientPressure / b;
  
  // Apply bubble reduction if bubbles are present
  let modifiedMValue = baseMValue;
  if (bubblePhase > 0.1) {
    // Reduce allowable supersaturation when bubbles are present
    const bubbleReduction = 1.0 - (bubblePhase * (1.0 - RGBM_PARAMS.GRADIENT_REDUCTION_FACTOR));
    modifiedMValue *= bubbleReduction;
  }
  
  // Apply overall reduction factor
  modifiedMValue *= reductionFactor;
  
  // Apply user conservatism (via gfHigh parameter)
  modifiedMValue = ambientPressure + (modifiedMValue - ambientPressure) * (conservatism / 100.0);
  
  return Math.max(ambientPressure * 1.01, modifiedMValue); // Minimum 1% supersaturation
}

/**
 * Calculate RGBM ceiling depth.
 */
function rgbmCeiling(tissueLoading, bubblePhases, diveTime, ascentRate) {
  let maxCeiling = 0;
  
  for (let i = 0; i < 16; i++) {
    const pN2 = tissueLoading[i];
    const bubblePhase = bubblePhases[i];
    
    // Binary search for ceiling depth
    let low = 0;
    let high = 100; // Maximum search depth
    
    for (let iter = 0; iter < 20; iter++) {
      const testDepth = (low + high) / 2;
      const testPressure = depthToPressure(testDepth);
      const reductionFactor = calculateBubbleReductionFactor(testDepth, ascentRate, diveTime, i);
      const allowable = rgbmMValue(i, testPressure, bubblePhase, reductionFactor, 70); // Use fixed conservatism for ceiling
      
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
 * Run RGBM decompression calculation.
 * 
 * @param {Array<{depth: number, duration: number, action: string}>} phases - Dive phases from profile
 * @param {number} fO2 - Fraction of O2 in breathing gas (e.g., 0.21 for air)
 * @param {number} gfLow - Conservative factor for deep stops (RGBM uses internally)
 * @param {number} gfHigh - Conservative factor for shallow stops
 * @param {number} ascentRate - Ascent rate in m/min
 * @returns {Object} Deco stops and tissue data
 */
export function calculateRGBM(phases, fO2 = 0.21, gfLow = 30, gfHigh = 70, ascentRate = 9) {
  const fN2 = 1.0 - fO2;
  
  // Calculate total dive time for bubble reduction factors
  const diveTime = phases.reduce((total, phase) => total + phase.duration, 0);
  
  // Initialize tissue loading at surface equilibrium
  const surfaceN2 = inspiredPressure(0, fN2);
  const tissueLoading = new Array(16).fill(surfaceN2);
  const bubblePhases = new Array(16).fill(0.0); // Track bubble formation per compartment
  
  // Process each phase to build tissue loading and bubble formation
  for (const phase of phases) {
    const pi = inspiredPressure(phase.depth, fN2);
    const ambientPress = depthToPressure(phase.depth);
    const duration = phase.duration;
    
    for (let i = 0; i < 16; i++) {
      // Update dissolved gas (traditional Haldanian)
      const newLoading = schreiner(tissueLoading[i], pi, duration, RGBM_HALFTIMES[i]);
      
      // Calculate bubble formation during this phase
      const avgLoading = (tissueLoading[i] + newLoading) / 2;
      const bubbleProb = bubbleFormationProbability(avgLoading, ambientPress, i);
      
      // Update bubble phase (bubbles can form but also get eliminated)
      const bubbleGrowth = bubbleProb * RGBM_PARAMS.BUBBLE_GROWTH_RATE * (duration / 60.0);
      const bubbleElimination = bubblePhases[i] * 0.1 * (duration / 60.0); // 10% per hour elimination
      
      bubblePhases[i] = Math.max(0, bubblePhases[i] + bubbleGrowth - bubbleElimination);
      bubblePhases[i] = Math.min(1.0, bubblePhases[i]); // Cap at 100%
      
      tissueLoading[i] = newLoading;
    }
  }
  
  // Calculate RGBM ceiling
  const rawCeiling = rgbmCeiling(tissueLoading, bubblePhases, diveTime, ascentRate);
  
  // RGBM typically produces deeper stops than Bühlmann, similar to VPM-B
  const firstStopDepth = Math.ceil(rawCeiling / 3) * 3;
  
  // Generate RGBM decompression stops
  const decoStops = [];
  const workingTissue = [...tissueLoading];
  const workingBubbles = [...bubblePhases];
  
  if (firstStopDepth > 0) {
    let currentStop = firstStopDepth;
    
    while (currentStop >= 3) {
      let stopTime = 0;
      const tempTissue = [...workingTissue];
      const tempBubbles = [...workingBubbles];
      
      // Simulate ascent to this stop
      const prevDepth = currentStop === firstStopDepth
        ? phases[phases.length - 1]?.depth || 0
        : currentStop + 3;
      
      const transitTime = Math.ceil(Math.abs(prevDepth - currentStop) / ascentRate);
      const transitPi = inspiredPressure(currentStop, fN2);
      const currentAmbient = depthToPressure(currentStop);
      
      for (let i = 0; i < 16; i++) {
        tempTissue[i] = schreiner(tempTissue[i], transitPi, transitTime, RGBM_HALFTIMES[i]);
        // Bubbles may form during ascent due to decompression
        const bubbleProb = bubbleFormationProbability(tempTissue[i], currentAmbient, i);
        tempBubbles[i] = Math.min(1.0, tempBubbles[i] + bubbleProb * 0.1);
      }
      
      // Check if we can ascend to next stop
      const nextStop = currentStop - 3;
      const nextAmbient = depthToPressure(nextStop);
      
      let canAscend = false;
      const simTissue = [...tempTissue];
      const simBubbles = [...tempBubbles];
      
      for (let minute = 0; minute <= 999; minute++) {
        canAscend = true;
        for (let i = 0; i < 16; i++) {
          const reductionFactor = calculateBubbleReductionFactor(currentStop, ascentRate, diveTime + minute/60, i);
          const allowable = rgbmMValue(i, nextAmbient, simBubbles[i], reductionFactor, gfHigh);
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
          simTissue[i] = schreiner(simTissue[i], pi, 1, RGBM_HALFTIMES[i]);
          // Bubble elimination during stop
          simBubbles[i] = Math.max(0, simBubbles[i] - 0.002); // Small elimination rate
        }
        stopTime = minute + 1;
      }
      
      if (stopTime > 0) {
        decoStops.push({ depth: currentStop, time: stopTime });
      }
      
      // Update working tissue and bubbles
      const pi = inspiredPressure(currentStop, fN2);
      for (let i = 0; i < 16; i++) {
        workingTissue[i] = schreiner(workingTissue[i], pi, transitTime + stopTime, RGBM_HALFTIMES[i]);
        // Update bubble state
        workingBubbles[i] = Math.max(0, workingBubbles[i] - (stopTime / 60) * 0.1); // Elimination during stops
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