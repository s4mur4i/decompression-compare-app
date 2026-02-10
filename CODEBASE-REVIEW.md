# Decompression Compare App — Codebase Review

## Simplification Opportunities

### 1. Massive State Duplication in App.jsx — **HIGH**

App.jsx declares 24 individual `useState` hooks for A/B algorithm settings. Each parameter is duplicated with an A/B suffix. This is the single biggest source of complexity.

**Before (current — 24 useState calls):**
```js
const [algorithmA, setAlgorithmA] = useState('none');
const [fO2A, setFO2A] = useState(0.21);
const [fHeA, setFHeA] = useState(0);
const [gfLowA, setGfLowA] = useState(50);
// ... 12 more for A, then 12 identical for B
```

**After (useReducer or grouped state object):**
```js
const defaultSettings = {
  algorithm: 'none', fO2: 0.21, fHe: 0, gfLow: 50, gfHigh: 70,
  descentRate: 18, ascentRate: 9, ppO2Max: 1.4, ppO2Deco: 1.6,
  decoGas1: null, decoGas2: null, gasSwitchTime: true,
};

const [settingsA, setSettingsA] = useReducer(
  (state, patch) => ({ ...state, ...patch }), defaultSettings
);
const [settingsB, setSettingsB] = useReducer(
  (state, patch) => ({ ...state, ...patch }),
  { ...defaultSettings, algorithm: 'zhl16c' }
);
```

This cuts 24 useState hooks to 2, and DiveSettings gets a single `settings`/`onChange` prop pair instead of 24 individual props.

### 2. Duplicated Physics Functions Across All Algorithm Files — **HIGH**

Every algorithm file independently defines:
- `depthToPressure(depth)` — identical in all 7 files
- `inspiredPressure(depth, fGas)` — identical in all 7 files
- `schreiner()` / `haldaneEquation()` / `exponentialLoading()` / `exponentialUpdate()` — same function, 4 different names
- `P_SURFACE` (1.01325), `P_WATER_VAPOR` / `WATER_VAPOR_PRESSURE` (0.0627) — same constants, different names

**Refactoring:** Create `src/utils/physics.js`:
```js
export const P_SURFACE = 1.01325;
export const P_WATER_VAPOR = 0.0627;

export function depthToPressure(depth) {
  return P_SURFACE + depth / 10.0;
}

export function pressureToDepth(pressure) {
  return Math.max(0, (pressure - P_SURFACE) * 10.0);
}

export function inspiredPressure(depth, fGas) {
  return (depthToPressure(depth) - P_WATER_VAPOR) * fGas;
}

export function schreiner(p0, pi, time, halfTime) {
  if (time <= 0) return p0;
  const k = Math.LN2 / halfTime;
  return p0 + (pi - p0) * (1 - Math.exp(-k * time));
}
```

This eliminates ~120 lines of pure duplication across 7 files.

### 3. Duplicated Deco Stop Generation Loop — **HIGH**

The deco stop generation loop is nearly identical in all 7 algorithms:
1. Start at `firstStopDepth`, iterate down by 3m
2. Transit to stop, simulate tissue loading
3. Minute-by-minute simulation until `canAscend` to next stop
4. Record stop, update working tissue
5. Repeat until surface

**Refactoring:** Extract a generic `generateDecoStops()` function:
```js
export function generateDecoStops({
  firstStopDepth, phases, ascentRate, fN2,
  compartments, // array of half-times
  updateTissue,  // (tissue, pi, time, i) => newValue
  canAscendTo,   // (tissue, nextDepth) => boolean
}) {
  // ... single implementation of the loop
}
```

Each algorithm only needs to provide its `canAscendTo` check and tissue update function. This would eliminate ~80-100 lines per algorithm file.

### 4. URL Serialization/Deserialization Boilerplate — **MEDIUM**

