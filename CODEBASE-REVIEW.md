# Decompression Compare App — Feature Tracker

## UX Improvements

- [x] ~~Dark/Light mode toggle~~ ✅
- [x] ~~Mobile responsiveness~~ ✅
- [x] ~~Drag-and-drop stop reordering~~ ✅
- [x] ~~Quick gas presets~~ ✅ (EAN50, EAN80, O₂ for deco stages)
- [x] ~~Responsive charts~~ ✅ (min(350px, 50vh))
- [x] ~~Loading/calculating indicator~~ ✅
- [x] ~~Deco gas presets~~ ✅
- [x] ~~Last stop depth (3m/6m)~~ ✅
- [x] ~~Split ascent rates~~ ✅ (to first stop + during deco)
- [x] ~~Toggleable explanations (ℹ️)~~ ✅
- [x] ~~Per-stage tank configuration~~ ✅ (size, pressure, sufficiency indicators) — in progress
- [x] ~~Tab-based results layout~~ ✅ (Overview, Dive Plan, Gas Plan, O₂ Toxicity, Analysis) — in progress
- [ ] **Imperial units toggle** — feet/FSW support (medium)

## Algorithm Improvements

- [x] ~~14 algorithms implemented~~ ✅
  - Bühlmann ZHL-16A/B/C with GF
  - Bühlmann ZHL-16A/B/C Trimix (published He a/b values)
  - VPM-B (simplified bubble model with GF)
  - RGBM (simplified bubble reduction factors with GF)
  - Haldane original
  - Workman 1965
  - Thalmann EL algorithm
  - DCIEM tables
  - DSAT/PADI RDP tables
  - US Navy Rev 7 tables
  - BSAC '88 tables
- [x] ~~Comprehensive validation~~ ✅ (269 tests)
- [x] ~~GF support for VPM/RGBM~~ ✅
- [x] ~~Trimix for Bühlmann family~~ ✅
- [x] ~~Multi-gas deco~~ ✅ (up to 2 deco stages, auto MOD calculation)
- [ ] **VPM-B/E full bubble tracking** — proper Yount/Hoffman model (large)
- [ ] **RGBM full Wienke implementation** — proper bubble factors with He (large)

## Dive Planning Features

- [x] ~~CNS O₂ toxicity tracking~~ ✅ (NOAA CNS clock per phase, warnings at 80%/100%)
- [x] ~~OTU (Oxygen Tolerance Units)~~ ✅ (Lambertsen UPTD formula, 300 OTU warning)
- [x] ~~Gas consumption calculation~~ ✅ (SAC rate default 20, per-phase in dive table)
- [x] ~~Safety stop enforcement~~ ✅ (3min at last stop depth for no-deco dives)
- [x] ~~NDL display~~ ✅ (binary search, shown in summary)
- [x] ~~Rock bottom / min gas~~ ✅ (stress factor 2.0, emergency ascent + reserve)
- [x] ~~Turn pressure~~ ✅ (min gas rule, tank size/pressure settings)
- [ ] **Per-stage tank definitions** — tank size + fill pressure per gas, sufficiency (in progress)
- [ ] **Multi-level dive profiles** — explicit multi-level planning UI (medium)
- [ ] **Repetitive dive planning** — surface interval + second dive (large)
- [ ] **Bailout gas planning** — OC bailout for CCR (large)
- [ ] **CCR mode** — fixed ppO₂ setpoint (large)
- [ ] **Helium deco gas support** — trimix deco gases (medium)

## Educational Features

- [x] ~~Tissue compartment visualization~~ ✅ (blue N₂ / purple He bars, status badges)
- [x] ~~Real-time ceiling line on chart~~ ✅
- [x] ~~Algorithm explanation tooltips (ℹ️)~~ ✅
- [x] ~~GF Explorer~~ ✅ (M-value lines + GF envelope + dive trajectory, gas-switch-aware)
- [x] ~~Supersaturation display~~ ✅ (post-deco tissue state, raw M-values, gas-switch-aware)
- [x] ~~Algorithm deep-dive page~~ ✅ (all 7 algorithm families explained)
- [x] ~~Bubble mechanics visualization~~ ✅ (Boyle's law simulation)
- [x] ~~NDL table generator~~ ✅ (per-algorithm, with CNS%)
- [x] ~~Learning Center as top-level tab~~ ✅ (Single | Compare | 📚 Learning)

## Technical Improvements

- [x] ~~PWA support~~ ✅ (service worker, offline, installable Android/iOS)
- [x] ~~Web Worker for calculations~~ ✅ (with main-thread fallback)
- [x] ~~TypeScript types~~ ✅ (src/types/dive.ts, full interface definitions)
- [x] ~~Code splitting~~ ✅ (React.lazy for educational components)
- [x] ~~Error boundaries~~ ✅ (wrapping all major sections)
- [x] ~~SEO/meta tags~~ ✅ (OG, Twitter Card, JSON-LD)
- [x] ~~React.memo on pure components~~ ✅ (8 components)
- [x] ~~Dependabot~~ ✅ (npm + GitHub Actions weekly scanning)
- [x] ~~Shared gas timeline utility~~ ✅ (extracted from duplicated code)
- [x] ~~ceiling.js gas switch fix~~ ✅ (now uses phases for proper gas tracking)
- [x] ~~269 tests~~ ✅ (unit + integration + E2E)
  - Algorithm validation (39), edge cases (36), cross-algorithm (41)
  - Boundary tests, gas validation, CNS/OTU, gas planning
  - NDL accuracy, URL serialization, regression golden values
  - Stress tests (deep/long dives), gas timeline utility
  - 31+ E2E Playwright tests
- [ ] **Full TypeScript migration** — rename .js/.jsx to .ts/.tsx (large)
- [ ] **Integration tests expansion** — more full-flow tests (medium)
- [ ] **E2E expansion** — more Playwright scenarios (medium)

## Data & Export Features

- [ ] **Export dive plan as PDF** — formatted table + chart (medium)
- [ ] **Export as CSV** — phase-by-phase data (small)
- [ ] **Save/load profiles** — localStorage (medium)
- [ ] **Screenshot/image export** — chart as PNG (small)
- [ ] **Print-friendly layout** — @media print CSS (small)
- [ ] **QR code sharing** — mobile-to-mobile (small)

## Compare Mode

- [x] ~~Single/Compare toggle~~ ✅ (blue=A, orange=B)
- [x] ~~Side-by-side algorithm panels~~ ✅
- [x] ~~Overlaid chart with delta indicators~~ ✅
- [x] ~~URL sharing for compare mode~~ ✅ (all params serialized)

## Not Planned

- ~~i18n support~~ — not needed
- ~~Analytics~~ — not needed
- ~~Import dive log formats~~ — not now
- ~~Export to dive computer~~ — not now
