import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { SyncQueueItem } from '../types/finance';

interface FinanceOfflineDBSchema extends DBSchema {
  sync_queue: {
    key: string;
    value: SyncQueueItem;
    indexes: {
      'by-status': string;
      'by-idempotency': string;
      'by-timestamp': number;
    };
  };
  offline_drafts: {
    key: string;
    value: {
      id: string;
      type: string;
      payload: any;
      createdAt: number;
    };
    indexes: {
      'by-type': string;
    };
  };
  local_cache: {
    key: string;
    value: {
      collection: string;
      data: any[];
      updatedAt: number;
    };
  };
}

const DB_NAME = 'ExpenseTrackerOfflineDB';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<FinanceOfflineDBSchema>> | null = null;

export function getOfflineDB(): Promise<IDBPDatabase<FinanceOfflineDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<FinanceOfflineDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Sync queue store
        if (!db.objectStoreNames.contains('sync_queue')) {
          const syncStore = db.createObjectStore('sync_queue', { keyPath: 'id' });
          syncStore.createIndex('by-status', 'status');
          syncStore.createIndex('by-idempotency', 'idempotencyKey');
          syncStore.createIndex('by-timestamp', 'timestamp');
        }

        // Offline drafts store
        if (!db.objectStoreNames.contains('offline_drafts')) {
          const draftStore = db.createObjectStore('offline_drafts', { keyPath: 'id' });
          draftStore.createIndex('by-type', 'type');
        }

        // Cache store
        if (!db.objectStoreNames.contains('local_cache')) {
          db.createObjectStore('local_cache', { keyPath: 'collection' });
        }
      }
    });
  }
  return dbPromise;
}

export async function enqueueSyncItem(
  item: Omit<SyncQueueItem, 'status' | 'retryCount' | 'timestamp'>
): Promise<SyncQueueItem> {
  const db = await getOfflineDB();

  // Check if idempotency key already queued
  const tx = db.transaction('sync_queue', 'readonly');
  const index = tx.store.index('by-idempotency');
  const existing = await index.get(item.idempotencyKey);
  await tx.done;

  if (existing) {
    console.warn(`Item with idempotency key ${item.idempotencyKey} already in sync queue.`);
    return existing;
  }

  const syncItem: SyncQueueItem = {
    ...item,
    status: 'pending',
    retryCount: 0,
    timestamp: Date.now()
  };

  await db.put('sync_queue', syncItem);
  return syncItem;
}

export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  const db = await getOfflineDB();
  const tx = db.transaction('sync_queue', 'readonly');
  const all = await tx.store.getAll();
  await tx.done;
  return all.filter((item) => item.status === 'pending' || item.status === 'failed');
}

export async function getAllSyncItems(): Promise<SyncQueueItem[]> {
  const db = await getOfflineDB();
  return db.getAll('sync_queue');
}

export async function updateSyncItem(id: string, updates: Partial<SyncQueueItem>): Promise<void> {
  const db = await getOfflineDB();
  const item = await db.get('sync_queue', id);
  if (item) {
    const updated = { ...item, ...updates };
    await db.put('sync_queue', updated);
  }
}

export async function removeSyncItem(id: string): Promise<void> {
  const db = await getOfflineDB();
  await db.delete('sync_queue', id);
}

export async function clearCompletedSyncItems(): Promise<void> {
  const db = await getOfflineDB();
  const tx = db.transaction('sync_queue', 'readwrite');
  const all = await tx.store.getAll();
  for (const item of all) {
    if (item.status === 'synced') {
      await tx.store.delete(item.id);
    }
  }
  await tx.done;
}

export async function saveLocalCache(collectionName: string, data: any[]): Promise<void> {
  try {
    const db = await getOfflineDB();
    await db.put('local_cache', {
      collection: collectionName,
      data,
      updatedAt: Date.now()
    });
  } catch (err) {
    console.error(`Failed to cache ${collectionName} offline:`, err);
  }
}

export async function getLocalCache<T = any>(collectionName: string): Promise<T[]> {
  try {
    const db = await getOfflineDB();
    const entry = await db.get('local_cache', collectionName);
    return entry ? (entry.data as T[]) : [];
  } catch (err) {
    console.error(`Failed to read cache for ${collectionName}:`, err);
    return [];
  }
}

export async function saveDraft(type: string, payload: any): Promise<string> {
  const db = await getOfflineDB();
  const id = payload.id || `draft_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  await db.put('offline_drafts', {
    id,
    type,
    payload,
    createdAt: Date.now()
  });
  return id;
}

export async function getDrafts(type: string): Promise<any[]> {
  const db = await getOfflineDB();
  const all = await db.getAll('offline_drafts');
  return all.filter((d) => d.type === type).map((d) => d.payload);
}

export async function deleteDraft(id: string): Promise<void> {
  const db = await getOfflineDB();
  await db.delete('offline_drafts', id);
}
