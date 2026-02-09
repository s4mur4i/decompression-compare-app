export default function DiveTable({ phases, color = '#4fc3f7' }) {
  if (!phases || phases.length === 0) return null;

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
    });
  }

  return (
    <div className="dive-table" style={{ borderColor: `${color}40` }}>
      <h3 style={{ color }}>Dive Plan</h3>
      <table>
        <thead>
          <tr>
            <th>Depth</th>
            <th>Stop</th>
            <th>Run Time</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={row.action === 'Gas Switch' ? 'gas-switch-row' : ''}>
              <td>{row.depth}</td>
              <td>{row.duration > 0 ? `${row.duration} min` : '—'}</td>
              <td>{row.runTime} min</td>
              <td>
                <span className={`action-badge ${row.action.toLowerCase().replace(/\s+/g, '-')}`}>
                  {row.action}
                </span>
                {row.gas && <span className="gas-label">{row.gas}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
