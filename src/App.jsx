import { useState, useEffect, useMemo, useReducer, useTransition } from 'react';
import DiveChart from './components/DiveChart';
import DiveStops from './components/DiveStops';
import DiveSettings from './components/DiveSettings';
import DiveSummary from './components/DiveSummary';
import DiveTable from './components/DiveTable';
import ShareLink from './components/ShareLink';
import TissueChart from './components/TissueChart';
import GFExplorer from './components/GFExplorer';
import SupersatDisplay from './components/SupersatDisplay';
import AlgorithmInfo from './components/AlgorithmInfo';
import BubbleChart from './components/BubbleChart';
import NDLTable from './components/NDLTable';
import { calculateDiveProfile, addAscentPhases, simpleAscent, parsePlan } from './utils/diveProfile';
import { calculateZHL16A, calculateZHL16B, calculateZHL16C, calculateZHL12, calculateZHL6, calculateZHL8ADT } from './utils/buhlmann';
import { calculateVPM } from './utils/vpm';
import { calculateRGBM } from './utils/rgbm';
import { calculateHaldane } from './utils/haldane';
import { calculateWorkman } from './utils/workman';
import { calculateThalmann } from './utils/thalmann';
import { calculateDCIEM } from './utils/dciem';
import { calculateDSAT } from './utils/dsat';
import { calculateUSNavy } from './utils/usnavy';
import { calculateBSAC } from './utils/bsac';
import { calculateCeilingTimeline } from './utils/ceiling';
import './App.css';

const DEFAULT_SETTINGS = {
  algorithm: 'none',
  fO2: 0.21,
  fHe: 0,
  gfLow: 50,
  gfHigh: 70,
  descentRate: 18,
  ascentRate: 9,
  decoAscentRate: 9,
  ppO2Max: 1.4,
  ppO2Deco: 1.6,
  decoGas1: null,
  decoGas2: null,
  gasSwitchTime: true,
  lastStopDepth: 6,
};

function settingsReducer(state, action) {
  if (action.type === 'SET') {
    return { ...state, [action.key]: action.value };
  }
  if (action.type === 'MERGE') {
    return { ...state, ...action.payload };
  }
  return state;
}

const ALGORITHM_REGISTRY = {
  none:     { fn: null,              name: 'No Algorithm',       description: 'Direct ascent, no deco calculation',                          trimix: false, multiGas: false, gf: false },
  zhl16a:   { fn: calculateZHL16A,   name: 'ZH-L 16A',          description: 'Original experimental (1986). Trimix + multi-gas.',           trimix: true,  multiGas: true,  gf: true },
  zhl16b:   { fn: calculateZHL16B,   name: 'ZH-L 16B',          description: 'For printed tables. Trimix + multi-gas.',                     trimix: true,  multiGas: true,  gf: true },
  zhl16c:   { fn: calculateZHL16C,   name: 'ZH-L 16C',          description: 'For dive computers. Most widely used. Trimix + multi-gas.',   trimix: true,  multiGas: true,  gf: true },
  zhl12:    { fn: calculateZHL12,    name: 'ZH-L 12',           description: 'Original 1983 version. Trimix + multi-gas.',                  trimix: true,  multiGas: true,  gf: true },
  zhl6:     { fn: calculateZHL6,     name: 'ZH-L 6',            description: 'Simplified 6-compartment. Trimix + multi-gas.',               trimix: true,  multiGas: true,  gf: true },
  zhl8adt:  { fn: calculateZHL8ADT,  name: 'ZH-L 8 ADT',        description: '8-compartment adaptive. Trimix + multi-gas.',                 trimix: true,  multiGas: true,  gf: true },
  vpm:      { fn: calculateVPM,      name: 'VPM-B',             description: 'Bubble mechanics model. Deeper first stops. Nitrox only.',    trimix: false, multiGas: false, gf: true },
  rgbm:     { fn: calculateRGBM,     name: 'RGBM',              description: 'Dual-phase bubble model. Nitrox only.',                       trimix: false, multiGas: false, gf: true },
  haldane:  { fn: calculateHaldane,  name: 'Haldane (1908)',     description: '5 compartments, 2:1 ratio. Air/Nitrox only.',                 trimix: false, multiGas: false, gf: false },
  workman:  { fn: calculateWorkman,  name: 'Workman (1965)',     description: 'US Navy M-values. 9 compartments. Air/Nitrox only.',          trimix: false, multiGas: false, gf: false },
  thalmann: { fn: calculateThalmann, name: 'Thalmann VVAL-18',  description: 'US Navy asymmetric kinetics. Air/Nitrox only.',               trimix: false, multiGas: false, gf: false },
  dciem:    { fn: calculateDCIEM,    name: 'DCIEM',             description: 'Canadian serial compartments. Very conservative. Air/Nitrox.', trimix: false, multiGas: false, gf: false },
  dsat:     { fn: calculateDSAT,    name: 'DSAT/PADI',         description: 'Recreational NDL-only. No deco calculation — indicates if NDL exceeded.', trimix: false, multiGas: false, gf: false },
  usnavy:   { fn: calculateUSNavy,  name: 'US Navy Rev 7',     description: 'Table-based USN Diving Manual Rev 7. Air only.',                        trimix: false, multiGas: false, gf: false },
  bsac:     { fn: calculateBSAC,    name: 'BSAC \'88',        description: 'British Sub-Aqua Club 1988 tables. Air only.',                           trimix: false, multiGas: false, gf: false },
};

