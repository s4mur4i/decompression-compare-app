import { TANK_PRESETS } from '../utils/gasPlanning';

function TankConfig({ label, tankSize, tankPressure, onSizeChange, onPressureChange }) {
  const isCustom = !TANK_PRESETS.some(p => Math.abs(p.value - tankSize) < 0.01);
  const totalVolume = tankSize * tankPressure;

  return (
    <div className="tank-config-row">
      <span className="tank-label">{label}</span>
      <select
        className="tank-preset-select"
        value={isCustom ? 'custom' : tankSize}
        onChange={e => {
          const v = e.target.value;
          if (v !== 'custom') onSizeChange(Number(v));
        }}
      >
        {TANK_PRESETS.map(p => (
          <option key={p.label} value={p.value}>{p.label}</option>
        ))}
        <option value="custom">Custom</option>
      </select>
      {isCustom && (
        <input
          type="number" className="tank-custom-input" min={1} max={50} step={0.1}
          value={tankSize} onChange={e => onSizeChange(Number(e.target.value) || 1)}
        />
      )}
      <span className="tank-at">@</span>
      <input
        type="number" className="tank-pressure-input" min={50} max={300}
        value={tankPressure} onChange={e => onPressureChange(Number(e.target.value) || 200)}
      />
      <span className="tank-unit">bar</span>
      <span className="tank-total">= {Math.round(totalVolume)}L</span>
    </div>
  );
}

function SufficiencyLine({ label, gasName, breakdown }) {
  if (!breakdown) return null;
  const { tankSize, tankPressure, totalVolume, used, remaining, remainingPct, status } = breakdown;
  const icon = status === 'ok' ? '✅' : status === 'warning' ? '⚠️' : '❌';
  const colorClass = `sufficiency-${status}`;

  return (
    <div className={`gas-plan-line ${colorClass}`}>
      <span className="gas-plan-name">{label}{gasName ? ` ${gasName}` : ''}</span>
      <span className="gas-plan-tank">({tankSize}L @ {tankPressure}bar = {Math.round(totalVolume)}L)</span>
      <span className="gas-plan-usage">
        Used {Math.ceil(used).toLocaleString()}L | Remaining {Math.ceil(Math.max(0, remaining)).toLocaleString()}L ({Math.max(0, remainingPct).toFixed(0)}%) {icon}
      </span>
    </div>
  );
}

export default function GasPlan({ settings, gasData, color = '#4fc3f7' }) {
  if (!gasData?.consumption) return null;

  const { consumption, rockBottom, turnPressure } = gasData;
  const tankSize = settings.tankSize || 24;

  return (
    <div className="gas-plan" style={{ borderColor: `${color}40` }}>
      <h3 style={{ color }}>Gas Plan</h3>

      {/* Sufficiency summary */}
      {consumption.gasBreakdown && (
        <div className="gas-plan-summary">
          {consumption.gasBreakdown.bottom && (
            <SufficiencyLine label="Bottom" breakdown={consumption.gasBreakdown.bottom} />
          )}
          {consumption.gasBreakdown.stage1 && (
            <SufficiencyLine
              label="Stage 1"
              gasName={settings.decoGas1 ? `EAN${Math.round(settings.decoGas1.fO2 * 100)}` : ''}
              breakdown={consumption.gasBreakdown.stage1}
            />
          )}
          {consumption.gasBreakdown.stage2 && (
            <SufficiencyLine
              label="Stage 2"
              gasName={settings.decoGas2 ? (settings.decoGas2.fO2 >= 0.99 ? 'O₂' : `EAN${Math.round(settings.decoGas2.fO2 * 100)}`) : ''}
              breakdown={consumption.gasBreakdown.stage2}
            />
          )}
        </div>
      )}

      {/* Fallback: simple total when no per-gas breakdown */}
      {!consumption.gasBreakdown && (
        <div className="gas-plan-simple">
          <div className="gas-plan-stat">
            <span className="gas-plan-stat-label">Total Gas</span>
            <span className="gas-plan-stat-value">{Math.ceil(consumption.totalLiters)}L ({Math.ceil(consumption.totalLiters / tankSize)} bar in {tankSize}L)</span>
          </div>
        </div>
      )}

      {/* Rock Bottom & Turn Pressure */}
      <div className="gas-plan-metrics">
        {rockBottom && rockBottom.liters > 0 && (
          <div className={`gas-plan-metric ${!turnPressure?.sufficient ? 'metric-critical' : ''}`}>
            <span className="gas-plan-metric-label">Min Gas (Rock Bottom)</span>
            <span className="gas-plan-metric-value">
              {rockBottom.bars} bar ({Math.ceil(rockBottom.liters)}L)
              <span className="gas-plan-metric-detail">incl. {rockBottom.reserveBar} bar reserve</span>
            </span>
          </div>
        )}
        {turnPressure && (
          <div className="gas-plan-metric">
            <span className="gas-plan-metric-label">Turn Pressure</span>
            <span className="gas-plan-metric-value">
              {turnPressure.turnPressure} bar
              <span className="gas-plan-metric-detail">Rule of thirds from {turnPressure.startPressure} bar</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
