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

export default function DiveChart({ profile }) {
  const chartRef = useRef(null);

  if (!profile || profile.length < 2) {
    return <div className="chart-placeholder">Add dive stops to see the profile</div>;
  }

  const maxDepth = Math.max(...profile.map(p => p.depth));
  const maxTime = profile[profile.length - 1].time;

  const data = {
    labels: profile.map(p => p.time),
    datasets: [
      {
        label: 'Depth (m)',
        data: profile.map(p => p.depth),
        borderColor: '#1a1a2e',
        backgroundColor: (context) => {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          if (!chartArea) return 'rgba(0, 180, 255, 0.3)';
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, 'rgba(173, 216, 255, 0.6)');
          gradient.addColorStop(0.5, 'rgba(0, 150, 255, 0.5)');
          gradient.addColorStop(1, 'rgba(0, 80, 180, 0.7)');
          return gradient;
        },
        fill: true,
        borderWidth: 3,
        pointRadius: 4,
        pointBackgroundColor: '#1a1a2e',
        tension: 0,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items) => `Time: ${items[0].label} min`,
          label: (item) => `Depth: ${item.raw} m`,
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
  };

  return (
    <div className="chart-container">
      <Line ref={chartRef} data={data} options={options} />
    </div>
  );
}