function App() {
  const [stops, setStops] = useState([]);
  const [compareMode, setCompareMode] = useState(false);
  const [showLearning, setShowLearning] = useState(false);
  const [settingsA, dispatchA] = useReducer(settingsReducer, DEFAULT_SETTINGS);
  const [settingsB, dispatchB] = useReducer(settingsReducer, { ...DEFAULT_SETTINGS, algorithm: 'zhl16c' });
  const [initialized, setInitialized] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [isPending, startTransition] = useTransition();

  // Theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : '');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  const setA = (key, value) => startTransition(() => dispatchA({ type: 'SET', key, value }));
  const setB = (key, value) => startTransition(() => dispatchB({ type: 'SET', key, value }));
  const onChangeA = (key) => (value) => setA(key, value);
  const onChangeB = (key) => (value) => setB(key, value);

  // MOD calculation
  const calcMOD = (fO2, ppO2) => fO2 > 0 ? Math.floor(10 * (ppO2 / fO2 - 1)) : 0;

  const runAlgorithm = (settings, phases) => {
    const { algorithm, fO2, fHe, gfLow, gfHigh, ascentRate, decoGas1, decoGas2, ppO2Deco } = settings;
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

    const decoAscentRate = settings.decoAscentRate || ascentRate;
    const opts = { fO2, fHe, gfLow, gfHigh, ascentRate, decoAscentRate, gasSwitches, lastStopDepth: settings.lastStopDepth || 6 };
    const entry = ALGORITHM_REGISTRY[algorithm];
    if (!entry || !entry.fn) return null;
    return entry.fn(phases, opts);
  };

  const calculateFull = (settings) => {
    if (stops.length === 0) return null;
    const { descentRate, ascentRate, decoAscentRate = 9, gasSwitchTime } = settings;
    const profile = calculateDiveProfile(stops, descentRate, ascentRate);
    const decoInfo = runAlgorithm(settings, profile.phases);
    if (decoInfo) {
      const adjustedStops = gasSwitchTime
        ? decoInfo.decoStops.map(s => s.gasSwitch ? { ...s, time: 1 } : s)
        : decoInfo.decoStops;
      const fullProfile = addAscentPhases(profile, adjustedStops, decoAscentRate);
      return { ...fullProfile, decoInfo };
    } else {
      const fullProfile = simpleAscent(profile, ascentRate);
      return { ...fullProfile, decoInfo };
    }
  };

  // Helper to parse settings from URL params
  const parseSettingsFromURL = (p, suffix = '') => {
    const s = {};
    const get = (key) => p.get(key + suffix);
    if (get('algo')) s.algorithm = get('algo');
    if (get('o2')) s.fO2 = Number(get('o2')) / 100;
    if (get('he')) s.fHe = Number(get('he')) / 100;
    if (get('gfl')) s.gfLow = Number(get('gfl'));
    if (get('gfh')) s.gfHigh = Number(get('gfh'));
    if (get('descent')) s.descentRate = Number(get('descent'));
    if (get('ascent')) s.ascentRate = Number(get('ascent'));
    if (get('dascent')) s.decoAscentRate = Number(get('dascent'));
    if (get('ppo2')) s.ppO2Max = Number(get('ppo2'));
    if (get('ppo2d')) s.ppO2Deco = Number(get('ppo2d'));
    if (get('s1')) s.decoGas1 = { fO2: Number(get('s1')) / 100 };
    if (get('s2')) s.decoGas2 = { fO2: Number(get('s2')) / 100 };
    if (get('gst') === '0') s.gasSwitchTime = false;
    if (get('lsd')) s.lastStopDepth = Number(get('lsd'));
    return s;
  };

  // URL loading
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('plan')) setStops(parsePlan(p.get('plan')));
    
    if (p.get('mode') === 'compare') {
      setCompareMode(true);
      dispatchA({ type: 'MERGE', payload: parseSettingsFromURL(p, 'A') });
      dispatchB({ type: 'MERGE', payload: parseSettingsFromURL(p, 'B') });
    } else {
      dispatchA({ type: 'MERGE', payload: parseSettingsFromURL(p) });
    }
    setInitialized(true);
  }, []);

  // Helper to serialize settings to URL params
  const serializeSettingsToURL = (p, settings, suffix = '') => {
    const def = DEFAULT_SETTINGS;
    const set = (key, val) => p.set(key + suffix, val);
    if (settings.algorithm !== def.algorithm) set('algo', settings.algorithm);
    if (settings.fO2 !== def.fO2) set('o2', Math.round(settings.fO2 * 100));
    if (settings.fHe > 0) set('he', Math.round(settings.fHe * 100));
    if (settings.gfLow !== def.gfLow) set('gfl', settings.gfLow);
    if (settings.gfHigh !== def.gfHigh) set('gfh', settings.gfHigh);
    if (settings.descentRate !== def.descentRate) set('descent', settings.descentRate);
    if (settings.ascentRate !== def.ascentRate) set('ascent', settings.ascentRate);
    if (settings.decoAscentRate !== def.decoAscentRate) set('dascent', settings.decoAscentRate);
    if (settings.ppO2Max !== def.ppO2Max) set('ppo2', settings.ppO2Max);
    if (settings.ppO2Deco !== def.ppO2Deco) set('ppo2d', settings.ppO2Deco);
    if (settings.decoGas1) set('s1', Math.round(settings.decoGas1.fO2 * 100));
    if (settings.decoGas2) set('s2', Math.round(settings.decoGas2.fO2 * 100));
    if (!settings.gasSwitchTime) set('gst', '0');
    if (settings.lastStopDepth !== def.lastStopDepth) set('lsd', settings.lastStopDepth);
  };

  // URL sync
  useEffect(() => {
    if (!initialized) return;
    const p = new URLSearchParams();
    if (stops.length > 0) p.set('plan', stops.map(s => `${s.depth}:${s.time}`).join(','));
    
    if (compareMode) {
      p.set('mode', 'compare');
      serializeSettingsToURL(p, settingsA, 'A');
      serializeSettingsToURL(p, settingsB, 'B');
    } else {
      serializeSettingsToURL(p, settingsA);
    }
    window.history.replaceState(null, '', `${window.location.pathname}?${p.toString()}`);
  }, [stops, compareMode, settingsA, settingsB, initialized]);

  // Results
  const resultA = useMemo(() => {
    return calculateFull(settingsA);
  }, [stops, settingsA]);

  const resultB = useMemo(() => {
    if (!compareMode) return null;
    return calculateFull(settingsB);
  }, [stops, compareMode, settingsB]);

  const timeDifference = useMemo(() => {
    if (!compareMode || !resultA || !resultB) return null;
    const diff = resultB.totalTime - resultA.totalTime;
    if (diff === 0) return null;
    return `${diff > 0 ? '+' : ''}${diff} min`;
  }, [compareMode, resultA, resultB]);

  // MOD lines for chart
  const modLines = useMemo(() => {
    const lines = [];
    
    if (settingsA.algorithm !== 'none') {
      const modA = calcMOD(settingsA.fO2, settingsA.ppO2Max);
      lines.push({ depth: modA, color: '#ff4444', dash: [6, 4], label: `MOD ${modA}m (ppO₂ ${settingsA.ppO2Max})` });
      if (settingsA.decoGas1?.fO2) {
        const d = calcMOD(settingsA.decoGas1.fO2, settingsA.ppO2Deco);
        lines.push({ depth: d, color: '#888888', dash: [4, 4], label: `S1 switch ${d}m` });
      }
      if (settingsA.decoGas2?.fO2) {
        const d = calcMOD(settingsA.decoGas2.fO2, settingsA.ppO2Deco);
        lines.push({ depth: d, color: '#666666', dash: [4, 4], label: `S2 switch ${d}m` });
      }
    }
    
    if (compareMode && settingsB.algorithm !== 'none') {
      const modB = calcMOD(settingsB.fO2, settingsB.ppO2Max);
      const modA = settingsA.algorithm !== 'none' ? calcMOD(settingsA.fO2, settingsA.ppO2Max) : -1;
      if (modB !== modA) {
        lines.push({ depth: modB, color: '#ff8800', dash: [6, 4], label: `MOD ${modB}m (B)` });
      }
      if (settingsB.decoGas1?.fO2) {
        const d = calcMOD(settingsB.decoGas1.fO2, settingsB.ppO2Deco);
        lines.push({ depth: d, color: '#aa7744', dash: [4, 4], label: `B S1 switch ${d}m` });
      }
      if (settingsB.decoGas2?.fO2) {
        const d = calcMOD(settingsB.decoGas2.fO2, settingsB.ppO2Deco);
        lines.push({ depth: d, color: '#886633', dash: [4, 4], label: `B S2 switch ${d}m` });
      }
    }
    
    return lines;
  }, [settingsA, settingsB, compareMode]);

  // MOD violation check
  const modViolationA = useMemo(() => {
    if (settingsA.algorithm === 'none' || stops.length === 0) return false;
    const maxDepth = Math.max(...stops.map(s => s.depth));
    return maxDepth > calcMOD(settingsA.fO2, settingsA.ppO2Max);
  }, [settingsA, stops]);

  const modViolationB = useMemo(() => {
    if (!compareMode || settingsB.algorithm === 'none' || stops.length === 0) return false;
    const maxDepth = Math.max(...stops.map(s => s.depth));
    return maxDepth > calcMOD(settingsB.fO2, settingsB.ppO2Max);
  }, [compareMode, settingsB, stops]);

  const ceilingLines = useMemo(() => {
    const lines = [];
    if (resultA?.points && settingsA.algorithm !== 'none') {
      lines.push({
        data: calculateCeilingTimeline(resultA.points, settingsA),
        color: '#ff6b35',
        label: compareMode ? 'Ceiling A' : 'Ceiling',
      });
    }
    if (compareMode && resultB?.points && settingsB.algorithm !== 'none') {
      lines.push({
        data: calculateCeilingTimeline(resultB.points, settingsB),
        color: '#ff4081',
        label: 'Ceiling B',
      });
    }
    return lines;
  }, [resultA, resultB, settingsA, settingsB, compareMode]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>🤿 Decompression Compare</h1>
        <p className="subtitle">Dive profile planner & algorithm comparison tool</p>
        <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
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
              settings={settingsA}
              onChange={(key, value) => setA(key, value)}
              color="#4fc3f7"
            />
          </div>
          {compareMode && (
            <div className="algorithm-panel panel-b">
              <div className="panel-header"><span className="panel-label">Algorithm B</span></div>
              <DiveSettings
                settings={settingsB}
                onChange={(key, value) => setB(key, value)}
                color="#ff9800"
              />
            </div>
          )}
        </div>

        {/* 3. Graph */}
        <div className="chart-panel">
          {isPending && <div className="loading-indicator"><span className="spinner" /> Calculating…</div>}
          <DiveChart 
            theme={theme}
            profiles={compareMode ? [
              { points: resultA?.points || [], color: '#4fc3f7', label: 'Algorithm A' },
              { points: resultB?.points || [], color: '#ff9800', label: 'Algorithm B' }
            ] : [
              { points: resultA?.points || [], color: '#4fc3f7', label: 'Dive Profile' }
            ]}
            modLines={modLines}
            ceilingLines={ceilingLines}
          />
        </div>

        {/* 3b. Tissue Chart */}
        <TissueChart
          decoInfoA={resultA?.decoInfo}
          decoInfoB={resultB?.decoInfo}
          compareMode={compareMode}
          theme={theme}
        />

        {/* 3c. GF Explorer */}
        <GFExplorer settings={settingsA} theme={theme} />

        {/* 4. Summary */}
        <div className={`algorithm-panels ${compareMode ? 'compare' : 'single'}`}>
          <div className="algorithm-panel panel-a">
            <DiveSummary
              stops={stops} totalTime={resultA?.totalTime || 0}
              decoInfo={resultA?.decoInfo} color="#4fc3f7"
              compareWith={compareMode && timeDifference ? `${timeDifference} vs B` : null}
              modViolation={modViolationA}
              mod={settingsA.algorithm !== 'none' ? calcMOD(settingsA.fO2, settingsA.ppO2Max) : null}
            />
          </div>
          {compareMode && (
            <div className="algorithm-panel panel-b">
              <DiveSummary
                stops={stops} totalTime={resultB?.totalTime || 0}
                decoInfo={resultB?.decoInfo} color="#ff9800"
                compareWith={timeDifference ? `${timeDifference.replace('+', '').replace('-', '+')} vs A` : null}
                modViolation={modViolationB}
                mod={settingsB.algorithm !== 'none' ? calcMOD(settingsB.fO2, settingsB.ppO2Max) : null}
              />
            </div>
          )}
        </div>

        {/* 4b. Supersaturation */}
        <div className={`algorithm-panels ${compareMode ? 'compare' : 'single'}`}>
          <div className="algorithm-panel panel-a">
            <SupersatDisplay decoInfo={resultA?.decoInfo} label={compareMode ? 'A' : ''} color="#4fc3f7" />
          </div>
          {compareMode && (
            <div className="algorithm-panel panel-b">
              <SupersatDisplay decoInfo={resultB?.decoInfo} label="B" color="#ff9800" />
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

        {/* 7. Learning Tab */}
        <div className="learning-section">
          <button className="learning-tab-btn" onClick={() => setShowLearning(prev => !prev)}>
            {showLearning ? '▼' : '▶'} 📚 Learning Center
          </button>
          {showLearning && (
            <div className="learning-content">
              <NDLTable
                algorithmFn={ALGORITHM_REGISTRY[settingsA.algorithm]?.fn}
                settings={settingsA}
                algorithmName={ALGORITHM_REGISTRY[settingsA.algorithm]?.name}
              />
              <AlgorithmInfo theme={theme} />
              <BubbleChart theme={theme} />
            </div>
          )}
        </div>
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
