import { useState } from 'react';
import { serializePlan } from '../utils/diveProfile';

export default function ShareLink({ 
  stops, descentRate, ascentRate, compareMode,
  algorithmA, algorithmB, fO2A, fO2B, 
  gfLowA, gfHighA, gfLowB, gfHighB 
}) {
  const [copied, setCopied] = useState(false);

  const getShareUrl = () => {
    const params = new URLSearchParams();
    if (stops.length > 0) params.set('plan', serializePlan(stops));
    if (descentRate !== 18) params.set('descent', descentRate);
    if (ascentRate !== 9) params.set('ascent', ascentRate);
    
    if (compareMode) {
      params.set('mode', 'compare');
      if (algorithmA !== 'none') params.set('algoA', algorithmA);
      if (algorithmB !== 'none') params.set('algoB', algorithmB);
      if (fO2A !== 0.21) params.set('o2A', Math.round(fO2A * 100));
      if (fO2B !== 0.21) params.set('o2B', Math.round(fO2B * 100));
      if (gfLowA !== 50) params.set('gflA', gfLowA);
      if (gfHighA !== 70) params.set('gfhA', gfHighA);
      if (gfLowB !== 50) params.set('gflB', gfLowB);
      if (gfHighB !== 70) params.set('gfhB', gfHighB);
    } else {
      if (algorithmA !== 'none') params.set('algo', algorithmA);
      if (fO2A !== 0.21) params.set('o2', Math.round(fO2A * 100));
      if (gfLowA !== 50) params.set('gfl', gfLowA);
      if (gfHighA !== 70) params.set('gfh', gfHighA);
    }
    
    return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(getShareUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = getShareUrl();
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="share-link">
      <button onClick={copyLink} className="share-btn">
        {copied ? '✓ Copied!' : '🔗 Share Dive Plan'}
      </button>
    </div>
  );
}
