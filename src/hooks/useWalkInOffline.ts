"use client";

import { useCallback, useEffect, useState } from "react";

const DB_NAME = "pinnacle-walk-in";
const STORE = "offline-queue";
const CATALOG_KEY = "catalog-cache";

interface QueuedAction {
  id: string;
  type: "count-line" | "waste";
  sessionId: string;
  payload: Record<string, unknown>;
  createdAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAllQueued(): Promise<QueuedAction[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as QueuedAction[]);
    req.onerror = () => reject(req.error);
  });
}

async function putQueued(action: QueuedAction) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(action);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function removeQueued(id: string) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function useWalkInOffline(sessionId: string | null) {
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [catalog, setCatalog] = useState<unknown[]>([]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const refreshPending = useCallback(async () => {
    const items = await getAllQueued();
    setPendingCount(items.length);
  }, []);

  useEffect(() => {
    refreshPending();
    const cached = localStorage.getItem(CATALOG_KEY);
    if (cached) {
      try {
        setCatalog(JSON.parse(cached));
      } catch {
        /* ignore */
      }
    }
  }, [refreshPending]);

  const cacheCatalog = useCallback(async () => {
    try {
      const res = await fetch("/api/walk-in/catalog");
      if (!res.ok) return;
      const data = await res.json();
      localStorage.setItem(CATALOG_KEY, JSON.stringify(data.items ?? []));
      setCatalog(data.items ?? []);
    } catch {
      /* offline — use existing cache */
    }
  }, []);

  const queueCountLine = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!sessionId) return;
      const action: QueuedAction = {
        id: crypto.randomUUID(),
        type: "count-line",
        sessionId,
        payload,
        createdAt: Date.now(),
      };
      await putQueued(action);
      await refreshPending();
    },
    [sessionId, refreshPending]
  );

  const syncQueue = useCallback(async () => {
    if (!sessionId || !navigator.onLine) return { synced: 0, failed: 0 };
    const items = await getAllQueued();
    let synced = 0;
    let failed = 0;

    const forSession = items.filter((i) => i.sessionId === sessionId);
    if (forSession.length === 0) return { synced: 0, failed: 0 };

    try {
      const res = await fetch("/api/walk-in/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          lines: forSession
            .filter((i) => i.type === "count-line")
            .map((i) => i.payload),
        }),
      });
      if (res.ok) {
        for (const item of forSession) {
          await removeQueued(item.id);
          synced++;
        }
      } else {
        failed = forSession.length;
      }
    } catch {
      failed = forSession.length;
    }

    await refreshPending();
    return { synced, failed };
  }, [sessionId, refreshPending]);

  useEffect(() => {
    if (online && sessionId) {
      syncQueue();
    }
  }, [online, sessionId, syncQueue]);

  return {
    online,
    pendingCount,
    catalog,
    cacheCatalog,
    queueCountLine,
    syncQueue,
  };
}
