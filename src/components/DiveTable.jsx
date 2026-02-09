export default function DiveTable({ phases }) {
  if (!phases || phases.length === 0) return null;

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
          {phases.map((phase, i) => (
            <tr key={i} className={`action-${phase.action.toLowerCase().replace(/\s+/g, '-')}`}>
              <td>{phase.depth} m</td>
              <td>{phase.duration} min</td>
              <td>{phase.runTime} min</td>
              <td>
                <span className={`action-badge ${phase.action.toLowerCase().replace(/\s+/g, '-')}`}>
                  {phase.action}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
