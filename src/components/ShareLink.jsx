import { useState } from 'react';

export default function ShareLink() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="share-section">
      <button className="share-btn" onClick={handleCopy}>
        {copied ? '✅ Copied!' : '📋 Share Plan'}
      </button>
    </div>
  );
}
