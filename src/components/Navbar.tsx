import appLogo from '/favicon.svg'; // Adjust path if logo is elsewhere
import './Navbar.css';

interface NavbarProps {
  isInstallable: boolean;
  isIOS: boolean;
  handleInstallClick: () => void;
}

function Navbar({ isInstallable, isIOS, handleInstallClick }: NavbarProps) {
  return (
    <nav className="navbar">
      <div className="logo-container">
        <img src={appLogo} className="logo" alt="OpenPCT PWA logo" />
      </div>
      <div className="navbar-actions">
        {isInstallable && !isIOS && (
          <button onClick={handleInstallClick} className="install-button">
            Install
          </button>
        )}
        {isIOS && (
          <p className="ios-install-message">
            To install, tap the Share button in Safari and select "Add to Home Screen".
          </p>
        )}
        {/* Placeholder for additional buttons */}
        {/* Example: <button className="nav-button">Menu</button> */}
      </div>
    </nav>
  );
}

export default Navbar;