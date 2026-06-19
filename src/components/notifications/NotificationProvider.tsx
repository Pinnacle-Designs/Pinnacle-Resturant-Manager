"use client";

import { useEffect } from "react";
import { showCriticalNotifications, type CriticalInsight } from "@/lib/notifications";
import { useAuth } from "@/components/auth/AuthProvider";
import { parseJsonResponse } from "@/lib/fetch-json";
import { registerPwaServiceWorker } from "@/lib/pwa";

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user, loading, can } = useAuth();

  useEffect(() => {
    void registerPwaServiceWorker();
  }, []);

  useEffect(() => {
    if (loading || !user || !can("view_insights")) return;

    fetch("/api/insights/critical")
      .then(async (res) => {
        if (!res.ok) return null;
        return parseJsonResponse<{ insights?: CriticalInsight[] }>(res);
      })
      .then((data) => {
        const insights = data?.insights;
        if (insights && insights.length > 0) {
          showCriticalNotifications(insights);
        }
      })
      .catch(console.error);
  }, [loading, user]);

  return <>{children}</>;
}
