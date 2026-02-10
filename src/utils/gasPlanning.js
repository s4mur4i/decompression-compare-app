/**
 * Gas consumption, rock bottom, and turn pressure calculations.
 */

/**
 * Calculate gas consumption per phase and total.
 * SAC rate is in L/min at surface.
 * Gas consumed = SAC × (depth/10 + 1) × time
 */
export function calculateGasConsumption(phases, sacRate = 20, defaultFO2 = 0.21, defaultFHe = 0) {
  let totalLiters = 0;
  const perPhase = [];

  for (const phase of phases) {
    let avgDepth = phase.depth;
    if (phase.action === 'Descend' || phase.action === 'Ascend') {
      avgDepth = phase.depth / 2;
    }
    const ambientFactor = avgDepth / 10 + 1;
    const liters = sacRate * ambientFactor * phase.duration;
    totalLiters += liters;
    perPhase.push({ liters, runningLiters: totalLiters });
  }

  return { totalLiters, perPhase };
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
