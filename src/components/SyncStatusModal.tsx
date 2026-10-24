import React from 'react';
import {
  X,
  RefreshCw,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Clock,
  Wifi,
  WifiOff,
  Database
} from 'lucide-react';
import { useSync } from '../context/SyncContext';

interface SyncStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SyncStatusModal: React.FC<SyncStatusModalProps> = ({ isOpen, onClose }) => {
  const {
    isOnline,
    syncStatus,
    syncQueue,
    triggerSync,
    clearCompleted,
    removeItem,
    resolveConflict
  } = useSync();

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '680px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Database size={22} color="#818cf8" />
            <div>
              <h2 className="modal-title">Offline Queue & Sync Engine</h2>
              <p style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                IndexedDB queue & Cloud Firestore reconciliation
              </p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Connectivity Status Banner */}
        <div
          style={{
            padding: '14px 16px',
            borderRadius: 'var(--radius-md)',
            background: isOnline ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
            border: `1px solid ${isOnline ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isOnline ? <Wifi size={20} color="#10b981" /> : <WifiOff size={20} color="#f59e0b" />}
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                {isOnline ? 'Online — Connected to Network' : 'Offline — Operating Locally'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {isOnline
                  ? 'Writes are synchronized with Cloud Firestore in real time.'
                  : 'New entries are queued in IndexedDB with idempotency keys.'}
              </div>
            </div>
          </div>

          <button
            onClick={() => triggerSync()}
            disabled={!isOnline || syncStatus === 'syncing'}
            className="btn btn-primary btn-sm"
          >
            <RefreshCw size={14} className={syncStatus === 'syncing' ? 'spin' : ''} />
            <span>{syncStatus === 'syncing' ? 'Syncing...' : 'Sync Now'}</span>
          </button>
        </div>

        {/* Sync Queue List */}
        <div style={{ marginBottom: '16px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px'
            }}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Queue Records ({syncQueue.length})
            </span>
            {syncQueue.some((i) => i.status === 'synced') && (
              <button
                onClick={clearCompleted}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.75rem' }}
              >
                <Trash2 size={13} />
                <span>Clear Synced</span>
              </button>
            )}
          </div>

          {syncQueue.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '30px 10px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-muted)',
                fontSize: '0.875rem'
              }}
            >
              <CheckCircle size={28} color="#10b981" style={{ marginBottom: '8px' }} />
              <div>All local transactions and drafts are fully synchronized!</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '340px', overflowY: 'auto' }}>
              {syncQueue.map((item) => (
                <div
                  key={item.id}
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          textTransform: 'uppercase',
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: item.operation === 'create' ? 'rgba(16,185,129,0.2)' : 'rgba(99,102,241,0.2)',
                          color: item.operation === 'create' ? '#34d399' : '#818cf8'
                        }}
                      >
                        {item.operation}
                      </span>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                        {item.collection} / {item.docId}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        className="status-pill"
                        style={{
                          background:
                            item.status === 'synced'
                              ? 'var(--accent-income-light)'
                              : item.status === 'conflict'
                              ? 'var(--accent-expense-light)'
                              : item.status === 'syncing'
                              ? 'var(--accent-info-light)'
                              : 'rgba(255,255,255,0.06)',
                          color:
                            item.status === 'synced'
                              ? '#34d399'
                              : item.status === 'conflict'
                              ? '#f87171'
                              : item.status === 'syncing'
                              ? '#38bdf8'
                              : '#cbd5e1'
                        }}
                      >
                        {item.status === 'synced' && <CheckCircle size={11} />}
                        {item.status === 'conflict' && <AlertTriangle size={11} />}
                        {item.status === 'pending' && <Clock size={11} />}
                        {item.status}
                      </span>
                      <button
                        onClick={() => removeItem(item.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                        title="Remove from queue"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '16px' }}>
                    <span>Key: {item.idempotencyKey}</span>
                    <span>Retries: {item.retryCount}</span>
                    <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                  </div>

                  {/* Conflict Resolution UI */}
                  {item.status === 'conflict' && item.conflictDetails && (
                    <div
                      style={{
                        marginTop: '8px',
                        padding: '10px',
                        background: 'rgba(244, 63, 94, 0.08)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid rgba(244, 63, 94, 0.2)'
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f87171', marginBottom: '6px' }}>
                        Conflict Detected: Server has a different version of this record.
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => resolveConflict(item.id, 'keep_client')}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.7rem', padding: '4px 8px' }}
                        >
                          Overwrite with Local Copy
                        </button>
                        <button
                          onClick={() => resolveConflict(item.id, 'keep_server')}
                          className="btn btn-primary btn-sm"
                          style={{ fontSize: '0.7rem', padding: '4px 8px' }}
                        >
                          Discard & Keep Cloud Version
                        </button>
                      </div>
                    </div>
                  )}

                  {item.errorMessage && (
                    <div style={{ fontSize: '0.7rem', color: '#f87171', marginTop: '4px' }}>
                      Error: {item.errorMessage}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
