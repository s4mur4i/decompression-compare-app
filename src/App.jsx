import { useState, useEffect, useMemo } from 'react';
import DiveChart from './components/DiveChart';
import DiveStops from './components/DiveStops';
import DiveSettings from './components/DiveSettings';
import DiveSummary from './components/DiveSummary';
import DiveTable from './components/DiveTable';
import ShareLink from './components/ShareLink';
import { calculateDiveProfile, addAscentPhases, simpleAscent, parsePlan } from './utils/diveProfile';
import { calculateBuhlmann, calculateZHL16A, calculateZHL16B, calculateZHL16C, calculateZHL12, calculateZHL6, calculateZHL8ADT } from './utils/buhlmann';
import { calculateVPM } from './utils/vpm';
import { calculateRGBM } from './utils/rgbm';
import { calculateHaldane } from './utils/haldane';
import { calculateWorkman } from './utils/workman';
import { calculateThalmann } from './utils/thalmann';
import { calculateDCIEM } from './utils/dciem';
import './App.css';

function App() {
  const [stops, setStops] = useState([]);
  const [descentRate, setDescentRate] = useState(18);
  const [ascentRate, setAscentRate] = useState(9);
  const [algorithm, setAlgorithm] = useState('none');
  const [fO2, setFO2] = useState(0.21);
  const [gfLow, setGfLow] = useState(50);
  const [gfHigh, setGfHigh] = useState(70);
  const [initialized, setInitialized] = useState(false);

  // Load from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const plan = params.get('plan');
    const descent = params.get('descent');
    const ascent = params.get('ascent');
    const algo = params.get('algo');
    const o2 = params.get('o2');
    const gfl = params.get('gfl');
    const gfh = params.get('gfh');

    if (plan) setStops(parsePlan(plan));
    if (descent) setDescentRate(Math.max(1, Number(descent) || 18));
    if (ascent) setAscentRate(Math.max(1, Number(ascent) || 9));
    if (algo) setAlgorithm(algo);
    if (o2) setFO2(Math.min(1, Math.max(0.16, Number(o2) / 100)));
    if (gfl) setGfLow(Number(gfl) || 50);
    if (gfh) setGfHigh(Number(gfh) || 70);

    setInitialized(true);
  }, []);

  // Update URL when state changes
  useEffect(() => {
    if (!initialized) return;
    const params = new URLSearchParams();
    if (stops.length > 0) params.set('plan', stops.map(s => `${s.depth}:${s.time}`).join(','));
    if (descentRate !== 18) params.set('descent', descentRate);
    if (ascentRate !== 9) params.set('ascent', ascentRate);
    if (algorithm !== 'none') params.set('algo', algorithm);
    if (fO2 !== 0.21) params.set('o2', Math.round(fO2 * 100));
    if (gfLow !== 50) params.set('gfl', gfLow);
    if (gfHigh !== 70) params.set('gfh', gfHigh);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', newUrl);
  }, [stops, descentRate, ascentRate, algorithm, fO2, gfLow, gfHigh, initialized]);

  const result = useMemo(() => {
    if (stops.length === 0) return null;

    const baseProfile = calculateDiveProfile(stops, descentRate, ascentRate);
    let decoInfo = null;

    if (algorithm === 'zhl16a') {
      decoInfo = calculateZHL16A(baseProfile.phases, fO2, gfLow, gfHigh, ascentRate);
      const fullProfile = addAscentPhases(baseProfile, decoInfo.decoStops, ascentRate);
      return { ...fullProfile, decoInfo };
    } else if (algorithm === 'zhl16b') {
      decoInfo = calculateZHL16B(baseProfile.phases, fO2, gfLow, gfHigh, ascentRate);
      const fullProfile = addAscentPhases(baseProfile, decoInfo.decoStops, ascentRate);
      return { ...fullProfile, decoInfo };
    } else if (algorithm === 'zhl16c') {
      decoInfo = calculateZHL16C(baseProfile.phases, fO2, gfLow, gfHigh, ascentRate);
      const fullProfile = addAscentPhases(baseProfile, decoInfo.decoStops, ascentRate);
      return { ...fullProfile, decoInfo };
    } else if (algorithm === 'zhl12') {
      decoInfo = calculateZHL12(baseProfile.phases, fO2, gfLow, gfHigh, ascentRate);
      const fullProfile = addAscentPhases(baseProfile, decoInfo.decoStops, ascentRate);
      return { ...fullProfile, decoInfo };
    } else if (algorithm === 'zhl6') {
      decoInfo = calculateZHL6(baseProfile.phases, fO2, gfLow, gfHigh, ascentRate);
      const fullProfile = addAscentPhases(baseProfile, decoInfo.decoStops, ascentRate);
      return { ...fullProfile, decoInfo };
    } else if (algorithm === 'zhl8adt') {
      decoInfo = calculateZHL8ADT(baseProfile.phases, fO2, gfLow, gfHigh, ascentRate);
      const fullProfile = addAscentPhases(baseProfile, decoInfo.decoStops, ascentRate);
      return { ...fullProfile, decoInfo };
    } else if (algorithm === 'buhlmann') {
      // Legacy support - default to ZHL-16C
      decoInfo = calculateZHL16C(baseProfile.phases, fO2, gfLow, gfHigh, ascentRate);
      const fullProfile = addAscentPhases(baseProfile, decoInfo.decoStops, ascentRate);
      return { ...fullProfile, decoInfo };
    } else if (algorithm === 'vpm') {
      decoInfo = calculateVPM(baseProfile.phases, fO2, gfLow, gfHigh, ascentRate);
      const fullProfile = addAscentPhases(baseProfile, decoInfo.decoStops, ascentRate);
      return { ...fullProfile, decoInfo };
    } else if (algorithm === 'rgbm') {
      decoInfo = calculateRGBM(baseProfile.phases, fO2, gfLow, gfHigh, ascentRate);
      const fullProfile = addAscentPhases(baseProfile, decoInfo.decoStops, ascentRate);
      return { ...fullProfile, decoInfo };
    } else if (algorithm === 'haldane') {
      decoInfo = calculateHaldane(baseProfile.phases, fO2, gfLow, gfHigh, ascentRate);
      const fullProfile = addAscentPhases(baseProfile, decoInfo.decoStops, ascentRate);
      return { ...fullProfile, decoInfo };
    } else if (algorithm === 'workman') {
      decoInfo = calculateWorkman(baseProfile.phases, fO2, gfLow, gfHigh, ascentRate);
      const fullProfile = addAscentPhases(baseProfile, decoInfo.decoStops, ascentRate);
      return { ...fullProfile, decoInfo };
    } else if (algorithm === 'thalmann') {
      decoInfo = calculateThalmann(baseProfile.phases, fO2, gfLow, gfHigh, ascentRate);
      const fullProfile = addAscentPhases(baseProfile, decoInfo.decoStops, ascentRate);
      return { ...fullProfile, decoInfo };
    } else if (algorithm === 'dciem') {
      decoInfo = calculateDCIEM(baseProfile.phases, fO2, gfLow, gfHigh, ascentRate);
      const fullProfile = addAscentPhases(baseProfile, decoInfo.decoStops, ascentRate);
      return { ...fullProfile, decoInfo };
    } else {
      const fullProfile = simpleAscent(baseProfile, ascentRate);
      return { ...fullProfile, decoInfo };
    }
  }, [stops, descentRate, ascentRate, algorithm, fO2, gfLow, gfHigh]);

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
            ascentRate={ascentRate}
            onAscentRateChange={setAscentRate}
            algorithm={algorithm}
            onAlgorithmChange={setAlgorithm}
            fO2={fO2}
            onFO2Change={setFO2}
            gfLow={gfLow}
            onGfLowChange={setGfLow}
            gfHigh={gfHigh}
            onGfHighChange={setGfHigh}
          />
          <DiveStops stops={stops} onStopsChange={setStops} />
          <DiveSummary
            stops={stops}
            totalTime={result?.totalTime || 0}
            decoInfo={result?.decoInfo}
          />
          <ShareLink stops={stops} descentRate={descentRate} />
        </div>

        <div className="chart-panel">
          <DiveChart profile={result?.points || []} />
          <DiveTable phases={result?.phases || []} />
        </div>
      </main>
    </div>
  );
}

export default App;
