import { ALGORITHMS } from '../utils/buhlmann';

export default function DiveSettings({
  descentRate, onDescentRateChange,
  ascentRate, onAscentRateChange,
  algorithm, onAlgorithmChange,
  fO2, onFO2Change,
  gfLow, onGfLowChange,
  gfHigh, onGfHighChange,
}) {
  return (
    <div className="dive-settings">
      <h3>Settings</h3>
      <div className="setting-row">
        <label>Descent Rate</label>
        <div className="rate-input">
          <input
            type="number"
            min="1"
            max="30"
            value={descentRate}
            onChange={(e) => onDescentRateChange(Math.max(1, Number(e.target.value) || 18))}
          />
          <span>m/min</span>
        </div>
      </div>

      <div className="setting-row">
        <label>Ascent Rate</label>
        <div className="rate-input">
          <input
            type="number"
            min="1"
            max="30"
            value={ascentRate}
            onChange={(e) => onAscentRateChange(Math.max(1, Number(e.target.value) || 9))}
          />
          <span>m/min</span>
        </div>
      </div>

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

      {algorithm !== 'none' && (
        <>
          <div className="setting-row">
            <label>Gas Mix (O₂ %)</label>
            <div className="rate-input">
              <input
                type="number"
                min="16"
                max="100"
                value={Math.round(fO2 * 100)}
                onChange={(e) => onFO2Change(Math.min(1, Math.max(0.16, (Number(e.target.value) || 21) / 100)))}
              />
              <span>%</span>
            </div>
          </div>

          <div className="setting-row">
            <label>GF Low</label>
            <div className="rate-input">
              <input
                type="number"
                min="10"
                max="100"
                value={gfLow}
                onChange={(e) => onGfLowChange(Math.min(100, Math.max(10, Number(e.target.value) || 50)))}
              />
              <span>%</span>
            </div>
          </div>

          <div className="setting-row">
            <label>GF High</label>
            <div className="rate-input">
              <input
                type="number"
                min="10"
                max="100"
                value={gfHigh}
                onChange={(e) => onGfHighChange(Math.min(100, Math.max(10, Number(e.target.value) || 70)))}
              />
              <span>%</span>
            </div>
          </div>

          <div className="algo-description">
            {ALGORITHMS[algorithm]?.description}
          </div>
        </>
      )}
    </div>
  );
}
