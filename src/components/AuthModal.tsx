import React, { useState } from 'react';
import { X, Lock, Mail, User as UserIcon, LogOut, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { sendResetPassword } from '../services/authService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, isDemo, login, loginWithGoogle, register, logout, toggleDemoUser } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      await loginWithGoogle();
      onClose();
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      setError(err.message || 'Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      if (mode === 'signin') {
        await login(email, password);
        onClose();
      } else if (mode === 'signup') {
        if (!displayName.trim()) {
          setError('Please provide a display name.');
          setLoading(false);
          return;
        }
        await register(email, password, displayName);
        onClose();
      } else if (mode === 'forgot') {
        await sendResetPassword(email);
        setInfo('Password reset instructions sent to your email.');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication operation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {currentUser && !isDemo
              ? 'Your Profile'
              : mode === 'signin'
              ? 'Sign In to FinanceFlow'
              : mode === 'signup'
              ? 'Create New Account'
              : 'Recover Password'}
          </h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {currentUser && !isDemo ? (
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '16px',
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-md)',
                marginBottom: '20px'
              }}
            >
              <div className="avatar-circle" style={{ width: '48px', height: '48px', fontSize: '1.25rem' }}>
                {currentUser.photoURL && !avatarError ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'User'}
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarError(true)}
                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : currentUser.displayName ? (
                  currentUser.displayName[0].toUpperCase()
                ) : (
                  'U'
                )}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{currentUser.displayName}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{currentUser.email}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--accent-income)', marginTop: '2px' }}>
                  UID: {currentUser.id.slice(0, 12)}...
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleLogout}
                className="btn btn-secondary"
                style={{ width: '100%', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}
              >
                <LogOut size={16} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Google One-Click Sign In */}
            {mode !== 'forgot' && (
              <>
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="btn-google"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </button>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    margin: '16px 0',
                    color: 'var(--text-muted)',
                    fontSize: '0.775rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em'
                  }}
                >
                  <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
                  <span>or with email</span>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
                </div>
              </>
            )}

            {/* Mode switch tabs */}
            <div
              style={{
                display: 'flex',
                background: 'rgba(0, 0, 0, 0.05)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '4px',
                marginBottom: '18px'
              }}
            >
              <button
                type="button"
                onClick={() => { setMode('signin'); setError(null); setInfo(null); }}
                style={{
                  flex: 1,
                  padding: '8px',
                  background: mode === 'signin' ? 'var(--bg-dark)' : 'transparent',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  color: mode === 'signin' ? '#fff' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  boxShadow: mode === 'signin' ? '0 2px 6px rgba(0,0,0,0.1)' : 'none',
                  transition: 'var(--transition)'
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMode('signup'); setError(null); setInfo(null); }}
                style={{
                  flex: 1,
                  padding: '8px',
                  background: mode === 'signup' ? 'var(--bg-dark)' : 'transparent',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  color: mode === 'signup' ? '#fff' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  boxShadow: mode === 'signup' ? '0 2px 6px rgba(0,0,0,0.1)' : 'none',
                  transition: 'var(--transition)'
                }}
              >
                Sign Up
              </button>
            </div>

            {error && (
              <div
                style={{
                  padding: '10px 14px',
                  background: 'rgba(244, 63, 94, 0.12)',
                  color: '#f87171',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.825rem',
                  marginBottom: '16px'
                }}
              >
                {error}
              </div>
            )}

            {info && (
              <div
                style={{
                  padding: '10px 14px',
                  background: 'rgba(16, 185, 129, 0.12)',
                  color: '#34d399',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.825rem',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <CheckCircle2 size={16} />
                <span>{info}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {mode === 'signup' && (
                <div className="input-group">
                  <label className="input-label">Full Name</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. Muneeswaran"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              <div className="input-group">
                <label className="input-label">Email Address</label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {mode !== 'forgot' && (
                <div className="input-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <label className="input-label">Password</label>
                    {mode === 'signin' && (
                      <span
                        onClick={() => setMode('forgot')}
                        style={{ fontSize: '0.75rem', color: '#818cf8', cursor: 'pointer' }}
                      >
                        Forgot password?
                      </span>
                    )}
                  </div>
                  <input
                    type="password"
                    className="input-field"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '8px' }}
              >
                {loading
                  ? 'Processing...'
                  : mode === 'signin'
                  ? 'Sign In'
                  : mode === 'signup'
                  ? 'Create Account'
                  : 'Send Reset Link'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
