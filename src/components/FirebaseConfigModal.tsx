import React, { useState } from 'react';
import { X, Server, Check, RotateCcw, ShieldCheck } from 'lucide-react';
import {
  getStoredFirebaseConfig,
  saveStoredFirebaseConfig,
  FirebaseConfigOptions
} from '../services/firebaseConfig';

interface FirebaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FirebaseConfigModal: React.FC<FirebaseConfigModalProps> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState<FirebaseConfigOptions>(getStoredFirebaseConfig());
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveStoredFirebaseConfig(config);
    setSavedSuccess(true);
    setTimeout(() => {
      window.location.reload();
    }, 800);
  };

  const handleReset = () => {
    localStorage.removeItem('user_firebase_config');
    setSavedSuccess(true);
    setTimeout(() => {
      window.location.reload();
    }, 600);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Server size={22} color="#10b981" />
            <div>
              <h2 className="modal-title">Firebase Backend Config</h2>
              <p style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                Client SDK keys (never store Admin SDK keys in frontend!)
              </p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(99, 102, 241, 0.1)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '18px'
          }}
        >
          <ShieldCheck size={20} color="#818cf8" />
          <div style={{ fontSize: '0.785rem', color: '#cbd5e1' }}>
            Firebase Web API keys identify your project on Google Cloud. Access security is strictly enforced by server-side <strong>firestore.rules</strong> and Cloud Functions.
          </div>
        </div>

        {savedSuccess && (
          <div
            style={{
              padding: '10px 14px',
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#34d399',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.825rem',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Check size={16} />
            <span>Configuration saved! Reloading application with new Firebase project...</span>
          </div>
        )}

        <form onSubmit={handleSave}>
          <div className="input-group">
            <label className="input-label">Project ID</label>
            <input
              type="text"
              className="input-field"
              value={config.projectId}
              onChange={(e) => setConfig({ ...config, projectId: e.target.value })}
              placeholder="e.g. my-finance-tracker-12345"
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label">Web API Key</label>
            <input
              type="text"
              className="input-field"
              value={config.apiKey}
              onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
              placeholder="AIzaSy..."
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="input-group">
              <label className="input-label">Auth Domain</label>
              <input
                type="text"
                className="input-field"
                value={config.authDomain}
                onChange={(e) => setConfig({ ...config, authDomain: e.target.value })}
                required
              />
            </div>
            <div className="input-group">
              <label className="input-label">Storage Bucket</label>
              <input
                type="text"
                className="input-field"
                value={config.storageBucket}
                onChange={(e) => setConfig({ ...config, storageBucket: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="input-group">
              <label className="input-label">Messaging Sender ID</label>
              <input
                type="text"
                className="input-field"
                value={config.messagingSenderId}
                onChange={(e) => setConfig({ ...config, messagingSenderId: e.target.value })}
                required
              />
            </div>
            <div className="input-group">
              <label className="input-label">App ID</label>
              <input
                type="text"
                className="input-field"
                value={config.appId}
                onChange={(e) => setConfig({ ...config, appId: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
              <Check size={16} />
              <span>Save & Connect Firebase</span>
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="btn btn-secondary"
              title="Reset to local demo environment"
            >
              <RotateCcw size={16} />
              <span>Reset</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
