import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Wifi,
  WifiOff,
  RefreshCw,
  Settings,
  User as UserIcon,
  HelpCircle,
  Download
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  openSyncModal: () => void;
  openAuthModal: () => void;
  openConfigModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  openSyncModal,
  openAuthModal,
  openConfigModal
}) => {
  const { currentUser, isDemo } = useAuth();
  const { isOnline, syncStatus, pendingCount } = useSync();
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    setAvatarError(false);
  }, [currentUser?.photoURL]);

  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallPWA = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #10b981, #6366f1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white'
            }}
          >
            <Wallet size={18} />
          </div>
          <div>
            <span style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>
              Finance<span style={{ color: '#10b981' }}>Flow</span>
            </span>
            <span className="currency-badge">
              INR (₹)
            </span>
          </div>
        </div>
      </div>

      <div className="topbar-right">
        {/* Sync & Connectivity Badge */}
        <button
          onClick={openSyncModal}
          className={`sync-badge ${!isOnline ? 'offline' : syncStatus === 'syncing' ? 'syncing' : 'online'}`}
          title="Click to view offline queue & sync status"
        >
          {isOnline ? (
            syncStatus === 'syncing' ? (
              <RefreshCw size={13} className="spin" style={{ animation: 'spin 1.5s linear infinite' }} />
            ) : (
              <Wifi size={13} />
            )
          ) : (
            <WifiOff size={13} />
          )}
          <span className="sync-badge-text">
            {!isOnline
              ? 'Offline'
              : syncStatus === 'syncing'
              ? 'Syncing...'
              : pendingCount > 0
              ? `${pendingCount} Pending`
              : 'Synced'}
          </span>
          <span className={`badge-dot ${syncStatus === 'syncing' ? 'pulse' : ''}`} />
        </button>

        {/* PWA Install Button */}
        {installPrompt && (
          <button
            onClick={handleInstallPWA}
            className="btn btn-secondary btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.76rem',
              padding: '6px 10px',
              background: 'rgba(16, 185, 129, 0.15)',
              borderColor: 'rgba(16, 185, 129, 0.35)',
              color: '#34d399'
            }}
            title="Install FinanceFlow app to home screen / desktop"
          >
            <Download size={13} />
            <span className="sync-badge-text">Install App</span>
          </button>
        )}

        {/* Demo mode badge */}
        {isDemo && (
          <span
            onClick={openAuthModal}
            className="demo-mode-badge"
            title="Click to sign in with Google or account"
          >
            <span className="demo-badge-full">Demo Mode</span>
            <span className="demo-badge-short">Demo</span>
          </span>
        )}

        {/* Firebase Config button */}
        <button
          onClick={openConfigModal}
          className="circle-icon-btn"
          style={{ width: '36px', height: '36px' }}
          title="Firebase Configuration & Settings"
        >
          <Settings size={16} />
        </button>

        {/* User Profile / Auth */}
        <div className="user-pill" onClick={openAuthModal} title="Account & Authentication">
          <div className="avatar-circle">
            {currentUser?.photoURL && !avatarError ? (
              <img
                src={currentUser.photoURL}
                alt={currentUser.displayName || 'User'}
                referrerPolicy="no-referrer"
                onError={() => setAvatarError(true)}
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : currentUser?.displayName ? (
              currentUser.displayName.charAt(0).toUpperCase()
            ) : (
              <UserIcon size={14} />
            )}
          </div>
          <span className="user-name-text">
            {currentUser?.displayName || 'Account'}
          </span>
        </div>
      </div>
    </header>
  );
};
