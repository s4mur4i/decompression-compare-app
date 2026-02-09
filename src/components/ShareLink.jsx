import { useState } from 'react';
import { serializePlan } from '../utils/diveProfile';

export default function ShareLink({ stops, descentRate }) {
  const [copied, setCopied] = useState(false);

  const getShareUrl = () => {
    const params = new URLSearchParams();
    if (stops.length > 0) params.set('plan', serializePlan(stops));
    if (descentRate !== 9) params.set('descent', descentRate);
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
