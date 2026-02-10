/**
 * Shared gas timeline utilities for tracking gas switches during a dive profile.
 * Used by GFExplorer, SupersatDisplay, and ceiling calculations.
 */

/**
 * Build a gas timeline from dive phases: [{startTime, fO2, fHe, fN2}]
 * Parses gas labels (e.g., "50/0", "21/35") from phase.gas property.
 */
export function buildGasTimeline(phases, defaultFO2, defaultFHe) {
  if (!phases || phases.length === 0) {
    return [{ startTime: 0, fO2: defaultFO2, fHe: defaultFHe, fN2: 1 - defaultFO2 - defaultFHe }];
  }
  const timeline = [];
  let currentFO2 = defaultFO2, currentFHe = defaultFHe;
  let runTime = 0;
  for (const phase of phases) {
    if (phase.gas) {
      const parts = phase.gas.split('/');
      currentFO2 = parseInt(parts[0], 10) / 100;
      currentFHe = parts.length > 1 ? parseInt(parts[1], 10) / 100 : 0;
    }
    timeline.push({ startTime: runTime, fO2: currentFO2, fHe: currentFHe, fN2: 1 - currentFO2 - currentFHe });
    runTime += phase.duration;
  }
  return timeline;
}

/**
 * Get the active gas at a given time from a gas timeline.
 */
export function getGasAtTime(timeline, t) {
  let gas = timeline[0];
  for (const g of timeline) {
    if (g.startTime <= t) gas = g;
    else break;
  }
  return gas;
}
