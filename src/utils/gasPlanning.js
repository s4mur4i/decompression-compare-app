/**
 * Gas consumption, rock bottom, and turn pressure calculations.
 */

/**
 * Tank presets: name -> size in liters
 */
export const TANK_PRESETS = [
  { label: 'AL80 (11.1L)', value: 11.1 },
  { label: 'S80 (11.1L)', value: 11.1 },
  { label: '12L Steel', value: 12 },
  { label: '15L Steel', value: 15 },
  { label: '2×12L Twins (24L)', value: 24 },
  { label: '7L Stage', value: 7 },
  { label: '5.5L Pony', value: 5.5 },
  { label: '3L Bailout', value: 3 },
];

/**
 * Calculate gas consumption per phase and total.
 * SAC rate is in L/min at surface.
 * Gas consumed = SAC × (depth/10 + 1) × time
 *
 * When perGasTanks is provided, also returns per-gas consumption breakdown.
 * perGasTanks: { bottom: { size, pressure }, stage1: { size, pressure }, stage2: { size, pressure } }
 */
export function calculateGasConsumption(phases, sacRate = 20, defaultFO2 = 0.21, defaultFHe = 0, perGasTanks = null) {
  let totalLiters = 0;
  const perPhase = [];

  // Track per-gas consumption
  const gasUsage = { bottom: 0, stage1: 0, stage2: 0 };

  for (const phase of phases) {
    let avgDepth = phase.depth;
    if (phase.action === 'Descend' || phase.action === 'Ascend') {
      avgDepth = phase.depth / 2;
    }
    const ambientFactor = avgDepth / 10 + 1;
    const liters = sacRate * ambientFactor * phase.duration;
    totalLiters += liters;

    // Determine which gas this phase uses
    let gasKey = 'bottom';
    if (phase.gas) {
      const gasLabel = phase.gas.toLowerCase();
      // After a gas switch, phases are tagged. Try to match stage gases.
      if (phase._gasIndex === 2) gasKey = 'stage2';
      else if (phase._gasIndex === 1) gasKey = 'stage1';
      else if (gasLabel.includes('o₂') || gasLabel === 'o2' || gasLabel === '100%') gasKey = 'stage2';
      else if (gasLabel !== '' && gasLabel !== 'air' && !gasLabel.startsWith('tx')) {
        // Heuristic: if there's a gas label and it's not the bottom gas, it's a deco gas
        gasKey = 'stage1';
      }
    }
    gasUsage[gasKey] += liters;

    perPhase.push({ liters, runningLiters: totalLiters, gasKey });
  }

  // Calculate per-gas sufficiency if tank configs provided
  let gasBreakdown = null;
  if (perGasTanks) {
    gasBreakdown = {};
    for (const key of ['bottom', 'stage1', 'stage2']) {
      const tank = perGasTanks[key];
      if (!tank) continue;
      const totalVolume = tank.size * tank.pressure;
      const used = gasUsage[key] || 0;
      const remaining = totalVolume - used;
      const pct = totalVolume > 0 ? (remaining / totalVolume) * 100 : 0;
      gasBreakdown[key] = {
        tankSize: tank.size,
        tankPressure: tank.pressure,
        totalVolume,
        used,
        remaining,
        remainingPct: pct,
        status: pct > 30 ? 'ok' : pct > 10 ? 'warning' : 'critical',
      };
    }
  }

  return { totalLiters, perPhase, gasUsage, gasBreakdown };
}

/**
 * Calculate bar pressure needed for a given gas volume in a tank.
 */
export function litersToBars(liters, tankSizeLiters) {
  if (tankSizeLiters <= 0) return 0;
  return Math.ceil(liters / tankSizeLiters);
}

/**
 * Calculate rock bottom (minimum gas for emergency ascent).
 * Uses stress factor of 2.0 (emergency breathing rate).
 * Includes ascent from max depth + any deco stops + reserve.
 */
export function calculateRockBottom(phases, sacRate = 20, tankSize = 24, reserveBar = 50, ascentRate = 9) {
  const STRESS_FACTOR = 2.0;
  const stressSAC = sacRate * STRESS_FACTOR;

  // Find max depth from phases
  let maxDepth = 0;
  for (const phase of phases) {
    if (phase.depth > maxDepth) maxDepth = phase.depth;
  }

  if (maxDepth === 0) return { liters: 0, bars: 0, reserveBar };

  // Emergency ascent from max depth
  const ascentTime = Math.ceil(maxDepth / ascentRate);
  const avgAscentDepth = maxDepth / 2;
  const ascentGas = stressSAC * (avgAscentDepth / 10 + 1) * ascentTime;

  // Safety/deco stop gas (assume 3 min at 6m under stress)
  const safetyStopGas = stressSAC * (6 / 10 + 1) * 3;

  const totalLiters = ascentGas + safetyStopGas;
  const bars = litersToBars(totalLiters, tankSize) + reserveBar;

  return { liters: totalLiters, bars, reserveBar, maxDepth };
}

/**
 * Rule of thirds gas management.
 * Returns turn pressure and turn time.
 */
export function calculateTurnPressure(startPressure = 200, reservePressure = 50, plannedConsumptionLiters = 0, tankSize = 24) {
  const usable = startPressure - reservePressure;
  const thirdUsable = Math.floor(usable / 3);
  const turnPressure = startPressure - thirdUsable;

  // Available gas in liters
  const availableLiters = usable * tankSize * (2 / 3);

  // Check if planned consumption exceeds available
  const plannedBars = litersToBars(plannedConsumptionLiters, tankSize);
  const sufficient = plannedBars + reservePressure <= startPressure;

  return {
    turnPressure,
    thirdUsable,
    availableLiters,
    plannedBars,
    startPressure,
    sufficient,
    totalRequired: plannedBars + reservePressure,
  };
}
