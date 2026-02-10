# Decompression Compare App — Feature TODO

## UX Improvements

- [x] ~~Dark/Light mode toggle~~ ✅
- [x] ~~Mobile responsiveness~~ ✅
- [x] ~~Drag-and-drop stop reordering~~ ✅
- [ ] **Imperial units toggle** — feet/FSW support (medium)
- [x] ~~Quick gas presets~~ ✅
- [x] ~~Responsive chart~~ ✅
- [x] ~~Loading/calculating indicator~~ ✅

## Algorithm Improvements

- [x] ~~Validation & comprehensive testing~~ ✅ (161 tests: validation, edge cases, cross-algorithm)
- [ ] **VPM-B/E with full bubble tracking** — current VPM is simplified (large)
- [ ] **RGBM full Wienke implementation** — current uses simplified bubble factors (large)
- [x] ~~Add DSAT (Recreational PADI)~~ ✅ NDL-based
- [x] ~~Add US Navy Rev 7 tables~~ ✅ table-based
- [x] ~~Add BSAC '88 tables~~ ✅ table-based
- [x] ~~GF support for VPM/RGBM~~ ✅ verified working

## Dive Planning Features

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

## Data & Export Features

- [ ] **Export dive plan as PDF** — formatted table + chart (medium)
- [ ] **Export as CSV** — phase-by-phase data (small)
- [ ] **Save/load profiles** — localStorage or account-based (medium)
- [ ] **Import from dive log formats** — UDDF, Subsurface XML (large)
- [ ] **Export to dive computer format** — for supported devices (large)
- [ ] **Screenshot/image export** — chart as PNG (small)
- [ ] **Print-friendly layout** — @media print CSS (small)
- [ ] **QR code sharing** — for mobile-to-mobile plan sharing (small)

## Educational Features

- [x] ~~Tissue compartment visualization~~ ✅
- [x] ~~Real-time ceiling line on chart~~ ✅
- [x] ~~Algorithm explanation tooltips~~ ✅
- [x] ~~GF explorer~~ ✅ (separate graph)
- [x] ~~Supersaturation gradient display~~ ✅
- [x] ~~Side-by-side algorithm deep-dive~~ ✅
- [x] ~~Bubble mechanics visualization~~ ✅
- [x] ~~NDL table generator~~ ✅

## Technical Improvements

- [ ] **PWA support** — service worker, offline capability, installable (medium)
- [ ] **Web Worker for calculations** — move heavy computation off main thread (medium)
- [ ] **TypeScript migration** — type safety for algorithm parameters (large)
- [x] ~~Unit tests for all algorithms~~ ✅ (161 tests)
- [ ] **Integration tests** — full flow: stops → algorithm → chart (medium)
- [ ] **Performance profiling** — useMemo dependency arrays (small)
- [ ] **Code splitting** — lazy-load algorithm files (small)
- [ ] **E2E tests** — Playwright for critical user flows (medium)
- [ ] **Error boundaries** — graceful failure for invalid inputs (small)
- [ ] **i18n support** — internationalization framework (large)
- [ ] **SEO/meta tags** — Open Graph for shared links (small)
- [ ] **Analytics** — anonymous usage stats for feature prioritization (small)
