'use client';

import React, { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  getQueuedCount,
  installOfflineFetchInterceptor,
  OFFLINE_QUEUE_EVENT,
  replayQueuedMutations
} from '@/lib/offlineSync';
import { RefreshCw, WifiOff, CheckCircle2 } from 'lucide-react';

function subscribeOnlineStatus(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

export const OfflineManager: React.FC = () => {
  const isOnline = useSyncExternalStore(
    subscribeOnlineStatus,
    () => navigator.onLine,
    () => true
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [justSyncedMsg, setJustSyncedMsg] = useState('');

  const refreshQueueCount = useCallback(async () => {
    try {
      const count = await getQueuedCount();
      setPendingCount(count);
    } catch {
      // Ignore IndexedDB unavailability
    }
  }, []);

  const handleSyncNow = useCallback(async () => {
    if (!navigator.onLine || syncing) return;
    setSyncing(true);
    try {
      const { synced } = await replayQueuedMutations();
      await refreshQueueCount();
      if (synced > 0) {
        setJustSyncedMsg(`Synced ${synced} offline action${synced > 1 ? 's' : ''}`);
        setTimeout(() => setJustSyncedMsg(''), 4000);
      }
    } finally {
      setSyncing(false);
    }
  }, [syncing, refreshQueueCount]);

  useEffect(() => {
    let cancelled = false;
    installOfflineFetchInterceptor();
    getQueuedCount()
      .then((count) => {
        if (!cancelled) setPendingCount(count);
      })
      .catch(() => {
        // Ignore IndexedDB unavailability
      });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Ignore SW registration errors in unsupported environments
      });
    }

    const onOnline = () => {
      void handleSyncNow();
    };
    const onQueueChange = () => {
      void refreshQueueCount();
    };

    window.addEventListener('online', onOnline);
    window.addEventListener(OFFLINE_QUEUE_EVENT, onQueueChange);

    if (navigator.onLine) {
      replayQueuedMutations()
        .then(async ({ synced }) => {
          if (cancelled) return;
          const count = await getQueuedCount().catch(() => 0);
          if (!cancelled) setPendingCount(count);
          if (synced > 0 && !cancelled) {
            setJustSyncedMsg(`Synced ${synced} offline action${synced > 1 ? 's' : ''}`);
            setTimeout(() => setJustSyncedMsg(''), 4000);
          }
        })
        .catch(() => {
          // Ignore sync errors
        });
    }

    return () => {
      cancelled = true;
      window.removeEventListener('online', onOnline);
      window.removeEventListener(OFFLINE_QUEUE_EVENT, onQueueChange);
    };
  }, [handleSyncNow, refreshQueueCount]);

  if (isOnline && pendingCount === 0 && !justSyncedMsg) {
    return null;
  }

  return (
    <div
      className={
        !isOnline
          ? 'bg-amber-500/15 border-b border-amber-500/30 text-amber-300 px-4 py-2 text-xs font-medium flex items-center justify-between gap-3'
          : pendingCount > 0
          ? 'bg-indigo-500/15 border-b border-indigo-500/30 text-indigo-300 px-4 py-2 text-xs font-medium flex items-center justify-between gap-3'
          : 'bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-300 px-4 py-2 text-xs font-medium flex items-center justify-between gap-3'
      }
    >
      <div className="flex items-center gap-2">
        {!isOnline ? (
          <>
            <WifiOff className="w-4 h-4 flex-shrink-0" />
            <span>
              Offline Mode — cached data is available and new POS sales/changes are queued locally
              {pendingCount > 0 ? ` (${pendingCount} pending)` : ''}.
            </span>
          </>
        ) : pendingCount > 0 ? (
          <>
            <RefreshCw className={`w-4 h-4 flex-shrink-0 ${syncing ? 'animate-spin' : ''}`} />
            <span>{pendingCount} offline change{pendingCount > 1 ? 's' : ''} ready to sync.</span>
          </>
        ) : (
          <>
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{justSyncedMsg}</span>
          </>
        )}
      </div>

      {isOnline && pendingCount > 0 && (
        <button
          onClick={handleSyncNow}
          disabled={syncing}
          className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors disabled:opacity-50"
        >
          {syncing ? 'Syncing...' : 'Sync Now'}
        </button>
      )}
    </div>
  );
};
