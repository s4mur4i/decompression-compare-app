import { useState, useEffect, useMemo } from 'react';
import DiveChart from './components/DiveChart';
import DiveStops from './components/DiveStops';
import DiveSettings from './components/DiveSettings';
import DiveSummary from './components/DiveSummary';
import ShareLink from './components/ShareLink';
import { calculateDiveProfile, parsePlan } from './utils/diveProfile';
import './App.css';

function App() {
  const [stops, setStops] = useState([]);
  const [descentRate, setDescentRate] = useState(9);
  const [initialized, setInitialized] = useState(false);

  // Load from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const plan = params.get('plan');
    const descent = params.get('descent');

    if (plan) {
      setStops(parsePlan(plan));
    } else {
      // Default example
      setStops([
        { depth: 25, time: 10 },
        { depth: 20, time: 5 },
      ]);
    }

    if (descent) {
      setDescentRate(Math.max(1, Number(descent) || 9));
    }

    setInitialized(true);
  }, []);

  // Update URL when stops/rate change
  useEffect(() => {
    if (!initialized) return;
    const params = new URLSearchParams();
    if (stops.length > 0) {
      params.set('plan', stops.map(s => `${s.depth}:${s.time}`).join(','));
    }
    if (descentRate !== 9) {
      params.set('descent', descentRate);
    }
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', newUrl);
  }, [stops, descentRate, initialized]);

  const profile = useMemo(
    () => calculateDiveProfile(stops, descentRate),
    [stops, descentRate]
  );

  return (
    <div className="app">
      <header className="app-header">
        <h1>🤿 Decompression Compare</h1>
        <p className="subtitle">Dive profile planner & algorithm comparison tool</p>
      </header>

      <main className="app-main">
        <div className="controls-panel">
          <DiveSettings
            descentRate={descentRate}
            onDescentRateChange={setDescentRate}
          />
          <DiveStops
            stops={stops}
            onStopsChange={setStops}
          />
          <DiveSummary
            stops={stops}
            profile={profile}
            descentRate={descentRate}
          />
          <ShareLink stops={stops} descentRate={descentRate} />
        </div>

        <div className="chart-panel">
          <DiveChart profile={profile} />
        </div>
      </main>
    </div>
  );
}

export default App;
