/**
 * Shared physics functions for decompression algorithms.
 */
import { P_SURFACE, P_WATER_VAPOR } from './constants.js';

/**
 * Convert depth in meters to absolute pressure in bar (saltwater).
 */
export function depthToPressure(depth) {
  return P_SURFACE + depth / 10.0;
}

/**
 * Convert absolute pressure to depth in meters.
 */
export function pressureToDepth(pressure) {
  return Math.max(0, (pressure - P_SURFACE) * 10.0);
}

/**
 * Calculate inspired (alveolar) gas pressure at given depth.
 */
export function inspiredPressure(depth, fGas) {
  return (depthToPressure(depth) - P_WATER_VAPOR) * fGas;
}

/**
 * Schreiner equation — exponential gas loading/elimination.
 * Also known as Haldane equation / exponential loading / exponential update.
 */
export function schreiner(p0, pi, time, halfTime) {
  if (time <= 0) return p0;
  const k = Math.LN2 / halfTime;
  return p0 + (pi - p0) * (1 - Math.exp(-k * time));
}

/**
 * Calculate Maximum Operating Depth for a given O2 fraction and ppO2 limit.
 */
export function calcMOD(fO2, ppO2Max) {
  return fO2 > 0 ? Math.floor(10 * (ppO2Max / fO2 - 1)) : 0;
}
