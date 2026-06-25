import appLogo from '/favicon.svg'; // Adjust path if logo is elsewhere
import './Navbar.css';

interface NavbarProps {
  isInstallable: boolean;
  isIOS: boolean;
  handleInstallClick: () => void;
}

function Navbar({ isInstallable, isIOS, handleInstallClick }: NavbarProps) {
  const handleInstall = () => {
    if (isInstallable) {
      handleInstallClick();
      return;
    }

    if (isIOS) {
      window.alert('Install OpenPCT from Safari using Share, then Add to Home Screen.');
      return;
    }

    window.alert('Install OpenPCT from your browser menu. In Chrome or Edge, use the install icon in the address bar or Install app from the menu.');
  };

  return (
    <nav className="navbar">
      <div className="logo-container">
        <img src={appLogo} className="logo" alt="OpenPCT PWA logo" />
      </div>
      <div className="navbar-actions">
        <button onClick={handleInstall} className="install-button" title="Install OpenPCT">
          Install
        </button>
      </div>
    </nav>
  );
}

export default Navbar;
