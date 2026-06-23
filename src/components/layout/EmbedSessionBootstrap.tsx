"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { bootstrapEmbedSession } from "@/lib/embed-api-client";

/** Runs once in embed mode: persist session token and patch fetch for all API calls. */
export function EmbedSessionBootstrap() {
  const searchParams = useSearchParams();
  const embed = searchParams.get("embed");

  useEffect(() => {
    bootstrapEmbedSession(embed);
  }, [embed]);

  return null;
}
