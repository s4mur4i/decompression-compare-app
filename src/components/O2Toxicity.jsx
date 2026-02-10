export default function O2Toxicity({ o2Data, color = '#4fc3f7' }) {
  if (!o2Data) return null;
  const { cns, otu } = o2Data;

  const cnsColor = cns?.totalCNS > 100 ? '#ff4444' : cns?.totalCNS > 80 ? '#ff9800' : '#66bb6a';
  const otuColor = otu?.totalOTU > 300 ? '#ff9800' : '#66bb6a';

  return (
    <div className="o2-toxicity" style={{ borderColor: `${color}40` }}>
      <h3 style={{ color }}>O₂ Toxicity</h3>

      {cns && (
        <div className="o2-section">
          <div className="o2-header">
            <span className="o2-label">CNS Clock</span>
            <span className="o2-value" style={{ color: cnsColor }}>
              {cns.totalCNS.toFixed(1)}%
            </span>
          </div>
          <div className="o2-bar-bg">
            <div
              className="o2-bar-fill"
              style={{
                width: `${Math.min(100, cns.totalCNS)}%`,
                background: cnsColor,
              }}
            />
            {/* Threshold markers */}
            <div className="o2-threshold" style={{ left: '80%' }} title="80% warning" />
            <div className="o2-threshold o2-threshold-danger" style={{ left: '100%' }} title="100% limit" />
          </div>
          <div className="o2-limits">
            <span>0%</span>
            <span style={{ color: '#ff9800' }}>80%</span>
            <span style={{ color: '#ff4444' }}>100%</span>
          </div>
          {cns.totalCNS > 100 && (
            <div className="o2-warning o2-danger">⚠️ CNS limit exceeded! Risk of oxygen toxicity seizure.</div>
          )}
          {cns.totalCNS > 80 && cns.totalCNS <= 100 && (
            <div className="o2-warning">⚠️ Approaching CNS limit. Consider reducing O₂ exposure.</div>
          )}

          {/* Per-phase breakdown */}
          {cns.perPhase && cns.perPhase.length > 0 && (
            <details className="o2-details">
              <summary>Phase breakdown</summary>
              <div className="o2-phase-list">
                {cns.perPhase.map((p, i) => (
                  <div key={i} className="o2-phase-item">
                    <span>Phase {i + 1}</span>
                    <span>+{p.cns.toFixed(1)}%</span>
                    <span style={{ color: p.runningCNS > 80 ? '#ff9800' : 'inherit' }}>
                      = {p.runningCNS.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {otu && (
        <div className="o2-section">
          <div className="o2-header">
            <span className="o2-label">OTU (Oxygen Tolerance Units)</span>
            <span className="o2-value" style={{ color: otuColor }}>
              {otu.totalOTU.toFixed(0)} OTU
            </span>
          </div>
          <div className="o2-bar-bg">
            <div
              className="o2-bar-fill"
              style={{
                width: `${Math.min(100, (otu.totalOTU / 850) * 100)}%`,
                background: otuColor,
              }}
            />
            <div className="o2-threshold" style={{ left: `${(300 / 850) * 100}%` }} title="300 OTU daily limit" />
          </div>
          <div className="o2-limits">
            <span>0</span>
            <span style={{ color: '#ff9800' }}>300 (daily)</span>
            <span>850 (single)</span>
          </div>
          {otu.totalOTU > 300 && (
            <div className="o2-warning">⚠️ Exceeds recommended daily OTU limit of 300.</div>
          )}
        </div>
      )}
    </div>
  );
}
