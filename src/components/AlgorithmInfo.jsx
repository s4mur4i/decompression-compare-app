import { useState } from 'react';

const ALGORITHM_INFO = {
  buhlmann: {
    title: 'Bühlmann ZH-L Models',
    icon: '🧮',
    sections: [
      {
        heading: 'How It Works',
        content: `Bühlmann\'s model tracks dissolved inert gas (N₂ and He) in multiple tissue compartments simultaneously. Each compartment has a different half-time representing how quickly it absorbs and releases gas.

The key insight: different body tissues (blood, muscle, fat, bone) absorb gas at different rates. Fast tissues (like blood, ~5 min half-time) load quickly but also off-gas quickly. Slow tissues (fat, ~635 min) take hours to saturate but also hours to clear.`,
      },
      {
        heading: 'M-Values',
        content: `Each compartment has a Maximum value (M-value) — the maximum tolerated inert gas pressure at a given ambient pressure. If tissue loading exceeds the M-value, decompression sickness becomes likely.

M = a + P_ambient / b

Where 'a' (intercept) and 'b' (slope) are compartment-specific constants derived from experimental data and DCS incident analysis.`,
      },
      {
        heading: 'Gradient Factors (GF)',
        content: `Gradient Factors are a safety margin invented by Erik Baker (1998). They express what fraction of the M-value you\'re willing to use:

• GF Low (e.g., 30%) — controls the FIRST stop depth. Lower = deeper first stop = more conservative.
• GF High (e.g., 70%) — controls the LAST stop depth and surfacing. Lower = longer shallow stops.

Common settings:
• GF 30/70 — Conservative (technical diving)
• GF 50/80 — Moderate
• GF 70/85 — Liberal (warm water, fit diver)
• GF 100/100 — Original Bühlmann (no safety margin)`,
      },
      {
        heading: 'Compartment Diagram',
        content: `Parallel compartment model:

  Lungs (alveoli)
    ├── TC1  (t½ = 4 min)    ← Blood
    ├── TC2  (t½ = 8 min)    ← Fast tissues
    ├── TC3  (t½ = 12.5 min)
    ├── TC4  (t½ = 18.5 min)
    ├── ...
    ├── TC12 (t½ = 239 min)  ← Fat
    ├── ...
    └── TC16 (t½ = 635 min)  ← Very slow tissues

Each compartment loads/unloads INDEPENDENTLY from the breathing gas via the lungs. This is the "parallel" model — all compartments see the same inspired gas pressure simultaneously.`,
      },
    ],
  },
  vpm: {
    title: 'VPM-B (Varying Permeability Model)',
    icon: '🫧',
    sections: [
      {
        heading: 'Bubble Mechanics',
        content: `VPM starts from a fundamentally different premise than Bühlmann: gas microbubbles (nuclei) always exist in tissues. These aren\'t dangerous at small sizes, but if they grow too large during ascent, they cause DCS.

The model tracks bubble radius rather than just dissolved gas. Key parameters:
• Initial critical radius (~0.6-1.3 μm)
• Surface tension (γ = 0.0179 N/m)
• Skin compression (γ_c = 0.0257 N/m)`,
      },
      {
        heading: 'Crushing & Growth',
        content: `At depth, hydrostatic pressure "crushes" bubble nuclei to smaller radii. The deeper you go, the smaller the nuclei become.

On ascent, the pressure drop allows:
1. Dissolved gas to come out of solution
2. Existing nuclei to expand (Boyle\'s law)
3. New bubble formation if supersaturation is high enough

VPM limits the allowable supersaturation gradient to prevent excessive bubble growth:
  ΔP_allowed = 2(γ + γ_c) / r_crushed`,
      },
      {
        heading: 'VPM-B Enhancement',
        content: `The "B" in VPM-B stands for Boyle\'s law compensation. As you ascend, bubbles expand simply due to pressure reduction (Boyle\'s law: P₁V₁ = P₂V₂).

VPM-B accounts for this expansion by progressively reducing the allowed supersaturation gradient at shallower stops. This produces slightly longer shallow stops compared to basic VPM.

Result: Deeper first stops than Bühlmann, but similar total deco time.`,
      },
    ],
  },
  rgbm: {
    title: 'RGBM (Reduced Gradient Bubble Model)',
    icon: '🔬',
    sections: [
      {
        heading: 'Dual-Phase Approach',
        content: `RGBM by Bruce Wienke combines dissolved gas tracking (like Bühlmann) with free-phase bubble dynamics. It uses Bühlmann as the base dissolved gas model but applies "bubble reduction factors" to the M-values.

The key insight: during ascent, some dissolved gas forms bubbles. These bubbles reduce the effective gradient available for further off-gassing, meaning you need MORE decompression than dissolved gas alone would predict.`,
      },
      {
        heading: 'Bubble Reduction Factors',
        content: `RGBM calculates a reduction factor (0.55–0.98) for each compartment based on:

1. Max depth — deeper dives excite more nuclei
2. Bottom time — longer exposure = more gas loading
3. Compartment speed — fast tissues form bubbles more readily

The M-value is reduced: M_rgbm = P_amb + (M_buhl - P_amb) × factor

This makes RGBM more conservative than Bühlmann, especially for:
• Deep dives (more bubble formation)
• Long dives (more total gas)
• Repetitive dives (residual bubbles)`,
      },
    ],
  },
  haldane: {
    title: 'Haldane (1908)',
    icon: '📜',
    sections: [
      {
        heading: 'The Origin',
        content: `John Scott Haldane was commissioned by the Royal Navy in 1905 to solve the problem of "caisson disease" (decompression sickness) in divers and tunnel workers.

His 1908 paper "The Prevention of Compressed-Air Illness" established the foundation for ALL modern decompression algorithms. He was the first to:
• Model the body as multiple tissue compartments
• Define supersaturation limits for safe ascent
• Create staged decompression stops`,
      },
      {
        heading: 'The 2:1 Rule',
        content: `Haldane\'s key finding: tissues can safely tolerate a 2:1 pressure ratio during ascent. That is, a tissue saturated at 2 atmospheres absolute can safely surface to 1 atmosphere.

This simple rule worked remarkably well for moderate depths. For a diver at 30m (4 ATA), the fast tissues that reach 4 ATA can safely ascend to 2 ATA (10m depth).

Limitation: The 2:1 ratio is too permissive for slow tissues on deep/long dives, which is why later models (Workman, Bühlmann) developed compartment-specific limits.`,
      },
      {
        heading: '5 Compartments',
        content: `Haldane used just 5 tissue compartments:

  TC1: t½ =  5 min  (blood, lungs)
  TC2: t½ = 10 min  (fast organs)
  TC3: t½ = 20 min  (muscle)
  TC4: t½ = 40 min  (slow organs)
  TC5: t½ = 75 min  (fat, bone)

Modern models use 4-16 compartments, but the principle is identical.`,
      },
    ],
  },
  workman: {
    title: 'Workman M-Values (1965)',
    icon: '⚓',
    sections: [
      {
        heading: 'The M-Value Revolution',
        content: `Robert Workman at the US Navy Experimental Diving Unit refined Haldane\'s simple 2:1 ratio into compartment-specific Maximum values (M-values). This was a massive improvement.

Instead of one ratio for all tissues, each compartment gets its own linear limit:
  M = M₀ + ΔM × depth

Where M₀ is the surface M-value and ΔM is the depth slope. Fast tissues have high M₀ (they tolerate more supersaturation) while slow tissues have low M₀.`,
      },
      {
        heading: '9 Compartments',
        content: `Workman expanded to 9 compartments (5–240 min half-times), covering a wider range of tissue speeds. This better modeled deep and long dives.

His M-values became the basis for US Navy dive tables used for decades and directly inspired Bühlmann\'s later work with 16 compartments.`,
      },
    ],
  },
  thalmann: {
    title: 'Thalmann VVAL-18',
    icon: '🎖️',
    sections: [
      {
        heading: 'Asymmetric Kinetics',
        content: `Edward Thalmann (1980s-90s) noticed that standard exponential models overestimate off-gassing rates. In reality, when tissues are supersaturated, micro-bubbles form and impede gas elimination.

His solution: use exponential kinetics for gas UPTAKE but linear (slower) kinetics for ELIMINATION when supersaturated. This "asymmetric" approach better matches real physiological data.`,
      },
      {
        heading: 'The Linear Model',
        content: `During off-gassing with supersaturation above a threshold:
  elimination_rate = constant (linear)

vs Bühlmann\'s exponential:
  elimination_rate = proportional to (P_tissue - P_inspired)

The linear model produces longer decompression obligations, especially for slow compartments after deep dives. This is more conservative but has an excellent safety record in US Navy operations.`,
      },
    ],
  },
  dciem: {
    title: 'DCIEM (Canadian Model)',
    icon: '🍁',
    sections: [
      {
        heading: 'Serial Compartments',
        content: `The DCIEM model (Kidd & Stubbs, 1960s-70s) is unique: gas flows through compartments IN SERIES, not in parallel.

Bühlmann parallel model:
  Lungs → TC1, TC2, TC3, TC4 (all simultaneously)

DCIEM serial model:
  Lungs → TC1 → TC2 → TC3 → TC4

This means compartment 2 doesn\'t see fresh inspired gas directly — it receives the "output" from compartment 1. Compartment 3 receives from compartment 2, etc.`,
      },
      {
        heading: 'Why Serial?',
        content: `The serial model better represents how blood flow actually delivers gas to deeper tissues. Not all tissues are equally perfused by arterial blood. Some are reached only via venous blood that has already exchanged gas with other tissues.

Result: Serial compartments load MORE SLOWLY than parallel ones, especially the deeper compartments. This means the model is inherently more conservative — it assumes slower gas delivery and thus longer required decompression.`,
      },
      {
        heading: 'Safety Record',
        content: `DCIEM tables have one of the best safety records of any decompression model. The Canadian military used them extensively for cold-water diving, and DCS incidence rates were very low.

The trade-off: significantly more decompression time required. A dive that might need 15 minutes of deco on Bühlmann could need 25+ minutes on DCIEM.`,
      },
    ],
  },
};

export default function AlgorithmInfo({ theme }) {
  const [open, setOpen] = useState(false);
  const [selectedAlgo, setSelectedAlgo] = useState('buhlmann');

  const info = ALGORITHM_INFO[selectedAlgo];

  return (
    <div className="collapsible-section">
      <button className="collapsible-header" onClick={() => setOpen(!open)}>
        <span>{open ? '▼' : '▶'} 📚 Algorithm Deep Dive — Learn More</span>
        <span className="collapsible-hint">Educational</span>
      </button>
      {open && (
        <div className="algo-info-panel">
          <div className="algo-info-tabs">
            {Object.entries(ALGORITHM_INFO).map(([key, val]) => (
              <button
                key={key}
                className={`algo-info-tab${selectedAlgo === key ? ' active' : ''}`}
                onClick={() => setSelectedAlgo(key)}
              >
                {val.icon} {val.title.split(' ')[0]}
              </button>
            ))}
          </div>
          {info && (
            <div className="algo-info-content">
              <h3 className="algo-info-title">{info.icon} {info.title}</h3>
              {info.sections.map((section, i) => (
                <div key={i} className="algo-info-section">
                  <h4>{section.heading}</h4>
                  <pre className="algo-info-text">{section.content}</pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
