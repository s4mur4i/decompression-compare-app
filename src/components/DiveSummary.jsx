import { getMaxDepth } from '../utils/diveProfile';

export default function DiveSummary({ stops, totalTime, decoInfo, color = '#4fc3f7', compareWith = null, modViolation = false, mod = null, o2Data = null, gasData = null, ndl = null, settings = {} }) {
  if (!stops || stops.length === 0) return null;

  const maxDepth = getMaxDepth(stops);
  const bottomTime = stops.reduce((acc, s) => acc + s.time, 0);
  const tankSize = settings.tankSize || 24;

  return (
    <div className="dive-summary" style={{ borderColor: `${color}40` }}>
      <h3 style={{ color }}>Summary</h3>
      <div className="summary-grid">
        <div className="summary-item">
          <span className="summary-label">Max Depth</span>
          <span className="summary-value" style={{ color }}>{maxDepth} m</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Bottom Time</span>
          <span className="summary-value" style={{ color }}>{bottomTime} min</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Run Time</span>
          <span className="summary-value" style={{ color }}>
            {totalTime} min
            {compareWith && <div className="comparison-delta">{compareWith}</div>}
          </span>
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
        {mod !== null && (
          <div className={`summary-item ${modViolation ? 'mod-violation' : ''}`}>
            <span className="summary-label">MOD</span>
            <span className="summary-value" style={{ color: modViolation ? '#ff4444' : color }}>
              {mod} m
            </span>
          </div>
        )}
        {modViolation && (
          <div className="summary-item mod-violation">
            <span className="summary-label">⚠️ Warning</span>
            <span className="summary-value">ppO₂ exceeded!</span>
          </div>
        )}

        {/* NDL Display */}
        {ndl !== null && (
          <div className={`summary-item ${ndl.inDeco ? 'deco-warning' : 'ndl-ok'}`}>
            <span className="summary-label">NDL</span>
            <span className="summary-value" style={{ color: ndl.inDeco ? '#ff9800' : '#66bb6a' }}>
              {ndl.inDeco ? 'In Deco' : `+${ndl.ndl} min`}
            </span>
          </div>
        )}

        {/* CNS O₂ */}
        {o2Data?.cns && (
          <div className={`summary-item ${o2Data.cns.totalCNS > 100 ? 'mod-violation' : o2Data.cns.totalCNS > 80 ? 'deco-warning' : ''}`}>
            <span className="summary-label">CNS O₂</span>
            <span className="summary-value" style={{
              color: o2Data.cns.totalCNS > 100 ? '#ff4444' : o2Data.cns.totalCNS > 80 ? '#ff9800' : '#66bb6a'
            }}>
              {o2Data.cns.totalCNS.toFixed(1)}%
            </span>
          </div>
        )}

        {/* OTU */}
        {o2Data?.otu && (
          <div className={`summary-item ${o2Data.otu.totalOTU > 300 ? 'deco-warning' : ''}`}>
            <span className="summary-label">OTU</span>
            <span className="summary-value" style={{
              color: o2Data.otu.totalOTU > 300 ? '#ff9800' : color
            }}>
              {o2Data.otu.totalOTU.toFixed(0)}
            </span>
          </div>
        )}

        {/* Gas Consumption */}
        {gasData?.consumption && (
          <div className="summary-item">
            <span className="summary-label">Gas Required</span>
            <span className="summary-value" style={{ color }}>
              {Math.ceil(gasData.consumption.totalLiters)} L
              <div className="comparison-delta">
                {Math.ceil(gasData.consumption.totalLiters / tankSize)} bar in {tankSize}L
              </div>
            </span>
          </div>
        )}

        {/* Rock Bottom */}
        {gasData?.rockBottom && gasData.rockBottom.liters > 0 && (
          <div className={`summary-item ${!gasData.turnPressure?.sufficient ? 'mod-violation' : ''}`}>
            <span className="summary-label">Min Gas</span>
            <span className="summary-value" style={{
              color: !gasData.turnPressure?.sufficient ? '#ff4444' : color
            }}>
              {gasData.rockBottom.bars} bar
              <div className="comparison-delta">
                {Math.ceil(gasData.rockBottom.liters)} L (incl. {gasData.rockBottom.reserveBar} bar reserve)
              </div>
            </span>
          </div>
        )}

        {/* Turn Pressure */}
        {gasData?.turnPressure && (
          <div className="summary-item">
            <span className="summary-label">Turn Pressure</span>
            <span className="summary-value" style={{ color }}>
              {gasData.turnPressure.turnPressure} bar
              <div className="comparison-delta">
                Rule of thirds from {gasData.turnPressure.startPressure} bar
              </div>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
