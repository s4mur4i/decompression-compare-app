# Decompression Compare App — Feature TODO

## UX Improvements

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

## Algorithm Improvements

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

## Technical Improvements

- [ ] **PWA support** — service worker, offline capability, installable (medium)
- [ ] **Web Worker for calculations** — move heavy computation off main thread (medium)
- [ ] **TypeScript migration** — type safety for algorithm parameters (large)
- [ ] **Unit tests for all algorithms** — expand test coverage (medium)
- [ ] **Integration tests** — full flow: stops → algorithm → chart (medium)
- [ ] **Performance profiling** — useMemo dependency arrays (small)
- [ ] **Code splitting** — lazy-load algorithm files (small)
- [ ] **E2E tests** — Playwright for critical user flows (medium)
- [ ] **Error boundaries** — graceful failure for invalid inputs (small)
- [ ] **i18n support** — internationalization framework (large)
- [ ] **SEO/meta tags** — Open Graph for shared links (small)
- [ ] **Analytics** — anonymous usage stats for feature prioritization (small)
