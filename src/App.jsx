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
  const [compareMode, setCompareMode] = useState(false);
  
  // Algorithm A
  const [algorithmA, setAlgorithmA] = useState('none');
  const [fO2A, setFO2A] = useState(0.21);
  const [fHeA, setFHeA] = useState(0);
  const [gfLowA, setGfLowA] = useState(50);
  const [gfHighA, setGfHighA] = useState(70);
  const [descentRateA, setDescentRateA] = useState(18);
  const [ascentRateA, setAscentRateA] = useState(9);
  const [ppO2MaxA, setPpO2MaxA] = useState(1.4);
  const [ppO2DecoA, setPpO2DecoA] = useState(1.6);
  const [decoGas1A, setDecoGas1A] = useState(null);
  const [decoGas2A, setDecoGas2A] = useState(null);
  const [gasSwitchTimeA, setGasSwitchTimeA] = useState(true); // 1 min gas switch time
  
  // Algorithm B
  const [algorithmB, setAlgorithmB] = useState('zhl16c');
  const [fO2B, setFO2B] = useState(0.21);
  const [fHeB, setFHeB] = useState(0);
  const [gfLowB, setGfLowB] = useState(50);
  const [gfHighB, setGfHighB] = useState(70);
  const [descentRateB, setDescentRateB] = useState(18);
  const [ascentRateB, setAscentRateB] = useState(9);
  const [ppO2MaxB, setPpO2MaxB] = useState(1.4);
  const [ppO2DecoB, setPpO2DecoB] = useState(1.6);
  const [decoGas1B, setDecoGas1B] = useState(null);
  const [decoGas2B, setDecoGas2B] = useState(null);
  const [gasSwitchTimeB, setGasSwitchTimeB] = useState(true);
  
  const [initialized, setInitialized] = useState(false);

  // MOD calculation
  const calcMOD = (fO2, ppO2) => fO2 > 0 ? Math.floor(10 * (ppO2 / fO2 - 1)) : 0;

  const runAlgorithm = (algorithm, fO2, fHe, gfLow, gfHigh, ascentRate, phases, decoGas1, decoGas2, ppO2Deco) => {
    // Build gas switches list (sorted deepest first)
    const gasSwitches = [];
    if (decoGas1?.fO2) {
      const switchDepth = calcMOD(decoGas1.fO2, ppO2Deco);
      gasSwitches.push({ depth: switchDepth, fO2: decoGas1.fO2, fHe: 0 });
    }
    if (decoGas2?.fO2) {
      const switchDepth = calcMOD(decoGas2.fO2, ppO2Deco);
      gasSwitches.push({ depth: switchDepth, fO2: decoGas2.fO2, fHe: 0 });
    }
    gasSwitches.sort((a, b) => b.depth - a.depth);

    const opts = { fO2, fHe, gfLow, gfHigh, ascentRate, gasSwitches };

    if (algorithm === 'zhl16a') return calculateZHL16A(phases, opts);
    if (algorithm === 'zhl16b') return calculateZHL16B(phases, opts);
    if (algorithm === 'zhl16c') return calculateZHL16C(phases, opts);
    if (algorithm === 'zhl12') return calculateZHL12(phases, opts);
    if (algorithm === 'zhl6') return calculateZHL6(phases, opts);
    if (algorithm === 'zhl8adt') return calculateZHL8ADT(phases, opts);
    if (algorithm === 'buhlmann') return calculateZHL16C(phases, opts);
    if (algorithm === 'vpm') return calculateVPM(phases, opts);
    if (algorithm === 'rgbm') return calculateRGBM(phases, opts);
    if (algorithm === 'haldane') return calculateHaldane(phases, opts);
    if (algorithm === 'workman') return calculateWorkman(phases, opts);
    if (algorithm === 'thalmann') return calculateThalmann(phases, opts);
    if (algorithm === 'dciem') return calculateDCIEM(phases, opts);
    return null;
  };

  const calculateFull = (algorithm, fO2, fHe, gfLow, gfHigh, descentRate, ascentRate, decoGas1, decoGas2, ppO2Deco, gasSwitchTime = true) => {
    if (stops.length === 0) return null;
    const profile = calculateDiveProfile(stops, descentRate, ascentRate);
    const decoInfo = runAlgorithm(algorithm, fO2, fHe, gfLow, gfHigh, ascentRate, profile.phases, decoGas1, decoGas2, ppO2Deco);
    if (decoInfo) {
      // Add 1 min to gas switch stops if toggle enabled
      const adjustedStops = gasSwitchTime
        ? decoInfo.decoStops.map(s => s.gasSwitch ? { ...s, time: 1 } : s)
        : decoInfo.decoStops;
      const fullProfile = addAscentPhases(profile, adjustedStops, ascentRate);
      return { ...fullProfile, decoInfo };
    } else {
      const fullProfile = simpleAscent(profile, ascentRate);
      return { ...fullProfile, decoInfo };
    }
  };

  // URL loading
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('plan')) setStops(parsePlan(p.get('plan')));
    
    if (p.get('mode') === 'compare') {
      setCompareMode(true);
      if (p.get('algoA')) setAlgorithmA(p.get('algoA'));
      if (p.get('algoB')) setAlgorithmB(p.get('algoB'));
      if (p.get('o2A')) setFO2A(Number(p.get('o2A')) / 100);
      if (p.get('o2B')) setFO2B(Number(p.get('o2B')) / 100);
      if (p.get('heA')) setFHeA(Number(p.get('heA')) / 100);
      if (p.get('heB')) setFHeB(Number(p.get('heB')) / 100);
      if (p.get('gflA')) setGfLowA(Number(p.get('gflA')));
      if (p.get('gfhA')) setGfHighA(Number(p.get('gfhA')));
      if (p.get('gflB')) setGfLowB(Number(p.get('gflB')));
      if (p.get('gfhB')) setGfHighB(Number(p.get('gfhB')));
      if (p.get('descentA')) setDescentRateA(Number(p.get('descentA')));
      if (p.get('ascentA')) setAscentRateA(Number(p.get('ascentA')));
      if (p.get('descentB')) setDescentRateB(Number(p.get('descentB')));
      if (p.get('ascentB')) setAscentRateB(Number(p.get('ascentB')));
      if (p.get('ppo2A')) setPpO2MaxA(Number(p.get('ppo2A')));
      if (p.get('ppo2B')) setPpO2MaxB(Number(p.get('ppo2B')));
      if (p.get('ppo2dA')) setPpO2DecoA(Number(p.get('ppo2dA')));
      if (p.get('ppo2dB')) setPpO2DecoB(Number(p.get('ppo2dB')));
      if (p.get('s1A')) setDecoGas1A({ fO2: Number(p.get('s1A')) / 100 });
      if (p.get('s2A')) setDecoGas2A({ fO2: Number(p.get('s2A')) / 100 });
      if (p.get('s1B')) setDecoGas1B({ fO2: Number(p.get('s1B')) / 100 });
      if (p.get('s2B')) setDecoGas2B({ fO2: Number(p.get('s2B')) / 100 });
      if (p.get('gstA') === '0') setGasSwitchTimeA(false);
      if (p.get('gstB') === '0') setGasSwitchTimeB(false);
    } else {
      if (p.get('algo')) setAlgorithmA(p.get('algo'));
      if (p.get('o2')) setFO2A(Number(p.get('o2')) / 100);
      if (p.get('he')) setFHeA(Number(p.get('he')) / 100);
      if (p.get('gfl')) setGfLowA(Number(p.get('gfl')));
      if (p.get('gfh')) setGfHighA(Number(p.get('gfh')));
      if (p.get('descent')) setDescentRateA(Number(p.get('descent')));
      if (p.get('ascent')) setAscentRateA(Number(p.get('ascent')));
      if (p.get('ppo2')) setPpO2MaxA(Number(p.get('ppo2')));
      if (p.get('ppo2d')) setPpO2DecoA(Number(p.get('ppo2d')));
      if (p.get('s1')) setDecoGas1A({ fO2: Number(p.get('s1')) / 100 });
      if (p.get('s2')) setDecoGas2A({ fO2: Number(p.get('s2')) / 100 });
      if (p.get('gst') === '0') setGasSwitchTimeA(false);
    }
    setInitialized(true);
  }, []);

  // URL sync
  useEffect(() => {
    if (!initialized) return;
    const p = new URLSearchParams();
    if (stops.length > 0) p.set('plan', stops.map(s => `${s.depth}:${s.time}`).join(','));
    
    if (compareMode) {
      p.set('mode', 'compare');
      if (algorithmA !== 'none') p.set('algoA', algorithmA);
      if (algorithmB !== 'none') p.set('algoB', algorithmB);
      if (fO2A !== 0.21) p.set('o2A', Math.round(fO2A * 100));
      if (fO2B !== 0.21) p.set('o2B', Math.round(fO2B * 100));
      if (fHeA > 0) p.set('heA', Math.round(fHeA * 100));
      if (fHeB > 0) p.set('heB', Math.round(fHeB * 100));
      if (gfLowA !== 50) p.set('gflA', gfLowA);
      if (gfHighA !== 70) p.set('gfhA', gfHighA);
      if (gfLowB !== 50) p.set('gflB', gfLowB);
      if (gfHighB !== 70) p.set('gfhB', gfHighB);
      if (descentRateA !== 18) p.set('descentA', descentRateA);
      if (ascentRateA !== 9) p.set('ascentA', ascentRateA);
      if (descentRateB !== 18) p.set('descentB', descentRateB);
      if (ascentRateB !== 9) p.set('ascentB', ascentRateB);
      if (ppO2MaxA !== 1.4) p.set('ppo2A', ppO2MaxA);
      if (ppO2MaxB !== 1.4) p.set('ppo2B', ppO2MaxB);
      if (ppO2DecoA !== 1.6) p.set('ppo2dA', ppO2DecoA);
      if (ppO2DecoB !== 1.6) p.set('ppo2dB', ppO2DecoB);
      if (decoGas1A) p.set('s1A', Math.round(decoGas1A.fO2 * 100));
      if (decoGas2A) p.set('s2A', Math.round(decoGas2A.fO2 * 100));
      if (decoGas1B) p.set('s1B', Math.round(decoGas1B.fO2 * 100));
      if (decoGas2B) p.set('s2B', Math.round(decoGas2B.fO2 * 100));
      if (!gasSwitchTimeA) p.set('gstA', '0');
      if (!gasSwitchTimeB) p.set('gstB', '0');
    } else {
      if (algorithmA !== 'none') p.set('algo', algorithmA);
      if (fO2A !== 0.21) p.set('o2', Math.round(fO2A * 100));
      if (fHeA > 0) p.set('he', Math.round(fHeA * 100));
      if (gfLowA !== 50) p.set('gfl', gfLowA);
      if (gfHighA !== 70) p.set('gfh', gfHighA);
      if (descentRateA !== 18) p.set('descent', descentRateA);
      if (ascentRateA !== 9) p.set('ascent', ascentRateA);
      if (ppO2MaxA !== 1.4) p.set('ppo2', ppO2MaxA);
      if (ppO2DecoA !== 1.6) p.set('ppo2d', ppO2DecoA);
      if (decoGas1A) p.set('s1', Math.round(decoGas1A.fO2 * 100));
      if (decoGas2A) p.set('s2', Math.round(decoGas2A.fO2 * 100));
      if (!gasSwitchTimeA) p.set('gst', '0');
    }
    window.history.replaceState(null, '', `${window.location.pathname}?${p.toString()}`);
  }, [stops, compareMode, algorithmA, algorithmB, fO2A, fO2B, fHeA, fHeB, gfLowA, gfHighA, gfLowB, gfHighB, descentRateA, ascentRateA, descentRateB, ascentRateB, ppO2MaxA, ppO2MaxB, ppO2DecoA, ppO2DecoB, decoGas1A, decoGas2A, decoGas1B, decoGas2B, gasSwitchTimeA, gasSwitchTimeB, initialized]);

  // Results
  const resultA = useMemo(() => {
    return calculateFull(algorithmA, fO2A, fHeA, gfLowA, gfHighA, descentRateA, ascentRateA, decoGas1A, decoGas2A, ppO2DecoA, gasSwitchTimeA);
  }, [stops, algorithmA, fO2A, fHeA, gfLowA, gfHighA, descentRateA, ascentRateA, decoGas1A, decoGas2A, ppO2DecoA, gasSwitchTimeA]);

  const resultB = useMemo(() => {
    if (!compareMode) return null;
    return calculateFull(algorithmB, fO2B, fHeB, gfLowB, gfHighB, descentRateB, ascentRateB, decoGas1B, decoGas2B, ppO2DecoB, gasSwitchTimeB);
  }, [stops, compareMode, algorithmB, fO2B, fHeB, gfLowB, gfHighB, descentRateB, ascentRateB, decoGas1B, decoGas2B, ppO2DecoB, gasSwitchTimeB]);

  const timeDifference = useMemo(() => {
    if (!compareMode || !resultA || !resultB) return null;
    const diff = resultB.totalTime - resultA.totalTime;
    if (diff === 0) return null;
    return `${diff > 0 ? '+' : ''}${diff} min`;
  }, [compareMode, resultA, resultB]);

  // MOD lines for chart
  const modLines = useMemo(() => {
    const lines = [];
    const maxDepth = Math.max(...stops.map(s => s.depth), 0);
    
    // Algorithm A MOD
    if (algorithmA !== 'none') {
      const modA = calcMOD(fO2A, ppO2MaxA);
      lines.push({ depth: modA, color: '#ff4444', dash: [6, 4], label: `MOD ${modA}m (ppO₂ ${ppO2MaxA})` });
      
      // Deco gas switch lines
      if (decoGas1A?.fO2) {
        const d = calcMOD(decoGas1A.fO2, ppO2DecoA);
        lines.push({ depth: d, color: '#888888', dash: [4, 4], label: `S1 switch ${d}m` });
      }
      if (decoGas2A?.fO2) {
        const d = calcMOD(decoGas2A.fO2, ppO2DecoA);
        lines.push({ depth: d, color: '#666666', dash: [4, 4], label: `S2 switch ${d}m` });
      }
    }
    
    // Algorithm B (compare mode)
    if (compareMode && algorithmB !== 'none') {
      const modB = calcMOD(fO2B, ppO2MaxB);
      const modA = algorithmA !== 'none' ? calcMOD(fO2A, ppO2MaxA) : -1;
      if (modB !== modA) {
        lines.push({ depth: modB, color: '#ff8800', dash: [6, 4], label: `MOD ${modB}m (B)` });
      }
      if (decoGas1B?.fO2) {
        const d = calcMOD(decoGas1B.fO2, ppO2DecoB);
        lines.push({ depth: d, color: '#aa7744', dash: [4, 4], label: `B S1 switch ${d}m` });
      }
      if (decoGas2B?.fO2) {
        const d = calcMOD(decoGas2B.fO2, ppO2DecoB);
        lines.push({ depth: d, color: '#886633', dash: [4, 4], label: `B S2 switch ${d}m` });
      }
    }
    
    return lines;
  }, [algorithmA, algorithmB, fO2A, fO2B, ppO2MaxA, ppO2MaxB, ppO2DecoA, ppO2DecoB, decoGas1A, decoGas2A, decoGas1B, decoGas2B, compareMode, stops]);

  // MOD violation check
  const modViolationA = useMemo(() => {
    if (algorithmA === 'none' || stops.length === 0) return false;
    const maxDepth = Math.max(...stops.map(s => s.depth));
    return maxDepth > calcMOD(fO2A, ppO2MaxA);
  }, [algorithmA, fO2A, ppO2MaxA, stops]);

  const modViolationB = useMemo(() => {
    if (!compareMode || algorithmB === 'none' || stops.length === 0) return false;
    const maxDepth = Math.max(...stops.map(s => s.depth));
    return maxDepth > calcMOD(fO2B, ppO2MaxB);
  }, [compareMode, algorithmB, fO2B, ppO2MaxB, stops]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>🤿 Decompression Compare</h1>
        <p className="subtitle">Dive profile planner & algorithm comparison tool</p>
        <div className="mode-toggle">
          <button className={`mode-btn ${!compareMode ? 'active' : ''}`} onClick={() => setCompareMode(false)}>Single</button>
          <button className={`mode-btn ${compareMode ? 'active' : ''}`} onClick={() => setCompareMode(true)}>Compare</button>
        </div>
      </header>

      <main className="app-main">
        {/* 1. Dive Stops */}
        <div className="shared-controls">
          <DiveStops stops={stops} onStopsChange={setStops} />
        </div>

        {/* 2. Algorithm Settings */}
        <div className={`algorithm-panels ${compareMode ? 'compare' : 'single'}`}>
          <div className="algorithm-panel panel-a">
            {compareMode && <div className="panel-header"><span className="panel-label">Algorithm A</span></div>}
            <DiveSettings
              algorithm={algorithmA} onAlgorithmChange={setAlgorithmA}
              fO2={fO2A} onFO2Change={setFO2A}
              fHe={fHeA} onFHeChange={setFHeA}
              gfLow={gfLowA} onGfLowChange={setGfLowA}
              gfHigh={gfHighA} onGfHighChange={setGfHighA}
              descentRate={descentRateA} onDescentRateChange={setDescentRateA}
              ascentRate={ascentRateA} onAscentRateChange={setAscentRateA}
              ppO2Max={ppO2MaxA} onPpO2MaxChange={setPpO2MaxA}
              ppO2Deco={ppO2DecoA} onPpO2DecoChange={setPpO2DecoA}
              decoGas1={decoGas1A} onDecoGas1Change={setDecoGas1A}
              decoGas2={decoGas2A} onDecoGas2Change={setDecoGas2A}
              gasSwitchTime={gasSwitchTimeA} onGasSwitchTimeChange={setGasSwitchTimeA}
              color="#4fc3f7"
            />
          </div>
          {compareMode && (
            <div className="algorithm-panel panel-b">
              <div className="panel-header"><span className="panel-label">Algorithm B</span></div>
              <DiveSettings
                algorithm={algorithmB} onAlgorithmChange={setAlgorithmB}
                fO2={fO2B} onFO2Change={setFO2B}
                fHe={fHeB} onFHeChange={setFHeB}
                gfLow={gfLowB} onGfLowChange={setGfLowB}
                gfHigh={gfHighB} onGfHighChange={setGfHighB}
                descentRate={descentRateB} onDescentRateChange={setDescentRateB}
                ascentRate={ascentRateB} onAscentRateChange={setAscentRateB}
                ppO2Max={ppO2MaxB} onPpO2MaxChange={setPpO2MaxB}
                ppO2Deco={ppO2DecoB} onPpO2DecoChange={setPpO2DecoB}
                decoGas1={decoGas1B} onDecoGas1Change={setDecoGas1B}
                decoGas2={decoGas2B} onDecoGas2Change={setDecoGas2B}
                gasSwitchTime={gasSwitchTimeB} onGasSwitchTimeChange={setGasSwitchTimeB}
                color="#ff9800"
              />
            </div>
          )}
        </div>

        {/* 3. Graph */}
        <div className="chart-panel">
          <DiveChart 
            profiles={compareMode ? [
              { points: resultA?.points || [], color: '#4fc3f7', label: 'Algorithm A' },
              { points: resultB?.points || [], color: '#ff9800', label: 'Algorithm B' }
            ] : [
              { points: resultA?.points || [], color: '#4fc3f7', label: 'Dive Profile' }
            ]}
            modLines={modLines}
          />
        </div>

        {/* 4. Summary */}
        <div className={`algorithm-panels ${compareMode ? 'compare' : 'single'}`}>
          <div className="algorithm-panel panel-a">
            <DiveSummary
              stops={stops} totalTime={resultA?.totalTime || 0}
              decoInfo={resultA?.decoInfo} color="#4fc3f7"
              compareWith={compareMode && timeDifference ? `${timeDifference} vs B` : null}
              modViolation={modViolationA}
              mod={algorithmA !== 'none' ? calcMOD(fO2A, ppO2MaxA) : null}
            />
          </div>
          {compareMode && (
            <div className="algorithm-panel panel-b">
              <DiveSummary
                stops={stops} totalTime={resultB?.totalTime || 0}
                decoInfo={resultB?.decoInfo} color="#ff9800"
                compareWith={timeDifference ? `${timeDifference.replace('+', '').replace('-', '+')} vs A` : null}
                modViolation={modViolationB}
                mod={algorithmB !== 'none' ? calcMOD(fO2B, ppO2MaxB) : null}
              />
            </div>
          )}
        </div>

        {/* 5. Dive Plan */}
        <div className={`algorithm-panels ${compareMode ? 'compare' : 'single'}`}>
          <div className="algorithm-panel panel-a">
            <DiveTable phases={resultA?.phases || []} color="#4fc3f7" />
          </div>
          {compareMode && (
            <div className="algorithm-panel panel-b">
              <DiveTable phases={resultB?.phases || []} color="#ff9800" />
            </div>
          )}
        </div>

        {/* 6. Share */}
        <ShareLink />
      </main>

      <footer className="app-footer">
        <div className="footer-content">
          <span>Made by <a href="https://github.com/s4mur4i" target="_blank" rel="noopener noreferrer">S4mur4i</a></span>
          <span>•</span>
          <a href="https://github.com/s4mur4i/decompression-compare-app" target="_blank" rel="noopener noreferrer">GitHub</a>
        </div>
      </footer>
    </div>
  );
}

export default App;
