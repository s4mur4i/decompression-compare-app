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

function getStatusLabel(loading, mValue, ambient) {
  if (!mValue || mValue <= ambient) return { text: '✓', color: '#4caf50' };
  const ratio = (loading - ambient) / (mValue - ambient);
  if (ratio > 0.8) return { text: '⚠', color: '#f44336' };
  if (ratio > 0.5) return { text: '~', color: '#ffc107' };
  return { text: '✓', color: '#4caf50' };
}

export default function TissueChart({ decoInfoA, decoInfoB, compareMode, theme = 'dark' }) {
  const [collapsed, setCollapsed] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  const hasA = decoInfoA && decoInfoA.tissueLoading;
  const hasB = compareMode && decoInfoB && decoInfoB.tissueLoading;

  if (!hasA && !hasB) return null;

  const ambient = 1.01325; // surface pressure

  const buildDatasets = (decoInfo, label, baseColor, borderColor) => {
    if (!decoInfo || !decoInfo.tissueLoading) return [];
    const nc = decoInfo.compartmentCount || decoInfo.tissueLoading.length;
    const ds = [];

    // N2 loading bars - solid color
    ds.push({
      label: `${label} N₂`,
      data: decoInfo.tissueLoading.slice(0, nc),
      backgroundColor: baseColor === 'blue' ? 'rgba(66, 165, 245, 0.75)' : 'rgba(255, 167, 38, 0.75)',
      borderColor: baseColor === 'blue' ? '#42a5f5' : '#ffa726',
      borderWidth: 1,
    });

    // He loading if present - purple
    if (decoInfo.heLoading) {
      const hasHeData = decoInfo.heLoading.some(v => v > 0);
      if (hasHeData) {
        ds.push({
          label: `${label} He`,
          data: decoInfo.heLoading.slice(0, nc),
          backgroundColor: baseColor === 'blue' ? 'rgba(171, 71, 188, 0.75)' : 'rgba(206, 147, 216, 0.75)',
          borderColor: baseColor === 'blue' ? '#ab47bc' : '#ce93d8',
          borderWidth: 1,
        });
      }
    }

    return ds;
  };

  const info = hasA ? decoInfoA : decoInfoB;
  const nc = info.compartmentCount || info.tissueLoading.length;
  const labels = Array.from({ length: nc }, (_, i) => `TC${i + 1}`);

  const datasets = [
    ...buildDatasets(decoInfoA, hasB ? 'A' : '', 'blue', '#4fc3f7'),
    ...(hasB ? buildDatasets(decoInfoB, 'B', 'orange', '#ff9800') : []),
  ];

  // M-value annotations as red line markers
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

  // Status badges for each compartment
  const statuses = [];
  if (info.mValues) {
    for (let i = 0; i < nc; i++) {
      const loading = info.tissueLoading[i] + (info.heLoading?.[i] || 0);
      statuses.push(getStatusLabel(loading, info.mValues[i], ambient));
    }
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
        display: true,
        labels: { color: theme === 'light' ? '#4a5568' : '#e0e8f0', font: { size: 11 } },
      },
      tooltip: {
        callbacks: {
          afterLabel: (ctx) => {
            const i = ctx.dataIndex;
            const mv = info.mValues?.[i];
            if (mv) {
              const loading = info.tissueLoading[i] + (info.heLoading?.[i] || 0);
              const status = getStatusLabel(loading, mv, ambient);
              return `M-value: ${mv.toFixed(3)} bar | Status: ${status.text === '✓' ? 'Safe' : status.text === '~' ? 'Approaching' : 'Near limit'}`;
            }
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
          <div className="section-header-row">
            <button
              className="info-toggle-btn"
              onClick={() => setShowExplanation(!showExplanation)}
              title="Toggle explanation"
            >
              ℹ️
            </button>
          </div>
          {showExplanation && (
            <p className="chart-explanation">
              Each bar represents a tissue compartment in your body (fast tissues like blood on the left, slow tissues like fat on the right). 
              The bar height shows how much dissolved gas (nitrogen/helium) is in that tissue. 
              <strong>Blue bars</strong> = N₂, <strong>Purple bars</strong> = He. 
              The <strong style={{ color: '#f44336' }}>red dashed line</strong> is the M-value — the maximum safe gas loading.
            </p>
          )}
          {statuses.length > 0 && (
            <div className="tissue-status-row">
              {statuses.map((s, i) => (
                <span key={i} className="tissue-status-badge" style={{ color: s.color }} title={`TC${i+1}: ${s.text === '✓' ? 'Safe' : s.text === '~' ? 'Approaching' : 'Near limit'}`}>
                  {s.text}
                </span>
              ))}
            </div>
          )}
          <div className="responsive-chart">
            <Bar data={data} options={options} />
          </div>
          <div className="tissue-legend">
            <span className="tissue-legend-item"><span className="legend-dot" style={{ background: '#42a5f5' }} /> N₂ loading</span>
            <span className="tissue-legend-item"><span className="legend-dot" style={{ background: '#ab47bc' }} /> He loading</span>
            <span className="tissue-legend-item"><span className="legend-dot" style={{ background: 'rgba(244,67,54,0.9)', width: '16px', height: '2px', borderRadius: 0 }} /> M-value (max safe)</span>
          </div>
        </div>
      )}
    </div>
  );
}
