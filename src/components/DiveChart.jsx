import { useRef, useEffect } from 'react';
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
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

export default function DiveChart({ profiles }) {
  const chartRef = useRef(null);

  if (!profiles || profiles.length === 0 || !profiles[0]?.points || profiles[0].points.length < 2) {
    return <div className="chart-placeholder">Add dive stops to see the profile</div>;
  }

  // Find max depth and time across all profiles
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

  // Generate time axis from 0 to maxTime
  const timePoints = [];
  for (let t = 0; t <= maxTime; t++) {
    timePoints.push(t);
  }

  // Create datasets for each profile
  const datasets = [];
  
  profiles.forEach((profile, index) => {
    if (!profile.points || profile.points.length === 0) return;
    
    const color = profile.color || '#4fc3f7';
    const label = profile.label || `Profile ${index + 1}`;
    
    // Interpolate depth values for consistent time axis
    const depthValues = timePoints.map(t => {
      // Find the depth at time t
      if (t === 0) return 0;
      
      for (let i = 0; i < profile.points.length - 1; i++) {
        const p1 = profile.points[i];
        const p2 = profile.points[i + 1];
        
        if (t >= p1.time && t <= p2.time) {
          // Linear interpolation between points
          if (p1.time === p2.time) return p1.depth;
          const ratio = (t - p1.time) / (p2.time - p1.time);
          return p1.depth + (p2.depth - p1.depth) * ratio;
        }
      }
      
      // Beyond last point, return last depth
      return profile.points[profile.points.length - 1].depth;
    });

    // Only fill under the deepest profile to avoid overlap confusion
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

  const data = {
    labels: timePoints,
    datasets,
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        display: profiles.length > 1,
        position: 'top',
        labels: {
          usePointStyle: true,
          pointStyle: 'line',
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          title: (items) => `Time: ${items[0].label} min`,
          label: (item) => `${item.dataset.label}: ${item.raw.toFixed(1)} m`,
        },
      },
    },
    scales: {
      y: {
        reverse: true,
        min: 0,
        max: Math.ceil(maxDepth / 5) * 5 + 5,
        title: {
          display: true,
          text: 'Depth (metres)',
          font: { size: 14, weight: 'bold' },
        },
        ticks: {
          stepSize: 5,
          callback: (val) => `${val}`,
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.15)',
        },
      },
      x: {
        type: 'linear',
        min: 0,
        max: Math.ceil(maxTime / 5) * 5 + 5,
        title: {
          display: true,
          text: 'Time (minutes)',
          font: { size: 14, weight: 'bold' },
        },
        ticks: {
          stepSize: maxTime > 60 ? 10 : 5,
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.15)',
        },
      },
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
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