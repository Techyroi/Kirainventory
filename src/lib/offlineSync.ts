'use client';

const DB_NAME = 'kiralyte_offline_db';
const STORE_NAME = 'sync_queue';
const QUEUE_EVENT = 'kiralyte-offline-queue-changed';

export interface QueuedMutation {
  id?: number;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  createdAt: string;
}

function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function notifyQueueChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(QUEUE_EVENT));
  }
}

export async function enqueueMutation(item: Omit<QueuedMutation, 'id'>): Promise<void> {
  const db = await openOfflineDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).add(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  notifyQueueChanged();
}

export async function getAllQueuedMutations(): Promise<QueuedMutation[]> {
  const db = await openOfflineDb();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve((req.result || []) as QueuedMutation[]);
    req.onerror = () => reject(req.error);
  });
}

export async function getQueuedCount(): Promise<number> {
  const db = await openOfflineDb();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).count();
    req.onsuccess = () => resolve(req.result || 0);
    req.onerror = () => reject(req.error);
  });
}

async function removeQueuedMutation(id: number): Promise<void> {
  const db = await openOfflineDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

let nativeFetchRef: typeof window.fetch | null = null;

export async function replayQueuedMutations(): Promise<{ synced: number; failed: number }> {
  const items = await getAllQueuedMutations();
  if (items.length === 0) return { synced: 0, failed: 0 };

  const fetchFn = nativeFetchRef || window.fetch.bind(window);
  let synced = 0;
  let failed = 0;

  for (const item of items) {
    if (!navigator.onLine) break;
    try {
      const res = await fetchFn(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body
      });
      // Remove from queue on 2xx or 4xx (permanent validation error); keep only on 5xx
      if (res.status < 500 && item.id !== undefined) {
        await removeQueuedMutation(item.id);
        synced++;
      } else {
        failed++;
      }
    } catch {
      failed++;
      break;
    }
  }

  notifyQueueChanged();
  return { synced, failed };
}

let interceptorInstalled = false;

export function installOfflineFetchInterceptor() {
  if (typeof window === 'undefined' || interceptorInstalled) return;
  interceptorInstalled = true;

  const originalFetch = window.fetch.bind(window);
  nativeFetchRef = originalFetch;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();

    const isSameOriginApiMutation =
      (urlStr.startsWith('/api/') || urlStr.startsWith(window.location.origin + '/api/')) &&
      !urlStr.includes('/api/auth/') &&
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

    if (!isSameOriginApiMutation) {
      return originalFetch(input, init);
    }

    const queueAndRespond = async (): Promise<Response> => {
      const headers: Record<string, string> = {};
      if (init?.headers) {
        new Headers(init.headers).forEach((v, k) => {
          headers[k] = v;
        });
      }
      const body = typeof init?.body === 'string' ? init.body : null;
      await enqueueMutation({
        url: urlStr,
        method,
        headers,
        body,
        createdAt: new Date().toISOString()
      });

      return new Response(
        JSON.stringify({
          success: true,
          offlineQueued: true,
          invoice_number: `OFFLINE-${Date.now().toString().slice(-6)}`,
          message: 'Saved offline. Will sync automatically when back online.'
        }),
        { status: 202, headers: { 'Content-Type': 'application/json' } }
      );
    };

    if (!navigator.onLine) {
      return await queueAndRespond();
    }

    try {
      return await originalFetch(input, init);
    } catch (err) {
      if (!navigator.onLine || err instanceof TypeError) {
        return await queueAndRespond();
      }
      throw err;
    }
  };
}

export const OFFLINE_QUEUE_EVENT = QUEUE_EVENT;
