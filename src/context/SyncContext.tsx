import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { SyncQueueItem } from '../types/finance';
import {
  getAllSyncItems,
  getPendingSyncItems,
  updateSyncItem,
  clearCompletedSyncItems,
  removeSyncItem
} from '../services/offlineQueue';
import { firestoreDb } from '../services/firebaseConfig';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

interface SyncContextType {
  isOnline: boolean;
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  pendingCount: number;
  syncQueue: SyncQueueItem[];
  triggerSync: () => Promise<void>;
  clearCompleted: () => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  resolveConflict: (id: string, resolution: 'keep_client' | 'keep_server') => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>([]);
  const [pendingCount, setPendingCount] = useState<number>(0);

  const refreshQueue = useCallback(async () => {
    try {
      const items = await getAllSyncItems();
      setSyncQueue(items);
      const pending = items.filter((i) => i.status === 'pending' || i.status === 'failed');
      setPendingCount(pending.length);
    } catch (e) {
      console.warn('Error reading sync queue:', e);
    }
  }, []);

  const triggerSync = useCallback(async () => {
    if (!navigator.onLine) {
      console.log('Cannot synchronize while offline.');
      return;
    }

    setSyncStatus('syncing');
    try {
      const pending = await getPendingSyncItems();
      for (const item of pending) {
        try {
          await updateSyncItem(item.id, { status: 'syncing' });

          const docRef = doc(firestoreDb, item.collection, item.docId);

          if (item.operation === 'create' || item.operation === 'update') {
            // Conflict Detection: check if server document already exists with later timestamp
            const serverSnap = await getDoc(docRef);
            if (serverSnap.exists() && item.operation === 'create') {
              const serverData = serverSnap.data();
              if (serverData.idempotencyKey && serverData.idempotencyKey !== item.idempotencyKey) {
                // Record Conflict
                await updateSyncItem(item.id, {
                  status: 'conflict',
                  conflictDetails: {
                    clientVersion: item.data,
                    serverVersion: serverData
                  }
                });
                continue;
              }
            }

            await setDoc(docRef, item.data, { merge: true });
          } else if (item.operation === 'delete') {
            await deleteDoc(docRef);
          }

          await updateSyncItem(item.id, { status: 'synced' });
        } catch (itemErr: any) {
          console.error(`Sync error for item ${item.id}:`, itemErr);
          const nextRetry = item.retryCount + 1;
          await updateSyncItem(item.id, {
            status: nextRetry > 4 ? 'failed' : 'pending',
            retryCount: nextRetry,
            errorMessage: itemErr.message || 'Sync failed'
          });
        }
      }

      setSyncStatus('synced');
    } catch (err) {
      console.error('Batch sync failure:', err);
      setSyncStatus('error');
    } finally {
      await refreshQueue();
    }
  }, [refreshQueue]);

  // Online / Offline listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    refreshQueue();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [triggerSync, refreshQueue]);

  const clearCompleted = async () => {
    await clearCompletedSyncItems();
    await refreshQueue();
  };

  const removeItem = async (id: string) => {
    await removeSyncItem(id);
    await refreshQueue();
  };

  const resolveConflict = async (id: string, resolution: 'keep_client' | 'keep_server') => {
    const item = syncQueue.find((i) => i.id === id);
    if (!item) return;

    if (resolution === 'keep_client') {
      const docRef = doc(firestoreDb, item.collection, item.docId);
      await setDoc(docRef, item.data, { merge: true });
      await updateSyncItem(id, { status: 'synced', conflictDetails: undefined });
    } else {
      // Keep server version: drop client queued update
      await removeSyncItem(id);
    }
    await refreshQueue();
  };

  return (
    <SyncContext.Provider
      value={{
        isOnline,
        syncStatus,
        pendingCount,
        syncQueue,
        triggerSync,
        clearCompleted,
        removeItem,
        resolveConflict
      }}
    >
      {children}
    </SyncContext.Provider>
  );
};

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}
