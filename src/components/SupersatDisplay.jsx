import { useMemo, useState } from 'react';
import { P_SURFACE } from '../utils/constants';
import { inspiredPressure, schreiner } from '../utils/physics';
import { PARAM_SETS } from '../utils/buhlmann';
import { buildGasTimeline, getGasAtTime } from '../utils/gasTimeline';

function getSatColor(pct) {
  if (pct > 100) return '#ff1744';
  if (pct > 80) return '#f44336';
  if (pct > 50) return '#ffc107';
  return '#4caf50';
}

function getSatLabel(pct) {
  if (pct > 100) return 'CRITICAL';
  if (pct > 80) return 'High';
  if (pct > 50) return 'Moderate';
  return 'Safe';
}

/**
 * Calculate post-deco tissue state by simulating the full dive profile.
 * Accounts for gas switches during deco stops.
 */
function calculatePostDecoTissueState(profilePoints, profilePhases, settings) {
  if (!profilePoints || profilePoints.length < 2 || !settings) return null;

  const { algorithm, fO2 = 0.21, fHe = 0 } = settings;
  const isBuhlmann = algorithm?.startsWith('zhl');
  const paramKey = isBuhlmann ? algorithm : 'zhl16c';
  const paramSet = PARAM_SETS[paramKey];
  if (!paramSet) return null;

  const nc = paramSet.compartments;
  const gasTimeline = buildGasTimeline(profilePhases, fO2, fHe);
  const initGas = gasTimeline[0];

  const n2 = new Array(nc).fill(inspiredPressure(0, initGas.fN2));
  const he = new Array(nc).fill(0);

  const maxTime = profilePoints[profilePoints.length - 1].time;

  function depthAt(t) {
    if (t <= 0) return 0;
    for (let i = 0; i < profilePoints.length - 1; i++) {
      const p1 = profilePoints[i], p2 = profilePoints[i + 1];
      if (t >= p1.time && t <= p2.time) {
        if (p1.time === p2.time) return p1.depth;
        const ratio = (t - p1.time) / (p2.time - p1.time);
        return p1.depth + (p2.depth - p1.depth) * ratio;
      }
    }
    return profilePoints[profilePoints.length - 1].depth;
  }

  for (let t = 1; t <= maxTime; t++) {
    const depth = depthAt(t);
    const gas = getGasAtTime(gasTimeline, t);
    const piN2 = inspiredPressure(depth, gas.fN2);
    const piHe = inspiredPressure(depth, gas.fHe);
    for (let i = 0; i < nc; i++) {
      n2[i] = schreiner(n2[i], piN2, 1, paramSet.halfTimes[i]);
      const heIdx = Math.min(i, paramSet.heHalfTimes.length - 1);
      he[i] = schreiner(he[i], piHe, 1, paramSet.heHalfTimes[heIdx]);
    }
  }

  // Use RAW M-values (not GF-adjusted) — shows % of actual physical limit
  const mValues = [];
  for (let i = 0; i < nc; i++) {
    const a = paramSet.aValues[i];
    const b = paramSet.bValues[i];
    mValues.push(a + P_SURFACE / b);
  }

  return { n2, he, mValues, nc };
}

export default function SupersatDisplay({ decoInfo, profilePoints, profilePhases, settings, label, color = '#4fc3f7' }) {
  const [showExplanation, setShowExplanation] = useState(false);

  // Use post-deco tissue state if we have profile points, otherwise fall back to decoInfo
  const postDecoState = useMemo(() => {
    if (profilePoints && settings && settings.algorithm !== 'none') {
      return calculatePostDecoTissueState(profilePoints, profilePhases, settings);
    }
    return null;
  }, [profilePoints, profilePhases, settings]);

  // Determine which data to use
  const tissueData = useMemo(() => {
    if (postDecoState) {
      return {
        tissueLoading: postDecoState.n2,
        heLoading: postDecoState.he,
        mValues: postDecoState.mValues,
        nc: postDecoState.nc,
      };
    }
    if (decoInfo && decoInfo.tissueLoading && decoInfo.mValues) {
      return {
        tissueLoading: decoInfo.tissueLoading,
        heLoading: decoInfo.heLoading,
        mValues: decoInfo.mValues,
        nc: decoInfo.compartmentCount || decoInfo.tissueLoading.length,
      };
    }
    return null;
  }, [postDecoState, decoInfo]);

  if (!tissueData) return null;

  const ambient = P_SURFACE;
  const saturations = [];

  for (let i = 0; i < tissueData.nc; i++) {
    const loading = tissueData.tissueLoading[i] + (tissueData.heLoading?.[i] || 0);
    const mVal = tissueData.mValues[i];
    const denom = mVal - ambient;
    const pct = denom > 0 ? ((loading - ambient) / denom) * 100 : 0;
    saturations.push(Math.max(0, pct));
  }

  const maxSat = Math.max(...saturations);
  const maxIdx = saturations.indexOf(maxSat);

  return (
    <div className="supersat-display" style={{ borderColor: `${color}40` }}>
      <div className="section-header-row">
        <h4 style={{ color, margin: '0', fontSize: '0.85rem' }}>
          {label ? `${label} ` : ''}Supersaturation at Surface
        </h4>
        <button
          className="info-toggle-btn"
          onClick={() => setShowExplanation(!showExplanation)}
          title="Toggle explanation"
        >
          ℹ️
        </button>
      </div>
      {showExplanation && (
        <p className="chart-explanation" style={{ margin: '8px 0' }}>
          How much dissolved gas remains in each tissue when you reach the surface{postDecoState ? ' after completing all deco stops' : ''}. 
          0% = ambient equilibrium, 100% = at the absolute M-value limit (DCS risk). 
          Values above ~70% indicate the tissue is still significantly loaded. Your GF setting provides additional safety margin below 100%.
        </p>
      )}
      <div className="supersat-summary">
        <span>Max: <strong style={{ color: getSatColor(maxSat) }}>{maxSat.toFixed(1)}%</strong> (TC{maxIdx + 1})</span>
        <span className="supersat-status" style={{ color: getSatColor(maxSat) }}>{getSatLabel(maxSat)}</span>
      </div>
      <div className="supersat-bars">
        {saturations.map((pct, i) => (
          <div key={i} className="supersat-bar-wrapper" title={`TC${i + 1}: ${pct.toFixed(1)}%`}>
            <div className="supersat-bar-bg">
              <div
                className="supersat-bar-fill"
                style={{
                  width: `${Math.min(100, pct)}%`,
                  backgroundColor: getSatColor(pct),
                }}
              />
            </div>
            <span className="supersat-bar-label">{i + 1}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
