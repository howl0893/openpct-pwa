import { useState, useEffect } from 'react';
import Navbar from './components/Navbar.tsx';
import PWABadge from './PWABadge.tsx';
import Map from './components/Map.tsx';
import './App.css';

function App() {
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
    setIsIOS(isIOSDevice);

    // Handle beforeinstallprompt for non-iOS devices
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    (deferredPrompt as any).prompt();
    const { outcome } = await (deferredPrompt as any).userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  return (
    <div className="app-container">
      <Navbar
        isInstallable={isInstallable}
        isIOS={isIOS}
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