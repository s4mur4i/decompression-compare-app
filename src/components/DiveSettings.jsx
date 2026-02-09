import { ALGORITHMS } from '../utils/buhlmann';

export default function DiveSettings({
  algorithm, onAlgorithmChange,
  fO2, onFO2Change,
  fHe = 0, onFHeChange,
  gfLow, onGfLowChange,
  gfHigh, onGfHighChange,
  descentRate, onDescentRateChange,
  ascentRate, onAscentRateChange,
  ppO2Max = 1.6, onPpO2MaxChange,
  ppO2Deco = 1.4, onPpO2DecoChange,
  decoGas1 = null, onDecoGas1Change,
  decoGas2 = null, onDecoGas2Change,
  color = '#4fc3f7',
}) {
  const mod = fO2 > 0 ? Math.floor(10 * (ppO2Max / fO2 - 1)) : 0;
  
  // Deco gas MODs
  const decoGas1MOD = decoGas1?.fO2 > 0 ? Math.floor(10 * (ppO2Deco / decoGas1.fO2 - 1)) : null;
  const decoGas2MOD = decoGas2?.fO2 > 0 ? Math.floor(10 * (ppO2Deco / decoGas2.fO2 - 1)) : null;

  return (
    <div className="dive-settings" style={{ borderColor: `${color}40` }}>
      <h3 style={{ color }}>Settings</h3>
      
      <div className="setting-row">
        <label>Algorithm</label>
        <select
          value={algorithm}
          onChange={(e) => onAlgorithmChange(e.target.value)}
          className="algo-select"
        >
          {Object.entries(ALGORITHMS).map(([key, algo]) => (
            <option key={key} value={key}>{algo.name}</option>
          ))}
        </select>
      </div>

      <div className="setting-row">
        <label>Descent Rate</label>
        <div className="rate-input">
          <input type="number" min="1" max="30" value={descentRate}
            onChange={(e) => onDescentRateChange(Math.max(1, Number(e.target.value) || 18))} />
          <span>m/min</span>
        </div>
      </div>

      <div className="setting-row">
        <label>Ascent Rate</label>
        <div className="rate-input">
          <input type="number" min="1" max="30" value={ascentRate}
            onChange={(e) => onAscentRateChange(Math.max(1, Number(e.target.value) || 9))} />
          <span>m/min</span>
        </div>
      </div>

      {algorithm !== 'none' && (
        <>
          <div className="settings-divider" />

          <div className="setting-row">
            <label>O₂ %</label>
            <div className="rate-input">
              <input type="number" min="8" max="100"
                value={Math.round(fO2 * 100)}
                onChange={(e) => {
                  const newO2 = Math.min(100, Math.max(8, Number(e.target.value) || 21));
                  onFO2Change(newO2 / 100);
                  // Clamp He so O2+He <= 100
                  if (onFHeChange && (newO2 + Math.round(fHe * 100)) > 100) {
                    onFHeChange((100 - newO2) / 100);
                  }
                }} />
              <span>%</span>
            </div>
          </div>

          {onFHeChange && (
            <div className="setting-row">
              <label>He %</label>
              <div className="rate-input">
                <input type="number" min="0" max={100 - Math.round(fO2 * 100)}
                  value={Math.round(fHe * 100)}
                  onChange={(e) => {
                    const maxHe = 100 - Math.round(fO2 * 100);
                    onFHeChange(Math.min(maxHe, Math.max(0, Number(e.target.value) || 0)) / 100);
                  }} />
                <span>%</span>
              </div>
            </div>
          )}

          <div className="gas-mix-label">
            {fHe > 0
              ? `Trimix ${Math.round(fO2*100)}/${Math.round(fHe*100)} (N₂ ${Math.round((1-fO2-fHe)*100)}%)`
              : `Nitrox ${Math.round(fO2*100)} (N₂ ${Math.round((1-fO2)*100)}%)`}
            {' · '}MOD {mod}m
          </div>

          <div className="settings-divider" />

          <div className="setting-row">
            <label>Bottom ppO₂</label>
            <div className="rate-input">
              <input type="number" min="1.0" max="2.0" step="0.1"
                value={ppO2Max}
                onChange={(e) => onPpO2MaxChange(Math.min(2.0, Math.max(1.0, Number(e.target.value) || 1.6)))} />
              <span>bar</span>
            </div>
          </div>

          <div className="setting-row">
            <label>Deco ppO₂</label>
            <div className="rate-input">
              <input type="number" min="1.0" max="1.8" step="0.1"
                value={ppO2Deco}
                onChange={(e) => onPpO2DecoChange(Math.min(1.8, Math.max(1.0, Number(e.target.value) || 1.4)))} />
              <span>bar</span>
            </div>
          </div>

          <div className="setting-row">
            <label>GF Low</label>
            <div className="rate-input">
              <input type="number" min="10" max="100" value={gfLow}
                onChange={(e) => onGfLowChange(Math.min(100, Math.max(10, Number(e.target.value) || 50)))} />
              <span>%</span>
            </div>
          </div>

          <div className="setting-row">
            <label>GF High</label>
            <div className="rate-input">
              <input type="number" min="10" max="100" value={gfHigh}
                onChange={(e) => onGfHighChange(Math.min(100, Math.max(10, Number(e.target.value) || 70)))} />
              <span>%</span>
            </div>
          </div>

          <div className="settings-divider" />
          <h4 className="settings-subtitle">Deco Gases</h4>

          <div className="deco-gas-row">
            <label className="deco-gas-toggle">
              <input type="checkbox"
                checked={decoGas1 !== null}
                onChange={(e) => onDecoGas1Change(e.target.checked ? { fO2: 0.50 } : null)} />
              Stage 1
            </label>
            {decoGas1 && (
              <div className="rate-input">
                <input type="number" min="21" max="100"
                  value={Math.round(decoGas1.fO2 * 100)}
                  onChange={(e) => onDecoGas1Change({ fO2: Math.min(1, Math.max(0.21, (Number(e.target.value) || 50) / 100)) })} />
                <span>% O₂</span>
                <span className="deco-gas-mod">MOD {decoGas1MOD}m</span>
              </div>
            )}
          </div>

          <div className="deco-gas-row">
            <label className="deco-gas-toggle">
              <input type="checkbox"
                checked={decoGas2 !== null}
                onChange={(e) => onDecoGas2Change(e.target.checked ? { fO2: 1.0 } : null)} />
              Stage 2
            </label>
            {decoGas2 && (
              <div className="rate-input">
                <input type="number" min="21" max="100"
                  value={Math.round(decoGas2.fO2 * 100)}
                  onChange={(e) => onDecoGas2Change({ fO2: Math.min(1, Math.max(0.21, (Number(e.target.value) || 100) / 100)) })} />
                <span>% O₂</span>
                <span className="deco-gas-mod">MOD {decoGas2MOD}m</span>
              </div>
            )}
          </div>

          <div className="algo-description">
            {ALGORITHMS[algorithm]?.description}
          </div>
        </>
      )}
    </div>
  );
}
