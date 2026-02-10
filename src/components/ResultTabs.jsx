import { useState, memo } from 'react';

const TAB_DEFS = [
  { id: 'overview', label: '📊 Overview' },
  { id: 'plan', label: '📋 Dive Plan' },
  { id: 'gas', label: '⛽ Gas Plan' },
  { id: 'o2', label: '🫁 O₂ Toxicity' },
  { id: 'analysis', label: '🔬 Analysis' },
];

function ResultTabs({ activeTab, onTabChange }) {
  return (
    <div className="result-tabs">
      {TAB_DEFS.map(tab => (
        <button
          key={tab.id}
          className={`result-tab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default memo(ResultTabs);
export { TAB_DEFS };
