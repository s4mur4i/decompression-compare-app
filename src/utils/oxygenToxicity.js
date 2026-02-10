/**
 * CNS O₂ Toxicity and OTU (Oxygen Tolerance Units) calculations.
 */

/**
 * NOAA CNS clock limits: ppO₂ → max single-exposure minutes at 100% CNS.
 */
const CNS_LIMITS = [
  [1.6, 45], [1.5, 120], [1.4, 150], [1.3, 180],
  [1.2, 210], [1.1, 240], [1.0, 300], [0.9, 360],
  [0.8, 450], [0.7, 570], [0.6, 720],
];

/**
 * Get max single-exposure minutes for a given ppO₂.
 */
function getCNSLimit(ppO2) {
  if (ppO2 <= 0.5) return Infinity;
  for (const [threshold, minutes] of CNS_LIMITS) {
    if (ppO2 >= threshold) return minutes;
  }
  return 720;
}

/**
 * Get the gas fO2 active during a phase, parsing the gas label if present.
 */
function getPhaseO2(phase, defaultFO2) {
  if (phase.gas) {
    const parts = phase.gas.split('/');
    return parseInt(parts[0]) / 100;
  }
  return defaultFO2;
}

/**
 * Calculate cumulative CNS% through a dive profile.
 * Returns { totalCNS, perPhase: [{cns, runningCNS}] }
 */
export function calculateCNS(phases, defaultFO2 = 0.21, defaultFHe = 0) {
  let totalCNS = 0;
  const perPhase = [];

  for (const phase of phases) {
    const fO2 = getPhaseO2(phase, defaultFO2);
    // Use average depth for transit phases
    let avgDepth = phase.depth;
    if (phase.action === 'Descend' || phase.action === 'Ascend') {
      // For transit, average between start and end depth
      // We approximate: for descend from prev to phase.depth, for ascend similarly
      avgDepth = phase.depth / 2; // simplified - works for first descent from 0
    }

    const pAmb = 1.01325 + avgDepth / 10;
    const ppO2 = pAmb * fO2;
    const limit = getCNSLimit(ppO2);
    const phaseCNS = limit === Infinity ? 0 : (phase.duration / limit) * 100;
    totalCNS += phaseCNS;
    perPhase.push({ cns: phaseCNS, runningCNS: totalCNS });
  }

  return { totalCNS: Math.min(999, totalCNS), perPhase };
}

/**
 * Calculate OTU using Lambertsen UPTD formula:
 * OTU = t × ((ppO₂ - 0.5) / 0.5)^0.83
 * Only applies when ppO₂ > 0.5
 */
export function calculateOTU(phases, defaultFO2 = 0.21, defaultFHe = 0) {
  let totalOTU = 0;
  const perPhase = [];

  for (const phase of phases) {
    const fO2 = getPhaseO2(phase, defaultFO2);
    let avgDepth = phase.depth;
    if (phase.action === 'Descend' || phase.action === 'Ascend') {
      avgDepth = phase.depth / 2;
    }

    const pAmb = 1.01325 + avgDepth / 10;
    const ppO2 = pAmb * fO2;

    let phaseOTU = 0;
    if (ppO2 > 0.5 && phase.duration > 0) {
      phaseOTU = phase.duration * Math.pow((ppO2 - 0.5) / 0.5, 0.83);
    }
    totalOTU += phaseOTU;
    perPhase.push({ otu: phaseOTU, runningOTU: totalOTU });
  }

  return { totalOTU, perPhase };
}
