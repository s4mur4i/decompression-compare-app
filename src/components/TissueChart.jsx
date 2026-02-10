import { useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

function getLoadingColor(loading, mValue, ambient) {
  if (!mValue || mValue <= ambient) return 'rgba(76,175,80,0.7)';
  const ratio = (loading - ambient) / (mValue - ambient);
  if (ratio > 0.8) return 'rgba(244,67,54,0.8)';
  if (ratio > 0.5) return 'rgba(255,193,7,0.8)';
  return 'rgba(76,175,80,0.7)';
}

export default function TissueChart({ decoInfoA, decoInfoB, compareMode, theme = 'dark' }) {
  const [collapsed, setCollapsed] = useState(false);

  const hasA = decoInfoA && decoInfoA.tissueLoading;
  const hasB = compareMode && decoInfoB && decoInfoB.tissueLoading;

  if (!hasA && !hasB) return null;

  const ambient = 1.01325; // surface pressure

  const buildDatasets = (decoInfo, label, borderColor) => {
    if (!decoInfo || !decoInfo.tissueLoading) return [];
    const nc = decoInfo.compartmentCount || decoInfo.tissueLoading.length;
    const ds = [];

    // N2 loading bars
    const n2Colors = decoInfo.tissueLoading.map((l, i) =>
      getLoadingColor(l + (decoInfo.heLoading?.[i] || 0), decoInfo.mValues?.[i], ambient)
    );
    ds.push({
      label: `${label} N₂`,
      data: decoInfo.tissueLoading.slice(0, nc),
      backgroundColor: n2Colors,
      borderColor,
      borderWidth: 1,
    });

    // He loading if present
    if (decoInfo.heLoading) {
      ds.push({
        label: `${label} He`,
        data: decoInfo.heLoading.slice(0, nc),
        backgroundColor: 'rgba(156,39,176,0.6)',
        borderColor: 'rgba(156,39,176,1)',
        borderWidth: 1,
      });
    }

    return ds;
  };

  const info = hasA ? decoInfoA : decoInfoB;
  const nc = info.compartmentCount || info.tissueLoading.length;
  const labels = Array.from({ length: nc }, (_, i) => `TC${i + 1}`);

  const datasets = [
    ...buildDatasets(decoInfoA, hasB ? 'A' : '', '#4fc3f7'),
    ...(hasB ? buildDatasets(decoInfoB, 'B', '#ff9800') : []),
  ];

  // M-value annotations
  const annotations = {};
  if (info.mValues) {
    info.mValues.forEach((mv, i) => {
      annotations[`mv_${i}`] = {
        type: 'line',
        yMin: mv,
        yMax: mv,
        xMin: i - 0.4,
        xMax: i + 0.4,
        borderColor: 'rgba(244,67,54,0.9)',
        borderWidth: 2,
        borderDash: [4, 2],
      };
    });
  }

  const data = { labels, datasets };

  const maxVal = Math.max(
    ...datasets.flatMap(d => d.data),
    ...(info.mValues || []),
  );

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'x',
    plugins: {
      legend: {
        display: datasets.length > 1,
        labels: { color: theme === 'light' ? '#4a5568' : '#e0e8f0', font: { size: 11 } },
      },
      tooltip: {
        callbacks: {
          afterLabel: (ctx) => {
            const i = ctx.dataIndex;
            const mv = info.mValues?.[i];
            if (mv) return `M-value: ${mv.toFixed(3)} bar`;
            return '';
          },
        },
      },
      annotation: { annotations },
    },
    scales: {
      y: {
        min: 0,
        max: Math.ceil(maxVal * 1.1 * 10) / 10,
        title: { display: true, text: 'Pressure (bar)', color: theme === 'light' ? '#4a5568' : '#b0bec5' },
        ticks: { color: theme === 'light' ? '#4a5568' : '#b0bec5' },
        grid: { color: theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)' },
      },
      x: {
        ticks: { color: theme === 'light' ? '#4a5568' : '#b0bec5' },
        grid: { display: false },
      },
    },
  };

  return (
    <div className="tissue-chart-section collapsible-section">
      <button className="collapsible-header" onClick={() => setCollapsed(!collapsed)}>
        <span>{collapsed ? '▶' : '▼'} Tissue Compartment Loading</span>
        <span className="collapsible-hint">{nc} compartments</span>
      </button>
      {!collapsed && (
        <div className="tissue-chart-container">
          <p className="chart-explanation">
            Each bar represents a tissue compartment in your body (fast tissues like blood on the left, slow tissues like fat on the right). 
            The bar height shows how much dissolved gas (nitrogen/helium) is in that tissue. 
            The red dashed line is the <strong>M-value</strong> — the maximum safe gas loading. 
            Green = safe, yellow = getting close, red = near the limit.
          </p>
          <div style={{ height: '280px' }}>
            <Bar data={data} options={options} />
          </div>
          <div className="tissue-legend">
            <span className="tissue-legend-item"><span className="legend-dot" style={{ background: 'rgba(76,175,80,0.7)' }} /> Safe</span>
            <span className="tissue-legend-item"><span className="legend-dot" style={{ background: 'rgba(255,193,7,0.8)' }} /> Approaching limit</span>
            <span className="tissue-legend-item"><span className="legend-dot" style={{ background: 'rgba(244,67,54,0.8)' }} /> Near M-value</span>
            <span className="tissue-legend-item"><span className="legend-dot" style={{ background: 'rgba(244,67,54,0.9)', width: '16px', height: '2px', borderRadius: 0 }} /> M-value (max safe)</span>
          </div>
        </div>
      )}
    </div>
  );
}
