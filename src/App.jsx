import { useState, useEffect, useMemo, useReducer, useTransition, lazy, Suspense, memo } from 'react';
import DiveChart from './components/DiveChart';
import DiveStops from './components/DiveStops';
import DiveSettings from './components/DiveSettings';
import DiveSummary from './components/DiveSummary';
import DiveTable from './components/DiveTable';
import ShareLink from './components/ShareLink';
import TissueChart from './components/TissueChart';
import GFExplorer from './components/GFExplorer';
import SupersatDisplay from './components/SupersatDisplay';
import ErrorBoundary from './components/ErrorBoundary';
import InstallPrompt from './components/InstallPrompt';

// Lazy-loaded educational components
const AlgorithmInfo = lazy(() => import('./components/AlgorithmInfo'));
const BubbleChart = lazy(() => import('./components/BubbleChart'));
const NDLTable = lazy(() => import('./components/NDLTable'));

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
import { calculateCNS, calculateOTU } from './utils/oxygenToxicity';
import { calculateGasConsumption, calculateRockBottom, calculateTurnPressure } from './utils/gasPlanning';
import { findNDLForProfile } from './utils/ndl';
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
  sacRate: 20,
  tankSize: 24,
  tankPressure: 200,
  reservePressure: 50,
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

// Memoized pure components
const MemoizedDiveStops = memo(DiveStops);
const MemoizedDiveSettings = memo(DiveSettings);
const MemoizedDiveChart = memo(DiveChart);
const MemoizedDiveSummary = memo(DiveSummary);
const MemoizedDiveTable = memo(DiveTable);
const MemoizedTissueChart = memo(TissueChart);
const MemoizedGFExplorer = memo(GFExplorer);
const MemoizedSupersatDisplay = memo(SupersatDisplay);

const LazyFallback = () => <div className="loading-indicator"><span className="spinner" /> Loading…</div>;

