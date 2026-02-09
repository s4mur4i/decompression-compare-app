import { getTotalTime, getMaxDepth } from '../utils/diveProfile';

export default function DiveSummary({ stops, profile, descentRate }) {
  if (!profile || profile.length < 2) return null;

  const totalTime = getTotalTime(profile);
  const maxDepth = getMaxDepth(stops);
  const ascentTime = Math.ceil(stops[stops.length - 1]?.depth / descentRate) || 0;
  const descentTotal = stops.reduce((acc, stop, i) => {
    const prevDepth = i === 0 ? 0 : stops[i - 1].depth;
    return acc + Math.ceil(Math.abs(stop.depth - prevDepth) / descentRate);
  }, 0);
  const bottomTime = stops.reduce((acc, s) => acc + s.time, 0);

  return (
    <div className="dive-summary">
      <h3>Summary</h3>
      <div className="summary-grid">
        <div className="summary-item">
          <span className="summary-label">Max Depth</span>
          <span className="summary-value">{maxDepth} m</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Bottom Time</span>
          <span className="summary-value">{bottomTime} min</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Transit Time</span>
          <span className="summary-value">{descentTotal + ascentTime} min</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Total Dive Time</span>
          <span className="summary-value">{totalTime} min</span>
        </div>
      </div>
    </div>
  );
}
