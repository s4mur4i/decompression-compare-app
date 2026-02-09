import { ALGORITHMS } from '../utils/buhlmann';

function NumInput({ value, onChange, onBlur, min, max, step, ...props }) {
  return (
    <input
      type="number" min={min} max={max} step={step} value={value}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === '' || raw === '-') { onChange(raw); return; }
        const num = Number(raw);
        if (!isNaN(num)) onChange(num);
      }}
      onBlur={() => {
        const num = Number(value);
        if (isNaN(num) || value === '') {
          onBlur(min ?? 0);
        } else {
          onBlur(Math.min(max ?? Infinity, Math.max(min ?? 0, num)));
        }
      }}
      {...props}
    />
  );
}

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
  const algo = ALGORITHMS[algorithm] || {};
  const supportsTrimix = algo.trimix;
  const supportsMultiGas = algo.multiGas;
  const supportsGF = algo.gf;

  const o2Pct = Math.round(fO2 * 100);
  const hePct = Math.round(fHe * 100);
  const mod = fO2 > 0 ? Math.floor(10 * (ppO2Max / fO2 - 1)) : 0;
  const decoGas1MOD = decoGas1?.fO2 > 0 ? Math.floor(10 * (ppO2Deco / decoGas1.fO2 - 1)) : null;
  const decoGas2MOD = decoGas2?.fO2 > 0 ? Math.floor(10 * (ppO2Deco / decoGas2.fO2 - 1)) : null;

  return (
    <div className="dive-settings" style={{ borderColor: `${color}40` }}>
      <h3 style={{ color }}>Settings</h3>
      
      <div className="setting-row">
        <label>Algorithm</label>
        <select value={algorithm} onChange={(e) => onAlgorithmChange(e.target.value)} className="algo-select">
          {Object.entries(ALGORITHMS).map(([key, a]) => (
            <option key={key} value={key}>{a.name}</option>
          ))}
        </select>
      </div>

      <div className="setting-row">
        <label>Descent Rate</label>
        <div className="rate-input">
          <NumInput value={descentRate} min={1} max={30}
            onChange={(v) => onDescentRateChange(v)}
            onBlur={(v) => onDescentRateChange(v)} />
          <span>m/min</span>
        </div>
      </div>

      <div className="setting-row">
        <label>Ascent Rate</label>
        <div className="rate-input">
          <NumInput value={ascentRate} min={1} max={30}
            onChange={(v) => onAscentRateChange(v)}
            onBlur={(v) => onAscentRateChange(v)} />
          <span>m/min</span>
        </div>
      </div>

      {algorithm !== 'none' && (
        <>
          <div className="settings-divider" />

          <div className="setting-row">
            <label>O₂ %</label>
            <div className="rate-input">
              <NumInput value={o2Pct} min={8} max={100}
                onChange={(v) => {
                  const n = typeof v === 'number' ? v : 0;
                  onFO2Change(n / 100);
                  if (onFHeChange && (n + hePct) > 100) onFHeChange((100 - n) / 100);
                }}
                onBlur={(v) => {
                  onFO2Change(v / 100);
                  if (onFHeChange && (v + hePct) > 100) onFHeChange((100 - v) / 100);
                }} />
              <span>%</span>
            </div>
          </div>

          {supportsTrimix && onFHeChange && (
            <div className="setting-row">
              <label>He %</label>
              <div className="rate-input">
                <NumInput value={hePct} min={0} max={100 - o2Pct}
                  onChange={(v) => onFHeChange((typeof v === 'number' ? v : 0) / 100)}
                  onBlur={(v) => onFHeChange(v / 100)} />
                <span>%</span>
              </div>
            </div>
          )}

          <div className="gas-mix-label">
            {supportsTrimix && fHe > 0
              ? `Trimix ${o2Pct}/${hePct} (N₂ ${100 - o2Pct - hePct}%)`
              : `Nitrox ${o2Pct} (N₂ ${100 - o2Pct}%)`}
            {' · '}MOD {mod}m
          </div>

          <div className="settings-divider" />

          <div className="setting-row">
            <label>Bottom ppO₂</label>
            <div className="rate-input">
              <NumInput value={ppO2Max} min={1.0} max={2.0} step={0.1}
                onChange={(v) => onPpO2MaxChange(typeof v === 'number' ? v : 1.6)}
                onBlur={(v) => onPpO2MaxChange(v)} />
              <span>bar</span>
            </div>
          </div>

          {supportsMultiGas && (
            <div className="setting-row">
              <label>Deco ppO₂</label>
              <div className="rate-input">
                <NumInput value={ppO2Deco} min={1.0} max={1.8} step={0.1}
                  onChange={(v) => onPpO2DecoChange(typeof v === 'number' ? v : 1.4)}
                  onBlur={(v) => onPpO2DecoChange(v)} />
                <span>bar</span>
              </div>
            </div>
          )}

          {supportsGF && (
            <>
              <div className="setting-row">
                <label>GF Low</label>
                <div className="rate-input">
                  <NumInput value={gfLow} min={10} max={100}
                    onChange={(v) => onGfLowChange(v)}
                    onBlur={(v) => onGfLowChange(v)} />
                  <span>%</span>
                </div>
              </div>

              <div className="setting-row">
                <label>GF High</label>
                <div className="rate-input">
                  <NumInput value={gfHigh} min={10} max={100}
                    onChange={(v) => onGfHighChange(v)}
                    onBlur={(v) => onGfHighChange(v)} />
                  <span>%</span>
                </div>
              </div>
            </>
          )}

          {supportsMultiGas && (
            <>
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
                    <NumInput value={Math.round(decoGas1.fO2 * 100)} min={21} max={100}
                      onChange={(v) => onDecoGas1Change({ fO2: (typeof v === 'number' ? v : 50) / 100 })}
                      onBlur={(v) => onDecoGas1Change({ fO2: v / 100 })} />
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
                    <NumInput value={Math.round(decoGas2.fO2 * 100)} min={21} max={100}
                      onChange={(v) => onDecoGas2Change({ fO2: (typeof v === 'number' ? v : 100) / 100 })}
                      onBlur={(v) => onDecoGas2Change({ fO2: v / 100 })} />
                    <span>% O₂</span>
                    <span className="deco-gas-mod">MOD {decoGas2MOD}m</span>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="algo-description">
            {algo.description}
          </div>
        </>
      )}
    </div>
  );
}
