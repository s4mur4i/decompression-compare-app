/**
 * Calculate dive profile from stops and descent rate.
 * Returns profile points AND phase table.
 */
export function calculateDiveProfile(stops, descentRate = 9) {
  if (!stops || stops.length === 0) return { points: [{ time: 0, depth: 0 }], phases: [] };

  const points = [{ time: 0, depth: 0 }];
  const phases = [];
  let currentTime = 0;
  let currentDepth = 0;

  for (const stop of stops) {
    const depthDiff = Math.abs(stop.depth - currentDepth);
    const transitTime = Math.ceil(depthDiff / descentRate);
    const action = stop.depth > currentDepth ? 'Descend' : stop.depth < currentDepth ? 'Ascend' : 'Stay';

    if (transitTime > 0) {
      phases.push({
        depth: stop.depth,
        duration: transitTime,
        runTime: currentTime,
        action,
      });
      currentTime += transitTime;
      currentDepth = stop.depth;
      points.push({ time: currentTime, depth: currentDepth });
    }

    // Bottom time at this depth
    phases.push({
      depth: currentDepth,
      duration: stop.time,
      runTime: currentTime,
      action: 'Stay',
    });
    currentTime += stop.time;
    points.push({ time: currentTime, depth: currentDepth });
  }

  return { points, phases, lastStopEnd: currentTime, lastDepth: currentDepth };
}

/**
 * Add ascent phases from decompression algorithm results.
 */
export function addAscentPhases(profile, ascentStops, descentRate) {
  const { points, phases, lastStopEnd, lastDepth } = profile;
  const newPoints = [...points];
  const newPhases = [...phases];
  let currentTime = lastStopEnd;
  let currentDepth = lastDepth;

  for (const stop of ascentStops) {
    const depthDiff = Math.abs(currentDepth - stop.depth);
    const transitTime = Math.ceil(depthDiff / descentRate);

    if (transitTime > 0) {
      newPhases.push({
        depth: stop.depth,
        duration: transitTime,
        runTime: currentTime,
        action: 'Ascend',
      });
      currentTime += transitTime;
      currentDepth = stop.depth;
      newPoints.push({ time: currentTime, depth: currentDepth });
    }

    if (stop.time > 0) {
      newPhases.push({
        depth: currentDepth,
        duration: stop.time,
        runTime: currentTime,
        action: 'Deco Stop',
      });
      currentTime += stop.time;
      newPoints.push({ time: currentTime, depth: currentDepth });
    }
  }

  // Final ascent to surface
  if (currentDepth > 0) {
    const ascentTime = Math.ceil(currentDepth / descentRate);
    newPhases.push({
      depth: 0,
      duration: ascentTime,
      runTime: currentTime,
      action: 'Ascend',
    });
    currentTime += ascentTime;
    newPoints.push({ time: currentTime, depth: 0 });
  }

  return { points: newPoints, phases: newPhases, totalTime: currentTime };
}

/**
 * Simple ascent (no algorithm) — just go up at descent rate.
 */
export function simpleAscent(profile, descentRate) {
  return addAscentPhases(profile, [], descentRate);
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
 * Get max depth from stops.
 */
export function getMaxDepth(stops) {
  if (!stops || stops.length === 0) return 0;
  return Math.max(...stops.map(s => s.depth));
}
