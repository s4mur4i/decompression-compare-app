import { useState, useEffect } from 'react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!deferredPrompt || dismissed) return null;

  const handleInstall = async () => {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
    else setDismissed(true);
  };

  return (
    <div className="install-prompt">
      <span>📱 Install Deco Compare for offline use</span>
      <button className="install-btn" onClick={handleInstall}>Install</button>
      <button className="install-dismiss" onClick={() => setDismissed(true)}>✕</button>
    </div>
  );
}
