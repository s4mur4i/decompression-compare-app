# 🤿 Decompression Compare

A dive profile planner and algorithm comparison tool for technical divers. Plan your dives and compare decompression obligations across multiple algorithms side-by-side.

**Live Site:** https://s4mur4i.github.io/decompression-compare-app/

## Features

- **Interactive dive planning** — Add multiple stops with depth and time
- **Algorithm comparison** — Compare 2 algorithms side-by-side in split view
- **Real-time calculations** — Instant decompression stop calculations as you plan
- **Shareable links** — URL-encoded dive plans for sharing
- **Responsive design** — Works on desktop and mobile

## Supported Algorithms

This tool supports 11+ decompression algorithms:

1. **ZH-L 16A** — Original experimental Bühlmann model (1986)
2. **ZH-L 16B** — For printed tables, reduced conservatism in middle compartments
3. **ZH-L 16C** — For dive computers, most widely used, more conservative
4. **ZH-L 12** — Original 1983 version, 16 compartments but 12 unique parameter pairs
5. **ZH-L 6** — Simplified 6-compartment model for early dive computers
6. **ZH-L 8 ADT** — 8-compartment adaptive model with variable half-times
7. **VPM-B** — Varying Permeability Model with bubble mechanics
8. **RGBM** — Reduced Gradient Bubble Model with explicit bubble tracking
9. **Haldane (1908)** — The original model, foundation of all modern algorithms
10. **Workman (1965)** — US Navy M-value approach, predecessor to Bühlmann
11. **Thalmann VVAL-18** — US Navy model with asymmetric gas kinetics
12. **DCIEM** — Canadian serial compartment model, very conservative

## Usage

1. **Plan your dive** — Add depth/time stops for your dive profile
2. **Choose mode** — Toggle between Single algorithm view or Compare mode
3. **Select algorithms** — Pick one or two algorithms to compare
4. **Adjust settings** — Set gas mix (O₂%), gradient factors, ascent/descent rates
5. **Review results** — See decompression stops, runtime, and dive profile chart
6. **Share** — Copy the URL to share your dive plan

## Compare Mode

Switch to Compare mode to see two algorithms side-by-side:
- Shared dive plan (same stops, rates) at the top
- Two independent algorithm settings columns
- Overlaid dive profiles on the same chart
- Side-by-side summaries with time differences
- Color-coded results (blue vs orange)

## Development

```bash
npm install
npm run dev     # Development server
npm run build   # Build for production
```

Built with React + Vite. Charts powered by Chart.js.

## Disclaimer

**For educational purposes only.** This tool is not certified for actual dive planning. Always use proper dive planning software and consult certified dive professionals for real dive planning.