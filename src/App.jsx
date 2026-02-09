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
  // Shared dive parameters (common to both algorithms in compare mode)
  const [stops, setStops] = useState([]);
  const [descentRate, setDescentRate] = useState(18);
  const [ascentRate, setAscentRate] = useState(9);
  
  // Mode toggle
  const [compareMode, setCompareMode] = useState(false);
  
  // Algorithm A (left side or single mode)
  const [algorithmA, setAlgorithmA] = useState('none');
  const [fO2A, setFO2A] = useState(0.21);
  const [gfLowA, setGfLowA] = useState(50);
  const [gfHighA, setGfHighA] = useState(70);
  
  // Algorithm B (right side, compare mode only)
  const [algorithmB, setAlgorithmB] = useState('zhl16c');
  const [fO2B, setFO2B] = useState(0.21);
  const [gfLowB, setGfLowB] = useState(50);
  const [gfHighB, setGfHighB] = useState(70);
  
  const [initialized, setInitialized] = useState(false);

  // Calculate algorithm function
  const calculateAlgorithm = (algorithm, fO2, gfLow, gfHigh, phases) => {
    let decoInfo = null;
    const baseProfile = { phases };

    if (algorithm === 'zhl16a') {
      decoInfo = calculateZHL16A(phases, fO2, gfLow, gfHigh, ascentRate);
    } else if (algorithm === 'zhl16b') {
      decoInfo = calculateZHL16B(phases, fO2, gfLow, gfHigh, ascentRate);
    } else if (algorithm === 'zhl16c') {
      decoInfo = calculateZHL16C(phases, fO2, gfLow, gfHigh, ascentRate);
    } else if (algorithm === 'zhl12') {
      decoInfo = calculateZHL12(phases, fO2, gfLow, gfHigh, ascentRate);
    } else if (algorithm === 'zhl6') {
      decoInfo = calculateZHL6(phases, fO2, gfLow, gfHigh, ascentRate);
    } else if (algorithm === 'zhl8adt') {
      decoInfo = calculateZHL8ADT(phases, fO2, gfLow, gfHigh, ascentRate);
    } else if (algorithm === 'buhlmann') {
      decoInfo = calculateZHL16C(phases, fO2, gfLow, gfHigh, ascentRate);
    } else if (algorithm === 'vpm') {
      decoInfo = calculateVPM(phases, fO2, gfLow, gfHigh, ascentRate);
    } else if (algorithm === 'rgbm') {
      decoInfo = calculateRGBM(phases, fO2, gfLow, gfHigh, ascentRate);
    } else if (algorithm === 'haldane') {
      decoInfo = calculateHaldane(phases, fO2, gfLow, gfHigh, ascentRate);
    } else if (algorithm === 'workman') {
      decoInfo = calculateWorkman(phases, fO2, gfLow, gfHigh, ascentRate);
    } else if (algorithm === 'thalmann') {
      decoInfo = calculateThalmann(phases, fO2, gfLow, gfHigh, ascentRate);
    } else if (algorithm === 'dciem') {
      decoInfo = calculateDCIEM(phases, fO2, gfLow, gfHigh, ascentRate);
    }

    if (decoInfo) {
      const fullProfile = addAscentPhases(baseProfile, decoInfo.decoStops, ascentRate);
      return { ...fullProfile, decoInfo };
    } else {
      const fullProfile = simpleAscent(baseProfile, ascentRate);
      return { ...fullProfile, decoInfo };
    }
  };

  // Load from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const plan = params.get('plan');
    const descent = params.get('descent');
    const ascent = params.get('ascent');
    const mode = params.get('mode');
    
    // Single mode params
    const algo = params.get('algo');
    const o2 = params.get('o2');
    const gfl = params.get('gfl');
    const gfh = params.get('gfh');
    
    // Compare mode params
    const algoA = params.get('algoA');
    const algoB = params.get('algoB');
    const o2A = params.get('o2A');
    const o2B = params.get('o2B');
    const gflA = params.get('gflA');
    const gfhA = params.get('gfhA');
    const gflB = params.get('gflB');
    const gfhB = params.get('gfhB');

    if (plan) setStops(parsePlan(plan));
    if (descent) setDescentRate(Math.max(1, Number(descent) || 18));
    if (ascent) setAscentRate(Math.max(1, Number(ascent) || 9));
    
    // Set mode
    if (mode === 'compare') {
      setCompareMode(true);
      if (algoA) setAlgorithmA(algoA);
      if (algoB) setAlgorithmB(algoB);
      if (o2A) setFO2A(Math.min(1, Math.max(0.16, Number(o2A) / 100)));
      if (o2B) setFO2B(Math.min(1, Math.max(0.16, Number(o2B) / 100)));
      if (gflA) setGfLowA(Number(gflA) || 50);
      if (gfhA) setGfHighA(Number(gfhA) || 70);
      if (gflB) setGfLowB(Number(gflB) || 50);
      if (gfhB) setGfHighB(Number(gfhB) || 70);
    } else {
      setCompareMode(false);
      if (algo) setAlgorithmA(algo);
      if (o2) setFO2A(Math.min(1, Math.max(0.16, Number(o2) / 100)));
      if (gfl) setGfLowA(Number(gfl) || 50);
      if (gfh) setGfHighA(Number(gfh) || 70);
    }

    setInitialized(true);
  }, []);

  // Update URL when state changes
  useEffect(() => {
    if (!initialized) return;
    const params = new URLSearchParams();
    if (stops.length > 0) params.set('plan', stops.map(s => `${s.depth}:${s.time}`).join(','));
    if (descentRate !== 18) params.set('descent', descentRate);
    if (ascentRate !== 9) params.set('ascent', ascentRate);
    
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
    } else {
      if (algorithmA !== 'none') params.set('algo', algorithmA);
      if (fO2A !== 0.21) params.set('o2', Math.round(fO2A * 100));
      if (gfLowA !== 50) params.set('gfl', gfLowA);
      if (gfHighA !== 70) params.set('gfh', gfHighA);
    }
    
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', newUrl);
  }, [stops, descentRate, ascentRate, compareMode, algorithmA, algorithmB, fO2A, fO2B, gfLowA, gfHighA, gfLowB, gfHighB, initialized]);

  // Calculate results
  const baseProfile = useMemo(() => {
    if (stops.length === 0) return null;
    return calculateDiveProfile(stops, descentRate, ascentRate);
  }, [stops, descentRate, ascentRate]);

  const resultA = useMemo(() => {
    if (!baseProfile) return null;
    return calculateAlgorithm(algorithmA, fO2A, gfLowA, gfHighA, baseProfile.phases);
  }, [baseProfile, algorithmA, fO2A, gfLowA, gfHighA, ascentRate]);

  const resultB = useMemo(() => {
    if (!baseProfile || !compareMode) return null;
    return calculateAlgorithm(algorithmB, fO2B, gfLowB, gfHighB, baseProfile.phases);
  }, [baseProfile, compareMode, algorithmB, fO2B, gfLowB, gfHighB, ascentRate]);

  // Calculate time difference for compare mode
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
        
        {/* Mode Toggle */}
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
        {/* Shared Controls (top section) */}
        <div className="shared-controls">
          <DiveStops stops={stops} onStopsChange={setStops} />
          <div className="rates-section">
            <div className="setting-row">
              <label>Descent Rate</label>
              <div className="rate-input">
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={descentRate}
                  onChange={(e) => setDescentRate(Math.max(1, Number(e.target.value) || 18))}
                />
                <span>m/min</span>
              </div>
            </div>
            <div className="setting-row">
              <label>Ascent Rate</label>
              <div className="rate-input">
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={ascentRate}
                  onChange={(e) => setAscentRate(Math.max(1, Number(e.target.value) || 9))}
                />
                <span>m/min</span>
              </div>
            </div>
          </div>
          <ShareLink 
            stops={stops} 
            descentRate={descentRate} 
            ascentRate={ascentRate}
            compareMode={compareMode}
            algorithmA={algorithmA}
            algorithmB={algorithmB}
            fO2A={fO2A}
            fO2B={fO2B}
            gfLowA={gfLowA}
            gfHighA={gfHighA}
            gfLowB={gfLowB}
            gfHighB={gfHighB}
          />
        </div>

        {/* Algorithm Panels */}
        <div className={`algorithm-panels ${compareMode ? 'compare' : 'single'}`}>
          {/* Algorithm A */}
          <div className="algorithm-panel panel-a">
            <div className="panel-header">
              {compareMode ? <span className="panel-label">Algorithm A</span> : null}
            </div>
            <DiveSettings
              algorithm={algorithmA}
              onAlgorithmChange={setAlgorithmA}
              fO2={fO2A}
              onFO2Change={setFO2A}
              gfLow={gfLowA}
              onGfLowChange={setGfLowA}
              gfHigh={gfHighA}
              onGfHighChange={setGfHighA}
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
              <div className="panel-header">
                <span className="panel-label">Algorithm B</span>
              </div>
              <DiveSettings
                algorithm={algorithmB}
                onAlgorithmChange={setAlgorithmB}
                fO2={fO2B}
                onFO2Change={setFO2B}
                gfLow={gfLowB}
                onGfLowChange={setGfLowB}
                gfHigh={gfHighB}
                onGfHighChange={setGfHighB}
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

        {/* Chart Panel */}
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
      </main>

      {/* Footer */}
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