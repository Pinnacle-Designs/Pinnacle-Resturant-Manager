"use client";

import { useCallback, useEffect, useRef } from "react";
import { clientFetch } from "@/lib/embed-api-client";

const POLL_MS = 5000;

/** Poll menu revision — keeps POS, orders, and BOH in sync when items are 86'd or stock changes. */
export function useMenuSync(
  menuRevision: number | undefined,
  onChanged: () => void,
  enabled = true
) {
  const revisionRef = useRef(menuRevision ?? 0);
  const onChangedRef = useRef(onChanged);

  useEffect(() => {
    onChangedRef.current = onChanged;
  }, [onChanged]);

  useEffect(() => {
    if (menuRevision !== undefined) {
      revisionRef.current = menuRevision;
    }
  }, [menuRevision]);

  const poll = useCallback(async () => {
    try {
      const res = await clientFetch(`/api/boh/sync?since=${revisionRef.current}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.changed) {
        revisionRef.current = data.menuRevision;
        onChangedRef.current();
      }
    } catch {
      /* ignore transient network errors */
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(poll, POLL_MS);
    return () => window.clearInterval(id);
  }, [enabled, poll]);
}
