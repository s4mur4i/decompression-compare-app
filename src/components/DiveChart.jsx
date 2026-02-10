import { useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  annotationPlugin
);

export default function DiveChart({ profiles, modLines = [], theme = 'dark', ceilingLines = [] }) {
  const chartRef = useRef(null);

  if (!profiles || profiles.length === 0 || !profiles[0]?.points || profiles[0].points.length < 2) {
    return <div className="chart-placeholder">Add dive stops to see the profile</div>;
  }

  let maxDepth = 0;
  let maxTime = 0;
  
  profiles.forEach(profile => {
    if (profile.points && profile.points.length > 0) {
      const profileMaxDepth = Math.max(...profile.points.map(p => p.depth));
      const profileMaxTime = profile.points[profile.points.length - 1].time;
      maxDepth = Math.max(maxDepth, profileMaxDepth);
      maxTime = Math.max(maxTime, profileMaxTime);
    }
  });

  // Include MOD lines in max depth calc for chart range
  modLines.forEach(line => {
    if (line.depth > maxDepth) maxDepth = line.depth;
  });

  const timePoints = [];
  for (let t = 0; t <= maxTime; t++) {
    timePoints.push(t);
  }

  const datasets = [];
  
  profiles.forEach((profile, index) => {
    if (!profile.points || profile.points.length === 0) return;
    
    const color = profile.color || '#4fc3f7';
    const label = profile.label || `Profile ${index + 1}`;
    
    const depthValues = timePoints.map(t => {
      if (t === 0) return 0;
      for (let i = 0; i < profile.points.length - 1; i++) {
        const p1 = profile.points[i];
        const p2 = profile.points[i + 1];
        if (t >= p1.time && t <= p2.time) {
          if (p1.time === p2.time) return p1.depth;
          const ratio = (t - p1.time) / (p2.time - p1.time);
          return p1.depth + (p2.depth - p1.depth) * ratio;
        }
      }
      return profile.points[profile.points.length - 1].depth;
    });

    const isDeepest = index === profiles.findIndex(p => {
      const pMaxDepth = Math.max(...(p.points?.map(pt => pt.depth) || [0]));
      return pMaxDepth === maxDepth;
    });

    datasets.push({
      label,
      data: depthValues,
      borderColor: color,
      backgroundColor: isDeepest ? (context) => {
        const chart = context.chart;
        const { ctx, chartArea } = chart;
        if (!chartArea) return `${color}30`;
        const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        gradient.addColorStop(0, 'rgba(173, 216, 255, 0.6)');
        gradient.addColorStop(0.5, 'rgba(0, 150, 255, 0.5)');
        gradient.addColorStop(1, 'rgba(0, 80, 180, 0.7)');
        return gradient;
      } : 'transparent',
      fill: isDeepest,
      borderWidth: 3,
      pointRadius: 2,
      pointBackgroundColor: color,
      tension: 0,
      pointHoverRadius: 4,
    });
  });

  // Add ceiling line datasets
  ceilingLines.forEach((cl, index) => {
    if (!cl.data || cl.data.length === 0) return;
    const ceilingValues = timePoints.map(t => t < cl.data.length ? cl.data[t] : null);
    datasets.push({
      label: cl.label || 'Ceiling',
      data: ceilingValues,
      borderColor: cl.color || '#ff6b35',
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderDash: [6, 4],
      pointRadius: 0,
      fill: false,
      tension: 0,
    });
  });

  // Build annotation lines for MOD/ppO₂
  const annotations = {};
  modLines.forEach((line, i) => {
    annotations[`mod_${i}`] = {
      type: 'line',
      yMin: line.depth,
      yMax: line.depth,
      borderColor: line.color || '#ff4444',
      borderWidth: 2,
      borderDash: line.dash || [6, 4],
      label: {
        display: true,
        content: line.label || `MOD ${line.depth}m`,
        position: 'start',
        backgroundColor: 'rgba(0,0,0,0.7)',
        color: line.color || '#ff4444',
        font: { size: 11, weight: 'bold' },
        padding: 4,
      },
    };
  });

  const data = { labels: timePoints, datasets };

  const yMax = Math.ceil(maxDepth / 5) * 5 + 5;

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        display: profiles.length > 1,
        position: 'top',
        labels: { usePointStyle: true, pointStyle: 'line', color: theme === 'light' ? '#4a5568' : undefined },
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          title: (items) => `Time: ${items[0].label} min`,
          label: (item) => `${item.dataset.label}: ${item.raw.toFixed(1)} m`,
        },
      },
      annotation: {
        annotations,
      },
    },
    scales: {
      y: {
        reverse: true,
        min: 0,
        max: yMax,
        title: {
          display: true,
          text: 'Depth (metres)',
          font: { size: 14, weight: 'bold' },
          color: theme === 'light' ? '#4a5568' : undefined,
        },
        ticks: { stepSize: 5, callback: (val) => `${val}`, color: theme === 'light' ? '#4a5568' : undefined },
        grid: { color: theme === 'light' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.15)' },
      },
      x: {
        type: 'linear',
        min: 0,
        max: Math.ceil(maxTime / 5) * 5 + 5,
        title: {
          display: true,
          text: 'Time (minutes)',
          font: { size: 14, weight: 'bold' },
          color: theme === 'light' ? '#4a5568' : undefined,
        },
        ticks: { stepSize: maxTime > 60 ? 10 : 5, color: theme === 'light' ? '#4a5568' : undefined },
        grid: { color: theme === 'light' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.15)' },
      },
    },
    interaction: { mode: 'index', intersect: false },
  };

  return (
    <div className="chart-container">
      {profiles.length > 1 && (
        <h3 style={{ color: '#4fc3f7', marginBottom: '16px', textAlign: 'center' }}>
          Algorithm Comparison
        </h3>
      )}
      <Line ref={chartRef} data={data} options={options} />
    </div>
  );
}
