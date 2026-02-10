import { useState, useMemo } from 'react';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { PARAM_SETS } from '../utils/buhlmann';
import { P_SURFACE } from '../utils/constants';

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend);

const COMPARTMENT_COLORS = [
  '#ef5350', '#ec407a', '#ab47bc', '#7e57c2', '#5c6bc0', '#42a5f5',
  '#29b6f6', '#26c6da', '#26a69a', '#66bb6a', '#9ccc65', '#d4e157',
  '#ffee58', '#ffa726', '#ff7043', '#8d6e63',
];

export default function GFExplorer({ settings, theme = 'dark' }) {
  const [collapsed, setCollapsed] = useState(true);
  const [selectedCompartments, setSelectedCompartments] = useState([0, 3, 7, 11, 15]);

  const algorithm = settings?.algorithm || 'none';
  const gfLow = settings?.gfLow || 50;
  const gfHigh = settings?.gfHigh || 70;
  const isBuhlmann = algorithm.startsWith('zhl');

  if (!isBuhlmann) return null;

  const paramKey = algorithm;
  const paramSet = PARAM_SETS[paramKey];
  if (!paramSet) return null;

  const nc = paramSet.compartments;
  const depths = [];
  for (let d = 0; d <= 60; d += 1) depths.push(d);

  const toggleCompartment = (i) => {
    setSelectedCompartments(prev =>
      prev.includes(i) ? prev.filter(c => c !== i) : [...prev, i].sort((a, b) => a - b)
    );
  };

  const datasets = useMemo(() => {
    const ds = [];

    // Ambient pressure line (diagonal)
    ds.push({
      label: 'Ambient',
      data: depths.map(d => ({ x: P_SURFACE + d / 10, y: P_SURFACE + d / 10 })),
      borderColor: 'rgba(255,255,255,0.4)',
      borderWidth: 2,
      pointRadius: 0,
      borderDash: [4, 4],
    });

    // M-value lines for selected compartments
    selectedCompartments.forEach(i => {
      if (i >= nc) return;
      const a = paramSet.aValues[i];
      const b = paramSet.bValues[i];

      // M-value line: M = a + P_amb / b
      ds.push({
        label: `TC${i + 1} M-value (t½=${paramSet.halfTimes[i]}min)`,
        data: depths.map(d => {
          const pAmb = P_SURFACE + d / 10;
          return { x: pAmb, y: a + pAmb / b };
        }),
        borderColor: COMPARTMENT_COLORS[i % 16],
        borderWidth: 2,
        pointRadius: 0,
      });

      // GF line: allowed = P_amb + (M - P_amb) * GF
      // Use GF high at surface, GF low at depth (simplified)
      ds.push({
        label: `TC${i + 1} GF ${gfLow}/${gfHigh}`,
        data: depths.map(d => {
          const pAmb = P_SURFACE + d / 10;
          const M = a + pAmb / b;
          // Interpolate GF: gfHigh at surface, gfLow at max depth
          const gf = (gfHigh + (gfLow - gfHigh) * (d / 60)) / 100;
          return { x: pAmb, y: pAmb + (M - pAmb) * gf };
        }),
        borderColor: COMPARTMENT_COLORS[i % 16],
        borderWidth: 1.5,
        borderDash: [6, 3],
        pointRadius: 0,
      });
    });

    return ds;
  }, [selectedCompartments, gfLow, gfHigh, nc, paramSet, depths]);

  const data = { datasets };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          color: theme === 'light' ? '#4a5568' : '#b0bec5',
          font: { size: 10 },
          usePointStyle: true,
          pointStyle: 'line',
          filter: (item) => !item.text.includes('GF '),
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)} bar at ${((ctx.parsed.x - P_SURFACE) * 10).toFixed(0)}m`,
        },
      },
    },
    scales: {
      x: {
        type: 'linear',
        title: { display: true, text: 'Ambient Pressure (bar)', color: theme === 'light' ? '#4a5568' : '#b0bec5' },
        ticks: { color: theme === 'light' ? '#4a5568' : '#b0bec5' },
        grid: { color: theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)' },
        min: P_SURFACE,
      },
      y: {
        type: 'linear',
        title: { display: true, text: 'Tolerated Tissue Pressure (bar)', color: theme === 'light' ? '#4a5568' : '#b0bec5' },
        ticks: { color: theme === 'light' ? '#4a5568' : '#b0bec5' },
        grid: { color: theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)' },
        min: P_SURFACE,
      },
    },
  };

  return (
    <div className="collapsible-section">
      <button className="collapsible-header" onClick={() => setCollapsed(!collapsed)}>
        <span>{collapsed ? '▶' : '▼'} GF Explorer — M-value Lines</span>
        <span className="collapsible-hint">GF {gfLow}/{gfHigh}</span>
      </button>
      {!collapsed && (
        <div style={{ padding: '12px 16px' }}>
          <div className="gf-compartment-selector">
            {Array.from({ length: nc }, (_, i) => (
              <button
                key={i}
                className={`gf-comp-btn${selectedCompartments.includes(i) ? ' active' : ''}`}
                style={{ borderColor: COMPARTMENT_COLORS[i % 16], color: selectedCompartments.includes(i) ? '#fff' : COMPARTMENT_COLORS[i % 16], backgroundColor: selectedCompartments.includes(i) ? COMPARTMENT_COLORS[i % 16] : 'transparent' }}
                onClick={() => toggleCompartment(i)}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div style={{ height: '350px' }}>
            <Line data={data} options={options} />
          </div>
          <div className="gf-explanation">
            <p>Solid lines = M-value (maximum tolerated pressure). Dashed = GF-adjusted limit. Area between dashed and ambient = the GF envelope.</p>
          </div>
        </div>
      )}
    </div>
  );
}
