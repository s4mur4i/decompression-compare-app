import { P_SURFACE } from '../utils/constants';

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

export default function SupersatDisplay({ decoInfo, label, color = '#4fc3f7' }) {
  if (!decoInfo || !decoInfo.tissueLoading || !decoInfo.mValues) return null;

  const ambient = P_SURFACE;
  const nc = decoInfo.compartmentCount || decoInfo.tissueLoading.length;
  const saturations = [];

  for (let i = 0; i < nc; i++) {
    const loading = decoInfo.tissueLoading[i] + (decoInfo.heLoading?.[i] || 0);
    const mVal = decoInfo.mValues[i];
    const denom = mVal - ambient;
    const pct = denom > 0 ? ((loading - ambient) / denom) * 100 : 0;
    saturations.push(Math.max(0, pct));
  }

  const maxSat = Math.max(...saturations);
  const maxIdx = saturations.indexOf(maxSat);

  return (
    <div className="supersat-display" style={{ borderColor: `${color}40` }}>
      <h4 style={{ color, margin: '0 0 8px 0', fontSize: '0.85rem' }}>
        {label ? `${label} ` : ''}Supersaturation at Surface
      </h4>
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