function App() {
  const [stops, setStops] = useState([]);
  const [mode, setMode] = useState('single');
  const [settingsA, dispatchA] = useReducer(settingsReducer, DEFAULT_SETTINGS);
  const [settingsB, dispatchB] = useReducer(settingsReducer, { ...DEFAULT_SETTINGS, algorithm: 'zhl16c' });
  const [learningAlgo, setLearningAlgo] = useState('zhl16c');
  const [initialized, setInitialized] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [isPending, startTransition] = useTransition();

  const compareMode = mode === 'compare';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : '');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  const setA = (key, value) => startTransition(() => dispatchA({ type: 'SET', key, value }));
  const setB = (key, value) => startTransition(() => dispatchB({ type: 'SET', key, value }));

  const calcMOD = (fO2, ppO2) => fO2 > 0 ? Math.floor(10 * (ppO2 / fO2 - 1)) : 0;

  const runAlgorithm = (settings, phases) => {
    const { algorithm, fO2, fHe, gfLow, gfHigh, ascentRate, decoGas1, decoGas2, ppO2Deco } = settings;
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
    const { descentRate, ascentRate, decoAscentRate = 9, gasSwitchTime, lastStopDepth = 6 } = settings;
    const profile = calculateDiveProfile(stops, descentRate, ascentRate);
    const decoInfo = runAlgorithm(settings, profile.phases);
    if (decoInfo) {
      const adjustedStops = gasSwitchTime
        ? decoInfo.decoStops.map(s => s.gasSwitch ? { ...s, time: 1 } : s)
        : decoInfo.decoStops;
      const fullProfile = addAscentPhases(profile, adjustedStops, decoAscentRate);
      return { ...fullProfile, decoInfo };
    } else {
      // No algorithm or no deco: add safety stop for no-deco dives
      const fullProfile = simpleAscent(profile, ascentRate, lastStopDepth);
      return { ...fullProfile, decoInfo };
    }
  };

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
    if (get('sac')) s.sacRate = Number(get('sac'));
    if (get('tank')) s.tankSize = Number(get('tank'));
    if (get('tp')) s.tankPressure = Number(get('tp'));
    return s;
  };

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('plan')) setStops(parsePlan(p.get('plan')));
    
    if (p.get('mode') === 'compare') {
      setMode('compare');
      dispatchA({ type: 'MERGE', payload: parseSettingsFromURL(p, 'A') });
      dispatchB({ type: 'MERGE', payload: parseSettingsFromURL(p, 'B') });
    } else if (p.get('mode') === 'learning') {
      setMode('learning');
    } else {
      dispatchA({ type: 'MERGE', payload: parseSettingsFromURL(p) });
    }
    setInitialized(true);
  }, []);

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
    if (settings.sacRate !== def.sacRate) set('sac', settings.sacRate);
    if (settings.tankSize !== def.tankSize) set('tank', settings.tankSize);
    if (settings.tankPressure !== def.tankPressure) set('tp', settings.tankPressure);
  };

  useEffect(() => {
    if (!initialized) return;
    const p = new URLSearchParams();
    if (stops.length > 0) p.set('plan', stops.map(s => `${s.depth}:${s.time}`).join(','));
    
    if (compareMode) {
      p.set('mode', 'compare');
      serializeSettingsToURL(p, settingsA, 'A');
      serializeSettingsToURL(p, settingsB, 'B');
    } else if (mode === 'learning') {
      p.set('mode', 'learning');
    } else {
      serializeSettingsToURL(p, settingsA);
    }
    window.history.replaceState(null, '', `${window.location.pathname}?${p.toString()}`);
  }, [stops, mode, settingsA, settingsB, initialized]);

  const resultA = useMemo(() => calculateFull(settingsA), [stops, settingsA]);
  const resultB = useMemo(() => {
    if (!compareMode) return null;
    return calculateFull(settingsB);
  }, [stops, compareMode, settingsB]);

  // O2 toxicity tracking
  const o2DataA = useMemo(() => {
    if (!resultA?.phases) return null;
    const cns = calculateCNS(resultA.phases, settingsA.fO2, settingsA.fHe);
    const otu = calculateOTU(resultA.phases, settingsA.fO2, settingsA.fHe);
    return { cns, otu };
  }, [resultA, settingsA.fO2, settingsA.fHe]);

  const o2DataB = useMemo(() => {
    if (!compareMode || !resultB?.phases) return null;
    const cns = calculateCNS(resultB.phases, settingsB.fO2, settingsB.fHe);
    const otu = calculateOTU(resultB.phases, settingsB.fO2, settingsB.fHe);
    return { cns, otu };
  }, [compareMode, resultB, settingsB.fO2, settingsB.fHe]);

  // Gas consumption
  const gasDataA = useMemo(() => {
    if (!resultA?.phases) return null;
    const sacRate = settingsA.sacRate || 20;
    const tankSize = settingsA.tankSize || 24;
    const tankPressure = settingsA.tankPressure || 200;
    const reservePressure = settingsA.reservePressure || 50;
    const consumption = calculateGasConsumption(resultA.phases, sacRate, settingsA.fO2, settingsA.fHe);
    const rockBottom = calculateRockBottom(resultA.phases, sacRate, tankSize);
    const turnPressure = calculateTurnPressure(tankPressure, reservePressure, consumption.totalLiters, tankSize);
    return { consumption, rockBottom, turnPressure };
  }, [resultA, settingsA]);

  const gasDataB = useMemo(() => {
    if (!compareMode || !resultB?.phases) return null;
    const sacRate = settingsB.sacRate || 20;
    const tankSize = settingsB.tankSize || 24;
    const tankPressure = settingsB.tankPressure || 200;
    const reservePressure = settingsB.reservePressure || 50;
    const consumption = calculateGasConsumption(resultB.phases, sacRate, settingsB.fO2, settingsB.fHe);
    const rockBottom = calculateRockBottom(resultB.phases, sacRate, tankSize);
    const turnPressure = calculateTurnPressure(tankPressure, reservePressure, consumption.totalLiters, tankSize);
    return { consumption, rockBottom, turnPressure };
  }, [compareMode, resultB, settingsB]);

  // NDL calculation
  const ndlA = useMemo(() => {
    if (!stops.length || settingsA.algorithm === 'none') return null;
    const entry = ALGORITHM_REGISTRY[settingsA.algorithm];
    if (!entry?.fn) return null;
    return findNDLForProfile(stops, entry.fn, settingsA);
  }, [stops, settingsA]);

  const timeDifference = useMemo(() => {
    if (!compareMode || !resultA || !resultB) return null;
    const diff = resultB.totalTime - resultA.totalTime;
    if (diff === 0) return null;
    return `${diff > 0 ? '+' : ''}${diff} min`;
  }, [compareMode, resultA, resultB]);

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

  const learningSettings = useMemo(() => ({
    ...DEFAULT_SETTINGS,
    algorithm: learningAlgo,
  }), [learningAlgo]);

  const learningAlgoFn = ALGORITHM_REGISTRY[learningAlgo]?.fn;

  return (
    <div className="app">
      <InstallPrompt />
      <header className="app-header">
        <h1>🤿 Decompression Compare</h1>
        <p className="subtitle">Dive profile planner & algorithm comparison tool</p>
        <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <div className="mode-toggle">
          <button className={`mode-btn ${mode === 'single' ? 'active' : ''}`} onClick={() => setMode('single')}>Single</button>
          <button className={`mode-btn ${mode === 'compare' ? 'active' : ''}`} onClick={() => setMode('compare')}>Compare</button>
          <button className={`mode-btn ${mode === 'learning' ? 'active' : ''}`} onClick={() => setMode('learning')}>📚 Learning</button>
        </div>
      </header>

      <main className="app-main">
        {mode === 'learning' ? (
          <ErrorBoundary section="Learning Mode">
            <div className="learning-mode">
              <div className="learning-algo-selector">
                <label>
                  Algorithm for NDL Table:
                  <select
                    className="algo-select"
                    value={learningAlgo}
                    onChange={e => setLearningAlgo(e.target.value)}
                  >
                    {Object.entries(ALGORITHM_REGISTRY).filter(([k, v]) => v.fn).map(([key, val]) => (
                      <option key={key} value={key}>{val.name}</option>
                    ))}
                  </select>
                </label>
              </div>
              <Suspense fallback={<LazyFallback />}>
                <NDLTable
                  algorithmFn={learningAlgoFn}
                  settings={learningSettings}
                  algorithmName={ALGORITHM_REGISTRY[learningAlgo]?.name}
                />
                <AlgorithmInfo theme={theme} />
                <BubbleChart theme={theme} />
              </Suspense>
            </div>
          </ErrorBoundary>
        ) : (
          <>
            <div className="shared-controls">
              <MemoizedDiveStops stops={stops} onStopsChange={setStops} />
            </div>

            <div className={`algorithm-panels ${compareMode ? 'compare' : 'single'}`}>
              <div className="algorithm-panel panel-a">
                {compareMode && <div className="panel-header"><span className="panel-label">Algorithm A</span></div>}
                <ErrorBoundary section="Settings">
                  <MemoizedDiveSettings
                    settings={settingsA}
                    onChange={(key, value) => setA(key, value)}
                    color="#4fc3f7"
                  />
                </ErrorBoundary>
              </div>
              {compareMode && (
                <div className="algorithm-panel panel-b">
                  <div className="panel-header"><span className="panel-label">Algorithm B</span></div>
                  <ErrorBoundary section="Settings B">
                    <MemoizedDiveSettings
                      settings={settingsB}
                      onChange={(key, value) => setB(key, value)}
                      color="#ff9800"
                    />
                  </ErrorBoundary>
                </div>
              )}
            </div>

            <ErrorBoundary section="Chart">
              <div className="chart-panel">
                {isPending && <div className="loading-indicator"><span className="spinner" /> Calculating…</div>}
                <MemoizedDiveChart 
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
            </ErrorBoundary>

            <ErrorBoundary section="Tissue Chart">
              <MemoizedTissueChart
                decoInfoA={resultA?.decoInfo}
                decoInfoB={resultB?.decoInfo}
                compareMode={compareMode}
                theme={theme}
              />
            </ErrorBoundary>

            <ErrorBoundary section="GF Explorer">
              <MemoizedGFExplorer settings={settingsA} profilePoints={resultA?.points} profilePhases={resultA?.phases} theme={theme} />
            </ErrorBoundary>

            {/* Summary */}
            <div className={`algorithm-panels ${compareMode ? 'compare' : 'single'}`}>
              <div className="algorithm-panel panel-a">
                <ErrorBoundary section="Summary">
                  <MemoizedDiveSummary
                    stops={stops} totalTime={resultA?.totalTime || 0}
                    decoInfo={resultA?.decoInfo} color="#4fc3f7"
                    compareWith={compareMode && timeDifference ? `${timeDifference} vs B` : null}
                    modViolation={modViolationA}
                    mod={settingsA.algorithm !== 'none' ? calcMOD(settingsA.fO2, settingsA.ppO2Max) : null}
                    o2Data={o2DataA}
                    gasData={gasDataA}
                    ndl={ndlA}
                    settings={settingsA}
                  />
                </ErrorBoundary>
              </div>
              {compareMode && (
                <div className="algorithm-panel panel-b">
                  <ErrorBoundary section="Summary B">
                    <MemoizedDiveSummary
                      stops={stops} totalTime={resultB?.totalTime || 0}
                      decoInfo={resultB?.decoInfo} color="#ff9800"
                      compareWith={timeDifference ? `${timeDifference.replace('+', '').replace('-', '+')} vs A` : null}
                      modViolation={modViolationB}
                      mod={settingsB.algorithm !== 'none' ? calcMOD(settingsB.fO2, settingsB.ppO2Max) : null}
                      o2Data={o2DataB}
                      gasData={gasDataB}
                      settings={settingsB}
                    />
                  </ErrorBoundary>
                </div>
              )}
            </div>

            {/* Supersaturation */}
            <div className={`algorithm-panels ${compareMode ? 'compare' : 'single'}`}>
              <div className="algorithm-panel panel-a">
                <ErrorBoundary section="Supersaturation">
                  <MemoizedSupersatDisplay
                    decoInfo={resultA?.decoInfo}
                    profilePoints={resultA?.points}
                    profilePhases={resultA?.phases}
                    settings={settingsA}
                    label={compareMode ? 'A' : ''}
                    color="#4fc3f7"
                  />
                </ErrorBoundary>
              </div>
              {compareMode && (
                <div className="algorithm-panel panel-b">
                  <ErrorBoundary section="Supersaturation B">
                    <MemoizedSupersatDisplay
                      decoInfo={resultB?.decoInfo}
                      profilePoints={resultB?.points}
                      profilePhases={resultB?.phases}
                      settings={settingsB}
                      label="B"
                      color="#ff9800"
                    />
                  </ErrorBoundary>
                </div>
              )}
            </div>

            {/* Dive Plan */}
            <div className={`algorithm-panels ${compareMode ? 'compare' : 'single'}`}>
              <div className="algorithm-panel panel-a">
                <ErrorBoundary section="Dive Plan">
                  <MemoizedDiveTable phases={resultA?.phases || []} color="#4fc3f7" settings={settingsA} />
                </ErrorBoundary>
              </div>
              {compareMode && (
                <div className="algorithm-panel panel-b">
                  <ErrorBoundary section="Dive Plan B">
                    <MemoizedDiveTable phases={resultB?.phases || []} color="#ff9800" settings={settingsB} />
                  </ErrorBoundary>
                </div>
              )}
            </div>

            <ShareLink />
          </>
        )}
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
