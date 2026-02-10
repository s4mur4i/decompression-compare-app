import { useState, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { P_SURFACE } from '../utils/constants';

/**
 * Simulates bubble radius behavior during a dive profile.
 * Uses simplified Boyle's law + Laplace equation.
 */
function simulateBubble(maxDepth, bottomTime) {
  const r0 = 1.0; // normalized initial radius at surface (μm)
  const gamma = 0.0179; // surface tension N/m
  const points = [];

  // Descent phase
  const descentTime = Math.ceil(maxDepth / 18);
  for (let t = 0; t <= descentTime; t++) {
    const depth = (t / descentTime) * maxDepth;
    const pAmb = P_SURFACE + depth / 10;
    // Boyle's law: P1*V1 = P2*V2, V ∝ r³
    // r = r0 * (P_surface / P_ambient)^(1/3)
    const radius = r0 * Math.pow(P_SURFACE / pAmb, 1 / 3);
    points.push({ time: t, depth, radius, phase: 'descent' });
  }

  // Bottom phase
  const bottomStart = descentTime;
  const pBottom = P_SURFACE + maxDepth / 10;
  const rBottom = r0 * Math.pow(P_SURFACE / pBottom, 1 / 3);
  for (let t = 1; t <= bottomTime; t++) {
    // Slight crushing effect over time (gas diffuses out of small bubbles)
    const crushFactor = 1 - 0.05 * (t / bottomTime);
    points.push({ time: bottomStart + t, depth: maxDepth, radius: rBottom * crushFactor, phase: 'bottom' });
  }

  // Ascent phase (slow: 9 m/min)
  const ascentStart = bottomStart + bottomTime;
  const ascentTime = Math.ceil(maxDepth / 9);
  const rCrushed = points[points.length - 1].radius;
  for (let t = 1; t <= ascentTime; t++) {
    const depth = maxDepth - (t / ascentTime) * maxDepth;
    const pAmb = P_SURFACE + depth / 10;
    // Bubble expands as pressure decreases, starting from crushed radius
    const radius = rCrushed * Math.pow(pBottom / pAmb, 1 / 3);
    points.push({ time: ascentStart + t, depth, radius, phase: 'ascent' });
  }

  // Surface phase (continued expansion)
  const surfaceStart = ascentStart + ascentTime;
  const rSurface = points[points.length - 1].radius;
  for (let t = 1; t <= 10; t++) {
    // Slow additional growth from dissolved gas
    const growth = 1 + 0.02 * t;
    points.push({ time: surfaceStart + t, depth: 0, radius: rSurface * growth, phase: 'surface' });
  }

  return points;
}

export default function BubbleChart({ theme = 'dark' }) {
  const [collapsed, setCollapsed] = useState(true);
  const [maxDepth, setMaxDepth] = useState(40);
  const [bottomTime, setBottomTime] = useState(20);

  const bubbleData = useMemo(() => simulateBubble(maxDepth, bottomTime), [maxDepth, bottomTime]);

  const data = {
    datasets: [
      {
        label: 'Bubble Radius (normalized)',
        data: bubbleData.map(p => ({ x: p.time, y: p.radius })),
        borderColor: '#26c6da',
        backgroundColor: 'rgba(38, 198, 218, 0.1)',
        fill: true,
        borderWidth: 2.5,
        pointRadius: 0,
        tension: 0.3,
      },
      {
        label: 'Depth (m) / 100',
        data: bubbleData.map(p => ({ x: p.time, y: p.depth / 100 })),
        borderColor: 'rgba(255,255,255,0.3)',
        borderWidth: 1,
        borderDash: [4, 4],
        pointRadius: 0,
        fill: false,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: theme === 'light' ? '#4a5568' : '#b0bec5', font: { size: 11 } },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            if (ctx.datasetIndex === 0) {
              const pt = bubbleData[ctx.dataIndex];
              return `Radius: ${pt.radius.toFixed(3)} (at ${pt.depth.toFixed(0)}m, ${pt.phase})`;
            }
            return `Depth: ${(ctx.parsed.y * 100).toFixed(0)}m`;
          },
        },
      },
    },
    scales: {
      x: {
        type: 'linear',
        title: { display: true, text: 'Time (min)', color: theme === 'light' ? '#4a5568' : '#b0bec5' },
        ticks: { color: theme === 'light' ? '#4a5568' : '#b0bec5' },
        grid: { color: theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.08)' },
      },
      y: {
        title: { display: true, text: 'Bubble Radius (normalized)', color: theme === 'light' ? '#4a5568' : '#b0bec5' },
        ticks: { color: theme === 'light' ? '#4a5568' : '#b0bec5' },
        grid: { color: theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.08)' },
        min: 0,
      },
    },
  };

  return (
    <div className="collapsible-section">
      <button className="collapsible-header" onClick={() => setCollapsed(!collapsed)}>
        <span>{collapsed ? '▶' : '▼'} 🫧 Bubble Mechanics Visualization</span>
        <span className="collapsible-hint">VPM-B / RGBM</span>
      </button>
      {!collapsed && (
        <div style={{ padding: '12px 16px' }}>
          <div className="bubble-controls">
            <label>
              Depth: <input type="range" min={10} max={80} value={maxDepth} onChange={e => setMaxDepth(Number(e.target.value))} /> {maxDepth}m
            </label>
            <label>
              Bottom: <input type="range" min={5} max={60} value={bottomTime} onChange={e => setBottomTime(Number(e.target.value))} /> {bottomTime}min
            </label>
          </div>
          <div style={{ height: '280px' }}>
            <Line data={data} options={options} />
          </div>
          <div className="bubble-explanation">
            <p><strong>How bubble models work:</strong> Gas microbubbles exist in tissues at all times. At depth, pressure compresses them (radius shrinks via Boyle's law). During ascent, they expand back — and potentially grow LARGER than their initial size due to dissolved gas diffusing into the bubble. VPM-B and RGBM limit ascent rate to prevent this dangerous bubble growth.</p>
          </div>
        </div>
      )}
    </div>
  );
}
