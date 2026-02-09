import { getMaxDepth } from '../utils/diveProfile';

export default function DiveSummary({ stops, totalTime, decoInfo }) {
  if (!stops || stops.length === 0) return null;

  const maxDepth = getMaxDepth(stops);
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
          <span className="summary-label">Run Time</span>
          <span className="summary-value">{totalTime} min</span>
        </div>
        {decoInfo && !decoInfo.noDecoLimit && (
          <div className="summary-item deco-warning">
            <span className="summary-label">Deco Stops</span>
            <span className="summary-value">{decoInfo.decoStops.length}</span>
          </div>
        )}
        {decoInfo && decoInfo.noDecoLimit && (
          <div className="summary-item no-deco">
            <span className="summary-label">Status</span>
            <span className="summary-value">No Deco</span>
          </div>
        )}
      </div>
    </div>
  );
}
