import { useState, useMemo, useCallback } from 'react';
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
 */
function calcCNS(depth, time, fO2) {
  const ppO2 = (1.01325 + depth / 10) * fO2;
  if (ppO2 <= 0.5) return 0;

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


export default function NDLTable({ algorithmFn: defaultAlgoFn, settings, algorithmName: defaultAlgoName, algorithmRegistry }) {
  const [collapsed, setCollapsed] = useState(true);
  const [showHelp, setShowHelp] = useState(false);

  // Local interactive state
  const [fO2, setFO2] = useState(Math.round((settings?.fO2 || 0.21) * 100));
  const [fHe, setFHe] = useState(Math.round((settings?.fHe || 0) * 100));
  const [gfLow, setGfLow] = useState(settings?.gfLow || 50);
  const [gfHigh, setGfHigh] = useState(settings?.gfHigh || 70);
  const [selectedAlgo, setSelectedAlgo] = useState('');

  // Get all available algorithms
  const algoEntries = useMemo(() => {
    if (!algorithmRegistry) return [];
    return Object.entries(algorithmRegistry).map(([key, val]) => ({
      key,
      name: val.name || key,
      fn: val.fn,
      supportsGF: val.gf ?? false,
      supportsTrimix: val.trimix ?? false,
    }));
  }, []);

  // Determine active algorithm
  const activeAlgo = useMemo(() => {
    if (selectedAlgo) {
      const entry = algoEntries.find(a => a.key === selectedAlgo);
      if (entry) return entry;
    }
    // Fallback to prop
    if (defaultAlgoFn) {
      return { key: '', name: defaultAlgoName || 'Selected', fn: defaultAlgoFn, supportsGF: true, supportsTrimix: true };
    }
    // Default to first algorithm
    return algoEntries[0] || null;
  }, [selectedAlgo, algoEntries, defaultAlgoFn, defaultAlgoName]); // eslint-disable-line react-hooks/exhaustive-deps

  const ndlData = useMemo(() => {
    if (!activeAlgo?.fn) return [];

    const o2 = fO2 / 100;
    const he = fHe / 100;
    const opts = { fO2: o2, fHe: he, gfLow, gfHigh, ascentRate: 9 };
    const rows = [];

    for (let depth = 6; depth <= 66; depth += 3) {
      // Check MOD
      const ppO2 = (1.01325 + depth / 10) * o2;
      if (ppO2 > 1.6) {
        rows.push({ depth, ndl: -1, cns: 0, mod: true });
        continue;
      }
      const ndl = findNDL(depth, activeAlgo.fn, opts);
      const cns = ndl > 0 ? calcCNS(depth, ndl, o2) : 0;
      rows.push({ depth, ndl, cns, mod: false });
    }

    return rows;
  }, [activeAlgo, fO2, fHe, gfLow, gfHigh]);

  const handleFO2 = useCallback((e) => {
    const v = parseInt(e.target.value) || 0;
    const maxO2 = 100 - fHe;
    setFO2(Math.max(1, Math.min(maxO2, v)));
  }, [fHe]);

  const handleFHe = useCallback((e) => {
    const v = parseInt(e.target.value) || 0;
    const maxHe = 100 - fO2;
    setFHe(Math.max(0, Math.min(maxHe, v)));
  }, [fO2]);

  return (
    <div className="collapsible-section">
      <button className="collapsible-header" onClick={() => setCollapsed(!collapsed)}>
        <span>{collapsed ? '▶' : '▼'} 📋 NDL Table — No-Decompression Limits</span>
        <span className="collapsible-hint">Interactive</span>
      </button>
      {!collapsed && (
        <div className="ndl-table-container">
          {/* Interactive controls */}
          <div className="ndl-controls">
            <div className="ndl-control-row">
              <label className="ndl-control">
                <span>Algorithm</span>
                <select
                  value={selectedAlgo || ''}
                  onChange={(e) => setSelectedAlgo(e.target.value)}
                  className="ndl-select"
                >
                  {!selectedAlgo && defaultAlgoFn && (
                    <option value="">— {defaultAlgoName || 'Current'} —</option>
                  )}
                  {algoEntries.map(a => (
                    <option key={a.key} value={a.key}>{a.name}</option>
                  ))}
                </select>
              </label>

              <label className="ndl-control">
                <span>O₂ %</span>
                <input
                  type="number"
                  value={fO2}
                  onChange={handleFO2}
                  onBlur={handleFO2}
                  min={1}
                  max={100 - fHe}
                  className="ndl-input"
                />
              </label>

              {activeAlgo?.supportsTrimix && (
                <label className="ndl-control">
                  <span>He %</span>
                  <input
                    type="number"
                    value={fHe}
                    onChange={handleFHe}
                    onBlur={handleFHe}
                    min={0}
                    max={100 - fO2}
                    className="ndl-input"
                  />
                </label>
              )}

              {activeAlgo?.supportsGF && (
                <>
                  <label className="ndl-control">
                    <span>GF Low</span>
                    <input
                      type="number"
                      value={gfLow}
                      onChange={(e) => setGfLow(Math.max(1, Math.min(99, parseInt(e.target.value) || 50)))}
                      min={1}
                      max={99}
                      className="ndl-input"
                    />
                  </label>
                  <label className="ndl-control">
                    <span>GF High</span>
                    <input
                      type="number"
                      value={gfHigh}
                      onChange={(e) => setGfHigh(Math.max(1, Math.min(99, parseInt(e.target.value) || 70)))}
                      min={1}
                      max={99}
                      className="ndl-input"
                    />
                  </label>
                </>
              )}
            </div>

            {/* Gas presets */}
            <div className="ndl-presets">
              <button className={fO2 === 21 && fHe === 0 ? 'preset-active' : ''} onClick={() => { setFO2(21); setFHe(0); }}>Air</button>
              <button className={fO2 === 32 && fHe === 0 ? 'preset-active' : ''} onClick={() => { setFO2(32); setFHe(0); }}>EAN32</button>
              <button className={fO2 === 36 && fHe === 0 ? 'preset-active' : ''} onClick={() => { setFO2(36); setFHe(0); }}>EAN36</button>
              <button className={fO2 === 21 && fHe === 35 ? 'preset-active' : ''} onClick={() => { setFO2(21); setFHe(35); }}>Tx 21/35</button>
              <button className={fO2 === 18 && fHe === 45 ? 'preset-active' : ''} onClick={() => { setFO2(18); setFHe(45); }}>Tx 18/45</button>
            </div>
          </div>

          <p className="ndl-subtitle">
            Gas: {fO2}% O₂ {fHe > 0 ? `/ ${fHe}% He / ${100 - fO2 - fHe}% N₂` : ''} | 
            {activeAlgo?.supportsGF ? ` GF: ${gfLow}/${gfHigh} |` : ''} {activeAlgo?.name || 'Unknown'}
            <button
              className="info-toggle"
              onClick={(e) => { e.stopPropagation(); setShowHelp(!showHelp); }}
              title="What is this?"
            >ℹ️</button>
          </p>

          {showHelp && (
            <div className="info-box">
              <p><strong>NDL (No-Decompression Limit)</strong> is the maximum time you can spend at a given depth without requiring mandatory decompression stops on ascent.</p>
              <p>Change the gas mix, gradient factors, and algorithm to see how they affect NDL. Higher O₂ extends NDL (less N₂ loading). Helium reduces narcosis but may shorten NDL for fast compartments. Conservative GF values (lower numbers) reduce NDL.</p>
              <p><strong>CNS%</strong> shows oxygen toxicity at the NDL — how close you are to the NOAA central nervous system limit. Stay below 80% for single dives.</p>
              <p><strong>MOD</strong> = Maximum Operating Depth exceeded — ppO₂ would be above 1.6 bar at that depth with this gas.</p>
            </div>
          )}

          <table className="ndl-table">
            <thead>
              <tr>
                <th>Depth (m)</th>
                <th>ppO₂ (bar)</th>
                <th>NDL (min)</th>
                <th>CNS% at NDL</th>
              </tr>
            </thead>
            <tbody>
              {ndlData.map(row => (
                <tr key={row.depth} className={row.mod ? 'ndl-mod-row' : ''}>
                  <td>{row.depth}</td>
                  <td style={{ color: row.mod ? '#f44336' : (fO2 / 100) * (1.01325 + row.depth / 10) > 1.4 ? '#ffc107' : 'inherit' }}>
                    {((fO2 / 100) * (1.01325 + row.depth / 10)).toFixed(2)}
                  </td>
                  <td className={row.ndl === 0 ? 'ndl-zero' : ''}>
                    {row.mod ? '⛔ MOD' : row.ndl === 0 ? '< 1' : row.ndl}
                  </td>
                  <td style={{ color: row.cns > 80 ? '#f44336' : row.cns > 50 ? '#ffc107' : 'inherit' }}>
                    {row.mod || row.ndl === 0 ? '—' : `${row.cns.toFixed(1)}%`}
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