The URL loading (useEffect) and URL sync (useEffect) together are ~80 lines of repetitive `p.get('key')` / `p.set('key', value)` calls. With grouped state (fix #1), this shrinks dramatically:

```js
const PARAM_MAP = {
  algorithm: { key: 'algo', default: 'none' },
  fO2: { key: 'o2', encode: v => Math.round(v * 100), decode: v => Number(v) / 100, default: 0.21 },
  // ...
};

function serializeSettings(settings, suffix = '') { /* generic */ }
function deserializeSettings(params, suffix = '') { /* generic */ }
```

### 5. `runAlgorithm` Dispatch Chain — **MEDIUM**

`runAlgorithm()` in App.jsx is a long if/else chain mapping algorithm names to functions. All Bühlmann variants already route through `calculateBuhlmann()` with a variant parameter.

**Refactoring:** Use a registry object:
```js
const ALGORITHM_FNS = {
  zhl16a: (phases, opts) => calculateBuhlmann(phases, opts.fO2, opts.gfLow, opts.gfHigh, opts.ascentRate, 'zhl16a', opts.fHe, opts.gasSwitches),
  vpm: (phases, opts) => calculateVPM(phases, opts.fO2, opts.gfLow, opts.gfHigh, opts.ascentRate, opts.fHe, opts.gasSwitches),
  haldane: (phases, opts) => calculateHaldane(phases, opts.fO2, opts.gfLow, opts.gfHigh, opts.ascentRate),
  // ...
};
```

Or better: make all algorithms accept the same `(phases, opts)` signature.

### 6. RGBM Duplicates ZHL-16C Compartment Data — **MEDIUM**

`rgbm.js` hardcodes its own `COMPARTMENTS` array with ZHL-16C a/b values (slightly different `a[0]` = 1.2599 vs buhlmann.js 1.1696 for 16C). It should import from buhlmann.js or a shared constants file.

### 7. Inconsistent Function Signatures — **LOW**

- Buhlmann variants: `(phases, fO2, gfLow, gfHigh, rate, fHe, gasSwitches)` — 7 positional args
- Haldane/Workman/Thalmann/DCIEM: `(phases, fO2, gfLow, gfHigh, ascentRate)` — 5 args, ignore gf params
- All should use a single options object: `(phases, { fO2, fHe, gfLow, gfHigh, ascentRate, gasSwitches })`

### 8. MOD Calculation Duplicated — **LOW**

`calcMOD` is defined in App.jsx and duplicated in DiveSettings.jsx (inline). Should be a shared utility.

### 9. DiveSettings Prop Explosion — **LOW**

DiveSettings takes 24 individual props. With grouped state (#1), this becomes:
```jsx
<DiveSettings settings={settingsA} onChange={setSettingsA} color="#4fc3f7" />
```

### 10. Magic Numbers — **LOW**

- `3` (deco stop interval in meters) is hardcoded everywhere — should be a constant `STOP_INTERVAL = 3`
- `999` (max deco loop iterations) — should be `MAX_DECO_MINUTES = 999`
- Gas switch default values (`0.50`, `1.0`) in DiveSettings

---

## Feature TODO

### UX Improvements

- [ ] **Dark/Light mode toggle** — currently dark-only (small)
- [ ] **Mobile responsiveness** — compare mode stacks on <900px but inputs are cramped (medium)
- [ ] **Keyboard shortcuts** — Enter to add stop, Delete to remove (small)
- [ ] **Drag-and-drop stop reordering** — replace ↑↓ buttons (medium)
- [ ] **Preset dive plans** — "30m/20min", "40m/30min" quick-load buttons (small)
- [ ] **Imperial units toggle** — feet/FSW support (medium)
- [ ] **Accessibility audit** — aria labels, color contrast, screen reader support (medium)
- [ ] **Undo/redo** — for stop changes and settings (medium)
- [ ] **Quick gas presets** — Air, EAN32, EAN36, Trimix 21/35 buttons (small)
- [ ] **Responsive chart** — currently fixed 500px height, bad on mobile (small)
- [ ] **Touch-friendly inputs** — larger touch targets on mobile (small)
- [ ] **Loading/calculating indicator** — for complex profiles (small)

### Algorithm Improvements

- [ ] **Validation against reference implementations** — compare with MultiDeco, Subsurface, V-Planner output (large)
- [ ] **VPM-B/E with full bubble tracking** — current VPM is simplified (large)
- [ ] **RGBM full Wienke implementation** — current uses simplified bubble factors (large)
- [ ] **Trimix support for VPM/RGBM** — currently Nitrox only (medium)
- [ ] **Multi-gas support for all algorithms** — Haldane/Workman/Thalmann/DCIEM lack it (medium)
- [ ] **Add DSAT (Recreational PADI)** — Spencer no-stop limits (medium)
- [ ] **Add US Navy Rev 7 tables** — new standard (medium)
- [ ] **Add BSAC '88 tables** — common in UK diving (medium)
- [ ] **GF support for VPM/RGBM** — they accept gf params but implement them differently (small)
- [ ] **Altitude diving correction** — adjust surface pressure for altitude (small)
- [ ] **Saltwater/freshwater toggle** — affects pressure conversion (small)

### Dive Planning Features

- [ ] **Multi-level dive profiles** — current stops are manual but no explicit multi-level planning (medium)
- [ ] **CNS O₂ toxicity tracking** — NOAA CNS clock per stop (medium)
- [ ] **OTU (Oxygen Tolerance Units)** — pulmonary O₂ toxicity tracking (medium)
- [ ] **Gas consumption calculation** — SAC rate → required gas volume per phase (medium)
- [ ] **Repetitive dive planning** — surface interval + second dive (large)
- [ ] **Bailout gas planning** — open circuit bailout for CCR divers (large)
- [ ] **CCR (Closed Circuit Rebreather) mode** — fixed ppO₂ setpoint (large)
- [ ] **Safety stop enforcement** — 3min @ 5m for no-deco dives (small)
- [ ] **NDL (No Decompression Limit) display** — show NDL for current depth/gas (small)
- [ ] **Min deco / min gas calculations** — rock bottom gas planning (medium)
- [ ] **Helium deco gas support** — trimix deco gases, not just nitrox (medium)
- [ ] **Turn pressure / gas management** — rule of thirds, etc. (small)

### Data & Export Features

- [ ] **Export dive plan as PDF** — formatted table + chart (medium)
- [ ] **Export as CSV** — phase-by-phase data (small)
- [ ] **Save/load profiles** — localStorage or account-based (medium)
- [ ] **Import from dive log formats** — UDDF, Subsurface XML (large)
- [ ] **Export to dive computer format** — for supported devices (large)
- [ ] **Screenshot/image export** — chart as PNG (small)
- [ ] **Print-friendly layout** — @media print CSS (small)
- [ ] **QR code sharing** — for mobile-to-mobile plan sharing (small)

### Educational Features

- [ ] **Tissue compartment visualization** — bar chart showing loading per compartment (medium)
- [ ] **Real-time ceiling line on chart** — show ceiling during dive (medium)
- [ ] **Algorithm explanation tooltips** — hover info for each algorithm (small)
- [ ] **"What-if" scenarios** — slider to adjust bottom time and see deco change live (medium)
- [ ] **GF explorer** — visualize how GF Low/High affect M-value lines (medium)
- [ ] **Supersaturation gradient display** — show how close each tissue is to limit (medium)
- [ ] **Side-by-side algorithm deep-dive** — educational page explaining differences (large)
- [ ] **Historical context** — timeline of decompression theory development (small)
- [ ] **Bubble mechanics visualization** — for VPM/RGBM understanding (large)
- [ ] **No-deco limit table generator** — generate NDL table for given gas mix (small)

### Technical Improvements

- [ ] **PWA support** — service worker, offline capability, installable (medium)
- [ ] **Web Worker for calculations** — move heavy computation off main thread (medium)
- [ ] **React context for state** — replace prop drilling, enable useContext (medium)
- [ ] **TypeScript migration** — type safety for algorithm parameters (large)
- [ ] **Unit tests for all algorithms** — currently only basic tests exist (medium)
- [ ] **Integration tests** — full flow: stops → algorithm → chart (medium)
- [ ] **Performance profiling** — useMemo dependency arrays are huge (small)
- [ ] **Code splitting** — lazy-load algorithm files (small)
- [ ] **Storybook for components** — visual component documentation (medium)
- [ ] **E2E tests** — Playwright/Cypress for critical user flows (medium)
- [ ] **Error boundaries** — graceful failure for invalid inputs (small)
- [ ] **i18n support** — internationalization framework (large)
- [ ] **SEO/meta tags** — Open Graph for shared links (small)
- [ ] **Analytics** — anonymous usage stats for feature prioritization (small)
