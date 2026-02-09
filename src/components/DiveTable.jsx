export default function DiveTable({ phases }) {
  if (!phases || phases.length === 0) return null;

  // Build display rows with cumulative runtime and depth ranges
  const rows = [];
  let runTime = 0;

  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    runTime = phase.runTime + phase.duration;

    let depthDisplay;
    if (phase.action === 'Descend' || phase.action === 'Ascend') {
      // Show range: find where we came from
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
    });
  }

  return (
    <div className="dive-table">
      <h3>Dive Plan</h3>
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
            <tr key={i}>
              <td>{row.depth}</td>
              <td>{row.duration} min</td>
              <td>{row.runTime} min</td>
              <td>
                <span className={`action-badge ${row.action.toLowerCase().replace(/\s+/g, '-')}`}>
                  {row.action}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
