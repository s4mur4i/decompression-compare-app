/**
 * Shared physical constants for decompression algorithms.
 */

// Atmospheric / surface pressure (bar)
export const P_SURFACE = 1.01325;

// Water vapor pressure in lungs (bar)
export const P_WATER_VAPOR = 0.0627;

// Surface tension parameters (VPM)
export const GAMMA = 0.0179;          // Surface tension (N/m)
export const GAMMA_C = 0.0257;        // Skin compression (N/m)

// VPM critical volume lambda
export const LAMBDA_N2 = 7500;

// DCIEM-specific
export const DCIEM_ASCENT_PENALTY = 1.1;
export const DCIEM_SAFETY_FACTOR = 0.9;

// Thalmann linear elimination threshold
export const LINEAR_THRESHOLD_FACTOR = 1.05;

// Meters-to-feet conversion
export const METERS_TO_FEET = 3.28084;

// Deco stop interval (meters)
export const STOP_INTERVAL = 3;

// Max deco stop search iterations
export const MAX_STOP_MINUTES = 999;
