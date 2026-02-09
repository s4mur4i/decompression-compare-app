export default function DiveSettings({ descentRate, onDescentRateChange }) {
  return (
    <div className="dive-settings">
      <h3>Settings</h3>
      <div className="setting-row">
        <label>Descent / Ascent Rate</label>
        <div className="rate-input">
          <input
            type="number"
            min="1"
            max="30"
            value={descentRate}
            onChange={(e) => onDescentRateChange(Math.max(1, Number(e.target.value) || 9))}
          />
          <span>m/min</span>
        </div>
      </div>
    </div>
  );
}
