/**
 * Calculate dive profile from stops and rates.
 * Transit time is INCLUDED in stop time (not added).
 * E.g. 25m/10min = 3min descent + 7min at depth = 10min total.
 */
export function calculateDiveProfile(stops, descentRate = 18, ascentRate = 9) {
  if (!stops || stops.length === 0) return { points: [{ time: 0, depth: 0 }], phases: [] };

  const points = [{ time: 0, depth: 0 }];
  const phases = [];
  let currentTime = 0;
  let currentDepth = 0;

  for (const stop of stops) {
    const depthDiff = Math.abs(stop.depth - currentDepth);
    const goingDeeper = stop.depth > currentDepth;
    const rate = goingDeeper ? descentRate : ascentRate;
    const transitTime = depthDiff > 0 ? Math.ceil(depthDiff / rate) : 0;
    const action = goingDeeper ? 'Descend' : stop.depth < currentDepth ? 'Ascend' : 'Stay';

    // Transit time is part of the planned stop time
    const stayTime = Math.max(0, stop.time - transitTime);

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

    if (stayTime > 0) {
      phases.push({
        depth: currentDepth,
        duration: stayTime,
        runTime: currentTime,
        action: 'Stay',
      });
      currentTime += stayTime;
      points.push({ time: currentTime, depth: currentDepth });
    }
  }

  return { points, phases, lastStopEnd: currentTime, lastDepth: currentDepth };
}

/**
 * Add ascent phases from decompression algorithm results.
 */
export function addAscentPhases(profile, ascentStops, ascentRate) {
  const { points, phases, lastStopEnd, lastDepth } = profile;
  const newPoints = [...points];
  const newPhases = [...phases];
  let currentTime = lastStopEnd;
  let currentDepth = lastDepth;
  for (const stop of ascentStops) {
    const depthDiff = Math.abs(currentDepth - stop.depth);
    const transitTime = Math.ceil(depthDiff / ascentRate);

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

    // Show gas switch marker only when explicitly flagged by algorithm
    if (stop.gasSwitch) {
      newPhases.push({
        depth: currentDepth,
        duration: 0,
        runTime: currentTime,
        action: 'Gas Switch',
        gas: stop.gas,
      });
    }

    if (stop.time > 0) {
      newPhases.push({
        depth: currentDepth,
        duration: stop.time,
        runTime: currentTime,
        action: 'Deco Stop',
        gas: stop.gas || undefined,
      });
      currentTime += stop.time;
      newPoints.push({ time: currentTime, depth: currentDepth });
    }
  }

  // Final ascent to surface
  if (currentDepth > 0) {
    const finalAscentTime = Math.ceil(currentDepth / ascentRate);
    newPhases.push({
      depth: 0,
      duration: finalAscentTime,
      runTime: currentTime,
      action: 'Ascend',
    });
    currentTime += finalAscentTime;
    newPoints.push({ time: currentTime, depth: 0 });
  }

  return { points: newPoints, phases: newPhases, totalTime: currentTime };
}

/**
 * Simple ascent (no algorithm) — just go up at ascent rate.
 */
export function simpleAscent(profile, ascentRate) {
  return addAscentPhases(profile, [], ascentRate);
}

/**
 * Parse plan string from URL params.
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
