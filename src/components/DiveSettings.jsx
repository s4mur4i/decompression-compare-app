import { ALGORITHMS } from '../utils/buhlmann';
import { ALGORITHM_TOOLTIPS } from '../utils/algorithmTooltips';
import { TANK_PRESETS } from '../utils/gasPlanning';

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

function TankSizeRow({ tankSize, tankPressure, onSizeChange, onPressureChange }) {
  const isCustom = !TANK_PRESETS.some(p => Math.abs(p.value - tankSize) < 0.05);
  const totalVol = tankSize * tankPressure;
  return (
    <div className="tank-size-row">
      <div className="setting-row">
        <label>Tank</label>
        <select
          className="algo-select"
          value={isCustom ? 'custom' : String(tankSize)}
          onChange={e => { if (e.target.value !== 'custom') onSizeChange(Number(e.target.value)); }}
        >
          {TANK_PRESETS.map(p => (
            <option key={p.label} value={String(p.value)}>{p.label}</option>
          ))}
          <option value="custom">Custom</option>
        </select>
      </div>
      {isCustom && (
        <div className="setting-row">
          <label>Size (L)</label>
          <div className="rate-input">
            <NumInput value={tankSize} min={1} max={50} step={0.1}
              onChange={onSizeChange} onBlur={onSizeChange} />
            <span>L</span>
          </div>
        </div>
      )}
      <div className="setting-row">
        <label>Fill Pressure</label>
        <div className="rate-input">
          <NumInput value={tankPressure} min={50} max={300}
            onChange={onPressureChange} onBlur={onPressureChange} />
          <span>bar</span>
        </div>
      </div>
      <div className="gas-mix-label">Total: {Math.round(totalVol)}L</div>
    </div>
  );
}

