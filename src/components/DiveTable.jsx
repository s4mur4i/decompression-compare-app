import { useMemo } from 'react';
import { calculateCNS, calculateOTU } from '../utils/oxygenToxicity';
import { calculateGasConsumption } from '../utils/gasPlanning';

export default function DiveTable({ phases, color = '#4fc3f7', settings = {} }) {
  if (!phases || phases.length === 0) return null;

  const { fO2 = 0.21, fHe = 0, sacRate = 20 } = settings;

  const { cnsData, otuData, gasData } = useMemo(() => {
    const cns = calculateCNS(phases, fO2, fHe);
    const otu = calculateOTU(phases, fO2, fHe);
    const gas = calculateGasConsumption(phases, sacRate, fO2, fHe);
    return { cnsData: cns, otuData: otu, gasData: gas };
  }, [phases, fO2, fHe, sacRate]);

  const rows = [];
  let runTime = 0;

  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    runTime = phase.runTime + phase.duration;

    let depthDisplay;
    if (phase.action === 'Descend' || phase.action === 'Ascend') {
      const prevDepth = i === 0 ? 0 : phases[i - 1].depth;
      depthDisplay = `${prevDepth}-${phase.depth}m`;
    } else {
      depthDisplay = `${phase.depth}m`;
    }

    rows.push({
      depth: depthDisplay,
      duration: phase.duration,
      runTime,
      action: phase.action,
      gas: phase.gas,
      cns: cnsData?.perPhase[i]?.runningCNS || 0,
      otu: otuData?.perPhase[i]?.runningOTU || 0,
      gasLiters: gasData?.perPhase[i]?.runningLiters || 0,
    });
  }

  return (
    <div className="dive-table" style={{ borderColor: `${color}40` }}>
      <h3 style={{ color }}>Dive Plan</h3>
      <div className="dive-table-scroll">
        <table>
          <thead>
            <tr>
              <th>Depth</th>
              <th>Stop</th>
              <th>Run Time</th>
              <th>Action</th>
              <th>CNS%</th>
              <th>Gas (L)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={row.action === 'Gas Switch' ? 'gas-switch-row' : row.action === 'Safety Stop' ? 'safety-stop-row' : ''}>
                <td>{row.depth}</td>
                <td>{row.duration > 0 ? `${row.duration} min` : '—'}</td>
                <td>{row.runTime} min</td>
                <td>
                  <span className={`action-badge ${row.action.toLowerCase().replace(/\s+/g, '-')}`}>
                    {row.action}
                  </span>
                  {row.gas && <span className="gas-label">{row.gas}</span>}
                </td>
                <td style={{ color: row.cns > 100 ? '#ff4444' : row.cns > 80 ? '#ff9800' : 'inherit' }}>
                  {row.cns.toFixed(1)}%
                </td>
                <td>{Math.ceil(row.gasLiters)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
