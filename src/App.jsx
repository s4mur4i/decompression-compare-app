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
  // Shared dive parameters
  const [stops, setStops] = useState([]);
  
  // Mode toggle
  const [compareMode, setCompareMode] = useState(false);
  
  // Algorithm A (left side or single mode)
  const [algorithmA, setAlgorithmA] = useState('none');
  const [fO2A, setFO2A] = useState(0.21);
  const [gfLowA, setGfLowA] = useState(50);
  const [gfHighA, setGfHighA] = useState(70);
  const [descentRateA, setDescentRateA] = useState(18);
  const [ascentRateA, setAscentRateA] = useState(9);
  
  // Algorithm B (right side, compare mode only)
  const [algorithmB, setAlgorithmB] = useState('zhl16c');
  const [fO2B, setFO2B] = useState(0.21);
  const [gfLowB, setGfLowB] = useState(50);
  const [gfHighB, setGfHighB] = useState(70);
  const [descentRateB, setDescentRateB] = useState(18);
  const [ascentRateB, setAscentRateB] = useState(9);
  
  const [initialized, setInitialized] = useState(false);

  const runAlgorithm = (algorithm, fO2, gfLow, gfHigh, ascentRate, phases) => {
    if (algorithm === 'zhl16a') return calculateZHL16A(phases, fO2, gfLow, gfHigh, ascentRate);
    if (algorithm === 'zhl16b') return calculateZHL16B(phases, fO2, gfLow, gfHigh, ascentRate);
    if (algorithm === 'zhl16c') return calculateZHL16C(phases, fO2, gfLow, gfHigh, ascentRate);
    if (algorithm === 'zhl12') return calculateZHL12(phases, fO2, gfLow, gfHigh, ascentRate);
    if (algorithm === 'zhl6') return calculateZHL6(phases, fO2, gfLow, gfHigh, ascentRate);
    if (algorithm === 'zhl8adt') return calculateZHL8ADT(phases, fO2, gfLow, gfHigh, ascentRate);
    if (algorithm === 'buhlmann') return calculateZHL16C(phases, fO2, gfLow, gfHigh, ascentRate);
    if (algorithm === 'vpm') return calculateVPM(phases, fO2, gfLow, gfHigh, ascentRate);
    if (algorithm === 'rgbm') return calculateRGBM(phases, fO2, gfLow, gfHigh, ascentRate);
    if (algorithm === 'haldane') return calculateHaldane(phases, fO2, gfLow, gfHigh, ascentRate);
    if (algorithm === 'workman') return calculateWorkman(phases, fO2, gfLow, gfHigh, ascentRate);
    if (algorithm === 'thalmann') return calculateThalmann(phases, fO2, gfLow, gfHigh, ascentRate);
    if (algorithm === 'dciem') return calculateDCIEM(phases, fO2, gfLow, gfHigh, ascentRate);
    return null;
  };

  const calculateFull = (algorithm, fO2, gfLow, gfHigh, descentRate, ascentRate) => {
    if (stops.length === 0) return null;
    const profile = calculateDiveProfile(stops, descentRate, ascentRate);
    const decoInfo = runAlgorithm(algorithm, fO2, gfLow, gfHigh, ascentRate, profile.phases);
    if (decoInfo) {
      const fullProfile = addAscentPhases(profile, decoInfo.decoStops, ascentRate);
      return { ...fullProfile, decoInfo };
    } else {
      const fullProfile = simpleAscent(profile, ascentRate);
      return { ...fullProfile, decoInfo };
    }
  };

  // Load from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const plan = params.get('plan');
    const mode = params.get('mode');
    
    if (plan) setStops(parsePlan(plan));
    
    if (mode === 'compare') {
      setCompareMode(true);
      const algoA = params.get('algoA');
      const algoB = params.get('algoB');
      if (algoA) setAlgorithmA(algoA);
      if (algoB) setAlgorithmB(algoB);
      if (params.get('o2A')) setFO2A(Math.min(1, Math.max(0.16, Number(params.get('o2A')) / 100)));
      if (params.get('o2B')) setFO2B(Math.min(1, Math.max(0.16, Number(params.get('o2B')) / 100)));
      if (params.get('gflA')) setGfLowA(Number(params.get('gflA')) || 50);
      if (params.get('gfhA')) setGfHighA(Number(params.get('gfhA')) || 70);
      if (params.get('gflB')) setGfLowB(Number(params.get('gflB')) || 50);
      if (params.get('gfhB')) setGfHighB(Number(params.get('gfhB')) || 70);
      if (params.get('descentA')) setDescentRateA(Math.max(1, Number(params.get('descentA')) || 18));
      if (params.get('ascentA')) setAscentRateA(Math.max(1, Number(params.get('ascentA')) || 9));
      if (params.get('descentB')) setDescentRateB(Math.max(1, Number(params.get('descentB')) || 18));
      if (params.get('ascentB')) setAscentRateB(Math.max(1, Number(params.get('ascentB')) || 9));
    } else {
      setCompareMode(false);
      const algo = params.get('algo');
      if (algo) setAlgorithmA(algo);
      if (params.get('o2')) setFO2A(Math.min(1, Math.max(0.16, Number(params.get('o2')) / 100)));
      if (params.get('gfl')) setGfLowA(Number(params.get('gfl')) || 50);
      if (params.get('gfh')) setGfHighA(Number(params.get('gfh')) || 70);
      if (params.get('descent')) setDescentRateA(Math.max(1, Number(params.get('descent')) || 18));
      if (params.get('ascent')) setAscentRateA(Math.max(1, Number(params.get('ascent')) || 9));
    }

    setInitialized(true);
  }, []);

  // Update URL when state changes
  useEffect(() => {
    if (!initialized) return;
    const params = new URLSearchParams();
    if (stops.length > 0) params.set('plan', stops.map(s => `${s.depth}:${s.time}`).join(','));
    
    if (compareMode) {
      params.set('mode', 'compare');
      if (algorithmA !== 'none') params.set('algoA', algorithmA);
      if (algorithmB !== 'none') params.set('algoB', algorithmB);
      if (fO2A !== 0.21) params.set('o2A', Math.round(fO2A * 100));
      if (fO2B !== 0.21) params.set('o2B', Math.round(fO2B * 100));
      if (gfLowA !== 50) params.set('gflA', gfLowA);
      if (gfHighA !== 70) params.set('gfhA', gfHighA);
      if (gfLowB !== 50) params.set('gflB', gfLowB);
      if (gfHighB !== 70) params.set('gfhB', gfHighB);
      if (descentRateA !== 18) params.set('descentA', descentRateA);
      if (ascentRateA !== 9) params.set('ascentA', ascentRateA);
      if (descentRateB !== 18) params.set('descentB', descentRateB);
      if (ascentRateB !== 9) params.set('ascentB', ascentRateB);
    } else {
      if (algorithmA !== 'none') params.set('algo', algorithmA);
      if (fO2A !== 0.21) params.set('o2', Math.round(fO2A * 100));
      if (gfLowA !== 50) params.set('gfl', gfLowA);
      if (gfHighA !== 70) params.set('gfh', gfHighA);
      if (descentRateA !== 18) params.set('descent', descentRateA);
      if (ascentRateA !== 9) params.set('ascent', ascentRateA);
    }
    
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', newUrl);
  }, [stops, compareMode, algorithmA, algorithmB, fO2A, fO2B, gfLowA, gfHighA, gfLowB, gfHighB, descentRateA, ascentRateA, descentRateB, ascentRateB, initialized]);

  // Calculate results
  const resultA = useMemo(() => {
    return calculateFull(algorithmA, fO2A, gfLowA, gfHighA, descentRateA, ascentRateA);
  }, [stops, algorithmA, fO2A, gfLowA, gfHighA, descentRateA, ascentRateA]);

  const resultB = useMemo(() => {
    if (!compareMode) return null;
    return calculateFull(algorithmB, fO2B, gfLowB, gfHighB, descentRateB, ascentRateB);
  }, [stops, compareMode, algorithmB, fO2B, gfLowB, gfHighB, descentRateB, ascentRateB]);

  const timeDifference = useMemo(() => {
    if (!compareMode || !resultA || !resultB) return null;
    const diffMinutes = resultB.totalTime - resultA.totalTime;
    if (diffMinutes === 0) return null;
    const sign = diffMinutes > 0 ? '+' : '';
    return `${sign}${diffMinutes} min`;
  }, [compareMode, resultA, resultB]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>🤿 Decompression Compare</h1>
        <p className="subtitle">Dive profile planner & algorithm comparison tool</p>
        
        <div className="mode-toggle">
          <button 
            className={`mode-btn ${!compareMode ? 'active' : ''}`}
            onClick={() => setCompareMode(false)}
          >
            Single
          </button>
          <button 
            className={`mode-btn ${compareMode ? 'active' : ''}`}
            onClick={() => setCompareMode(true)}
          >
            Compare
          </button>
        </div>
      </header>

      <main className="app-main">
        {/* Shared: Dive Stops only */}
        <div className="shared-controls">
          <DiveStops stops={stops} onStopsChange={setStops} />
        </div>

        {/* Chart — above summaries/tables */}
        <div className="chart-panel">
          <DiveChart 
            profiles={compareMode ? [
              { points: resultA?.points || [], color: '#4fc3f7', label: 'Algorithm A' },
              { points: resultB?.points || [], color: '#ff9800', label: 'Algorithm B' }
            ] : [
              { points: resultA?.points || [], color: '#4fc3f7', label: 'Dive Profile' }
            ]} 
          />
        </div>

        {/* Algorithm Panels — settings, summary, table */}
        <div className={`algorithm-panels ${compareMode ? 'compare' : 'single'}`}>
          {/* Algorithm A */}
          <div className="algorithm-panel panel-a">
            {compareMode && <div className="panel-header"><span className="panel-label">Algorithm A</span></div>}
            <DiveSettings
              algorithm={algorithmA}
              onAlgorithmChange={setAlgorithmA}
              fO2={fO2A}
              onFO2Change={setFO2A}
              gfLow={gfLowA}
              onGfLowChange={setGfLowA}
              gfHigh={gfHighA}
              onGfHighChange={setGfHighA}
              descentRate={descentRateA}
              onDescentRateChange={setDescentRateA}
              ascentRate={ascentRateA}
              onAscentRateChange={setAscentRateA}
              color="#4fc3f7"
            />
            <DiveSummary
              stops={stops}
              totalTime={resultA?.totalTime || 0}
              decoInfo={resultA?.decoInfo}
              color="#4fc3f7"
              compareWith={compareMode && timeDifference ? `${timeDifference} vs B` : null}
            />
            <DiveTable phases={resultA?.phases || []} color="#4fc3f7" />
          </div>

          {/* Algorithm B (compare mode only) */}
          {compareMode && (
            <div className="algorithm-panel panel-b">
              <div className="panel-header"><span className="panel-label">Algorithm B</span></div>
              <DiveSettings
                algorithm={algorithmB}
                onAlgorithmChange={setAlgorithmB}
                fO2={fO2B}
                onFO2Change={setFO2B}
                gfLow={gfLowB}
                onGfLowChange={setGfLowB}
                gfHigh={gfHighB}
                onGfHighChange={setGfHighB}
                descentRate={descentRateB}
                onDescentRateChange={setDescentRateB}
                ascentRate={ascentRateB}
                onAscentRateChange={setAscentRateB}
                color="#ff9800"
              />
              <DiveSummary
                stops={stops}
                totalTime={resultB?.totalTime || 0}
                decoInfo={resultB?.decoInfo}
                color="#ff9800"
                compareWith={timeDifference ? `${timeDifference.replace('+', '').replace('-', '+')} vs A` : null}
              />
              <DiveTable phases={resultB?.phases || []} color="#ff9800" />
            </div>
          )}
        </div>

        {/* Share Link — very bottom */}
        <ShareLink />
      </main>

      <footer className="app-footer">
        <div className="footer-content">
          <span>Made by <a href="https://github.com/s4mur4i" target="_blank" rel="noopener noreferrer">S4mur4i</a></span>
          <span>•</span>
          <a href="https://github.com/s4mur4i/decompression-compare-app" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}

export default App;