export default function DiveSettings({
  settings,
  onChange,
  color = '#4fc3f7',
}) {
  const {
    algorithm, fO2, fHe = 0, gfLow, gfHigh,
    descentRate, ascentRate, decoAscentRate = 9, ppO2Max = 1.4, ppO2Deco = 1.6,
    decoGas1 = null, decoGas2 = null, gasSwitchTime = true,
    lastStopDepth = 6,
  } = settings;

  const set = (key) => (value) => onChange(key, value);
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
        <div className="algo-select-wrapper">
          <select value={algorithm} onChange={(e) => onChange("algorithm", e.target.value)} className="algo-select">
            {Object.entries(ALGORITHMS).map(([key, a]) => (
              <option key={key} value={key}>{a.name}</option>
            ))}
          </select>
          {ALGORITHM_TOOLTIPS[algorithm] && (
            <span className="algo-tooltip-trigger">
              ℹ️
              <div className="algo-tooltip">
                <div className="algo-tooltip-section"><strong>History:</strong> {ALGORITHM_TOOLTIPS[algorithm].history}</div>
                <div className="algo-tooltip-section"><strong>Key traits:</strong> {ALGORITHM_TOOLTIPS[algorithm].characteristics}</div>
                <div className="algo-tooltip-section"><strong>When to use:</strong> {ALGORITHM_TOOLTIPS[algorithm].usage}</div>
                <div className="algo-tooltip-section"><strong>Differs:</strong> {ALGORITHM_TOOLTIPS[algorithm].differences}</div>
              </div>
            </span>
          )}
        </div>
      </div>

      <div className="setting-row">
        <label>Descent Rate</label>
        <div className="rate-input">
          <NumInput value={descentRate} min={1} max={30}
            onChange={set("descentRate")}
            onBlur={set("descentRate")} />
          <span>m/min</span>
        </div>
      </div>

      <div className="setting-row">
        <label>Ascent to First Stop</label>
        <div className="rate-input">
          <NumInput value={ascentRate} min={1} max={30}
            onChange={set("ascentRate")}
            onBlur={set("ascentRate")} />
          <span>m/min</span>
        </div>
      </div>

      <div className="setting-row">
        <label>Ascent during Deco</label>
        <div className="rate-input">
          <NumInput value={decoAscentRate} min={1} max={18}
            onChange={set("decoAscentRate")}
            onBlur={set("decoAscentRate")} />
          <span>m/min</span>
        </div>
      </div>

      <div className="setting-row">
        <label>Last Stop</label>
        <div className="gas-presets">
          <button type="button" className={`gas-preset-btn${lastStopDepth === 3 ? ' active' : ''}`}
            onClick={() => onChange('lastStopDepth', 3)}>3m</button>
          <button type="button" className={`gas-preset-btn${lastStopDepth === 6 ? ' active' : ''}`}
            onClick={() => onChange('lastStopDepth', 6)}>6m</button>
        </div>
      </div>

      {algorithm !== 'none' && (
        <>
          <div className="settings-divider" />

          <div className="gas-presets">
            <button type="button" className={`gas-preset-btn${o2Pct === 21 && hePct === 0 ? ' active' : ''}`}
              onClick={() => { onChange('fO2', 0.21); onChange('fHe', 0); }}>Air (21%)</button>
            <button type="button" className={`gas-preset-btn${o2Pct === 32 && hePct === 0 ? ' active' : ''}`}
              onClick={() => { onChange('fO2', 0.32); onChange('fHe', 0); }}>EAN32</button>
            <button type="button" className={`gas-preset-btn${o2Pct === 36 && hePct === 0 ? ' active' : ''}`}
              onClick={() => { onChange('fO2', 0.36); onChange('fHe', 0); }}>EAN36</button>
            {supportsTrimix && (
              <button type="button" className={`gas-preset-btn${o2Pct === 21 && hePct === 35 ? ' active' : ''}`}
                onClick={() => { onChange('fO2', 0.21); onChange('fHe', 0.35); }}>Tx 21/35</button>
            )}
          </div>

          <div className="setting-row">
            <label>O₂ %</label>
            <div className="rate-input">
              <NumInput value={o2Pct} min={8} max={100}
                onChange={(v) => {
                  const n = typeof v === 'number' ? v : 0;
                  onChange('fO2', n / 100);
                  if ((n + hePct) > 100) onChange('fHe', (100 - n) / 100);
                }}
                onBlur={(v) => {
                  onChange('fO2', v / 100);
                  if ((v + hePct) > 100) onChange('fHe', (100 - v) / 100);
                }} />
              <span>%</span>
            </div>
          </div>

          {supportsTrimix && (
            <div className="setting-row">
              <label>He %</label>
              <div className="rate-input">
                <NumInput value={hePct} min={0} max={100 - o2Pct}
                  onChange={(v) => onChange('fHe', (typeof v === 'number' ? v : 0) / 100)}
                  onBlur={(v) => onChange('fHe', v / 100)} />
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
              <NumInput value={ppO2Max} min={1.0} max={1.4} step={0.1}
                onChange={(v) => onChange('ppO2Max', typeof v === 'number' ? v : 1.6)}
                onBlur={set('ppO2Max')} />
              <span>bar</span>
            </div>
          </div>

          {supportsMultiGas && (
            <div className="setting-row">
              <label>Deco ppO₂</label>
              <div className="rate-input">
                <NumInput value={ppO2Deco} min={1.0} max={1.6} step={0.1}
                  onChange={(v) => onChange('ppO2Deco', typeof v === 'number' ? v : 1.4)}
                  onBlur={set('ppO2Deco')} />
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
                    onChange={set("gfLow")}
                    onBlur={set("gfLow")} />
                  <span>%</span>
                </div>
              </div>

              <div className="setting-row">
                <label>GF High</label>
                <div className="rate-input">
                  <NumInput value={gfHigh} min={10} max={100}
                    onChange={set("gfHigh")}
                    onBlur={set("gfHigh")} />
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
                    onChange={(e) => onChange("decoGas1", e.target.checked ? { fO2: 0.50 } : null)} />
                  Stage 1
                </label>
                {decoGas1 && (
                  <>
                    <div className="rate-input">
                      <NumInput value={Math.round(decoGas1.fO2 * 100)} min={21} max={100}
                        onChange={(v) => onChange("decoGas1", { fO2: (typeof v === "number" ? v : 50) / 100 })}
                        onBlur={(v) => onChange("decoGas1", { fO2: v / 100 })} />
                      <span>% O₂</span>
                      <span className="deco-gas-mod">MOD {decoGas1MOD}m</span>
                    </div>
                    <div className="gas-presets">
                      {[50, 80, 100].map(pct => (
                        <button key={pct} type="button"
                          className={`gas-preset-btn${Math.round(decoGas1.fO2 * 100) === pct ? ' active' : ''}`}
                          onClick={() => onChange("decoGas1", { fO2: pct / 100 })}>
                          {pct === 100 ? 'O₂' : `EAN${pct}`}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="deco-gas-row">
                <label className="deco-gas-toggle">
                  <input type="checkbox"
                    checked={decoGas2 !== null}
                    onChange={(e) => onChange("decoGas2", e.target.checked ? { fO2: 1.0 } : null)} />
                  Stage 2
                </label>
                {decoGas2 && (
                  <>
                    <div className="rate-input">
                      <NumInput value={Math.round(decoGas2.fO2 * 100)} min={21} max={100}
                        onChange={(v) => onChange("decoGas2", { fO2: (typeof v === "number" ? v : 100) / 100 })}
                        onBlur={(v) => onChange("decoGas2", { fO2: v / 100 })} />
                      <span>% O₂</span>
                      <span className="deco-gas-mod">MOD {decoGas2MOD}m</span>
                    </div>
                    <div className="gas-presets">
                      {[50, 80, 100].map(pct => (
                        <button key={pct} type="button"
                          className={`gas-preset-btn${Math.round(decoGas2.fO2 * 100) === pct ? ' active' : ''}`}
                          onClick={() => onChange("decoGas2", { fO2: pct / 100 })}>
                          {pct === 100 ? 'O₂' : `EAN${pct}`}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              {(decoGas1 || decoGas2) && (
                <div className="deco-gas-row" style={{ marginTop: '8px' }}>
                  <label className="deco-gas-toggle">
                    <input type="checkbox"
                      checked={gasSwitchTime}
                      onChange={(e) => onChange("gasSwitchTime", e.target.checked)} />
                    +1 min gas switch
                  </label>
                </div>
              )}
            </>
          )}

          <div className="algo-description">
            {algo.description}
          </div>

          <div className="settings-divider" />
          <details className="settings-collapsible">
            <summary className="settings-collapsible-header">⛽ Gas Planning</summary>
            <div className="settings-collapsible-body">

              <div className="setting-row">
                <label>SAC Rate</label>
                <div className="rate-input">
                  <NumInput value={settings.sacRate || 20} min={5} max={40}
                    onChange={set("sacRate")}
                    onBlur={set("sacRate")} />
                  <span>L/min</span>
                </div>
              </div>

              <h4 className="settings-subtitle" style={{ marginTop: 12 }}>Bottom Gas Tank</h4>
              <TankSizeRow
                tankSize={settings.tankSize || 24}
                tankPressure={settings.tankPressure || 200}
                onSizeChange={(v) => onChange('tankSize', v)}
                onPressureChange={(v) => onChange('tankPressure', v)}
              />

              {decoGas1 && (
                <>
                  <h4 className="settings-subtitle" style={{ marginTop: 12 }}>Stage 1 Tank</h4>
                  <TankSizeRow
                    tankSize={settings.stage1TankSize || 7}
                    tankPressure={settings.stage1TankPressure || 200}
                    onSizeChange={(v) => onChange('stage1TankSize', v)}
                    onPressureChange={(v) => onChange('stage1TankPressure', v)}
                  />
                </>
              )}

              {decoGas2 && (
                <>
                  <h4 className="settings-subtitle" style={{ marginTop: 12 }}>Stage 2 Tank</h4>
                  <TankSizeRow
                    tankSize={settings.stage2TankSize || 7}
                    tankPressure={settings.stage2TankPressure || 200}
                    onSizeChange={(v) => onChange('stage2TankSize', v)}
                    onPressureChange={(v) => onChange('stage2TankPressure', v)}
                  />
                </>
              )}

            </div>
          </details>
        </>
      )}
    </div>
  );
}
