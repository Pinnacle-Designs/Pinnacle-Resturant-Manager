"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  bootstrapEmbedSession,
  ensureEmbedUrlHasSession,
  getEmbedSessionToken,
} from "@/lib/embed-api-client";
import { useAuth } from "@/components/auth/AuthProvider";

/** Runs in embed mode: persist session token, patch fetch, sync URL, refresh auth. */
export function EmbedSessionBootstrap() {
  const searchParams = useSearchParams();
  const embed = searchParams.get("embed");
  const st = searchParams.get("_st");
  const { refresh } = useAuth();

  useEffect(() => {
    bootstrapEmbedSession(embed);
    ensureEmbedUrlHasSession();

    if (getEmbedSessionToken()) {
      void refresh();
    }
  }, [embed, st, refresh]);

  return null;
}
