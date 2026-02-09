/**
 * Calculate dive profile from stops and descent rate.
 * 
 * @param {Array<{depth: number, time: number}>} stops - Dive stops (depth in meters, time in minutes)
 * @param {number} descentRate - Descent/ascent rate in meters per minute (default 9)
 * @returns {Array<{time: number, depth: number}>} Profile points for graphing
 */
export function calculateDiveProfile(stops, descentRate = 9) {
  if (!stops || stops.length === 0) return [{ time: 0, depth: 0 }];

  const points = [{ time: 0, depth: 0 }];
  let currentTime = 0;
  let currentDepth = 0;

  for (const stop of stops) {
    const depthDiff = Math.abs(stop.depth - currentDepth);
    const transitTime = Math.ceil(depthDiff / descentRate);

    // Transit to target depth
    currentTime += transitTime;
    currentDepth = stop.depth;
    points.push({ time: currentTime, depth: currentDepth });

    // Bottom time at this depth
    currentTime += stop.time;
    points.push({ time: currentTime, depth: currentDepth });
  }

  // Ascent to surface
  if (currentDepth > 0) {
    const ascentTime = Math.ceil(currentDepth / descentRate);
    currentTime += ascentTime;
    points.push({ time: currentTime, depth: 0 });
  }

  return points;
}

/**
 * Parse plan string from URL params.
 * Format: "25:10,20:5" → [{depth: 25, time: 10}, {depth: 20, time: 5}]
 */
export function parsePlan(planStr) {
  if (!planStr) return [];
  return planStr.split(',').map(s => {
    const [depth, time] = s.split(':').map(Number);
    if (isNaN(depth) || isNaN(time)) return null;
    return { depth, time };
  }).filter(Boolean);
}

/**
 * Serialize stops to URL plan string.
 */
export function serializePlan(stops) {
  return stops.map(s => `${s.depth}:${s.time}`).join(',');
}

/**
 * Get total dive time from profile.
 */
export function getTotalTime(profile) {
  if (!profile || profile.length === 0) return 0;
  return profile[profile.length - 1].time;
}

/**
 * Get max depth from stops.
 */
export function getMaxDepth(stops) {
  if (!stops || stops.length === 0) return 0;
  return Math.max(...stops.map(s => s.depth));
}
