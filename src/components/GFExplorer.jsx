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
import { inspiredPressure, schreiner } from '../utils/physics';
import { buildGasTimeline, getGasAtTime } from '../utils/gasTimeline';

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend);

const COMPARTMENT_COLORS = [
  '#ef5350', '#ec407a', '#ab47bc', '#7e57c2', '#5c6bc0', '#42a5f5',
  '#29b6f6', '#26c6da', '#26a69a', '#66bb6a', '#9ccc65', '#d4e157',
  '#ffee58', '#ffa726', '#ff7043', '#8d6e63',
];

/**
 * Simulate tissue loading trajectory through a dive profile.
 * Accounts for gas switches during deco.
 * Returns per-compartment arrays of { pAmb, pTissue } points.
 */
function simulateTissueTrajectory(profilePoints, phases, settings, paramSet) {
  if (!profilePoints || profilePoints.length < 2) return null;

  const { fO2 = 0.21, fHe = 0 } = settings;
  const nc = paramSet.compartments;
  const gasTimeline = buildGasTimeline(phases, fO2, fHe);

  const initGas = gasTimeline[0];
  const n2 = new Array(nc).fill(inspiredPressure(0, initGas.fN2));
  const he = new Array(nc).fill(0);

  const trajectories = Array.from({ length: nc }, () => []);
  const maxTime = profilePoints[profilePoints.length - 1].time;

  function depthAt(t) {
    if (t <= 0) return 0;
    for (let i = 0; i < profilePoints.length - 1; i++) {
      const p1 = profilePoints[i], p2 = profilePoints[i + 1];
      if (t >= p1.time && t <= p2.time) {
        if (p1.time === p2.time) return p1.depth;
        const ratio = (t - p1.time) / (p2.time - p1.time);
        return p1.depth + (p2.depth - p1.depth) * ratio;
      }
    }
    return profilePoints[profilePoints.length - 1].depth;
  }

  for (let t = 0; t <= maxTime; t++) {
    const depth = depthAt(t);
    const pAmb = P_SURFACE + depth / 10;
    const gas = getGasAtTime(gasTimeline, t);

    if (t > 0) {
      const piN2 = inspiredPressure(depth, gas.fN2);
      const piHe = inspiredPressure(depth, gas.fHe);
      for (let i = 0; i < nc; i++) {
        n2[i] = schreiner(n2[i], piN2, 1, paramSet.halfTimes[i]);
        const heIdx = Math.min(i, paramSet.heHalfTimes.length - 1);
        he[i] = schreiner(he[i], piHe, 1, paramSet.heHalfTimes[heIdx]);
      }
    }

    for (let i = 0; i < nc; i++) {
      trajectories[i].push({ x: pAmb, y: n2[i] + he[i] });
    }
  }

  return trajectories;
}

export default function GFExplorer({ settings, profilePoints, profilePhases, theme = 'dark' }) {
  const [collapsed, setCollapsed] = useState(true);
  const [showExplanation, setShowExplanation] = useState(false);
  const [selectedCompartments, setSelectedCompartments] = useState([0]);

  const algorithm = settings?.algorithm || 'none';
  const gfLow = settings?.gfLow || 50;
  const gfHigh = settings?.gfHigh || 70;
  const isBuhlmann = algorithm.startsWith('zhl');

  const paramKey = isBuhlmann ? algorithm : 'zhl16c';
  const paramSet = PARAM_SETS[paramKey];
  const nc = paramSet?.compartments || 16;
  const depths = [];
  for (let d = 0; d <= 60; d += 1) depths.push(d);

  const toggleCompartment = (i) => {
    setSelectedCompartments(prev =>
      prev.includes(i) ? prev.filter(c => c !== i) : [...prev, i].sort((a, b) => a - b)
    );
  };

  // Compute tissue trajectories from profile points
  const trajectories = useMemo(() => {
    if (!isBuhlmann || !paramSet || !profilePoints || profilePoints.length < 2) return null;
    return simulateTissueTrajectory(profilePoints, profilePhases, settings, paramSet);
  }, [profilePoints, profilePhases, settings, isBuhlmann, paramSet]);

  const datasets = useMemo(() => {
    if (!isBuhlmann || !paramSet) return [];
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

    // M-value lines and GF lines for selected compartments
    selectedCompartments.forEach(i => {
      if (i >= nc) return;
      const a = paramSet.aValues[i];
      const b = paramSet.bValues[i];

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

      ds.push({
        label: `TC${i + 1} GF ${gfLow}/${gfHigh}`,
        data: depths.map(d => {
          const pAmb = P_SURFACE + d / 10;
          const M = a + pAmb / b;
          const gf = (gfHigh + (gfLow - gfHigh) * (d / 60)) / 100;
          return { x: pAmb, y: pAmb + (M - pAmb) * gf };
        }),
        borderColor: COMPARTMENT_COLORS[i % 16],
        borderWidth: 1.5,
        borderDash: [6, 3],
        pointRadius: 0,
      });

      // Tissue trajectory — single connected line showing the dive path
      if (trajectories && trajectories[i]) {
        ds.push({
          label: `TC${i + 1} Dive`,
          data: trajectories[i],
          borderColor: COMPARTMENT_COLORS[i % 16] + 'CC',
          backgroundColor: COMPARTMENT_COLORS[i % 16] + '20',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          showLine: true,
          tension: 0.1,
          fill: false,
        });
      }
    });

    return ds;
  }, [selectedCompartments, gfLow, gfHigh, nc, paramSet, depths, trajectories]);

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
        title: { display: true, text: 'Tissue Inert Gas Pressure (bar)', color: theme === 'light' ? '#4a5568' : '#b0bec5' },
        ticks: { color: theme === 'light' ? '#4a5568' : '#b0bec5' },
        grid: { color: theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)' },
        min: P_SURFACE,
      },
    },
  };

  if (!isBuhlmann || !paramSet) return null;

  return (
    <div className="collapsible-section">
      <button className="collapsible-header" onClick={() => setCollapsed(!collapsed)}>
        <span>{collapsed ? '▶' : '▼'} GF Explorer — M-value Lines{trajectories ? ' & Dive Trajectory' : ''}</span>
        <span className="collapsible-hint">GF {gfLow}/{gfHigh}</span>
      </button>
      {!collapsed && (
        <div style={{ padding: '12px 16px' }}>
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
              This graph shows how <strong>Gradient Factors</strong> limit your ascent. 
              Solid colored lines are M-values — the absolute maximum gas pressure each tissue can tolerate at a given depth. 
              Dashed lines show your GF-adjusted limits (GF {gfLow}/{gfHigh}).
              {trajectories && <> <strong>Thick lines</strong> show the actual tissue loading trajectory during your dive — 
              watch how tissue pressure rises during descent/bottom, then tracks along the GF line during ascent. 
              If the trajectory crosses a dashed GF line, that tissue has exceeded your safety margin.</>}
              {!trajectories && <> Add dive stops to see the tissue loading trajectory overlaid on M-value lines.</>}
            </p>
          )}
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
          <div className="responsive-chart">
            <Line data={data} options={options} />
          </div>
        </div>
      )}
    </div>
  );
}
