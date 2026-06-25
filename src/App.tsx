import { useState, useEffect } from 'react';
import Navbar from './components/Navbar.tsx';
import PWABadge from './PWABadge.tsx';
import Map from './components/Map.tsx';
import './App.css';
import { trackEvent } from './analytics.ts';

function App() {
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine);

  useEffect(() => {
    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
    setIsIOS(isIOSDevice);

    // Handle beforeinstallprompt for non-iOS devices
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOffline(!navigator.onLine);
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    (deferredPrompt as any).prompt();
    const { outcome } = await (deferredPrompt as any).userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    trackEvent(outcome === 'accepted' ? 'pwa_install_prompt_accepted' : 'pwa_install_prompt_dismissed');
    setDeferredPrompt(null);
  };

  return (
    <div className="app-container">
      <Navbar
        isInstallable={deferredPrompt !== null}
        isIOS={isIOS}
        isOffline={isOffline}
        handleInstallClick={handleInstallClick}
      />
      <main>
        <Map />
      </main>
      <PWABadge />
    </div>
  );
}

export default App;
