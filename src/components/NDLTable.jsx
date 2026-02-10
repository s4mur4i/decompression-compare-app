import { useState, useMemo } from 'react';
import { calculateDiveProfile } from '../utils/diveProfile';

/**
 * Binary search for NDL: find max bottom time with 0 deco stops.
 */
function findNDL(depth, algoFn, opts) {
  if (!algoFn) return null;

  let lo = 1, hi = 300, ndl = 0;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const profile = calculateDiveProfile([{ depth, time: mid }], 18, 9);
    const result = algoFn(profile.phases, opts);

    if (result.noDecoLimit || result.decoStops.length === 0) {
      ndl = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return ndl > 0 ? ndl : 0;
}

/**
 * Calculate CNS% for a given depth and time.
 * Simplified NOAA CNS clock.
 */
function calcCNS(depth, time, fO2) {
  const ppO2 = (1.01325 + depth / 10) * fO2;
  if (ppO2 <= 0.5) return 0;

  // NOAA CNS limits (ppO2 → max minutes at 100%)
  const limits = [
    [1.6, 45], [1.5, 120], [1.4, 150], [1.3, 180],
    [1.2, 210], [1.1, 240], [1.0, 300], [0.9, 360],
    [0.8, 450], [0.7, 570], [0.6, 720],
  ];

  let maxMin = 720;
  for (const [pp, mins] of limits) {
    if (ppO2 >= pp) { maxMin = mins; break; }
  }

  return Math.min(999, (time / maxMin) * 100);
}

export default function NDLTable({ algorithmFn, settings, algorithmName }) {
  const [collapsed, setCollapsed] = useState(true);

  const { fO2 = 0.21, fHe = 0, gfLow = 50, gfHigh = 70, ascentRate = 9 } = settings || {};

  const ndlData = useMemo(() => {
    if (!algorithmFn) return [];

    const opts = { fO2, fHe, gfLow, gfHigh, ascentRate };
    const rows = [];

    for (let depth = 10; depth <= 60; depth += 3) {
      const ndl = findNDL(depth, algorithmFn, opts);
      const cns = ndl > 0 ? calcCNS(depth, ndl, fO2) : 0;
      rows.push({ depth, ndl, cns });
    }

    return rows;
  }, [algorithmFn, fO2, fHe, gfLow, gfHigh, ascentRate]);

  if (!algorithmFn) return null;

  return (
    <div className="collapsible-section">
      <button className="collapsible-header" onClick={() => setCollapsed(!collapsed)}>
        <span>{collapsed ? '▶' : '▼'} 📋 NDL Table — No-Decompression Limits</span>
        <span className="collapsible-hint">{algorithmName || 'Selected algorithm'}</span>
      </button>
      {!collapsed && (
        <div className="ndl-table-container">
          <p className="ndl-subtitle">
            Gas: {Math.round(fO2 * 100)}% O₂ {fHe > 0 ? `/ ${Math.round(fHe * 100)}% He` : ''} | GF: {gfLow}/{gfHigh}
          </p>
          <table className="ndl-table">
            <thead>
              <tr>
                <th>Depth (m)</th>
                <th>NDL (min)</th>
                <th>CNS% at NDL</th>
              </tr>
            </thead>
            <tbody>
              {ndlData.map(row => (
                <tr key={row.depth}>
                  <td>{row.depth}</td>
                  <td className={row.ndl === 0 ? 'ndl-zero' : ''}>
                    {row.ndl === 0 ? '< 1' : row.ndl}
                  </td>
                  <td style={{ color: row.cns > 80 ? '#f44336' : row.cns > 50 ? '#ffc107' : 'inherit' }}>
                    {row.ndl === 0 ? '—' : `${row.cns.toFixed(1)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
